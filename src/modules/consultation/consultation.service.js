import { z } from 'zod';

export const submitNotesSchema = z.object({
  bookingId: z.string().uuid(),
  caseNotes: z.string().min(1).max(2000),
  followUpTasks: z.array(z.string()).optional()
});

export class ConsultationService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async submitCaseNotes(expertId, input) {
    const { bookingId, caseNotes, followUpTasks = [] } = submitNotesSchema.parse(input);

    const booking = await this.models.ConsultationBooking.findOne({
      where: { id: bookingId, expertId }
    });

    if (!booking) {
      throw new Error('Consultation booking not found or unauthorized');
    }

    booking.caseNotes = caseNotes;
    booking.followUpTasks = JSON.stringify(followUpTasks);
    await booking.save();
    return booking;
  }

  async getPrescriptionSummary(userId) {
    return this.models.ConsultationBooking.findAll({
      where: { userId },
      order: [['scheduleSlot', 'DESC']]
    });
  }
}
