import { authenticate } from '../permissions/index.js';
import { ReferralService } from '../../../modules/referral/referral.service.js';

export const referralResolvers = {
  UserReferral: {
    referrer: async (parent, args, context) => {
      if (parent.referrer) return parent.referrer;
      return await context.models.User.findByPk(parent.referrerId);
    }
  },

  Testimonial: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    }
  },

  AmbassadorApplication: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    },
    socialLinks: (parent) => {
      return JSON.stringify(parent.socialLinks || {});
    }
  },

  Query: {
    getMyReferrals: authenticate(async (parent, args, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.getMyReferrals(context.viewer);
    }),
    getReferralsReport: authenticate(async (parent, args, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.getReferralsReport(context.viewer);
    }),
    getTestimonials: authenticate(async (parent, { statusFilter }, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.getTestimonials(context.viewer, statusFilter);
    }),
    getAmbassadorApplications: authenticate(async (parent, args, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.getAmbassadorApplications(context.viewer);
    })
  },

  Mutation: {
    submitReferral: authenticate(async (parent, args, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.submitReferral(context.viewer, args);
    }),
    convertReferral: authenticate(async (parent, { referralId, pointsAwarded }, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.convertReferral(context.viewer, referralId, pointsAwarded);
    }),
    submitTestimonial: authenticate(async (parent, args, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.submitTestimonial(context.viewer, args);
    }),
    moderateTestimonial: authenticate(async (parent, { id, status }, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.moderateTestimonial(context.viewer, id, status);
    }),
    applyForAmbassador: authenticate(async (parent, { socialLinksJson, reason }, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.applyForAmbassador(context.viewer, {
        reason,
        socialLinks: JSON.parse(socialLinksJson)
      });
    }),
    moderateAmbassadorApplication: authenticate(async (parent, { id, status }, context) => {
      const service = new ReferralService(context.models, context.sequelize);
      return service.moderateAmbassadorApplication(context.viewer, id, status);
    })
  }
};
