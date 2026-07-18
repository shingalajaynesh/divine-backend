import { v4 as uuidv4 } from 'uuid';

export class ReferralService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // --- REFERRALS ---

  async submitReferral(viewer, input) {
    if (!viewer || !viewer.id) throw new Error('Authentication required');

    const { refereeName, refereeEmail, refereePhone } = input;

    if (!refereeName || !refereeName.trim()) throw new Error('Referee name is required');
    if (!refereePhone || !refereePhone.trim()) throw new Error('Referee phone number is required');

    // Prevent self-referral
    if (refereeEmail && viewer.emailAddress && refereeEmail.trim().toLowerCase() === viewer.emailAddress.trim().toLowerCase()) {
      throw new Error('You cannot refer yourself.');
    }
    if (refereePhone && viewer.mobileNo && refereePhone.trim() === viewer.mobileNo.trim()) {
      throw new Error('You cannot refer yourself.');
    }

    return this.models.UserReferral.create({
      id: uuidv4(),
      referrerId: viewer.id,
      refereeName: refereeName.trim(),
      refereeEmail: refereeEmail?.trim() || null,
      refereePhone: refereePhone.trim(),
      status: 'pending',
      rewardPoints: 0
    });
  }

  async getMyReferrals(viewer) {
    if (!viewer || !viewer.id) throw new Error('Authentication required');

    return this.models.UserReferral.findAll({
      where: { referrerId: viewer.id },
      order: [['createdAt', 'DESC']]
    });
  }

  async getReferralsReport(viewer) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    return this.models.UserReferral.findAll({
      include: [
        {
          model: this.models.User,
          as: 'referrer',
          attributes: ['id', 'displayName', 'emailAddress', 'mobileNo']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async convertReferral(viewer, referralId, pointsAwarded) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const ref = await this.models.UserReferral.findByPk(referralId);
    if (!ref) throw new Error('Referral record not found');

    return ref.update({
      status: 'converted',
      rewardPoints: pointsAwarded || 100
    });
  }

  // --- TESTIMONIALS ---

  async submitTestimonial(viewer, input) {
    if (!viewer || !viewer.id) throw new Error('Authentication required');

    const { content, rating } = input;

    if (!content || !content.trim()) throw new Error('Content is required');
    if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

    return this.models.Testimonial.create({
      id: uuidv4(),
      userId: viewer.id,
      content: content.trim(),
      rating,
      status: 'pending'
    });
  }

  async getTestimonials(viewer, statusFilter) {
    const isStaff = viewer.role?.roleType === 'ADMIN' || viewer.role?.roleType === 'STAFF';

    const where = {};
    if (!isStaff) {
      where.status = 'approved';
    } else if (statusFilter) {
      where.status = statusFilter;
    }

    return this.models.Testimonial.findAll({
      where,
      include: [
        {
          model: this.models.User,
          as: 'user',
          attributes: ['id', 'displayName', 'emailAddress']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async moderateTestimonial(viewer, id, status) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status for moderation');
    }

    const testimonial = await this.models.Testimonial.findByPk(id);
    if (!testimonial) throw new Error('Testimonial not found');

    return testimonial.update({
      status,
      approvedBy: viewer.id
    });
  }

  // --- AMBASSADOR APPLICATIONS ---

  async applyForAmbassador(viewer, input) {
    if (!viewer || !viewer.id) throw new Error('Authentication required');

    const { socialLinks, reason } = input;

    if (!reason || !reason.trim()) throw new Error('Reason for applying is required');

    // Check duplicate pending application
    const existing = await this.models.AmbassadorApplication.findOne({
      where: { userId: viewer.id, status: 'pending' }
    });
    if (existing) {
      throw new Error('You already have a pending application');
    }

    return this.models.AmbassadorApplication.create({
      id: uuidv4(),
      userId: viewer.id,
      socialLinks: socialLinks || {},
      reason: reason.trim(),
      status: 'pending'
    });
  }

  async getAmbassadorApplications(viewer) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    return this.models.AmbassadorApplication.findAll({
      include: [
        {
          model: this.models.User,
          as: 'user',
          attributes: ['id', 'displayName', 'emailAddress', 'mobileNo']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async moderateAmbassadorApplication(viewer, id, status) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status for moderation');
    }

    const app = await this.models.AmbassadorApplication.findByPk(id);
    if (!app) throw new Error('Application not found');

    return app.update({ status });
  }
}
