import { z } from 'zod';

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

  async getLiveClasses(userId) {
    const classes = await this.models.LiveClass.findAll({
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
}
