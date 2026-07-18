import { authenticate } from '../permissions/index.js';
import { StoreService } from '../../../modules/store/store.service.js';

export const storeResolvers = {
  Product: {
    center: async (parent, args, context) => {
      if (parent.center) return parent.center;
      if (!parent.centerId) return null;
      return await context.models.Center.findByPk(parent.centerId);
    }
  },

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

  StoreCheckoutPayload: {
    expiresAt: (parent) => new Date(parent.expiresAt).toISOString()
  },

  StoreCheckoutStatus: {
    expiresAt: (parent) => new Date(parent.expiresAt).toISOString(),
    amount: (parent) => parent.totalMinor ?? parent.amount
  },

  Query: {
    getProducts: authenticate(async (parent, { centerId }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.getProducts(centerId);
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
    }),

    getStoreCheckoutStatus: authenticate(async (parent, { checkoutId }, context) => {
      const checkout = await context.models.StoreCheckoutIntent.findOne({
        where: { id: checkoutId, userId: context.viewer.id }
      });
      if (!checkout) throw new Error('Store checkout not found');
      return checkout;
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

    createStoreCheckout: authenticate(async (parent, { addressId, couponCode }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.createStoreCheckout(context.viewer.id, addressId, couponCode);
    }),

    verifyStorePayment: authenticate(async (parent, { razorpayOrderId, razorpayPaymentId, razorpaySignature }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.verifyStorePayment(context.viewer.id, razorpayOrderId, razorpayPaymentId, razorpaySignature);
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
    }),

    createProduct: authenticate(async (parent, args, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.createProduct(context.viewer, args);
    }),

    updateProduct: authenticate(async (parent, { id, ...args }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.updateProduct(context.viewer, id, args);
    }),

    deleteProduct: authenticate(async (parent, { id }, context) => {
      const service = new StoreService(context.models, context.sequelize);
      return service.deleteProduct(context.viewer, id);
    })
  }
};
