import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { StoreService } from '../src/modules/store/store.service.js';

const VALID_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const VALID_PROD_ID = '27a5b3a4-e910-410a-86fe-2d5d71eb5aa1';
const VALID_ADDR_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44';

test('store queries require authentication', async () => {
  const query = '{ getProducts { id title price } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('StoreService manages products catalog, carts, addresses, and order checkouts', async () => {
  let fetchedProducts = false;
  let cartItemCreated = null;
  let cartItemUpdated = null;
  let cartItemDeleted = false;
  let addressCreated = null;
  let orderCreated = null;
  let orderItemsCreated = [];
  let cartCleared = false;
  let prodStockCount = 50;

  const mockTransaction = async (callback) => callback({});

  const models = {
    Product: {
      findAll: async () => {
        fetchedProducts = true;
        return [{ id: VALID_PROD_ID, title: 'Sample Book', price: 299.00, inventoryCount: prodStockCount }];
      },
      findByPk: async (id) => {
        return {
          id: VALID_PROD_ID,
          title: 'Sample Book',
          price: 299.00,
          inventoryCount: prodStockCount,
          save: function() { prodStockCount = this.inventoryCount; }
        };
      }
    },
    CartItem: {
      findAll: async () => {
        if (cartCleared) return [];
        return [{ id: 'cart-1', productId: VALID_PROD_ID, quantity: 2 }];
      },
      findOrCreate: async ({ where, defaults }) => {
        cartItemCreated = { ...where, ...defaults };
        return [{ id: 'cart-1', quantity: 2, save: async function() { cartItemUpdated = this; } }, true];
      },
      findOne: async () => {
        return { id: 'cart-1', quantity: 2, save: async function() { cartItemUpdated = this; } };
      },
      destroy: async ({ where }) => {
        if (where.userId && where.productId) cartItemDeleted = true;
        else if (where.userId) cartCleared = true;
        return 1;
      }
    },
    UserAddress: {
      findOne: async () => {
        return { id: VALID_ADDR_ID, userId: VALID_USER_ID, fullName: 'Jayne' };
      },
      create: async (input) => {
        addressCreated = input;
        return { id: VALID_ADDR_ID, ...input };
      }
    },
    StoreOrder: {
      create: async (input) => {
        orderCreated = input;
        return { id: 'order-1', ...input };
      }
    },
    StoreOrderItem: {
      create: async (input) => {
        orderItemsCreated.push(input);
        return { id: 'order-item-1', ...input };
      }
    }
  };

  const service = new StoreService(models, { transaction: mockTransaction });

  // 1. Get products
  const prods = await service.getProducts();
  assert.equal(fetchedProducts, true);
  assert.equal(prods[0].title, 'Sample Book');

  // 2. Add address
  await service.addAddress(VALID_USER_ID, {
    fullName: 'Jane Doe',
    addressLine1: '123 Main Road',
    city: 'Surat',
    state: 'Gujarat',
    postalCode: '395009',
    phone: '9988776655'
  });
  assert.equal(addressCreated.fullName, 'Jane Doe');

  // 3. Add to cart
  await service.addToCart(VALID_USER_ID, {
    productId: VALID_PROD_ID,
    quantity: 2
  });
  assert.equal(cartItemCreated.productId, VALID_PROD_ID);

  // 4. Update cart quantity
  await service.updateCartQuantity(VALID_USER_ID, {
    productId: VALID_PROD_ID,
    quantity: 5
  });
  assert.equal(cartItemUpdated.quantity, 5);

  // 5. Direct unpaid order placement is blocked
  prodStockCount = 10;
  await assert.rejects(
    service.placeOrder(VALID_USER_ID, VALID_ADDR_ID),
    /Direct unpaid store order placement is disabled/
  );
  assert.equal(prodStockCount, 10);
  assert.equal(orderCreated, null);
  assert.equal(orderItemsCreated.length, 0);
  assert.equal(cartCleared, false);
});

