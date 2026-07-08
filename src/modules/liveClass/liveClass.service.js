import { z } from 'zod';
import { Op } from 'sequelize';

export const bookClassInputSchema = z.object({
  liveClassId: z.string().uuid()
});

export const submitFeedbackSchema = z.object({
  liveClassId: z.string().uuid(),
  feedbackScore: z.number().int().min(1).max(5),
  feedbackNotes: z.string().max(500).optional()
});

export class LiveClassService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getLiveClasses(userId, viewer) {
    const where = {};
    if (viewer) {
      const isSuperAdmin = viewer.role?.roleType === 'SUPER_ADMIN';
      if (!isSuperAdmin && viewer.centerId) {
        where[Op.or] = [
          { centerId: viewer.centerId },
          { centerId: null }
        ];
      }
    }

    const classes = await this.models.LiveClass.findAll({
      where,
      order: [['startTime', 'ASC']]
    });

    const bookings = await this.models.LiveClassBooking.findAll({
      where: { userId }
    });

    const bookingMap = new Map(bookings.map(b => [b.liveClassId, b]));

    return classes.map(c => {
      const booking = bookingMap.get(c.id);
      return {
        id: c.id,
        titleEn: c.titleEn,
        titleHi: c.titleHi,
        instructor: c.instructor,
        startTime: c.startTime.toISOString(),
        durationMins: c.durationMins,
        videoCallUrl: c.videoCallUrl,
        replayUrl: c.replayUrl,
        centerId: c.centerId,
        seriesTitle: c.seriesTitle,
        batchName: c.batchName,
        booked: !!booking,
        attended: booking ? booking.attended : false,
        feedbackScore: booking ? booking.feedbackScore : null,
        feedbackNotes: booking ? booking.feedbackNotes : null
      };
    });
  }

  async bookLiveClass(userId, liveClassId) {
    const parsedId = z.string().uuid().parse(liveClassId);
    
    const liveClass = await this.models.LiveClass.findByPk(parsedId);
    if (!liveClass) throw new Error('Live class not found');

    let booking = await this.models.LiveClassBooking.findOne({
      where: { userId, liveClassId: parsedId }
    });

    if (!booking) {
      booking = await this.models.LiveClassBooking.create({
        userId,
        liveClassId: parsedId,
        attended: false
      });
    }

    return booking;
  }

  async submitLiveClassFeedback(userId, input) {
    const { liveClassId, feedbackScore, feedbackNotes = '' } = submitFeedbackSchema.parse(input);

    const booking = await this.models.LiveClassBooking.findOne({
      where: { userId, liveClassId }
    });

    if (!booking) throw new Error('Booking not found');

    booking.feedbackScore = feedbackScore;
    booking.feedbackNotes = feedbackNotes;
    booking.attended = true;
    await booking.save();
    return booking;
  }

  async updateReplayUrl(liveClassId, replayUrl) {
    const parsedId = z.string().uuid().parse(liveClassId);
    const parsedUrl = z.string().url().parse(replayUrl);

    const liveClass = await this.models.LiveClass.findByPk(parsedId);
    if (!liveClass) throw new Error('Live class not found');

    liveClass.replayUrl = parsedUrl;
    await liveClass.save();
    return liveClass;
  }

  async createLiveClass(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized');
    }
    const { titleEn, titleHi, instructor, startTime, durationMins, videoCallUrl, seriesTitle, batchName, centerId } = input;
    
    const targetCenterId = centerId || viewer.centerId;

    const liveClass = await this.models.LiveClass.create({
      titleEn,
      titleHi,
      instructor,
      startTime: new Date(startTime),
      durationMins,
      videoCallUrl,
      seriesTitle,
      batchName,
      centerId: targetCenterId
    });

    return liveClass;
  }

  async updateLiveClass(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized');
    }
    const { id, titleEn, titleHi, instructor, startTime, durationMins, videoCallUrl, seriesTitle, batchName, replayUrl } = input;

    const liveClass = await this.models.LiveClass.findByPk(id);
    if (!liveClass) throw new Error('Live class not found');

    if (viewer.role?.roleType !== 'SUPER_ADMIN' && liveClass.centerId && liveClass.centerId !== viewer.centerId) {
      throw new Error('Unauthorized center access');
    }

    if (titleEn !== undefined) liveClass.titleEn = titleEn;
    if (titleHi !== undefined) liveClass.titleHi = titleHi;
    if (instructor !== undefined) liveClass.instructor = instructor;
    if (startTime !== undefined) liveClass.startTime = new Date(startTime);
    if (durationMins !== undefined) liveClass.durationMins = durationMins;
    if (videoCallUrl !== undefined) liveClass.videoCallUrl = videoCallUrl;
    if (seriesTitle !== undefined) liveClass.seriesTitle = seriesTitle;
    if (batchName !== undefined) liveClass.batchName = batchName;
    if (replayUrl !== undefined) liveClass.replayUrl = replayUrl;

    await liveClass.save();
    return liveClass;
  }

  async deleteLiveClass(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized');
    }

    const liveClass = await this.models.LiveClass.findByPk(id);
    if (!liveClass) throw new Error('Live class not found');

    if (viewer.role?.roleType !== 'SUPER_ADMIN' && liveClass.centerId && liveClass.centerId !== viewer.centerId) {
      throw new Error('Unauthorized center access');
    }

    await liveClass.destroy();
    return true;
  }

  async sendLiveClassReminder(viewer, classId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized');
    }

    const liveClass = await this.models.LiveClass.findByPk(classId);
    if (!liveClass) throw new Error('Live class not found');

    const bookings = await this.models.LiveClassBooking.findAll({
      where: { liveClassId: classId },
      include: [{ model: this.models.User, as: 'user' }]
    });

    for (const booking of bookings) {
      const user = booking.user;
      if (!user) continue;

      const title = user.language === 'hi' ? 'लाइव क्लास रिमाइंडर' : 'Live Class Reminder';
      const body = user.language === 'hi'
        ? `आपकी क्लास "${liveClass.titleHi}" जल्द शुरू होगी।`
        : `Your live class "${liveClass.titleEn}" starts soon.`;

      const notification = await this.models.Notification.create({
        userId: user.id,
        title,
        body,
        type: 'reminder',
        status: 'unread'
      });

      await this.models.NotificationDelivery.create({
        notificationId: notification.id,
        userId: user.id,
        channel: 'in_app',
        status: 'delivered',
        deliveredAt: new Date()
      });
    }

    return true;
  }
}
