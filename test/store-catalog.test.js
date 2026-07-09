import assert from 'node:assert/strict';
import test from 'node:test';
import { StoreService } from '../src/modules/store/store.service.js';

const VIEWER_STAFF = { id: '66666666-6666-4666-a666-666666666666', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: '77777777-7777-4777-a777-777777777777', role: { roleType: 'MOTHER' } };

test('StoreService - Products catalog CRUD, stock deduction checkout, tracking, and returns', async () => {
  const mockProducts = [];
  const mockCartItems = [];
  const mockAddresses = [];
  const mockOrders = [];
  const mockOrderItems = [];
  const mockReturns = [];

  // Seed initial values
  mockProducts.push({
    id: '11111111-1111-4111-a111-111111111111',
    title: 'Global Prenatal Kit',
    description: 'A global kit bundle',
    price: 499.00,
    imageUrl: 'http://example.com/global.jpg',
    inventoryCount: 15,
    category: 'kit',
    centerId: null,
    update: async function(updates) {
      Object.assign(this, updates);
      return this;
    },
    save: async function() {
      return this;
    },
    destroy: async function() {
      const idx = mockProducts.indexOf(this);
      if (idx !== -1) mockProducts.splice(idx, 1);
    }
  });

  mockProducts.push({
    id: '22222222-2222-4222-a222-222222222222',
    title: 'Center Specialized Book',
    description: 'A book only for Center A',
    price: 150.00,
    imageUrl: 'http://example.com/book.jpg',
    inventoryCount: 8,
    category: 'book',
    centerId: '44444444-4444-4444-a444-444444444444',
    update: async function(updates) {
      Object.assign(this, updates);
      return this;
    },
    save: async function() {
      return this;
    },
    destroy: async function() {
      const idx = mockProducts.indexOf(this);
      if (idx !== -1) mockProducts.splice(idx, 1);
    }
  });

  mockAddresses.push({
    id: '33333333-3333-4333-a333-333333333333',
    userId: '66666666-6666-4666-a666-666666666666',
    fullName: 'Jane Doe',
    addressLine1: '123 Main St',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110001',
    phone: '9876543210'
  });

  mockCartItems.push({
    id: '55555555-5555-4555-a555-555555555555',
    userId: '66666666-6666-4666-a666-666666666666',
    productId: '11111111-1111-4111-a111-111111111111',
    quantity: 2,
    product: mockProducts[0],
    save: async function() { return this; }
  });

  const mockModels = {
    Sequelize: {
      Op: {
        or: Symbol('or')
      }
    },
    Product: {
      findAll: async (options) => {
        let list = mockProducts;
        if (options?.where) {
          const orConditions = options.where[mockModels.Sequelize.Op.or];
          if (orConditions) {
            const allowedCenters = orConditions.map(c => c.centerId);
            list = list.filter(p => p.centerId === null || allowedCenters.includes(p.centerId));
          }
        }
        return list;
      },
      findByPk: async (id) => mockProducts.find(p => p.id === id) || null,
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          },
          save: async function() {
            return this;
          },
          destroy: async function() {
            const idx = mockProducts.indexOf(this);
            if (idx !== -1) mockProducts.splice(idx, 1);
          }
        };
        mockProducts.push(row);
        return row;
      }
    },
    CartItem: {
      findAll: async (options) => {
        if (options?.where?.userId) {
          return mockCartItems.filter(c => c.userId === options.where.userId);
        }
        return mockCartItems;
      },
      findOrCreate: async ({ where, defaults }) => {
        const existing = mockCartItems.find(c => c.userId === where.userId && c.productId === where.productId);
        if (existing) return [existing, false];
        const newItem = {
          id: '55555555-5555-4555-a555-555555555555',
          userId: where.userId,
          productId: where.productId,
          quantity: defaults.quantity,
          save: async function() { return this; }
        };
        mockCartItems.push(newItem);
        return [newItem, true];
      },
      findOne: async (options) => {
        return mockCartItems.find(c => c.userId === options.where.userId && c.productId === options.where.productId) || null;
      },
      destroy: async (options) => {
        if (options?.where?.userId) {
          const beforeCount = mockCartItems.length;
          mockCartItems.splice(0, mockCartItems.length); // clear
          return beforeCount;
        }
        return 0;
      }
    },
    UserAddress: {
      findOne: async (options) => {
        return mockAddresses.find(a => a.id === options.where.id && a.userId === options.where.userId) || null;
      }
    },
    StoreOrder: {
      create: async (input) => {
        const row = {
          ...input,
          id: '77777777-7777-4777-a777-777777777777',
          save: async function() { return this; }
        };
        mockOrders.push(row);
        return row;
      },
      findByPk: async (id) => mockOrders.find(o => o.id === id) || null,
      findOne: async (options) => {
        return mockOrders.find(o => o.id === options.where.id && o.userId === options.where.userId) || null;
      }
    },
    StoreOrderItem: {
      create: async (input) => {
        mockOrderItems.push(input);
        return input;
      }
    },
    StoreOrderReturn: {
      create: async (input) => {
        const row = {
          ...input,
          id: '88888888-8888-4888-a888-888888888888',
          save: async function() { return this; }
        };
        mockReturns.push(row);
        return row;
      },
      findOne: async (options) => mockReturns.find(r => r.orderId === options.where.orderId) || null,
      findByPk: async (id) => mockReturns.find(r => r.id === id) || null
    },
    Center: {}
  };

  const mockSequelize = {
    transaction: async (cb) => {
      return cb({});
    }
  };

  const service = new StoreService(mockModels, mockSequelize);

  // 1. Test getProducts with center filtering
  const allProds = await service.getProducts();
  assert.equal(allProds.length, 2);

  const centerAProds = await service.getProducts('44444444-4444-4444-a444-444444444444');
  assert.equal(centerAProds.length, 2);

  // 2. Test Product Creation validations and role enforcement
  await assert.rejects(
    service.createProduct(VIEWER_MOTHER, { title: 'Unauthorized Booklet', price: 99.00, inventoryCount: 50, category: 'book' }),
    /Unauthorized access/
  );

  const newProduct = await service.createProduct(VIEWER_STAFF, {
    title: 'Staff Created Kit',
    description: 'New bundle',
    price: 350.00,
    imageUrl: 'http://example.com/new.jpg',
    inventoryCount: 20,
    category: 'bundle'
  });
  assert.equal(newProduct.title, 'Staff Created Kit');
  assert.equal(mockProducts.length, 3);

  // Negative validation checks
  await assert.rejects(
    service.createProduct(VIEWER_STAFF, { title: 'Neg Price', price: -5.00, inventoryCount: 10, category: 'kit' }),
    /Price cannot be negative/
  );
  await assert.rejects(
    service.createProduct(VIEWER_STAFF, { title: 'Neg Stock', price: 10.00, inventoryCount: -10, category: 'kit' }),
    /Inventory count cannot be negative/
  );

  // 3. Test Product Updates
  const updatedProd = await service.updateProduct(VIEWER_STAFF, '11111111-1111-4111-a111-111111111111', {
    price: 599.00,
    inventoryCount: 12
  });
  assert.equal(parseFloat(updatedProd.price), 599.00);
  assert.equal(updatedProd.inventoryCount, 12);

  // 4. Test checkout placing order and stock reduction
  const cartList = await service.getCart('66666666-6666-4666-a666-666666666666');
  assert.equal(cartList.length, 1);
  assert.equal(cartList[0].productId, '11111111-1111-4111-a111-111111111111');
  assert.equal(cartList[0].quantity, 2);

  // Let's checkout
  const order = await service.placeOrder('66666666-6666-4666-a666-666666666666', '33333333-3333-4333-a333-333333333333');
  assert.ok(order);
  assert.equal(order.status, 'processing');
  assert.equal(parseFloat(order.totalAmount), 1198.00); // 599 * 2

  // Verify stock was deducted (12 - 2 = 10)
  const checkedProduct = await mockModels.Product.findByPk('11111111-1111-4111-a111-111111111111');
  assert.equal(checkedProduct.inventoryCount, 10);

  // Verify cart is empty
  const emptyCart = await service.getCart('66666666-6666-4666-a666-666666666666');
  assert.equal(emptyCart.length, 0);

  // 5. Test Order Tracking updates
  const trackedOrder = await service.updateOrderTracking('77777777-7777-4777-a777-777777777777', 'DHL', 'TRACK-1234', '2026-07-15T00:00:00Z');
  assert.equal(trackedOrder.carrier, 'DHL');
  assert.equal(trackedOrder.trackingNumber, 'TRACK-1234');

  // 6. Test Status transitions
  const shippedOrder = await service.updateOrderStatus('77777777-7777-4777-a777-777777777777', 'shipped');
  assert.equal(shippedOrder.status, 'shipped');
  assert.ok(shippedOrder.shippedAt);

  const deliveredOrder = await service.updateOrderStatus('77777777-7777-4777-a777-777777777777', 'delivered');
  assert.equal(deliveredOrder.status, 'delivered');
  assert.ok(deliveredOrder.deliveredAt);

  // 7. Test Returns workflow
  const retReq = await service.requestOrderReturn('66666666-6666-4666-a666-666666666666', '77777777-7777-4777-a777-777777777777', 'Incorrect size');
  assert.equal(retReq.status, 'requested');
  assert.equal(retReq.reason, 'Incorrect size');

  // Review return approval
  const approvedRet = await service.reviewOrderReturn('88888888-8888-4888-a888-888888888888', 'approved', 'Authorized return');
  assert.equal(approvedRet.status, 'approved');

  // Order status should be cancelled after approval
  const finalOrder = await mockModels.StoreOrder.findByPk('77777777-7777-4777-a777-777777777777');
  assert.equal(finalOrder.status, 'cancelled');

  // 8. Test delete product
  const deleted = await service.deleteProduct(VIEWER_STAFF, '22222222-2222-4222-a222-222222222222');
  assert.equal(deleted, true);
  assert.equal(mockProducts.find(p => p.id === '22222222-2222-4222-a222-222222222222'), undefined);
});
