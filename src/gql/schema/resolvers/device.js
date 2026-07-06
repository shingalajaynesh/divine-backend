import { authenticate } from '../permissions/index.js';

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

    approveDevice: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN') {
        throw new Error('Unauthorized. Admin privilege required.');
      }
      const { deviceManager } = context;
      return await deviceManager.updateDeviceStatus(args.deviceId, 'approved', context.viewer.id);
    }),

    rejectDevice: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN') {
        throw new Error('Unauthorized. Admin privilege required.');
      }
      const { deviceManager } = context;
      return await deviceManager.updateDeviceStatus(args.deviceId, 'rejected', context.viewer.id);
    }),

    deauthorizeDevice: authenticate(async (parent, args, context) => {
      const { deviceManager } = context;
      return await deviceManager.deauthorizeDevice(context.viewer.id, args.deviceId);
    }),
  }
};

