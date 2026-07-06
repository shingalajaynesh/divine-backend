import { authenticate, authorizeRoles } from '../permissions/index.js';

export const deviceResolvers = {
  Query: {
    getMyDevices: authenticate(async (parent, args, context) => {
      const { deviceManager } = context;
      return await deviceManager.getUserDevices(context.viewer.id);
    }),
  },

  Mutation: {
    registerDevice: authenticate(async (parent, args, context) => {
      const { deviceManager } = context;
      return await deviceManager.registerDevice(context.viewer.id, args);
    }),

    approveDevice: authenticate(authorizeRoles(['ADMIN'], async (parent, args, context) => {
      const { deviceManager } = context;
      return await deviceManager.updateDeviceStatus(args.deviceId, 'approved', context.viewer.id, context.viewer.centerId);
    })),

    rejectDevice: authenticate(authorizeRoles(['ADMIN'], async (parent, args, context) => {
      const { deviceManager } = context;
      return await deviceManager.updateDeviceStatus(args.deviceId, 'rejected', context.viewer.id, context.viewer.centerId);
    })),

    deauthorizeDevice: authenticate(async (parent, args, context) => {
      const { deviceManager } = context;
      return await deviceManager.deauthorizeDevice(context.viewer.id, args.deviceId);
    }),
  }
};
