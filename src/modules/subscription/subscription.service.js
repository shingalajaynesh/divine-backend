import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export class SubscriptionService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  getRazorpayCredentials() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isTestEnv = process.env.NODE_ENV?.includes('test');

    if (isTestEnv) {
      return {
        keyId: keyId || 'mock_key_id',
        keySecret: keySecret || 'mock_key_secret',
        allowMock: true,
      };
    }

    if (!keyId || !keySecret) {
      throw new Error('Razorpay is not configured on the server.');
    }

    return {
      keyId,
      keySecret,
      allowMock: false,
    };
  }

  // 1. Browse Plans
  async getPlans() {
    return this.models.SubscriptionPlan.findAll({
      order: [['price', 'ASC']]
    });
  }

  // 2. Start free trial
  async startTrial(userId, planId) {
    const plan = await this.models.SubscriptionPlan.findByPk(planId);
    if (!plan) throw new Error('Subscription plan not found');

    const existing = await this.models.UserSubscription.findOne({
      where: { userId }
    });
    if (existing) {
      throw new Error('You already have an active subscription or free trial');
    }

    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);

    return this.models.UserSubscription.create({
      userId,
      planId,
      status: 'trialing',
      trialStartDate: now,
      trialEndDate,
      currentPeriodStartDate: now,
      currentPeriodEndDate: trialEndDate
    });
  }

  // 3. Validate Promo Coupon
  async validateCoupon(code) {
    const c = await this.models.Coupon.findOne({
      where: { code: code.toUpperCase() }
    });
    if (!c) throw new Error('Promo coupon code not found or invalid');

    const now = new Date();
    if (now < c.validFrom || now > c.validUntil) {
      throw new Error('Promo coupon code is expired');
    }

    if (c.maxRedemptions && c.redemptionsCount >= c.maxRedemptions) {
      throw new Error('Promo coupon code redemptions limit has been reached');
    }

    return c;
  }

  // 4. Upgrade / Subscribe checkout (no payment gateways)
  async subscribe(userId, planId, couponCode) {
    const plan = await this.models.SubscriptionPlan.findByPk(planId);
    if (!plan) throw new Error('Subscription plan not found');

    return this.sequelize.transaction(async (t) => {
      let finalAmount = parseFloat(plan.price);
      let coupon = null;

      if (couponCode) {
        coupon = await this.models.Coupon.findOne({
          where: { code: couponCode.toUpperCase() },
          transaction: t
        });
        if (!coupon) throw new Error('Invalid promo coupon');
        
        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validUntil) {
          throw new Error('Promo coupon is expired');
        }
        if (coupon.maxRedemptions && coupon.redemptionsCount >= coupon.maxRedemptions) {
          throw new Error('Promo coupon redemptions limit reached');
        }

        // Apply discount
        if (coupon.discountPercent) {
          finalAmount = finalAmount * (1 - coupon.discountPercent / 100);
        } else if (coupon.discountAmount) {
          finalAmount = Math.max(0, finalAmount - parseFloat(coupon.discountAmount));
        }

        // Increment redemption count
        coupon.redemptionsCount += 1;
        await coupon.save({ transaction: t });
      }

      // Upsert user subscription
      let sub = await this.models.UserSubscription.findOne({
        where: { userId },
        transaction: t
      });

      const now = new Date();
      const periodEnd = new Date();
      if (plan.billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (sub) {
        sub.planId = planId;
        sub.status = 'active';
        sub.trialStartDate = null;
        sub.trialEndDate = null;
        sub.currentPeriodStartDate = now;
        sub.currentPeriodEndDate = periodEnd;
        sub.cancelledAt = null;
        await sub.save({ transaction: t });
      } else {
        sub = await this.models.UserSubscription.create({
          userId,
          planId,
          status: 'active',
          trialStartDate: null,
          trialEndDate: null,
          currentPeriodStartDate: now,
          currentPeriodEndDate: periodEnd
        }, { transaction: t });
      }

      // Record transaction invoice
      const payment = await this.models.Payment.create({
        id: uuidv4(),
        userId,
        amount: finalAmount,
        status: 'succeeded'
      }, { transaction: t });

      const invoice = await this.models.Invoice.create({
        id: uuidv4(),
        userId,
        subscriptionId: sub.id,
        paymentId: payment.id,
        amount: finalAmount,
        status: 'paid',
        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        billingDate: now,
        dueDate: now
      }, { transaction: t });

      // Update user subscriptionStatus flag and get center association
      const user = await this.models.User.findByPk(userId, { transaction: t });
      const centerId = user?.centerId || null;

      if (user) {
        user.subscriptionStatus = plan.name.toLowerCase().includes('premium') ? 'premium' : 'standard';
        await user.save({ transaction: t });
      }

      await this.models.FinancialTransaction.create({
        id: uuidv4(),
        userId,
        centerId,
        amount: finalAmount,
        type: 'payment',
        status: 'completed',
        centerShare: finalAmount * 0.70,
        platformShare: finalAmount * 0.30,
        paymentId: payment.id,
        invoiceId: invoice.id
      }, { transaction: t });

      return sub;
    });
  }

  // 5. Cancel Subscription
  async cancelSubscription(userId) {
    const sub = await this.models.UserSubscription.findOne({
      where: { userId }
    });
    if (!sub) throw new Error('No active subscription found');

    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
    await sub.save();
    return sub;
  }

  // 6. Active subscription detail
  async getSubscription(userId) {
    return this.models.UserSubscription.findOne({
      where: { userId },
      include: [{ model: this.models.SubscriptionPlan, as: 'plan' }]
    });
  }

  // 7. Create Razorpay Order via REST
  async createRazorpayOrder(userId, planId, couponCode) {
    const plan = await this.models.SubscriptionPlan.findByPk(planId);
    if (!plan) throw new Error('Subscription plan not found');

    let finalAmount = parseFloat(plan.price);
    if (couponCode) {
      const coupon = await this.models.Coupon.findOne({
        where: { code: couponCode.toUpperCase() }
      });
      if (!coupon) throw new Error('Invalid promo coupon');
      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validUntil) throw new Error('Promo coupon is expired');
      if (coupon.maxRedemptions && coupon.redemptionsCount >= coupon.maxRedemptions) throw new Error('Promo coupon redemptions limit reached');

      if (coupon.discountPercent) {
        finalAmount = finalAmount * (1 - coupon.discountPercent / 100);
      } else if (coupon.discountAmount) {
        finalAmount = Math.max(0, finalAmount - parseFloat(coupon.discountAmount));
      }
    }

    const { keyId, keySecret, allowMock } = this.getRazorpayCredentials();
    const amountInPaise = Math.round(finalAmount * 100);

    // Mock API call is allowed only in the automated test environment.
    let orderId = `order_${Math.random().toString(36).substring(2, 15)}`;
    if (!allowMock) {
      try {
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64'),
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
          })
        });
        if (!response.ok) {
          const errorPayload = await response.text();
          throw new Error(`Razorpay order creation failed: ${errorPayload}`);
        }

        const order = await response.json();
        orderId = order.id;
      } catch (err) {
        throw new Error(`Razorpay API request failed: ${err.message}`);
      }
    }

    // Log pending payment
    await this.models.Payment.create({
      userId,
      amount: finalAmount,
      status: 'pending',
      razorpayOrderId: orderId
    });

    return {
      id: orderId,
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };
  }

  // 8. Verify Razorpay Payment and upgrade user
  async verifyRazorpayPayment(userId, planId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const crypto = await import('crypto');
    return this.sequelize.transaction(async (t) => {
      const payment = await this.models.Payment.findOne({
        where: { razorpayOrderId, userId, status: 'pending' },
        transaction: t
      });
      if (!payment) throw new Error('Payment record not found');

      // Verify signature locally
      const { keySecret, allowMock } = this.getRazorpayCredentials();
      const expected = crypto.createHmac('sha256', keySecret)
                            .update(razorpayOrderId + '|' + razorpayPaymentId)
                            .digest('hex');
      if (expected !== razorpaySignature && !allowMock) {
        throw new Error('Invalid Razorpay signature verification');
      }

      // Update payment
      payment.status = 'succeeded';
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      await payment.save({ transaction: t });

      // Upsert user subscription
      const plan = await this.models.SubscriptionPlan.findByPk(planId, { transaction: t });
      if (!plan) throw new Error('Plan not found');

      let sub = await this.models.UserSubscription.findOne({
        where: { userId },
        transaction: t
      });

      const now = new Date();
      const periodEnd = new Date();
      if (plan.billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (sub) {
        sub.planId = planId;
        sub.status = 'active';
        sub.trialStartDate = null;
        sub.trialEndDate = null;
        sub.currentPeriodStartDate = now;
        sub.currentPeriodEndDate = periodEnd;
        sub.cancelledAt = null;
        await sub.save({ transaction: t });
      } else {
        sub = await this.models.UserSubscription.create({
          userId,
          planId,
          status: 'active',
          trialStartDate: null,
          trialEndDate: null,
          currentPeriodStartDate: now,
          currentPeriodEndDate: periodEnd
        }, { transaction: t });
      }

      // Record invoice receipt
      const invoice = await this.models.Invoice.create({
        id: uuidv4(),
        userId,
        subscriptionId: sub.id,
        paymentId: payment.id,
        amount: payment.amount,
        status: 'paid',
        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        billingDate: now,
        dueDate: now
      }, { transaction: t });

      // Update user subscriptionStatus and get center association
      const user = await this.models.User.findByPk(userId, { transaction: t });
      const centerId = user?.centerId || null;

      if (user) {
        user.subscriptionStatus = plan.name.toLowerCase().includes('premium') ? 'premium' : 'standard';
        await user.save({ transaction: t });
      }

      await this.models.FinancialTransaction.create({
        id: uuidv4(),
        userId,
        centerId,
        amount: parseFloat(payment.amount),
        type: 'payment',
        status: 'completed',
        centerShare: parseFloat(payment.amount) * 0.70,
        platformShare: parseFloat(payment.amount) * 0.30,
        paymentId: payment.id,
        invoiceId: invoice.id
      }, { transaction: t });

      return sub;
    });
  }

  // 9. Entitlement check
  async checkUserEntitlement(userId, featureKey) {
    const sub = await this.models.UserSubscription.findOne({
      where: { 
        userId,
        status: ['active', 'trialing']
      },
      include: [{ model: this.models.SubscriptionPlan, as: 'plan' }]
    });

    if (!sub || !sub.plan) return false;
    
    // Check if plan's features list contains featureKey
    let feats = sub.plan.features || [];
    if (typeof feats === 'string') {
      try {
        feats = JSON.parse(feats);
      } catch {
        feats = [];
      }
    }
    
    return Array.isArray(feats) && feats.includes(featureKey);
  }

  // 10. Invoices Queries
  async getInvoices(userId) {
    return this.models.Invoice.findAll({
      where: { userId },
      include: [
        { model: this.models.UserSubscription, as: 'subscription', include: [{ model: this.models.SubscriptionPlan, as: 'plan' }] },
        { model: this.models.Payment, as: 'payment' }
      ],
      order: [['billingDate', 'DESC']]
    });
  }

  async getAdminInvoices() {
    return this.models.Invoice.findAll({
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.UserSubscription, as: 'subscription', include: [{ model: this.models.SubscriptionPlan, as: 'plan' }] },
        { model: this.models.Payment, as: 'payment' }
      ],
      order: [['billingDate', 'DESC']]
    });
  }

  // 11. Coupons Query
  async getCoupons() {
    return this.models.Coupon.findAll({
      order: [['createdAt', 'DESC']]
    });
  }

  // 12. SubscriptionPlan CRUD for Staff/Admin
  async createSubscriptionPlan(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const { name, description, price, billingPeriod, trialDays, features } = input;
    if (!name || !name.trim()) throw new Error('Plan name is required');
    if (price < 0) throw new Error('Price cannot be negative');
    if (trialDays < 0) throw new Error('Trial days cannot be negative');

    return this.models.SubscriptionPlan.create({
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || null,
      price,
      billingPeriod,
      trialDays,
      features: features || []
    });
  }

  async updateSubscriptionPlan(viewer, id, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const plan = await this.models.SubscriptionPlan.findByPk(id);
    if (!plan) throw new Error('Subscription plan not found');

    const { name, description, price, billingPeriod, trialDays, features } = input;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (price !== undefined) {
      if (price < 0) throw new Error('Price cannot be negative');
      updates.price = price;
    }
    if (billingPeriod !== undefined) updates.billingPeriod = billingPeriod;
    if (trialDays !== undefined) {
      if (trialDays < 0) throw new Error('Trial days cannot be negative');
      updates.trialDays = trialDays;
    }
    if (features !== undefined) updates.features = features;

    return plan.update(updates);
  }

  async deleteSubscriptionPlan(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const plan = await this.models.SubscriptionPlan.findByPk(id);
    if (!plan) throw new Error('Subscription plan not found');

    await plan.destroy();
    return true;
  }

  // 13. Coupon CRUD for Staff/Admin
  async createCoupon(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const { code, discountPercent, discountAmount, validFrom, validUntil, maxRedemptions } = input;
    if (!code || !code.trim()) throw new Error('Coupon code is required');
    if (discountPercent !== undefined && (discountPercent < 0 || discountPercent > 100)) {
      throw new Error('Discount percent must be between 0 and 100');
    }
    if (discountAmount !== undefined && discountAmount < 0) {
      throw new Error('Discount amount cannot be negative');
    }

    return this.models.Coupon.create({
      id: uuidv4(),
      code: code.trim().toUpperCase(),
      discountPercent,
      discountAmount,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      maxRedemptions,
      redemptionsCount: 0
    });
  }

  async deleteCoupon(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const coupon = await this.models.Coupon.findByPk(id);
    if (!coupon) throw new Error('Coupon not found');

    await coupon.destroy();
    return true;
  }

  // 14. Renewals simulation
  async simulateRenewalProcess() {
    const now = new Date();
    // Find active/trialing subscriptions whose current period has ended
    const expiredSubs = await this.models.UserSubscription.findAll({
      where: {
        status: ['active', 'trialing'],
        currentPeriodEndDate: {
          [this.models.Sequelize.Op.lte]: now
        }
      },
      include: [{ model: this.models.SubscriptionPlan, as: 'plan' }]
    });

    const updated = [];
    for (const sub of expiredSubs) {
      await this.sequelize.transaction(async (t) => {
        // Extend period
        const nextPeriodStart = sub.currentPeriodEndDate;
        const nextPeriodEnd = new Date(nextPeriodStart);
        if (sub.plan?.billingPeriod === 'yearly') {
          nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
        } else {
          nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
        }

        const renewalPrice = sub.plan ? parseFloat(sub.plan.price) : 0.0;

        // Create Invoice
        const inv = await this.models.Invoice.create({
          id: uuidv4(),
          userId: sub.userId,
          subscriptionId: sub.id,
          amount: renewalPrice,
          status: 'unpaid',
          invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          billingDate: now,
          dueDate: now
        }, { transaction: t });

        // Simulate automatic renewal payment charge success
        const payment = await this.models.Payment.create({
          id: uuidv4(),
          userId: sub.userId,
          amount: renewalPrice,
          status: 'succeeded'
        }, { transaction: t });

        // Mark invoice paid
        inv.status = 'paid';
        inv.paymentId = payment.id;
        await inv.save({ transaction: t });

        // Extend subscription
        sub.status = 'active';
        sub.trialStartDate = null;
        sub.trialEndDate = null;
        sub.currentPeriodStartDate = nextPeriodStart;
        sub.currentPeriodEndDate = nextPeriodEnd;
        await sub.save({ transaction: t });

        // Record financial transaction for renewal
        const user = await this.models.User.findByPk(sub.userId, { transaction: t });
        const centerId = user?.centerId || null;
        await this.models.FinancialTransaction.create({
          id: uuidv4(),
          userId: sub.userId,
          centerId,
          amount: renewalPrice,
          type: 'payment',
          status: 'completed',
          centerShare: renewalPrice * 0.70,
          platformShare: renewalPrice * 0.30,
          paymentId: payment.id,
          invoiceId: inv.id
        }, { transaction: t });

        updated.push(sub);
      });
    }

    return updated;
  }
}
