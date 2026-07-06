import { authenticate } from '../permissions/index.js';
import { StoreService } from '../../../modules/store/store.service.js';

export const storeResolvers = {
  StoreOrder: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
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
    })
  }
};
