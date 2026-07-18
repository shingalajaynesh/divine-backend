import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RazorpayClient } from '../payment/razorpay.client.js';
import { verifyRazorpayCheckoutSignature } from '../payment/razorpaySignature.service.js';
import { PAYMENT_STATUS, setPaymentStatus } from '../payment/paymentState.js';

const STORE_PURPOSE = 'store_order';
const CURRENCY_INR = 'INR';
const CHECKOUT_EXPIRY_MINUTES = 15;

const STORE_CHECKOUT_STATUS = Object.freeze({
  CREATED: 'created',
  ORDER_CREATED: 'order_created',
  CLIENT_VERIFIED: 'client_verified',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

const RESERVATION_STATUS = Object.freeze({
  RESERVED: 'RESERVED',
  CONSUMED: 'CONSUMED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

export const addAddressSchema = z.object({
  fullName: z.string().min(2).max(100),
  addressLine1: z.string().min(5).max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  postalCode: z.string().min(4).max(20),
  phone: z.string().min(6).max(20)
});

export const cartItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20)
});

const razorpayOrderIdSchema = z.string().min(6).max(100).regex(/^order_[A-Za-z0-9_]+$/);
const razorpayPaymentIdSchema = z.string().min(6).max(100).regex(/^pay_[A-Za-z0-9_]+$/);
const razorpaySignatureSchema = z.string().min(10).max(256).regex(/^[a-fA-F0-9]+$/);

const decimalToMinorUnits = (value) => {
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Invalid monetary amount configured for product');
  return (Number.parseInt(match[1], 10) * 100) + (Number.parseInt((match[2] || '').padEnd(2, '0'), 10) || 0);
};

const minorUnitsToDecimal = (amountMinor) => (amountMinor / 100).toFixed(2);
const makeReceipt = (checkoutId) => `dgs_store_${checkoutId.replace(/-/g, '').slice(0, 22)}`;

export class StoreService {
  constructor(models, sequelize, razorpayClient = new RazorpayClient()) {
    this.models = models;
    this.sequelize = sequelize;
    this.razorpayClient = razorpayClient;
  }

  // 1. Products Catalog
  async getProducts(centerId) {
    const where = {};
    if (centerId) {
      where[this.models.Sequelize.Op.or] = [
        { centerId: null },
        { centerId }
      ];
    }
    return this.models.Product.findAll({
      where,
      include: [
        {
          model: this.models.Center,
          as: 'center',
          attributes: ['id', 'name']
        }
      ],
      order: [['title', 'ASC']]
    });
  }

  // 2. Shopping Cart
  async getCart(userId) {
    return this.models.CartItem.findAll({
      where: { userId },
      include: [{ model: this.models.Product, as: 'product' }],
      order: [['createdAt', 'ASC']]
    });
  }

  async addToCart(userId, input) {
    const data = cartItemInputSchema.parse(input);
    
    const product = await this.models.Product.findByPk(data.productId);
    if (!product) throw new Error('Product not found');
    if (product.inventoryCount < data.quantity) {
      throw new Error(`Insufficient stock. Only ${product.inventoryCount} items left.`);
    }

    const [item, created] = await this.models.CartItem.findOrCreate({
      where: { userId, productId: data.productId },
      defaults: { quantity: data.quantity }
    });

    if (!created) {
      const newQty = item.quantity + data.quantity;
      if (product.inventoryCount < newQty) {
        throw new Error(`Cannot add more. Insufficient stock limit of ${product.inventoryCount}.`);
      }
      item.quantity = newQty;
      await item.save();
    }

    return item;
  }

  async updateCartQuantity(userId, input) {
    const data = cartItemInputSchema.parse(input);
    const product = await this.models.Product.findByPk(data.productId);
    if (!product) throw new Error('Product not found');
    if (product.inventoryCount < data.quantity) {
      throw new Error(`Insufficient stock. Only ${product.inventoryCount} items left.`);
    }

    const item = await this.models.CartItem.findOne({
      where: { userId, productId: data.productId }
    });
    if (!item) throw new Error('Cart item not found');

    item.quantity = data.quantity;
    await item.save();
    return item;
  }

  async removeFromCart(userId, productId) {
    const parsedPid = z.string().uuid().parse(productId);
    const count = await this.models.CartItem.destroy({
      where: { userId, productId: parsedPid }
    });
    return count > 0;
  }

  // 3. User Address
  async getAddresses(userId) {
    return this.models.UserAddress.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  }

  async addAddress(userId, input) {
    const data = addAddressSchema.parse(input);
    return this.models.UserAddress.create({
      userId,
      ...data
    });
  }

  async deleteAddress(userId, id) {
    const parsedId = z.string().uuid().parse(id);
    const count = await this.models.UserAddress.destroy({
      where: { id: parsedId, userId }
    });
    return count > 0;
  }

  // 4. Checkout Order creation (no payment gateways)
  async placeOrder(userId, addressId) {
    throw new Error('Direct unpaid store order placement is disabled. Please use secure Razorpay checkout.');
  }

  async createStoreCheckout(userId, addressId, couponCode) {
    const parsedAddressId = z.string().uuid().parse(addressId);
    const address = await this.models.UserAddress.findOne({
      where: { id: parsedAddressId, userId }
    });
    if (!address) throw new Error('Shipping destination address not found');

    const cart = await this.models.CartItem.findAll({
      where: { userId },
      include: [{ model: this.models.Product, as: 'product' }]
    });
    if (cart.length === 0) throw new Error('Your shopping cart is empty');

    const user = await this.models.User.findByPk(userId);
    const checkoutId = uuidv4();
    const receipt = makeReceipt(checkoutId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHECKOUT_EXPIRY_MINUTES * 60 * 1000);

    let checkout;
    let totalMinor = 0;
    await this.sequelize.transaction(async (t) => {
      const snapshotItems = [];
      for (const item of cart) {
        const prod = await this.models.Product.findByPk(item.productId, {
          transaction: t,
          lock: t.LOCK?.UPDATE
        });
        if (!prod) throw new Error(`Product ${item.productId} no longer exists`);
        if (prod.inventoryCount < 0) throw new Error(`Inventory for "${prod.title}" is invalid`);
        if (prod.inventoryCount < item.quantity) {
          throw new Error(`Insufficient stock for "${prod.title}". Only ${prod.inventoryCount} items left.`);
        }

        const unitPriceMinor = decimalToMinorUnits(prod.price);
        const lineTotalMinor = unitPriceMinor * item.quantity;
        totalMinor += lineTotalMinor;
        snapshotItems.push({
          productId: prod.id,
          productName: prod.title,
          quantity: item.quantity,
          unitPriceMinor,
          lineDiscountMinor: 0,
          taxMinor: 0,
          lineTotalMinor,
          metadata: {
            category: prod.category,
            imageUrl: prod.imageUrl || null,
          }
        });
      }

      checkout = await this.models.StoreCheckoutIntent.create({
        id: checkoutId,
        userId,
        centerId: user?.centerId || null,
        addressId: parsedAddressId,
        currency: CURRENCY_INR,
        subtotalMinor: totalMinor,
        discountMinor: 0,
        taxMinor: 0,
        shippingMinor: 0,
        totalMinor,
        couponCode: couponCode?.trim() || null,
        receipt,
        status: STORE_CHECKOUT_STATUS.CREATED,
        expiresAt,
      }, { transaction: t });

      for (const snapshotItem of snapshotItems) {
        await this.models.StoreCheckoutItem.create({
          id: uuidv4(),
          checkoutIntentId: checkout.id,
          ...snapshotItem
        }, { transaction: t });
        await this.models.InventoryReservation.create({
          id: uuidv4(),
          productId: snapshotItem.productId,
          checkoutIntentId: checkout.id,
          quantity: snapshotItem.quantity,
          status: RESERVATION_STATUS.RESERVED,
          reservedAt: now,
          expiresAt,
        }, { transaction: t });
      }
    });

    let providerOrder;
    try {
      providerOrder = await this.razorpayClient.createOrder({
        amount: totalMinor,
        currency: CURRENCY_INR,
        receipt,
        notes: {
          checkout_id: checkout.id,
          user_id: userId,
          purpose: STORE_PURPOSE,
          currency: CURRENCY_INR,
        }
      });
    } catch (error) {
      await this.releaseStoreCheckout(checkout.id, STORE_CHECKOUT_STATUS.FAILED, 'RAZORPAY_ORDER_FAILED', 'Razorpay order creation failed');
      throw new Error(`Razorpay API request failed: ${error.message}`);
    }

    checkout.razorpayOrderId = providerOrder.id;
    checkout.status = STORE_CHECKOUT_STATUS.ORDER_CREATED;
    await checkout.save();

    return {
      id: checkout.id,
      razorpayOrderId: providerOrder.id,
      amount: totalMinor,
      currency: CURRENCY_INR,
      receipt,
      status: checkout.status,
      expiresAt: checkout.expiresAt,
    };
  }

  async verifyStorePayment(userId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const parsedOrderId = razorpayOrderIdSchema.parse(razorpayOrderId);
    const parsedPaymentId = razorpayPaymentIdSchema.parse(razorpayPaymentId);
    const allowMock = process.env.NODE_ENV?.includes('test');
    const parsedSignature = allowMock
      ? z.string().min(5).max(256).parse(razorpaySignature)
      : razorpaySignatureSchema.parse(razorpaySignature);

    const keySecret = process.env.RAZORPAY_KEY_SECRET || (allowMock ? 'mock_key_secret' : null);
    if (!verifyRazorpayCheckoutSignature({
      orderId: parsedOrderId,
      paymentId: parsedPaymentId,
      signature: parsedSignature,
      secret: keySecret,
      allowMock,
    })) {
      throw new Error('Invalid Razorpay signature verification');
    }

    const checkout = await this.models.StoreCheckoutIntent.findOne({ where: { razorpayOrderId: parsedOrderId } });
    if (!checkout) throw new Error('Store checkout record not found');
    if (checkout.userId !== userId) throw new Error('Store checkout does not belong to this user');

    const providerPayment = await this.razorpayClient.fetchPayment(parsedPaymentId, {
      expectedOrderId: parsedOrderId,
      expectedAmountMinor: checkout.totalMinor,
      expectedCurrency: checkout.currency,
    });

    if (providerPayment.order_id && providerPayment.order_id !== parsedOrderId) {
      throw new Error('Razorpay payment does not belong to the store checkout order');
    }
    if (providerPayment.status !== 'captured') {
      checkout.status = STORE_CHECKOUT_STATUS.CLIENT_VERIFIED;
      checkout.razorpayPaymentId = parsedPaymentId;
      checkout.clientVerifiedAt = new Date();
      await checkout.save();
      throw new Error('Store payment is pending provider capture. Please refresh your order status shortly.');
    }

    const result = await this.confirmCapturedStorePayment({
      razorpayOrderId: parsedOrderId,
      razorpayPaymentId: parsedPaymentId,
      amountMinor: providerPayment.amount,
      currency: providerPayment.currency,
      providerStatus: providerPayment.status,
      signature: parsedSignature,
      source: 'client_verification_provider_fetch',
    });
    return result.order;
  }

  async confirmCapturedStorePayment({ razorpayOrderId, razorpayPaymentId, amountMinor, currency, providerStatus, signature, source, transaction }) {
    const run = async (t) => {
      const checkout = await this.models.StoreCheckoutIntent.findOne({
        where: { razorpayOrderId },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!checkout) return null;
      if (amountMinor !== undefined && Number(amountMinor) !== Number(checkout.totalMinor)) {
        throw new Error('Razorpay payment amount does not match store checkout');
      }
      if (currency && currency !== checkout.currency) {
        throw new Error('Razorpay payment currency does not match store checkout');
      }
      if (checkout.status === STORE_CHECKOUT_STATUS.PAID && checkout.storeOrderId) {
        const existingOrder = await this.models.StoreOrder.findByPk(checkout.storeOrderId, { transaction: t });
        return { checkout, order: existingOrder, source };
      }

      const snapshotItems = await this.models.StoreCheckoutItem.findAll({
        where: { checkoutIntentId: checkout.id },
        transaction: t
      });
      if (snapshotItems.length === 0) throw new Error('Store checkout snapshot is empty');

      const reservations = await this.models.InventoryReservation.findAll({
        where: { checkoutIntentId: checkout.id },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      for (const reservation of reservations) {
        if (reservation.status === RESERVATION_STATUS.CONSUMED) continue;
        if (reservation.status !== RESERVATION_STATUS.RESERVED) {
          throw new Error('Store checkout inventory reservation is not available');
        }
        const product = await this.models.Product.findByPk(reservation.productId, {
          transaction: t,
          lock: t.LOCK?.UPDATE
        });
        if (!product || product.inventoryCount < reservation.quantity) {
          throw new Error('Reserved inventory is no longer available');
        }
        product.inventoryCount -= reservation.quantity;
        await product.save({ transaction: t });
        reservation.status = RESERVATION_STATUS.CONSUMED;
        reservation.consumedAt = new Date();
        await reservation.save({ transaction: t });
      }

      let payment = checkout.paymentId ? await this.models.Payment.findByPk(checkout.paymentId, { transaction: t }) : null;
      if (!payment) {
        payment = await this.models.Payment.create({
          id: uuidv4(),
          userId: checkout.userId,
          amount: minorUnitsToDecimal(checkout.totalMinor),
          amountMinor: checkout.totalMinor,
          currency: checkout.currency,
          status: PAYMENT_STATUS.CAPTURED,
          providerStatus: providerStatus || 'captured',
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: signature || null,
          purpose: STORE_PURPOSE,
          storeCheckoutIntentId: checkout.id,
        }, { transaction: t });
      } else {
        setPaymentStatus(payment, PAYMENT_STATUS.CAPTURED);
        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = signature || payment.razorpaySignature;
        payment.providerStatus = providerStatus || 'captured';
        await payment.save({ transaction: t });
      }

      let order = checkout.storeOrderId ? await this.models.StoreOrder.findByPk(checkout.storeOrderId, { transaction: t }) : null;
      if (!order) {
        order = await this.models.StoreOrder.create({
          id: uuidv4(),
          userId: checkout.userId,
          addressId: checkout.addressId,
          totalAmount: minorUnitsToDecimal(checkout.totalMinor),
          totalAmountMinor: checkout.totalMinor,
          currency: checkout.currency,
          paymentStatus: PAYMENT_STATUS.CAPTURED,
          paymentId: payment.id,
          storeCheckoutIntentId: checkout.id,
          status: 'processing'
        }, { transaction: t });

        for (const item of snapshotItems) {
          await this.models.StoreOrderItem.create({
            id: uuidv4(),
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: minorUnitsToDecimal(item.unitPriceMinor)
          }, { transaction: t });
        }
      }

      payment.storeOrderId = order.id;
      await payment.save({ transaction: t });

      let invoice = checkout.invoiceId ? await this.models.Invoice.findByPk(checkout.invoiceId, { transaction: t }) : null;
      if (!invoice) {
        invoice = await this.models.Invoice.create({
          id: uuidv4(),
          userId: checkout.userId,
          paymentId: payment.id,
          amount: minorUnitsToDecimal(checkout.totalMinor),
          status: 'paid',
          invoiceNumber: `STORE-${checkout.receipt}`,
          billingDate: new Date(),
          dueDate: new Date()
        }, { transaction: t });
      }

      let tx = await this.models.FinancialTransaction.findOne({
        where: { paymentId: payment.id, type: 'payment' },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (!tx) {
        const amount = Number(minorUnitsToDecimal(checkout.totalMinor));
        tx = await this.models.FinancialTransaction.create({
          id: uuidv4(),
          userId: checkout.userId,
          centerId: checkout.centerId || null,
          amount,
          type: 'payment',
          status: 'completed',
          centerShare: Number((amount * 0.70).toFixed(2)),
          platformShare: Number((amount * 0.30).toFixed(2)),
          paymentId: payment.id,
          invoiceId: invoice.id
        }, { transaction: t });
      }

      await this.removePurchasedCartItems(checkout.userId, snapshotItems, t);

      checkout.status = STORE_CHECKOUT_STATUS.PAID;
      checkout.razorpayPaymentId = razorpayPaymentId;
      checkout.providerConfirmedAt = new Date();
      checkout.storeOrderId = order.id;
      checkout.paymentId = payment.id;
      checkout.invoiceId = invoice.id;
      checkout.failureCode = null;
      checkout.failureMessage = null;
      await checkout.save({ transaction: t });

      order.paymentId = payment.id;
      order.invoiceId = invoice.id;
      order.paymentStatus = PAYMENT_STATUS.CAPTURED;
      await order.save({ transaction: t });

      return { checkout, order, payment, invoice, transaction: tx, source };
    };

    return transaction ? run(transaction) : this.sequelize.transaction(run);
  }

  async markStorePaymentFailed({ razorpayOrderId, razorpayPaymentId, failureCode, failureMessage, transaction }) {
    const checkout = await this.models.StoreCheckoutIntent.findOne({
      where: { razorpayOrderId },
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
    if (!checkout || checkout.status === STORE_CHECKOUT_STATUS.PAID) return checkout;
    checkout.status = STORE_CHECKOUT_STATUS.FAILED;
    checkout.razorpayPaymentId = razorpayPaymentId || checkout.razorpayPaymentId;
    checkout.failureCode = failureCode || null;
    checkout.failureMessage = String(failureMessage || 'Store payment failed').slice(0, 500);
    await checkout.save({ transaction });
    await this.releaseReservations(checkout.id, RESERVATION_STATUS.RELEASED, transaction);
    return checkout;
  }

  async releaseStoreCheckout(checkoutId, status, failureCode, failureMessage) {
    await this.sequelize.transaction(async (t) => {
      const checkout = await this.models.StoreCheckoutIntent.findByPk(checkoutId, { transaction: t, lock: t.LOCK?.UPDATE });
      if (!checkout || checkout.status === STORE_CHECKOUT_STATUS.PAID) return;
      checkout.status = status;
      checkout.failureCode = failureCode || checkout.failureCode;
      checkout.failureMessage = failureMessage || checkout.failureMessage;
      await checkout.save({ transaction: t });
      await this.releaseReservations(checkout.id, RESERVATION_STATUS.RELEASED, t);
    });
  }

  async releaseReservations(checkoutIntentId, status, transaction) {
    const reservations = await this.models.InventoryReservation.findAll({
      where: { checkoutIntentId },
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
    for (const reservation of reservations) {
      if (reservation.status !== RESERVATION_STATUS.RESERVED) continue;
      reservation.status = status;
      reservation.releasedAt = new Date();
      await reservation.save({ transaction });
    }
  }

  async removePurchasedCartItems(userId, snapshotItems, transaction) {
    for (const item of snapshotItems) {
      const cartItem = await this.models.CartItem.findOne({
        where: { userId, productId: item.productId },
        transaction,
        lock: transaction?.LOCK?.UPDATE
      });
      if (!cartItem) continue;
      if (cartItem.quantity <= item.quantity) {
        await this.models.CartItem.destroy({ where: { id: cartItem.id }, transaction });
      } else {
        cartItem.quantity -= item.quantity;
        await cartItem.save({ transaction });
      }
    }
  }

  async expireStoreCheckouts() {
    const { Op } = this.models.Sequelize || { Op: {} };
    const now = new Date();
    const expired = await this.models.StoreCheckoutIntent.findAll({
      where: {
        status: [STORE_CHECKOUT_STATUS.CREATED, STORE_CHECKOUT_STATUS.ORDER_CREATED, STORE_CHECKOUT_STATUS.CLIENT_VERIFIED],
        expiresAt: { [Op.lte]: now }
      }
    });
    for (const checkout of expired) {
      await this.releaseStoreCheckout(checkout.id, STORE_CHECKOUT_STATUS.EXPIRED, 'CHECKOUT_EXPIRED', 'Store checkout expired before payment confirmation');
    }
    return expired.length;
  }

  async getMyOrders(userId) {
    return this.models.StoreOrder.findAll({
      where: { userId },
      include: [
        { model: this.models.UserAddress, as: 'address' },
        { 
          model: this.models.StoreOrderItem, 
          as: 'items',
          include: [{ model: this.models.Product, as: 'product' }]
        },
        {
          model: this.models.StoreOrderReturn,
          as: 'returnRequest'
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getAdminOrders() {
    return this.models.StoreOrder.findAll({
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.UserAddress, as: 'address' },
        { 
          model: this.models.StoreOrderItem, 
          as: 'items',
          include: [{ model: this.models.Product, as: 'product' }]
        },
        {
          model: this.models.StoreOrderReturn,
          as: 'returnRequest'
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async updateOrderTracking(orderId, carrier, trackingNumber, estimatedDeliveryDate) {
    const order = await this.models.StoreOrder.findByPk(orderId);
    if (!order) throw new Error('Order not found');

    order.carrier = carrier;
    order.trackingNumber = trackingNumber;
    if (estimatedDeliveryDate) {
      order.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    }
    await order.save();
    return order;
  }

  async updateOrderStatus(orderId, status) {
    const order = await this.models.StoreOrder.findByPk(orderId);
    if (!order) throw new Error('Order not found');

    order.status = status;
    if (status === 'shipped') {
      order.shippedAt = new Date();
    } else if (status === 'delivered') {
      order.deliveredAt = new Date();
    }
    await order.save();
    return order;
  }

  async requestOrderReturn(userId, orderId, reason) {
    const order = await this.models.StoreOrder.findOne({
      where: { id: orderId, userId }
    });
    if (!order) throw new Error('Order not found');
    if (order.status !== 'delivered') {
      throw new Error('Only delivered orders can be returned');
    }

    const existingReturn = await this.models.StoreOrderReturn.findOne({
      where: { orderId }
    });
    if (existingReturn) throw new Error('Return request already submitted for this order');

    return this.models.StoreOrderReturn.create({
      orderId,
      reason,
      status: 'requested'
    });
  }

  async reviewOrderReturn(orderReturnId, status, adminNotes) {
    const ret = await this.models.StoreOrderReturn.findByPk(orderReturnId);
    if (!ret) throw new Error('Return request not found');

    ret.status = status;
    if (adminNotes) ret.adminNotes = adminNotes;
    await ret.save();

    if (status === 'approved' || status === 'refunded') {
      const order = await this.models.StoreOrder.findByPk(ret.orderId);
      if (order) {
        order.status = 'cancelled'; // refund transitions to cancelled
        await order.save();
      }
    }

    return ret;
  }

  // 5. Product CRUD for Staff/Admin
  async createProduct(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const { title, description, price, imageUrl, inventoryCount, category, centerId } = input;
    if (!title || !title.trim()) throw new Error('Product title is required');
    if (price < 0) throw new Error('Price cannot be negative');
    if (inventoryCount < 0) throw new Error('Inventory count cannot be negative');

    return this.models.Product.create({
      id: uuidv4(),
      title: title.trim(),
      description: description?.trim() || null,
      price,
      imageUrl: imageUrl?.trim() || null,
      inventoryCount,
      category,
      centerId: centerId || null
    });
  }

  async updateProduct(viewer, id, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const product = await this.models.Product.findByPk(id);
    if (!product) throw new Error('Product not found');

    const { title, description, price, imageUrl, inventoryCount, category, centerId } = input;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (price !== undefined) {
      if (price < 0) throw new Error('Price cannot be negative');
      updates.price = price;
    }
    if (imageUrl !== undefined) updates.imageUrl = imageUrl?.trim() || null;
    if (inventoryCount !== undefined) {
      if (inventoryCount < 0) throw new Error('Inventory count cannot be negative');
      updates.inventoryCount = inventoryCount;
    }
    if (category !== undefined) updates.category = category;
    if (centerId !== undefined) updates.centerId = centerId || null;

    return product.update(updates);
  }

  async deleteProduct(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    const product = await this.models.Product.findByPk(id);
    if (!product) throw new Error('Product not found');

    await product.destroy();
    return true;
  }
}
