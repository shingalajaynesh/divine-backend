import { authenticate } from '../permissions/index.js';
import { WellnessService } from '../../../modules/wellness/wellness.service.js';

export const wellnessResolvers = {
  VitalsLog: {
    loggedAt: (parent) => {
      const d = typeof parent.loggedAt === 'string' ? new Date(parent.loggedAt) : parent.loggedAt;
      return d.toISOString();
    }
  },

  Appointment: {
    appointmentDate: (parent) => {
      const d = typeof parent.appointmentDate === 'string' ? new Date(parent.appointmentDate) : parent.appointmentDate;
      return d.toISOString();
    }
  },

  Query: {
    getAppointments: authenticate(async (parent, args, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.getAppointments(context.viewer.id);
    }),

    getMedicineReminders: authenticate(async (parent, args, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.getMedicineReminders(context.viewer.id);
    }),

    getHospitalBagItems: authenticate(async (parent, args, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.getHospitalBagItems(context.viewer.id);
    })
  },

  Mutation: {
    logVitalsAndSymptoms: authenticate(async (parent, { input }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.logVitals(context.viewer.id, input);
    }),

    addAppointment: authenticate(async (parent, { input }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.addAppointment(context.viewer.id, input);
    }),

    deleteAppointment: authenticate(async (parent, { id }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.deleteAppointment(context.viewer.id, id);
    }),

    addMedicineReminder: authenticate(async (parent, { input }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.addMedicineReminder(context.viewer.id, input);
    }),

    toggleMedicineReminder: authenticate(async (parent, { id, active }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.toggleMedicineReminder(context.viewer.id, id, active);
    }),

    deleteMedicineReminder: authenticate(async (parent, { id }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.deleteMedicineReminder(context.viewer.id, id);
    }),

    addHospitalBagItem: authenticate(async (parent, { input }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.addHospitalBagItem(context.viewer.id, input);
    }),

    toggleHospitalBagItem: authenticate(async (parent, { id, packed }, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.toggleHospitalBagItem(context.viewer.id, id, packed);
    }),

    clearPackedHospitalBagItems: authenticate(async (parent, args, context) => {
      const service = new WellnessService(context.models, context.sequelize);
      return service.clearPackedHospitalBagItems(context.viewer.id);
    })
  }
};
