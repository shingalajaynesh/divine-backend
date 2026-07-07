import { z } from 'zod';

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

      // Update user subscriptionStatus
      const user = await this.models.User.findByPk(userId, { transaction: t });
      if (user) {
        user.subscriptionStatus = plan.name.toLowerCase().includes('premium') ? 'premium' : 'standard';
        await user.save({ transaction: t });
      }

      return sub;
    });
  }
}
