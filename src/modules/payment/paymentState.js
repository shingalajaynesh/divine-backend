export const CHECKOUT_STATUS = Object.freeze({
  CREATED: 'created',
  ORDER_CREATED: 'order_created',
  CLIENT_VERIFIED: 'client_verified',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUND_PENDING: 'refund_pending',
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
});

export const REFUND_STATUS = Object.freeze({
  REQUESTED: 'requested',
  PROVIDER_CREATED: 'provider_created',
  PROCESSED: 'processed',
  FAILED: 'failed',
});

const checkoutTransitions = {
  [CHECKOUT_STATUS.CREATED]: [CHECKOUT_STATUS.ORDER_CREATED, CHECKOUT_STATUS.FAILED, CHECKOUT_STATUS.EXPIRED],
  [CHECKOUT_STATUS.ORDER_CREATED]: [CHECKOUT_STATUS.CLIENT_VERIFIED, CHECKOUT_STATUS.PAID, CHECKOUT_STATUS.FAILED, CHECKOUT_STATUS.EXPIRED],
  [CHECKOUT_STATUS.CLIENT_VERIFIED]: [CHECKOUT_STATUS.PAID, CHECKOUT_STATUS.FAILED, CHECKOUT_STATUS.EXPIRED],
  [CHECKOUT_STATUS.FAILED]: [CHECKOUT_STATUS.PAID],
  [CHECKOUT_STATUS.PAID]: [CHECKOUT_STATUS.PARTIALLY_REFUNDED, CHECKOUT_STATUS.REFUNDED],
  [CHECKOUT_STATUS.PARTIALLY_REFUNDED]: [CHECKOUT_STATUS.REFUNDED],
  [CHECKOUT_STATUS.REFUNDED]: [],
  [CHECKOUT_STATUS.EXPIRED]: [],
};

const paymentTransitions = {
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.AUTHORIZED, PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.AUTHORIZED]: [PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.FAILED]: [PAYMENT_STATUS.CAPTURED],
  [PAYMENT_STATUS.CAPTURED]: [PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.REFUND_PENDING]: [PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.CAPTURED],
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: [PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.REFUNDED]: [],
};

const canTransition = (map, current, next) => current === next || (map[current] || []).includes(next);

export const setCheckoutStatus = (checkout, nextStatus) => {
  if (!canTransition(checkoutTransitions, checkout.status, nextStatus)) {
    throw new Error(`Invalid checkout status transition: ${checkout.status} -> ${nextStatus}`);
  }
  checkout.status = nextStatus;
};

export const setPaymentStatus = (payment, nextStatus) => {
  const current = payment.status === 'succeeded' ? PAYMENT_STATUS.CAPTURED : payment.status;
  if (!canTransition(paymentTransitions, current, nextStatus)) {
    throw new Error(`Invalid payment status transition: ${payment.status} -> ${nextStatus}`);
  }
  payment.status = nextStatus;
};

export const isPaymentCaptured = (status) => status === PAYMENT_STATUS.CAPTURED || status === 'succeeded';
