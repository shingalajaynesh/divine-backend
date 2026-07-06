import assert from 'node:assert/strict';
import test from 'node:test';
import { StoreService } from '../src/modules/store/store.service.js';

const VALID_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const VALID_ORDER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_RETURN_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';

test('StoreService manages shipping tracking and order returns lifecycle', async () => {
  let orderStatus = 'processing';
  let orderCarrier = null;
  let orderTracking = null;
  let orderEstimatedDate = null;
  let orderShippedAt = null;
  let orderDeliveredAt = null;

  let returnCreated = null;
  let returnStatus = 'requested';
  let returnNotes = null;

  const mockTransaction = async (callback) => callback({});

  const models = {
    StoreOrder: {
      findByPk: async (id) => {
        return {
          id: VALID_ORDER_ID,
          userId: VALID_USER_ID,
          status: orderStatus,
          carrier: orderCarrier,
          trackingNumber: orderTracking,
          shippedAt: orderShippedAt,
          deliveredAt: orderDeliveredAt,
          save: function() {
            orderStatus = this.status;
            orderCarrier = this.carrier;
            orderTracking = this.trackingNumber;
            orderEstimatedDate = this.estimatedDeliveryDate;
            orderShippedAt = this.shippedAt;
            orderDeliveredAt = this.deliveredAt;
          }
        };
      },
      findOne: async ({ where }) => {
        if (where.id === VALID_ORDER_ID && where.userId === VALID_USER_ID) {
          return {
            id: VALID_ORDER_ID,
            userId: VALID_USER_ID,
            status: orderStatus,
            save: function() { orderStatus = this.status; }
          };
        }
        return null;
      }
    },
    StoreOrderReturn: {
      findOne: async ({ where }) => {
        return returnCreated; // simulates checking for existing
      },
      create: async (input) => {
        returnCreated = input;
        return { id: VALID_RETURN_ID, ...input };
      },
      findByPk: async (id) => {
        return {
          id: VALID_RETURN_ID,
          orderId: VALID_ORDER_ID,
          status: returnStatus,
          adminNotes: returnNotes,
          save: function() {
            returnStatus = this.status;
            returnNotes = this.adminNotes;
          }
        };
      }
    }
  };

  const service = new StoreService(models, { transaction: mockTransaction });

  // 1. Update Order tracking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await service.updateOrderTracking(VALID_ORDER_ID, 'Delhivery', 'DEL12345', tomorrow);

  assert.equal(orderCarrier, 'Delhivery');
  assert.equal(orderTracking, 'DEL12345');
  assert.equal(orderEstimatedDate.toDateString(), tomorrow.toDateString());

  // 2. Update Order status to Shipped
  await service.updateOrderStatus(VALID_ORDER_ID, 'shipped');
  assert.equal(orderStatus, 'shipped');
  assert.ok(orderShippedAt instanceof Date);

  // 3. Request return should reject if not delivered
  await assert.rejects(
    service.requestOrderReturn(VALID_USER_ID, VALID_ORDER_ID, 'Damaged product packaging'),
    /Only delivered orders can be returned/
  );

  // 4. Update status to Delivered & request return
  await service.updateOrderStatus(VALID_ORDER_ID, 'delivered');
  assert.equal(orderStatus, 'delivered');
  assert.ok(orderDeliveredAt instanceof Date);

  await service.requestOrderReturn(VALID_USER_ID, VALID_ORDER_ID, 'Damaged packaging');
  assert.equal(returnCreated.orderId, VALID_ORDER_ID);
  assert.equal(returnCreated.reason, 'Damaged packaging');

  // 5. Review return (Approve return -> order transitions to cancelled)
  await service.reviewOrderReturn(VALID_RETURN_ID, 'approved', 'Refund approved by specialist');
  assert.equal(returnStatus, 'approved');
  assert.equal(returnNotes, 'Refund approved by specialist');
  assert.equal(orderStatus, 'cancelled');
});
