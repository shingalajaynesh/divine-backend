import { authenticate } from '../permissions/index.js';
import { StoreService } from '../../../modules/store/store.service.js';

export const storeResolvers = {
  StoreOrder: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    },
    estimatedDeliveryDate: (parent) => {
      if (!parent.estimatedDeliveryDate) return null;
      const d = typeof parent.estimatedDeliveryDate === 'string' ? new Date(parent.estimatedDeliveryDate) : parent.estimatedDeliveryDate;
      return d.toISOString();
    },
    shippedAt: (parent) => {
      if (!parent.shippedAt) return null;
      const d = typeof parent.shippedAt === 'string' ? new Date(parent.shippedAt) : parent.shippedAt;
      return d.toISOString();
    },
    deliveredAt: (parent) => {
      if (!parent.deliveredAt) return null;
      const d = typeof parent.deliveredAt === 'string' ? new Date(parent.deliveredAt) : parent.deliveredAt;
      return d.toISOString();
    }
  },

  StoreOrderReturn: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    },
    updatedAt: (parent) => {
      const d = typeof parent.updatedAt === 'string' ? new Date(parent.updatedAt) : parent.updatedAt;
      return d.toISOString();
    }
  },

  Query: {
    getProducts: authenticate(async (parent, args, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.getProducts();
    }),

    getCart: authenticate(async (parent, args, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.getCart(context.viewer.id);
    }),

    getAddresses: authenticate(async (parent, args, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.getAddresses(context.viewer.id);
    }),

    getMyOrders: authenticate(async (parent, args, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.getMyOrders(context.viewer.id);
    }),

    getAdminOrders: authenticate(async (parent, args, context) => {
      // Allow STAFF and ADMIN
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new StoreService(context.models, context.sequelize);
      return service.getAdminOrders();
    })
  },

  Mutation: {
    addToCart: authenticate(async (parent, { input }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.addToCart(context.viewer.id, input);
    }),

    updateCartQuantity: authenticate(async (parent, { input }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.updateCartQuantity(context.viewer.id, input);
    }),

    removeFromCart: authenticate(async (parent, { productId }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.removeFromCart(context.viewer.id, productId);
    }),

    addAddress: authenticate(async (parent, { input }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.addAddress(context.viewer.id, input);
    }),

    deleteAddress: authenticate(async (parent, { id }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.deleteAddress(context.viewer.id, id);
    }),

    placeOrder: authenticate(async (parent, { addressId }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.placeOrder(context.viewer.id, addressId);
    }),

    updateOrderTracking: authenticate(async (parent, { orderId, carrier, trackingNumber, estimatedDeliveryDate }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new StoreService(context.models, context.sequelize);
      return service.updateOrderTracking(orderId, carrier, trackingNumber, estimatedDeliveryDate);
    }),

    updateOrderStatus: authenticate(async (parent, { orderId, status }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new StoreService(context.models, context.sequelize);
      return service.updateOrderStatus(orderId, status);
    }),

    requestOrderReturn: authenticate(async (parent, { orderId, reason }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.requestOrderReturn(context.viewer.id, orderId, reason);
    }),

    reviewOrderReturn: authenticate(async (parent, { orderReturnId, status, adminNotes }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new StoreService(context.models, context.sequelize);
      return service.reviewOrderReturn(orderReturnId, status, adminNotes);
    })
  }
};
