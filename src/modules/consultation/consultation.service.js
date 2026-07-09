import { z } from 'zod';

export const submitNotesSchema = z.object({
  bookingId: z.string().uuid(),
  caseNotes: z.string().min(1).max(2000),
  followUpTasks: z.array(z.string()).optional(),
  prescriptions: z.string().optional(),
  followUpDate: z.string().optional(),
  documents: z.string().optional()
});

export class ConsultationService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async submitIntakeForm(userId, { bookingId, symptoms, gestationalWeeks, concerns, medicalHistory }) {
    const booking = await this.models.ConsultationBooking.findOne({
      where: { id: bookingId, userId }
    });

    if (!booking) {
      throw new Error('Consultation booking not found or unauthorized');
    }

    booking.intakeForm = {
      symptoms,
      gestationalWeeks,
      concerns,
      medicalHistory
    };

    await booking.save();
    return booking;
  }

  async submitCaseNotes(expertId, input) {
    const { bookingId, caseNotes, followUpTasks = [], prescriptions, followUpDate, documents } = submitNotesSchema.parse(input);

    const booking = await this.models.ConsultationBooking.findOne({
      where: { id: bookingId, expertId }
    });

    if (!booking) {
      throw new Error('Consultation booking not found or unauthorized');
    }

    let parsedPrescriptions = null;
    if (prescriptions) {
      try {
        parsedPrescriptions = JSON.parse(prescriptions);
        if (!Array.isArray(parsedPrescriptions)) {
          throw new Error('Prescriptions must be an array');
        }
      } catch (err) {
        throw new Error('Invalid prescriptions format');
      }
    }

    let parsedDocs = null;
    if (documents) {
      try {
        parsedDocs = JSON.parse(documents);
        if (!Array.isArray(parsedDocs)) {
          throw new Error('Documents must be an array');
        }
      } catch (err) {
        throw new Error('Invalid documents format');
      }
    }

    booking.caseNotes = caseNotes;
    booking.followUpTasks = JSON.stringify(followUpTasks);
    if (prescriptions) {
      booking.prescriptions = parsedPrescriptions;
    }
    if (documents) {
      booking.documents = parsedDocs;
    }
    if (followUpDate) {
      booking.followUpDate = followUpDate || null;
    }

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
