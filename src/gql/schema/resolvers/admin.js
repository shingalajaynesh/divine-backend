import { authenticate } from '../permissions/index.js';
import { Op } from 'sequelize';
import { getAuth } from 'firebase-admin/auth';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { RazorpayClient } from '../../../modules/payment/razorpay.client.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const adminResolvers = {
  Role: {
    permissions: (parent) => {
      if (!parent.permissions) return null;
      if (typeof parent.permissions === 'string') return parent.permissions;
      return JSON.stringify(parent.permissions);
    }
  },

  StaffInvitation: {
    role: async (parent, args, context) => {
      return context.models.Role.findByPk(parent.roleId);
    },
    center: async (parent, args, context) => {
      return context.models.Center.findByPk(parent.centerId);
    },
    creator: async (parent, args, context) => {
      return context.models.User.findByPk(parent.createdBy);
    },
    token: (parent) => {
      return parent.isRaw ? parent.token : 'REDACTED';
    }
  },

  InventoryMovement: {
    product: async (parent, args, context) => {
      return context.models.Product.findByPk(parent.productId);
    },
    center: async (parent, args, context) => {
      if (!parent.centerId) return null;
      return context.models.Center.findByPk(parent.centerId);
    },
    performer: async (parent, args, context) => {
      return context.models.User.findByPk(parent.performedBy);
    },
  },

  PaymentCheckoutIntent: {
    user: async (parent, args, context) => {
      return context.models.User.findByPk(parent.userId);
    },
    plan: async (parent, args, context) => {
      return context.models.SubscriptionPlan.findByPk(parent.subscriptionPlanId);
    },
  },

  PaymentProviderEvent: {
    // Standard direct fields mapping
  },

  Query: {
    getCenterKpis: authenticate(async (parent, args, context) => {
      const { models } = context;
      const role = context.viewer.role?.roleType;

      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const centerId = context.viewer.centerId;
      const userWhere = { isActive: true };
      if (centerId) {
        userWhere.centerId = centerId;
      }

      // 1. Total active mothers count
      const totalMothers = await models.User.count({
        where: userWhere,
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: 'MOTHER' }
        }]
      });

      // 2. Active staff members count (STAFF and GUIDE roles)
      const activeStaff = await models.User.count({
        where: userWhere,
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: { [Op.in]: ['STAFF', 'GUIDE'] } }
        }]
      });

      // 3. Premium enrollments count
      const subUserInclude = {
        model: models.User,
        as: 'user',
      };
      if (centerId) {
        subUserInclude.where = { centerId };
      }
      const premiumEnrollments = await models.UserSubscription.count({
        where: { status: 'active' },
        include: [subUserInclude]
      });

      // 4. SLA breached support tickets
      const now = new Date();
      const ticketUserInclude = {
        model: models.User,
        as: 'user',
      };
      if (centerId) {
        ticketUserInclude.where = { centerId };
      }
      const slaBreachedTickets = await models.SupportTicket.count({
        where: {
          status: { [Op.ne]: 'resolved' },
          [Op.or]: [
            { slaBreached: true },
            { slaExpiresAt: { [Op.lt]: now } }
          ]
        },
        include: [ticketUserInclude]
      });

      // 5. Enrollment Trends (last 4 weeks)
      const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      const trendWhere = {
        inserted: { [Op.gte]: fourWeeksAgo }
      };
      if (centerId) {
        trendWhere.centerId = centerId;
      }
      const usersLast4Weeks = await models.User.findAll({
        where: trendWhere,
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: 'MOTHER' }
        }],
        order: [['inserted', 'ASC']]
      });

      const enrollmentTrend = [];
      for (let i = 3; i >= 0; i--) {
        const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const count = usersLast4Weeks.filter(u => {
          const createdTime = new Date(u.inserted || u.createdAt).getTime();
          return createdTime >= start.getTime() && createdTime < end.getTime();
        }).length;

        enrollmentTrend.push({
          weekLabel: `Week -${i}`,
          count
        });
      }

      // 6. Staff Health & Task Metrics
      const staffWhere = { isActive: true };
      if (centerId) {
        staffWhere.centerId = centerId;
      }
      const staffUsers = await models.User.findAll({
        where: staffWhere,
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: { [Op.in]: ['STAFF', 'GUIDE'] } }
        }]
      });

      const staffHealth = [];
      for (const staff of staffUsers) {
        const pendingTasksCount = await models.StaffTask.count({
          where: { staffId: staff.id, completed: false }
        });
        const completedTasksCount = await models.StaffTask.count({
          where: { staffId: staff.id, completed: true }
        });
        staffHealth.push({
          staffId: staff.id,
          displayName: staff.displayName,
          email: staff.emailAddress || staff.email || '',
          pendingTasksCount,
          completedTasksCount
        });
      }

      // 7. Escalated tickets (High priority or SLA breached, unresolved)
      const escalatedUserInclude = {
        model: models.User,
        as: 'user',
      };
      if (centerId) {
        escalatedUserInclude.where = { centerId };
      }
      const escalatedTickets = await models.SupportTicket.findAll({
        where: {
          status: { [Op.ne]: 'resolved' },
          [Op.or]: [
            { priority: 'high' },
            { slaBreached: true },
            { slaExpiresAt: { [Op.lt]: now } }
          ]
        },
        include: [escalatedUserInclude],
        order: [['createdAt', 'DESC']],
        limit: 5
      });

      return {
        totalMothers,
        activeStaff,
        premiumEnrollments,
        slaBreachedTickets,
        enrollmentTrend,
        staffHealth,
        escalatedTickets
      };
    }),

    getRoles: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }
      return context.models.Role.findAll({ order: [['name', 'ASC']] });
    }),

    adminGetUsers: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN' && roleType !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, search, status, role, centerId, sortField, sortDirection } = args;

      // Bounded pagination
      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (roleType === 'ADMIN' || roleType === 'STAFF') {
        where.centerId = context.viewer.centerId;
      } else if (centerId) {
        where.centerId = centerId;
      }

      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      if (role) {
        where.roleId = role;
      }

      if (search?.trim()) {
        const pattern = `%${search.trim()}%`;
        where[Op.or] = [
          { emailAddress: { [Op.iLike]: pattern } },
          { displayName: { [Op.iLike]: pattern } },
          { firstName: { [Op.iLike]: pattern } },
          { lastName: { [Op.iLike]: pattern } }
        ];
      }

      // Allowlisted sorting
      const allowedSortFields = ['id', 'emailAddress', 'displayName', 'isActive', 'inserted', 'updated'];
      const field = allowedSortFields.includes(sortField) ? sortField : 'inserted';
      const direction = ['ASC', 'DESC'].includes(sortDirection?.toUpperCase()) ? sortDirection.toUpperCase() : 'DESC';

      const { rows, count } = await models.User.findAndCountAll({
        where,
        order: [[field, direction], ['id', 'ASC']],
        limit,
        offset,
        distinct: true
      });

      return { items: rows, total: count };
    }),

    adminGetPayments: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, search, status, centerId } = args;

      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (roleType === 'ADMIN') {
        // Scoped to admin's center
        const centerUsers = await models.User.findAll({
          attributes: ['id'],
          where: { centerId: context.viewer.centerId }
        });
        const userIds = centerUsers.map(u => u.id);
        where.userId = { [Op.in]: userIds };
      } else if (centerId) {
        const centerUsers = await models.User.findAll({
          attributes: ['id'],
          where: { centerId }
        });
        const userIds = centerUsers.map(u => u.id);
        where.userId = { [Op.in]: userIds };
      }

      if (status) {
        where.status = status;
      }

      const userInclude = {
        model: models.User,
        as: 'user',
        required: false
      };

      if (search?.trim()) {
        const pattern = `%${search.trim()}%`;
        userInclude.where = {
          [Op.or]: [
            { emailAddress: { [Op.iLike]: pattern } },
            { displayName: { [Op.iLike]: pattern } }
          ]
        };
        userInclude.required = true;
      }

      const { rows, count } = await models.Payment.findAndCountAll({
        where,
        include: [userInclude],
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        limit,
        offset,
        distinct: true
      });

      return { items: rows, total: count };
    }),

    adminGetCheckoutIntents: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, search, status, centerId } = args;

      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (roleType === 'ADMIN') {
        const centerUsers = await models.User.findAll({
          attributes: ['id'],
          where: { centerId: context.viewer.centerId }
        });
        const userIds = centerUsers.map(u => u.id);
        where.userId = { [Op.in]: userIds };
      } else if (centerId) {
        const centerUsers = await models.User.findAll({
          attributes: ['id'],
          where: { centerId }
        });
        const userIds = centerUsers.map(u => u.id);
        where.userId = { [Op.in]: userIds };
      }

      if (status) {
        where.status = status;
      }

      const userInclude = {
        model: models.User,
        as: 'user',
        required: false
      };

      if (search?.trim()) {
        const pattern = `%${search.trim()}%`;
        userInclude.where = {
          [Op.or]: [
            { emailAddress: { [Op.iLike]: pattern } },
            { displayName: { [Op.iLike]: pattern } }
          ]
        };
        userInclude.required = true;
      }

      const { rows, count } = await models.PaymentCheckoutIntent.findAndCountAll({
        where,
        include: [userInclude],
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        limit,
        offset,
        distinct: true
      });

      return { items: rows, total: count };
    }),

    adminGetProviderEvents: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, search, processingStatus } = args;

      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (processingStatus) {
        where.processingStatus = processingStatus;
      }

      if (search?.trim()) {
        const pattern = `%${search.trim()}%`;
        where[Op.or] = [
          { providerEventId: { [Op.iLike]: pattern } },
          { eventType: { [Op.iLike]: pattern } },
          { razorpayPaymentId: { [Op.iLike]: pattern } },
          { razorpayOrderId: { [Op.iLike]: pattern } }
        ];
      }

      const { rows, count } = await models.PaymentProviderEvent.findAndCountAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        limit,
        offset,
      });

      return { items: rows, total: count };
    }),

    adminGetRefunds: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, status } = args;

      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (status) {
        where.status = status;
      }

      const { rows, count } = await models.PaymentRefund.findAndCountAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        limit,
        offset,
      });

      return { items: rows, total: count };
    }),

    adminGetStaffInvitations: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, search, status, centerId } = args;

      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (roleType === 'ADMIN') {
        where.centerId = context.viewer.centerId;
      } else if (centerId) {
        where.centerId = centerId;
      }

      if (status) {
        where.status = status;
      }

      if (search?.trim()) {
        where.emailAddress = { [Op.iLike]: `%${search.trim()}%` };
      }

      const { rows, count } = await models.StaffInvitation.findAndCountAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        limit,
        offset,
      });

      return { items: rows, total: count };
    }),

    adminGetInventoryMovements: authenticate(async (parent, args, context) => {
      const roleType = context.viewer.role?.roleType;
      if (roleType !== 'ADMIN' && roleType !== 'SUPER_ADMIN' && roleType !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const { models } = context;
      const { page = 1, pageSize = 10, productId, centerId, reasonCode } = args;

      const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
      const offset = Math.max((Number(page) || 1) - 1, 0) * limit;

      const where = {};
      if (roleType === 'ADMIN' || roleType === 'STAFF') {
        where.centerId = context.viewer.centerId;
      } else if (centerId) {
        where.centerId = centerId;
      }

      if (productId) {
        where.productId = productId;
      }

      if (reasonCode) {
        where.reasonCode = reasonCode;
      }

      const { rows, count } = await models.InventoryMovement.findAndCountAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        limit,
        offset,
      });

      return { items: rows, total: count };
    }),
  },

  Mutation: {
    createStaff: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'ADMIN' && creatorRole !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models, sequelize } = context;
      const { emailAddress, displayName, roleId, centerId } = args;
      const targetEmail = emailAddress.trim().toLowerCase();

      // Privilege escalation and scoping checks
      if (creatorRole === 'ADMIN' && centerId !== context.viewer.centerId) {
        throw new Error('Cannot invite staff members to a different center');
      }

      const targetRole = await models.Role.findByPk(roleId);
      if (!targetRole) {
        throw new Error('Target role not found');
      }

      if (targetRole.roleType === 'SUPER_ADMIN' || (targetRole.roleType === 'ADMIN' && creatorRole !== 'SUPER_ADMIN')) {
        throw new Error('Privilege escalation check failed: cannot create administrators of equal or higher tier');
      }

      // Check if email already belongs to a user
      const existingUser = await models.User.findOne({
        where: { emailAddress: targetEmail }
      });
      if (existingUser) {
        throw new Error('A user with this email address already exists');
      }

      // Check duplicate invitation prevention
      const existingInvite = await models.StaffInvitation.findOne({
        where: { emailAddress: targetEmail }
      });
      if (existingInvite) {
        if (existingInvite.status === 'ACTIVE') {
          throw new Error('This staff member is already active');
        }
        if (['INVITED', 'PENDING_ACTIVATION'].includes(existingInvite.status) && existingInvite.expiresAt > new Date()) {
          throw new Error('An invitation is already pending for this email address');
        }
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const finalInvite = await sequelize.transaction(async (t) => {
        // Create local user/staff record with sub = null
        const newUser = await models.User.create({
          id: uuidv4(),
          emailAddress: targetEmail,
          displayName: displayName.trim(),
          isActive: false, // inactive until verified account linking
          centerId,
          roleId,
          sub: null,
          firebaseUid: null,
        }, { transaction: t });

        // Create or overwrite the staff invitation
        let invite;
        if (existingInvite) {
          existingInvite.token = tokenHash;
          existingInvite.expiresAt = expiresAt;
          existingInvite.status = 'INVITED';
          existingInvite.roleId = roleId;
          existingInvite.centerId = centerId;
          existingInvite.createdBy = context.viewer.id;
          invite = await existingInvite.save({ transaction: t });
        } else {
          invite = await models.StaffInvitation.create({
            id: uuidv4(),
            emailAddress: targetEmail,
            roleId,
            centerId,
            token: tokenHash,
            status: 'INVITED',
            expiresAt,
            createdBy: context.viewer.id,
          }, { transaction: t });
        }

        // Record in audit log
        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: 'CREATE_STAFF_INVITATION',
          targetType: 'StaffInvitation',
          targetId: invite.id,
          payload: JSON.stringify({ emailAddress: targetEmail, roleId, centerId, userId: newUser.id }),
          timestamp: new Date(),
        }, { transaction: t });

        // Log the secure activation URL (defer outbound delivery)
        const invitationUrl = `http://localhost:3000/register?token=${rawToken}`;
        context.logger.info(`[STAFF INVITE DEFERRED] Created staff invitation: ${invitationUrl}`);

        return invite;
      });

      const returnedInvite = finalInvite.toJSON ? finalInvite.toJSON() : finalInvite;
      returnedInvite.token = rawToken;
      returnedInvite.isRaw = true;
      return returnedInvite;
    }),

    resendStaffInvitation: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'ADMIN' && creatorRole !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models, sequelize } = context;
      const { invitationId } = args;

      const invite = await models.StaffInvitation.findByPk(invitationId);
      if (!invite) {
        throw new Error('Invitation not found');
      }

      if (creatorRole === 'ADMIN' && invite.centerId !== context.viewer.centerId) {
        throw new Error('Cannot resend invitations for a different center');
      }

      if (invite.status === 'ACTIVE') {
        throw new Error('This invitation has already been accepted and is active');
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const finalInvite = await sequelize.transaction(async (t) => {
        invite.token = tokenHash;
        invite.expiresAt = expiresAt;
        invite.status = 'INVITED';
        await invite.save({ transaction: t });

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: 'RESEND_STAFF_INVITATION',
          targetType: 'StaffInvitation',
          targetId: invite.id,
          payload: JSON.stringify({ emailAddress: invite.emailAddress }),
          timestamp: new Date(),
        }, { transaction: t });

        const invitationUrl = `http://localhost:3000/register?token=${rawToken}`;
        context.logger.info(`[STAFF INVITE RESEND DEFERRED] Resent staff invitation: ${invitationUrl}`);

        return invite;
      });

      const returnedInvite = finalInvite.toJSON ? finalInvite.toJSON() : finalInvite;
      returnedInvite.token = rawToken;
      returnedInvite.isRaw = true;
      return returnedInvite;
    }),

    linkFirebaseStaffAccount: async (parent, args, context) => {
      const { models, sequelize } = context;
      const { token, firebaseIdToken } = args;

      const tokenHash = hashToken(token);
      const invite = await models.StaffInvitation.findOne({ where: { token: tokenHash } });
      if (!invite) {
        throw new Error('Invitation not found');
      }

      if (!['INVITED', 'PENDING_ACTIVATION'].includes(invite.status)) {
        throw new Error('Invitation is not valid or already accepted');
      }

      if (invite.expiresAt < new Date()) {
        invite.status = 'INVITATION_EXPIRED';
        await invite.save();
        throw new Error('Invitation has expired');
      }

      // Verify the Firebase ID token securely
      let decodedToken;
      try {
        decodedToken = await getAuth().verifyIdToken(firebaseIdToken);
      } catch (err) {
        throw new Error(`Firebase token verification failed: ${err.message}`);
      }

      const { uid, email, email_verified } = decodedToken;
      const tokenEmail = email?.trim().toLowerCase();

      if (tokenEmail !== invite.emailAddress.toLowerCase()) {
        throw new Error('Firebase authenticated email does not match the invited email address');
      }

      if (!email_verified) {
        throw new Error('Firebase email address must be verified before activating privileged staff access');
      }

      // Check if UID is already linked to another user
      const linkedUser = await models.User.findOne({ where: { firebaseUid: uid } });
      if (linkedUser) {
        throw new Error('This Firebase account is already linked to another user');
      }

      return sequelize.transaction(async (t) => {
        const localUser = await models.User.findOne({
          where: { emailAddress: invite.emailAddress },
          transaction: t
        });

        if (!localUser) {
          throw new Error('Corresponding staff user record not found');
        }

        if (localUser.firebaseUid) {
          throw new Error('Account is already linked to a Firebase user');
        }

        localUser.firebaseUid = uid;
        localUser.sub = uid;
        localUser.isActive = true;
        await localUser.save({ transaction: t });

        invite.status = 'ACTIVE';
        await invite.save({ transaction: t });

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: localUser.id,
          action: 'LINK_STAFF_FIREBASE_ACCOUNT',
          targetType: 'User',
          targetId: localUser.id,
          payload: JSON.stringify({ firebaseUid: uid, email: tokenEmail }),
          timestamp: new Date(),
        }, { transaction: t });

        return localUser;
      });
    },

    updateUserStatus: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'ADMIN' && creatorRole !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models, sequelize } = context;
      const { id, isActive } = args;

      if (id === context.viewer.id) {
        throw new Error('Cannot modify your own active status');
      }

      const user = await models.User.findByPk(id);
      if (!user) {
        throw new Error('User not found');
      }

      if (creatorRole === 'ADMIN' && user.centerId !== context.viewer.centerId) {
        throw new Error('Cannot modify user status for a different center');
      }

      return sequelize.transaction(async (t) => {
        user.isActive = isActive;
        await user.save({ transaction: t });

        if (!isActive) {
          // If deactivating, cancel any pending invitations for this email
          await models.StaffInvitation.update(
            { status: 'DEACTIVATED' },
            { where: { emailAddress: user.emailAddress }, transaction: t }
          );
        }

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
          targetType: 'User',
          targetId: user.id,
          payload: JSON.stringify({ isActive }),
          timestamp: new Date(),
        }, { transaction: t });

        return user;
      });
    }),

    updateUserRole: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'ADMIN' && creatorRole !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models, sequelize } = context;
      const { id, roleId } = args;

      const user = await models.User.findByPk(id);
      if (!user) {
        throw new Error('User not found');
      }

      if (creatorRole === 'ADMIN' && user.centerId !== context.viewer.centerId) {
        throw new Error('Cannot modify user role for a different center');
      }

      const role = await models.Role.findByPk(roleId);
      if (!role) {
        throw new Error('Target role not found');
      }

      // Prevent privilege escalation
      if (role.roleType === 'SUPER_ADMIN' || (role.roleType === 'ADMIN' && creatorRole !== 'SUPER_ADMIN')) {
        throw new Error('Privilege escalation check failed: cannot assign roles equal or higher than your own');
      }

      return sequelize.transaction(async (t) => {
        user.roleId = roleId;
        await user.save({ transaction: t });

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: 'UPDATE_USER_ROLE',
          targetType: 'User',
          targetId: user.id,
          payload: JSON.stringify({ roleId, roleType: role.roleType }),
          timestamp: new Date(),
        }, { transaction: t });

        return user;
      });
    }),

    updateUserCenter: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized: only Super Administrators can transfer users between centers');
      }

      const { models, sequelize } = context;
      const { id, centerId } = args;

      const user = await models.User.findByPk(id);
      if (!user) {
        throw new Error('User not found');
      }

      const center = await models.Center.findByPk(centerId);
      if (!center) {
        throw new Error('Center not found');
      }

      return sequelize.transaction(async (t) => {
        user.centerId = centerId;
        await user.save({ transaction: t });

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: 'UPDATE_USER_CENTER',
          targetType: 'User',
          targetId: user.id,
          payload: JSON.stringify({ centerId }),
          timestamp: new Date(),
        }, { transaction: t });

        return user;
      });
    }),

    adminCreateRefund: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'ADMIN' && creatorRole !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const { models, sequelize } = context;
      const { paymentId, amountMinor, reason, idempotencyKey } = args;

      if (!reason?.trim()) {
        throw new Error('Refund reason is required');
      }

      if (amountMinor <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }

      // Check if duplicate idempotency key exists
      const existingRefund = await models.PaymentRefund.findOne({
        where: { idempotencyKey }
      });
      if (existingRefund) {
        if (existingRefund.paymentId !== paymentId || Number(existingRefund.requestedAmountMinor) !== Number(amountMinor)) {
          throw new Error('Idempotency key reused with different parameters');
        }
        return existingRefund;
      }

      return sequelize.transaction(async (t) => {
        const payment = await models.Payment.findByPk(paymentId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!payment) throw new Error('Payment not found');
        if (!['captured', 'succeeded', 'partially_refunded'].includes(payment.status)) {
          throw new Error('Only captured payments can be refunded');
        }
        if (!payment.razorpayPaymentId) {
          throw new Error('Payment is missing Razorpay payment reference');
        }

        const capturedAmountMinor = payment.amountMinor || Math.round(parseFloat(payment.amount) * 100);
        const alreadyRefundedMinor = payment.totalRefundedMinor || 0;

        if (alreadyRefundedMinor + amountMinor > capturedAmountMinor) {
          throw new Error('Refund amount exceeds original payment amount');
        }

        // Initiate refund with the payment provider
        const rzp = new RazorpayClient();
        let providerRefund;
        try {
          providerRefund = await rzp.initiateRefund({
            paymentId: payment.razorpayPaymentId,
            amountMinor,
            idempotencyKey,
            receipt: `rcpt_${idempotencyKey.slice(0, 20)}`,
            notes: {
              paymentId: payment.id,
              reason: reason.trim().slice(0, 100),
            }
          });
        } catch (err) {
          throw new Error(`Refund failed at payment gateway: ${err.message}`);
        }

        const refund = await models.PaymentRefund.create({
          id: uuidv4(),
          paymentId: payment.id,
          checkoutIntentId: payment.checkoutIntentId || null,
          razorpayPaymentId: payment.razorpayPaymentId,
          razorpayRefundId: providerRefund.id,
          requestedAmountMinor: amountMinor,
          processedAmountMinor: amountMinor,
          currency: payment.currency || 'INR',
          reason: reason.trim(),
          requestedByUserId: context.viewer.id,
          status: 'processed',
          providerStatus: providerRefund.status || 'processed',
          idempotencyKey,
          requestedAt: new Date(),
        }, { transaction: t });

        // Update payment refunded amount
        payment.totalRefundedMinor = alreadyRefundedMinor + amountMinor;
        payment.status = (payment.totalRefundedMinor >= capturedAmountMinor) ? 'refunded' : 'partially_refunded';
        await payment.save({ transaction: t });

        // Record financial transaction for center/platform share reversing
        const refundAmountDecimal = amountMinor / 100;
        const user = await models.User.findByPk(payment.userId, { transaction: t });
        const centerId = user?.centerId || null;

        await models.FinancialTransaction.create({
          id: uuidv4(),
          userId: payment.userId,
          centerId,
          amount: refundAmountDecimal,
          type: 'refund',
          status: 'succeeded',
          centerShare: refundAmountDecimal * 0.70,
          platformShare: refundAmountDecimal * 0.30,
          paymentId: payment.id,
          reconciliationNotes: reason.trim()
        }, { transaction: t });

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: 'CREATE_REFUND',
          targetType: 'PaymentRefund',
          targetId: refund.id,
          payload: JSON.stringify({ paymentId, amountMinor, reason }),
          timestamp: new Date(),
        }, { transaction: t });

        return refund;
      });
    }),

    adjustInventory: authenticate(async (parent, args, context) => {
      const creatorRole = context.viewer.role?.roleType;
      if (creatorRole !== 'ADMIN' && creatorRole !== 'SUPER_ADMIN' && creatorRole !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const { models, sequelize } = context;
      const { productId, centerId, reasonCode, reasonNote, quantityChange, referenceType, referenceId, idempotencyKey } = args;

      // Scoping
      if ((creatorRole === 'ADMIN' || creatorRole === 'STAFF') && centerId !== context.viewer.centerId) {
        throw new Error('Cannot adjust inventory for a different center');
      }

      // Validated reason codes
      const approvedCodes = [
        'STOCK_RECEIVED', 'CUSTOMER_RETURN', 'DAMAGED', 'EXPIRED', 'LOST',
        'PROMOTIONAL_USE', 'MANUAL_CORRECTION', 'PHYSICAL_AUDIT', 'SUPPLIER_RETURN',
        'ORDER_CANCELLATION', 'RESERVATION_RELEASE', 'OTHER'
      ];
      if (!approvedCodes.includes(reasonCode)) {
        throw new Error(`Invalid inventory adjustment reason code: ${reasonCode}`);
      }

      // Note requirements
      if (reasonCode === 'OTHER' && !reasonNote?.trim()) {
        throw new Error('A reason note is required for reason code OTHER');
      }
      if (['DAMAGED', 'LOST', 'MANUAL_CORRECTION', 'PHYSICAL_AUDIT'].includes(reasonCode)) {
        if (!reasonNote?.trim() || reasonNote.trim().length < 5) {
          throw new Error(`A meaningful reason note (at least 5 characters) is required for reason code ${reasonCode}`);
        }
      }

      // Idempotency check
      const existingMovement = await models.InventoryMovement.findOne({
        where: { requestCorrelationId: idempotencyKey }
      });
      if (existingMovement) {
        if (
          existingMovement.productId !== productId ||
          (centerId && existingMovement.centerId !== centerId) ||
          existingMovement.quantityChange !== quantityChange ||
          existingMovement.reasonCode !== reasonCode
        ) {
          throw new Error('Idempotency key reused with different parameters');
        }
        return existingMovement;
      }

      return sequelize.transaction(async (t) => {
        const product = await models.Product.findByPk(productId, { transaction: t, lock: t.LOCK?.UPDATE });
        if (!product) {
          throw new Error('Product not found');
        }

        const quantityBefore = product.inventoryCount || 0;
        const quantityAfter = quantityBefore + quantityChange;

        if (quantityAfter < 0) {
          throw new Error('Inventory cannot go negative');
        }

        product.inventoryCount = quantityAfter;
        await product.save({ transaction: t });

        const movement = await models.InventoryMovement.create({
          id: uuidv4(),
          productId,
          centerId,
          reasonCode,
          reasonNote: reasonNote?.trim() || null,
          quantityBefore,
          quantityChange,
          quantityAfter,
          referenceType: referenceType || null,
          referenceId: referenceId || null,
          performedBy: context.viewer.id,
          requestCorrelationId: idempotencyKey,
        }, { transaction: t });

        await models.AdminAuditLog.create({
          id: uuidv4(),
          userId: context.viewer.id,
          action: 'ADJUST_INVENTORY',
          targetType: 'Product',
          targetId: productId,
          payload: JSON.stringify({
            productId,
            centerId,
            reasonCode,
            quantityChange,
            quantityBefore,
            quantityAfter
          }),
          timestamp: new Date(),
        }, { transaction: t });

        return movement;
      });
    }),
  }
};
