import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RazorpayClient } from '../payment/razorpay.client.js';
import { verifyRazorpayCheckoutSignature } from '../payment/razorpaySignature.service.js';
import { CHECKOUT_STATUS, PAYMENT_STATUS, setCheckoutStatus, setPaymentStatus } from '../payment/paymentState.js';

const SUBSCRIPTION_PURPOSE = 'subscription_purchase';
const CHECKOUT_EXPIRY_MINUTES = 15;
const CURRENCY_INR = 'INR';

const razorpayOrderIdSchema = z.string().min(6).max(100).regex(/^order_[A-Za-z0-9_]+$/);
const razorpayPaymentIdSchema = z.string().min(6).max(100).regex(/^pay_[A-Za-z0-9_]+$/);
const razorpaySignatureSchema = z.string().min(10).max(256).regex(/^[a-fA-F0-9]+$/);

const decimalToMinorUnits = (value) => {
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new Error('Invalid monetary amount configured for subscription plan');
  }
  const rupees = Number.parseInt(match[1], 10);
  const paise = Number.parseInt((match[2] || '').padEnd(2, '0'), 10) || 0;
  return (rupees * 100) + paise;
};

const minorUnitsToDecimal = (amountMinor) => (amountMinor / 100).toFixed(2);

const addBillingPeriod = (fromDate, billingPeriod) => {
  const periodEnd = new Date(fromDate);
  if (billingPeriod === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  return periodEnd;
};

const makeReceipt = (checkoutId) => `dgs_sub_${checkoutId.replace(/-/g, '').slice(0, 24)}`;

export class SubscriptionService {
  constructor(models, sequelize, razorpayClient = new RazorpayClient()) {
    this.models = models;
    this.sequelize = sequelize;
    this.razorpayClient = razorpayClient;
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
    if (!code || !code.trim()) throw new Error('Promo coupon code not found or invalid');
    const c = await this.models.Coupon.findOne({
      where: { code: code.trim().toUpperCase() }
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

  async loadValidCoupon(code, transaction) {
    if (!code || !code.trim()) return null;
    const coupon = await this.models.Coupon.findOne({
      where: { code: code.trim().toUpperCase() },
      transaction
    });
    if (!coupon) throw new Error('Invalid promo coupon');

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new Error('Promo coupon is expired');
    }
    if (coupon.maxRedemptions && coupon.redemptionsCount >= coupon.maxRedemptions) {
      throw new Error('Promo coupon redemptions limit reached');
    }
    return coupon;
  }

  calculateCheckoutAmountMinor(plan, coupon) {
    const planAmountMinor = decimalToMinorUnits(plan.price);
    if (planAmountMinor <= 0) {
      throw new Error('Subscription plan is not purchasable');
    }

    if (!coupon) return planAmountMinor;

    if (coupon.discountPercent) {
      const discountMinor = Math.round(planAmountMinor * (coupon.discountPercent / 100));
      return Math.max(0, planAmountMinor - discountMinor);
    }

    if (coupon.discountAmount) {
      return Math.max(0, planAmountMinor - decimalToMinorUnits(coupon.discountAmount));
    }

    return planAmountMinor;
  }

  // 4. Upgrade / Subscribe checkout (no payment gateways)
  async subscribe(userId, planId, couponCode) {
    throw new Error('Direct paid subscription activation is disabled. Please use Razorpay checkout.');
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
    if (plan.isActive === false) throw new Error('Subscription plan is not active');

    const user = await this.models.User.findByPk(userId);
    const centerId = user?.centerId || null;
    const coupon = await this.loadValidCoupon(couponCode);
    const amountInPaise = this.calculateCheckoutAmountMinor(plan, coupon);

    const checkoutId = uuidv4();
    const receipt = makeReceipt(checkoutId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHECKOUT_EXPIRY_MINUTES * 60 * 1000);

    const checkout = await this.models.PaymentCheckoutIntent.create({
      id: checkoutId,
      userId,
      centerId,
      subscriptionPlanId: plan.id,
      couponId: coupon?.id || null,
      expectedAmountMinor: amountInPaise,
      currency: CURRENCY_INR,
      purpose: SUBSCRIPTION_PURPOSE,
      status: CHECKOUT_STATUS.CREATED,
      receipt,
      expiresAt
    });

    let order;
    try {
      order = await this.razorpayClient.createOrder({
        amount: amountInPaise,
        currency: CURRENCY_INR,
        receipt,
        notes: {
          checkout_id: checkoutId,
          user_id: userId,
          plan_id: plan.id,
          purpose: SUBSCRIPTION_PURPOSE
        }
      });
    } catch (err) {
      checkout.status = CHECKOUT_STATUS.FAILED;
      checkout.failureReason = 'Razorpay order creation failed';
      await checkout.save();
      throw new Error(`Razorpay API request failed: ${err.message}`);
    }
    const orderId = order.id;

    await this.sequelize.transaction(async (t) => {
      checkout.razorpayOrderId = orderId;
      checkout.status = CHECKOUT_STATUS.ORDER_CREATED;
      await checkout.save({ transaction: t });

      const payment = await this.models.Payment.create({
        id: uuidv4(),
        userId,
        amount: minorUnitsToDecimal(amountInPaise),
        amountMinor: amountInPaise,
        currency: CURRENCY_INR,
        status: PAYMENT_STATUS.PENDING,
        providerStatus: order.status || 'created',
        razorpayOrderId: orderId,
        checkoutIntentId: checkout.id
      }, { transaction: t });

      checkout.paymentId = payment.id;
      await checkout.save({ transaction: t });
    });

    return {
      id: orderId,
      amount: amountInPaise,
      currency: CURRENCY_INR,
      receipt
    };
  }

  // 8. Verify Razorpay Payment and upgrade user
  async verifyRazorpayPayment(userId, planIdOrRazorpayOrderId, maybeRazorpayOrderId, maybeRazorpayPaymentId, maybeRazorpaySignature) {
    const hasLegacyPlanArg = maybeRazorpaySignature !== undefined;
    const razorpayOrderId = hasLegacyPlanArg ? maybeRazorpayOrderId : planIdOrRazorpayOrderId;
    const razorpayPaymentId = hasLegacyPlanArg ? maybeRazorpayPaymentId : maybeRazorpayOrderId;
    const razorpaySignature = hasLegacyPlanArg ? maybeRazorpaySignature : maybeRazorpayPaymentId;

    const { keySecret, allowMock } = this.getRazorpayCredentials();
    const parsedOrderId = razorpayOrderIdSchema.parse(razorpayOrderId);
    const parsedPaymentId = razorpayPaymentIdSchema.parse(razorpayPaymentId);
    const parsedSignature = allowMock
      ? z.string().min(5).max(256).parse(razorpaySignature)
      : razorpaySignatureSchema.parse(razorpaySignature);

    if (!verifyRazorpayCheckoutSignature({
      orderId: parsedOrderId,
      paymentId: parsedPaymentId,
      signature: parsedSignature,
      secret: keySecret,
      allowMock,
    })) {
      throw new Error('Invalid Razorpay signature verification');
    }

    const checkoutForProvider = await this.models.PaymentCheckoutIntent.findOne({
      where: { razorpayOrderId: parsedOrderId },
    });
    if (!checkoutForProvider) throw new Error('Payment checkout record not found');
    if (checkoutForProvider.userId !== userId) throw new Error('Payment checkout does not belong to this user');
    if (checkoutForProvider.purpose !== SUBSCRIPTION_PURPOSE) throw new Error('Unsupported payment checkout purpose');
    if (new Date(checkoutForProvider.expiresAt) < new Date() && checkoutForProvider.status !== CHECKOUT_STATUS.PAID) {
      checkoutForProvider.status = CHECKOUT_STATUS.EXPIRED;
      checkoutForProvider.failureReason = 'Payment checkout expired before verification';
      await checkoutForProvider.save();
      throw new Error('Payment checkout has expired');
    }

    const providerPayment = await this.razorpayClient.fetchPayment(parsedPaymentId, {
      expectedOrderId: parsedOrderId,
      expectedAmountMinor: checkoutForProvider.expectedAmountMinor,
      expectedCurrency: CURRENCY_INR,
    });

    if (providerPayment.order_id && providerPayment.order_id !== parsedOrderId) {
      throw new Error('Razorpay payment does not belong to the checkout order');
    }
    if (providerPayment.status !== 'captured') {
      await this.markClientVerifiedPayment({
        userId,
        razorpayOrderId: parsedOrderId,
        razorpayPaymentId: parsedPaymentId,
        signature: parsedSignature,
      });
      throw new Error('Payment is pending provider capture. Please refresh your subscription status shortly.');
    }

    const result = await this.confirmCapturedSubscriptionPayment({
      userId,
      razorpayOrderId: parsedOrderId,
      razorpayPaymentId: parsedPaymentId,
      amountMinor: providerPayment.amount,
      currency: providerPayment.currency,
      providerStatus: providerPayment.status,
      signature: parsedSignature,
      source: 'client_verification_provider_fetch',
    });

    return result.subscription;
  }

  async markClientVerifiedPayment({ userId, razorpayOrderId, razorpayPaymentId, signature }) {
    return this.sequelize.transaction(async (t) => {
      const checkout = await this.models.PaymentCheckoutIntent.findOne({
        where: { razorpayOrderId },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!checkout) throw new Error('Payment checkout record not found');
      if (checkout.userId !== userId) throw new Error('Payment checkout does not belong to this user');
      if (checkout.purpose !== SUBSCRIPTION_PURPOSE) throw new Error('Unsupported payment checkout purpose');
      const payment = await this.models.Payment.findOne({
        where: { checkoutIntentId: checkout.id, userId },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!payment) throw new Error('Pending payment record not found');

      if (checkout.status === CHECKOUT_STATUS.ORDER_CREATED) {
        setCheckoutStatus(checkout, CHECKOUT_STATUS.CLIENT_VERIFIED);
      }
      checkout.razorpayPaymentId = razorpayPaymentId;
      checkout.verifiedAt = new Date();
      await checkout.save({ transaction: t });

      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = signature;
      await payment.save({ transaction: t });
      return checkout;
    });
  }

  async markAuthorizedPayment({ razorpayOrderId, razorpayPaymentId, providerStatus, transaction }) {
    const checkout = await this.models.PaymentCheckoutIntent.findOne({
      where: { razorpayOrderId },
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
    if (!checkout) return null;
    const payment = await this.models.Payment.findOne({
      where: { checkoutIntentId: checkout.id },
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
    if (payment && [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AUTHORIZED].includes(payment.status)) {
      setPaymentStatus(payment, PAYMENT_STATUS.AUTHORIZED);
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.providerStatus = providerStatus || 'authorized';
      await payment.save({ transaction });
    }
    checkout.razorpayPaymentId = razorpayPaymentId || checkout.razorpayPaymentId;
    checkout.providerStatus = providerStatus || 'authorized';
    await checkout.save({ transaction });
    return checkout;
  }

  async markFailedPayment({ razorpayOrderId, razorpayPaymentId, providerStatus, failureReason, transaction }) {
    const checkout = await this.models.PaymentCheckoutIntent.findOne({
      where: { razorpayOrderId },
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
    if (!checkout || [CHECKOUT_STATUS.PAID, CHECKOUT_STATUS.REFUNDED, CHECKOUT_STATUS.PARTIALLY_REFUNDED].includes(checkout.status)) {
      return checkout;
    }

    const payment = await this.models.Payment.findOne({
      where: { checkoutIntentId: checkout.id },
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
    if (payment && ![PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(payment.status)) {
      setPaymentStatus(payment, PAYMENT_STATUS.FAILED);
      payment.razorpayPaymentId = razorpayPaymentId || payment.razorpayPaymentId;
      payment.providerStatus = providerStatus || 'failed';
      await payment.save({ transaction });
    }

    setCheckoutStatus(checkout, CHECKOUT_STATUS.FAILED);
    checkout.razorpayPaymentId = razorpayPaymentId || checkout.razorpayPaymentId;
    checkout.providerStatus = providerStatus || 'failed';
    checkout.failureReason = String(failureReason || 'Razorpay payment failed').slice(0, 500);
    await checkout.save({ transaction });
    return checkout;
  }

  async confirmCapturedSubscriptionPayment({ userId, razorpayOrderId, razorpayPaymentId, amountMinor, currency, providerStatus, signature, source, transaction }) {
    const run = async (t) => {
      const checkout = await this.models.PaymentCheckoutIntent.findOne({
        where: { razorpayOrderId },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!checkout) throw new Error('Payment checkout record not found');
      if (userId && checkout.userId !== userId) throw new Error('Payment checkout does not belong to this user');
      if (checkout.purpose !== SUBSCRIPTION_PURPOSE) throw new Error('Unsupported payment checkout purpose');

      if (amountMinor !== undefined && Number(amountMinor) !== Number(checkout.expectedAmountMinor)) {
        throw new Error('Razorpay payment amount does not match checkout intent');
      }
      if (currency && currency !== checkout.currency) {
        throw new Error('Razorpay payment currency does not match checkout intent');
      }

      const payment = await this.models.Payment.findOne({
        where: { checkoutIntentId: checkout.id },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!payment) throw new Error('Pending payment record not found');
      if (payment.razorpayPaymentId && payment.razorpayPaymentId !== razorpayPaymentId) {
        throw new Error('Payment checkout has already been processed for a different payment');
      }

      // Upsert user subscription
      const plan = await this.models.SubscriptionPlan.findByPk(checkout.subscriptionPlanId, { transaction: t });
      if (!plan) throw new Error('Plan not found');

      let sub = await this.models.UserSubscription.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });

      const now = new Date();
      const periodEnd = addBillingPeriod(now, plan.billingPeriod);

      if (sub) {
        sub.planId = plan.id;
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
          planId: plan.id,
          status: 'active',
          trialStartDate: null,
          trialEndDate: null,
          currentPeriodStartDate: now,
          currentPeriodEndDate: periodEnd
        }, { transaction: t });
      }

      let invoice = await this.models.Invoice.findOne({
        where: { paymentId: payment.id },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!invoice) {
        invoice = await this.models.Invoice.create({
          id: uuidv4(),
          userId,
          subscriptionId: sub.id,
          paymentId: payment.id,
          amount: minorUnitsToDecimal(checkout.expectedAmountMinor),
          status: 'paid',
          invoiceNumber: `INV-${checkout.receipt}`,
          billingDate: now,
          dueDate: now
        }, { transaction: t });
      }

      // Update user subscriptionStatus and get center association
      const user = await this.models.User.findByPk(userId, { transaction: t });
      const centerId = user?.centerId || null;

      if (user) {
        user.subscriptionStatus = plan.name.toLowerCase().includes('premium') ? 'premium' : 'standard';
        await user.save({ transaction: t });
      }

      let financialTransaction = await this.models.FinancialTransaction.findOne({
        where: { paymentId: payment.id, type: 'payment' },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!financialTransaction) {
        const amount = Number(minorUnitsToDecimal(checkout.expectedAmountMinor));
        financialTransaction = await this.models.FinancialTransaction.create({
          id: uuidv4(),
          userId,
          centerId,
          amount,
          type: 'payment',
          status: 'completed',
          centerShare: Number((amount * 0.70).toFixed(2)),
          platformShare: Number((amount * 0.30).toFixed(2)),
          paymentId: payment.id,
          invoiceId: invoice.id
        }, { transaction: t });
      }

      if (checkout.couponId) {
        const existingRedemption = await this.models.CouponRedemption.findOne({
          where: { checkoutIntentId: checkout.id },
          transaction: t,
          lock: t.LOCK?.UPDATE
        });

        if (!existingRedemption) {
          await this.models.CouponRedemption.create({
            id: uuidv4(),
            couponId: checkout.couponId,
            userId,
            checkoutIntentId: checkout.id,
            paymentId: payment.id,
            redeemedAt: now
          }, { transaction: t });

          const coupon = await this.models.Coupon.findByPk(checkout.couponId, {
            transaction: t,
            lock: t.LOCK?.UPDATE
          });
          if (coupon) {
            coupon.redemptionsCount += 1;
            await coupon.save({ transaction: t });
          }
        }
      }

      setPaymentStatus(payment, PAYMENT_STATUS.CAPTURED);
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = signature || payment.razorpaySignature;
      payment.amountMinor = checkout.expectedAmountMinor;
      payment.currency = checkout.currency;
      payment.providerStatus = providerStatus || 'captured';
      await payment.save({ transaction: t });

      if (checkout.status !== CHECKOUT_STATUS.PAID) {
        setCheckoutStatus(checkout, CHECKOUT_STATUS.PAID);
      }
      checkout.razorpayPaymentId = razorpayPaymentId;
      checkout.verifiedAt = checkout.verifiedAt || now;
      checkout.processedAt = now;
      checkout.providerConfirmedAt = now;
      checkout.providerStatus = providerStatus || 'captured';
      checkout.paymentId = payment.id;
      checkout.invoiceId = invoice.id;
      checkout.failureReason = null;
      await checkout.save({ transaction: t });

      return { subscription: sub, checkout, payment, invoice, source };
    };

    return transaction ? run(transaction) : this.sequelize.transaction(run);
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
