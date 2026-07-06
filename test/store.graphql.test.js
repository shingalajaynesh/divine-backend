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

  // 5. Checkout / Place order (validates stock limit, decrements stock count, clears cart)
  prodStockCount = 10;
  await service.placeOrder(VALID_USER_ID, VALID_ADDR_ID);
  
  assert.equal(prodStockCount, 8); // 10 - 2 (quantity in cart)
  assert.equal(orderCreated.addressId, VALID_ADDR_ID);
  assert.equal(orderItemsCreated[0].productId, VALID_PROD_ID);
  assert.equal(cartCleared, true);
});
