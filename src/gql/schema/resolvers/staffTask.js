import { authenticate } from '../permissions/index.js';

export const staffTaskResolvers = {
  StaffTask: {
    dueDate: (parent) => {
      if (!parent.dueDate) return null;
      const d = typeof parent.dueDate === 'string' ? new Date(parent.dueDate) : parent.dueDate;
      return d.toISOString();
    },
    status: (parent) => {
      if (parent.completed) return 'COMPLETED';
      const desc = parent.description || '';
      const match = desc.match(/\[STATUS:(PENDING|IN_PROGRESS|BLOCKED|CANCELLED)\]/);
      return match ? match[1] : 'PENDING';
    },
    user: async (parent, args, context) => {
      if (!parent.userId) return null;
      return await context.models.User.findByPk(parent.userId);
    }
  },

  LiveClassBooking: {
    user: async (parent, args, context) => {
      if (!parent.userId) return null;
      return await context.models.User.findByPk(parent.userId);
    }
  },

  Query: {
    getStaffTasks: authenticate(async (parent, args, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }
      return await context.models.StaffTask.findAll({
        where: { staffId: context.viewer.id },
        order: [
          ['completed', 'ASC'],
          ['dueDate', 'ASC'],
          ['createdAt', 'DESC']
        ]
      });
    }),

    getLiveClassBookings: authenticate(async (parent, { classId }, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }
      return await context.models.LiveClassBooking.findAll({
        where: { liveClassId: classId }
      });
    })
  },

  Mutation: {
    recordClassAttendance: authenticate(async (parent, { classId, userId, attended }, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      let booking = await context.models.LiveClassBooking.findOne({
        where: { liveClassId: classId, userId }
      });

      if (!booking) {
        booking = await context.models.LiveClassBooking.create({
          liveClassId: classId,
          userId,
          attended
        });
      } else {
        booking.attended = attended;
        await booking.save();
      }

      return booking;
    }),

    createStaffTask: authenticate(async (parent, { userId, title, description, dueDate }, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const parsedDueDate = dueDate ? new Date(dueDate) : null;

      return await context.models.StaffTask.create({
        staffId: context.viewer.id,
        userId: userId || null,
        title,
        description: description || null,
        dueDate: parsedDueDate,
        completed: false
      });
    }),

    toggleStaffTask: authenticate(async (parent, { id }, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const task = await context.models.StaffTask.findByPk(id);
      if (!task) throw new Error('Task not found');

      if (task.staffId !== context.viewer.id) {
        throw new Error('Unauthorized to modify this task');
      }

      task.completed = !task.completed;
      await task.save();
      return task;
    }),

    updateStaffTaskStatus: authenticate(async (parent, { id, status }, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const task = await context.models.StaffTask.findByPk(id);
      if (!task) throw new Error('Task not found');

      if (task.staffId !== context.viewer.id) {
        throw new Error('Unauthorized to modify this task');
      }

      const validStatuses = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid task status: ${status}`);
      }

      // Enforce status transitions
      const currentStatus = task.completed ? 'COMPLETED' : (() => {
        const match = (task.description || '').match(/\[STATUS:(PENDING|IN_PROGRESS|BLOCKED|CANCELLED)\]/);
        return match ? match[1] : 'PENDING';
      })();

      const allowedTransitions = {
        PENDING: ['IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'],
        IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
        BLOCKED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: []
      };

      if (currentStatus !== status && !allowedTransitions[currentStatus]?.includes(status)) {
        throw new Error(`Invalid task status transition from ${currentStatus} to ${status}`);
      }

      // Clean existing prefix
      let cleanDesc = (task.description || '').replace(/\[STATUS:(PENDING|IN_PROGRESS|BLOCKED|CANCELLED)\]/, '').trim();
      
      if (status === 'COMPLETED') {
        task.completed = true;
        task.description = cleanDesc;
      } else {
        task.completed = false;
        task.description = `${cleanDesc} [STATUS:${status}]`.trim();
      }

      await task.save();
      return task;
    }),

    deleteStaffTask: authenticate(async (parent, { id }, context) => {
      const role = context.viewer.role?.roleType;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        throw new Error('Unauthorized');
      }

      const task = await context.models.StaffTask.findByPk(id);
      if (!task) throw new Error('Task not found');

      if (task.staffId !== context.viewer.id) {
        throw new Error('Unauthorized to delete this task');
      }

      await task.destroy();
      return true;
    })
  }
};
