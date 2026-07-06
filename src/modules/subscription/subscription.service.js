import { z } from 'zod';

export class SubscriptionService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
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
}
