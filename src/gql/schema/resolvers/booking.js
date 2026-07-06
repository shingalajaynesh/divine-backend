import { authenticate, authorizeRoles } from '../permissions/index.js';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

export const bookingResolvers = {
  Query: {
    getExpertSchedules: authenticate(async (parent, args, context) => {
      const { models } = context;
      return await models.ExpertSchedule.findAll({
        include: [{
          model: models.User,
          as: 'expert',
          required: true,
          where: { centerId: context.viewer.centerId, isActive: true },
        }],
        order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
      });
    }),

    getExpertBookings: authenticate(async (parent, args, context) => {
      const { models } = context;
      const roleType = context.viewer.role?.roleType;
      if (context.viewer.id !== args.expertId && !['STAFF', 'ADMIN'].includes(roleType)) {
        throw new Error('Unauthorized. You can only view your own bookings.');
      }
      return await models.ConsultationBooking.findAll({
        where: { expertId: args.expertId, status: 'confirmed' },
        include: [{
          model: models.User,
          as: 'expert',
          required: true,
          where: { centerId: context.viewer.centerId },
        }],
      });
    }),

    getMyConsultations: authenticate(async (parent, args, context) => {
      const { models } = context;
      const isExpert = context.viewer.role?.roleType === 'STAFF' || context.viewer.role?.roleType === 'ADMIN';
      const where = isExpert ? { expertId: context.viewer.id } : { userId: context.viewer.id };

      return await models.ConsultationBooking.findAll({
        where,
        include: [
          { model: models.User, as: 'user' },
          { model: models.User, as: 'expert' }
        ],
        order: [['scheduleSlot', 'ASC']]
      });
    })
  },

  Mutation: {
    bookConsultation: authenticate(async (parent, args, context) => {
      const { models, log } = context;
      const { expertId, scheduleSlot } = args;
      const userId = context.viewer.id;

      const expert = await models.User.findOne({
        where: { id: expertId, centerId: context.viewer.centerId, isActive: true },
        include: [{
          model: models.Role,
          as: 'role',
          required: true,
          where: { roleType: { [Op.in]: ['GUIDE', 'STAFF', 'ADMIN'] } },
        }],
      });
      if (!expert) throw new Error('The selected expert is unavailable.');
      if (new Date(scheduleSlot) <= new Date()) throw new Error('Consultation time must be in the future.');

      // 1. Check if the slot is already booked for this expert
      const existing = await models.ConsultationBooking.findOne({
        where: { expertId, scheduleSlot, status: 'confirmed' }
      });

      if (existing) {
        throw new Error('This time slot is already booked. Please choose another time.');
      }

      // 2. Generate a random Jitsi Meet URL for the consultation
      const roomName = `DivineGarbh-Consult-${uuidv4().substring(0, 8)}`;
      const videoCallUrl = `https://meet.jit.si/${roomName}`;

      const booking = await models.ConsultationBooking.create({
        userId,
        expertId,
        scheduleSlot,
        videoCallUrl,
        status: 'confirmed'
      });

      log.info(`Consultation booked successfully for user ${userId} with expert ${expertId} at ${scheduleSlot}`);

      // Fetch complete booking details to return
      return await models.ConsultationBooking.findByPk(booking.id, {
        include: [
          { model: models.User, as: 'user' },
          { model: models.User, as: 'expert' }
        ]
      });
    }),

    cancelConsultation: authenticate(async (parent, args, context) => {
      const { models, log } = context;
      const { bookingId } = args;
      
      const booking = await models.ConsultationBooking.findByPk(bookingId);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      // Allow either the booking user or the expert to cancel the appointment
      if (booking.userId !== context.viewer.id && booking.expertId !== context.viewer.id) {
        throw new Error('Unauthorized. You can only cancel your own appointments.');
      }

      await booking.update({ status: 'cancelled' });
      log.info(`Booking ${bookingId} cancelled by user ${context.viewer.id}`);
      return true;
    }),

    dispatchDailyWhatsAppReminders: authenticate(authorizeRoles(['ADMIN'], async (parent, args, context) => {
      const { models, log } = context;
      const { WhatsAppService } = await import('../../../services/whatsappService.js');
      const wsService = new WhatsAppService(models);

      // Find all active users
      const users = await models.User.findAll({
        where: { isActive: true, centerId: context.viewer.centerId }
      });

      let count = 0;
      for (const u of users) {
        if (!u.lmpDate && !u.dueDate) continue;

        const { calculatePregnancyStats } = await import('../../../util/pregnancy.js');
        const stats = calculatePregnancyStats(u.lmpDate, u.dueDate);
        const dayNum = stats.pregnancyDay || 1;

        // Retrieve daily content for this day number
        const dailyContent = await models.DailyContent.findOne({
          where: { dayNumber: dayNum }
        });

        if (dailyContent) {
          await wsService.sendDailyUpdate(u, dailyContent);
          count++;
        }
      }

      log.info(`Dispatched bilingual daily WhatsApp reminders to ${count} mothers.`);
      return true;
    }))
  }
};