test('StoreService creates trusted Razorpay checkout and finalizes store order from provider capture', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
  const product = {
    id: VALID_PROD_ID,
    title: 'Sample Book',
    price: '299.00',
    inventoryCount: 10,
    category: 'book',
    imageUrl: null,
    save: async function() { return this; }
  };
  const cartItems = [{
    id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
    userId: VALID_USER_ID,
    productId: VALID_PROD_ID,
    quantity: 2,
    product
  }];
  const checkouts = [];
  const checkoutItems = [];
  const reservations = [];
  const payments = [];
  const orders = [];
  const orderItems = [];
  const invoices = [];
  const transactions = [];

  const attachSave = (row) => ({ ...row, save: async function() { return this; } });
  const models = {
    Sequelize: { Op: { lte: Symbol('lte') } },
    User: { findByPk: async () => ({ id: VALID_USER_ID, centerId: null }) },
    Product: { findByPk: async () => product },
    CartItem: {
      findAll: async () => cartItems,
      findOne: async ({ where }) => cartItems.find((item) => item.userId === where.userId && item.productId === where.productId) || null,
      destroy: async ({ where }) => {
        const idx = cartItems.findIndex((item) => item.id === where.id);
        if (idx >= 0) cartItems.splice(idx, 1);
        return idx >= 0 ? 1 : 0;
      }
    },
    UserAddress: {
      findOne: async () => ({ id: VALID_ADDR_ID, userId: VALID_USER_ID })
    },
    StoreCheckoutIntent: {
      create: async (input) => {
        const row = attachSave(input);
        checkouts.push(row);
        return row;
      },
      findOne: async ({ where }) => checkouts.find((checkout) => checkout.razorpayOrderId === where.razorpayOrderId) || null,
      findByPk: async (id) => checkouts.find((checkout) => checkout.id === id) || null
    },
    StoreCheckoutItem: {
      create: async (input) => {
        const row = attachSave(input);
        checkoutItems.push(row);
        return row;
      },
      findAll: async ({ where }) => checkoutItems.filter((item) => item.checkoutIntentId === where.checkoutIntentId)
    },
    InventoryReservation: {
      create: async (input) => {
        const row = attachSave(input);
        reservations.push(row);
        return row;
      },
      findAll: async ({ where }) => reservations.filter((reservation) => reservation.checkoutIntentId === where.checkoutIntentId)
    },
    Payment: {
      create: async (input) => {
        const row = attachSave(input);
        payments.push(row);
        return row;
      },
      findByPk: async (id) => payments.find((payment) => payment.id === id) || null
    },
    StoreOrder: {
      create: async (input) => {
        const row = attachSave(input);
        orders.push(row);
        return row;
      },
      findByPk: async (id) => orders.find((order) => order.id === id) || null
    },
    StoreOrderItem: {
      create: async (input) => {
        orderItems.push(input);
        return input;
      }
    },
    Invoice: {
      create: async (input) => {
        const row = attachSave(input);
        invoices.push(row);
        return row;
      },
      findByPk: async (id) => invoices.find((invoice) => invoice.id === id) || null
    },
    FinancialTransaction: {
      findOne: async ({ where }) => transactions.find((tx) => tx.paymentId === where.paymentId && tx.type === where.type) || null,
      create: async (input) => {
        const row = attachSave(input);
        transactions.push(row);
        return row;
      }
    }
  };
  const sequelize = { transaction: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }) };
  const razorpayClient = {
    createOrder: async ({ amount, currency, receipt }) => ({ id: `order_${receipt}`, amount, currency, receipt, status: 'created' }),
    fetchPayment: async (paymentId, expected) => ({
      id: paymentId,
      order_id: expected.expectedOrderId,
      amount: expected.expectedAmountMinor,
      currency: expected.expectedCurrency,
      status: 'captured'
    })
  };
  const service = new StoreService(models, sequelize, razorpayClient);

  const checkout = await service.createStoreCheckout(VALID_USER_ID, VALID_ADDR_ID);
  assert.equal(checkout.amount, 59800);
  assert.equal(checkout.currency, 'INR');
  assert.equal(checkoutItems.length, 1);
  assert.equal(checkoutItems[0].unitPriceMinor, 29900);
  assert.equal(reservations.length, 1);
  assert.equal(product.inventoryCount, 10);

  const order = await service.verifyStorePayment(VALID_USER_ID, checkout.razorpayOrderId, 'pay_store_123', 'mock_signature');
  assert.equal(order.status, 'processing');
  assert.equal(order.paymentStatus, 'captured');
  assert.equal(product.inventoryCount, 8);
  assert.equal(reservations[0].status, 'CONSUMED');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].purpose, 'store_order');
  assert.equal(orders.length, 1);
  assert.equal(orderItems.length, 1);
  assert.equal(invoices.length, 1);
  assert.equal(transactions.length, 1);
  assert.equal(cartItems.length, 0);

  const duplicate = await service.verifyStorePayment(VALID_USER_ID, checkout.razorpayOrderId, 'pay_store_123', 'mock_signature');
  assert.equal(duplicate.id, order.id);
  assert.equal(orders.length, 1);
  assert.equal(product.inventoryCount, 8);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});
