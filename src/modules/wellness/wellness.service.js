import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const logVitalsSchema = z.object({
  weight: z.number().optional(),
  systolicBp: z.number().int().optional(),
  diastolicBp: z.number().int().optional(),
  kickCount: z.number().int().optional(),
  bloodSugar: z.number().optional(),
  symptoms: z.array(z.string()).optional(),
  mood: z.string().optional(),
  sleepHours: z.number().optional(),
  hydrationWater: z.number().optional(),
  nutritionCalories: z.number().optional(),
  nutritionMealNotes: z.string().optional()
});

export const addAppointmentSchema = z.object({
  title: z.string().min(2).max(100),
  doctorName: z.string().max(100).optional(),
  appointmentDate: z.string(),
  notes: z.string().max(1000).optional()
});

export const addMedicineSchema = z.object({
  name: z.string().min(2).max(100),
  dosage: z.string().min(1).max(50),
  timeOfDay: z.string().max(10)
});

export const addBagItemSchema = z.object({
  itemName: z.string().min(2).max(100),
  category: z.string().max(50).optional()
});

export class WellnessService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // 1. Vitals and Symptoms
  async logVitals(userId, input) {
    const data = logVitalsSchema.parse(input);

    const log = await this.models.VitalsLog.create({
      userId,
      weight: data.weight || null,
      systolicBp: data.systolicBp || null,
      diastolicBp: data.diastolicBp || null,
      kickCount: data.kickCount || null,
      bloodSugar: data.bloodSugar || null,
      symptoms: JSON.stringify(data.symptoms || []),
      mood: data.mood || null,
      sleepHours: data.sleepHours || null,
      hydrationWater: data.hydrationWater || null,
      nutritionCalories: data.nutritionCalories || null,
      nutritionMealNotes: data.nutritionMealNotes || null,
      loggedAt: new Date()
    });

    // Alert verification checks
    const alerts = [];
    if (data.systolicBp >= 140 || data.diastolicBp >= 90) {
      alerts.push(`High Blood Pressure: ${data.systolicBp}/${data.diastolicBp} mmHg`);
    }
    if (data.kickCount !== undefined && data.kickCount !== null && data.kickCount < 10) {
      alerts.push(`Low Fetal Movement: ${data.kickCount} kicks in 2h`);
    }
    if (data.bloodSugar >= 140) {
      alerts.push(`High Blood Sugar: ${data.bloodSugar} mg/dL`);
    }
    const symptomsList = data.symptoms || [];
    const severeSymptoms = symptomsList.filter(s => 
      ['Bleeding', 'Swelling', 'Severe Headache', 'Blurred Vision', 'Severe Abdominal Pain'].includes(s)
    );
    if (severeSymptoms.length > 0) {
      alerts.push(`Severe Symptoms: ${severeSymptoms.join(', ')}`);
    }

    if (alerts.length > 0) {
      let userCenterId = null;
      try {
        const user = await this.models.User.findByPk(userId);
        userCenterId = user?.centerId || null;
      } catch (e) {
        // Safe fallback
      }

      await this.models.Notification.create({
        id: uuidv4(),
        userId,
        centerId: userCenterId,
        kind: 'wellness_alert',
        title: '🚨 Pregnancy Wellness Alert',
        body: `Abnormal readings detected: ${alerts.join('. ')}. Please rest and contact your obstetrician immediately if symptoms persist.`,
        status: 'unread',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return log;
  }

  async getVitals(userId) {
    return this.models.VitalsLog.findAll({
      where: { userId },
      order: [['loggedAt', 'DESC']]
    });
  }

  // 2. Appointments
  async getAppointments(userId) {
    return this.models.Appointment.findAll({
      where: { userId },
      order: [['appointmentDate', 'ASC']]
    });
  }

  async addAppointment(userId, input) {
    const data = addAppointmentSchema.parse(input);

    return this.models.Appointment.create({
      userId,
      title: data.title,
      doctorName: data.doctorName || null,
      appointmentDate: new Date(data.appointmentDate),
      notes: data.notes || null
    });
  }

  async deleteAppointment(userId, id) {
    const parsedId = z.string().uuid().parse(id);
    const count = await this.models.Appointment.destroy({
      where: { id: parsedId, userId }
    });
    return count > 0;
  }

  // 3. Medicines
  async getMedicineReminders(userId) {
    return this.models.MedicineReminder.findAll({
      where: { userId },
      order: [['timeOfDay', 'ASC']]
    });
  }

  async addMedicineReminder(userId, input) {
    const data = addMedicineSchema.parse(input);

    return this.models.MedicineReminder.create({
      userId,
      name: data.name,
      dosage: data.dosage,
      timeOfDay: data.timeOfDay,
      active: true
    });
  }

  async toggleMedicineReminder(userId, id, active) {
    const parsedId = z.string().uuid().parse(id);
    const reminder = await this.models.MedicineReminder.findOne({
      where: { id: parsedId, userId }
    });
    if (!reminder) throw new Error('Reminder not found');

    reminder.active = active;
    await reminder.save();
    return reminder;
  }

  async deleteMedicineReminder(userId, id) {
    const parsedId = z.string().uuid().parse(id);
    const count = await this.models.MedicineReminder.destroy({
      where: { id: parsedId, userId }
    });
    return count > 0;
  }

  // 4. Hospital Bag
  async getHospitalBagItems(userId) {
    return this.models.HospitalBagItem.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']]
    });
  }

  async addHospitalBagItem(userId, input) {
    const data = addBagItemSchema.parse(input);

    return this.models.HospitalBagItem.create({
      userId,
      itemName: data.itemName,
      category: data.category || 'mother',
      packed: false
    });
  }

  async toggleHospitalBagItem(userId, id, packed) {
    const parsedId = z.string().uuid().parse(id);
    const item = await this.models.HospitalBagItem.findOne({
      where: { id: parsedId, userId }
    });
    if (!item) throw new Error('Hospital bag item not found');

    item.packed = packed;
    await item.save();
    return item;
  }

  async clearPackedHospitalBagItems(userId) {
    const count = await this.models.HospitalBagItem.destroy({
      where: { userId, packed: true }
    });
    return count > 0;
  }
}
