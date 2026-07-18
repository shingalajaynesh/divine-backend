const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';
const DEFAULT_TIMEOUT_MS = 8000;

const isTestEnv = () => process.env.NODE_ENV?.includes('test');

const safeProviderError = (message, status) => {
  const error = new Error(message || 'Razorpay provider request failed');
  error.providerStatus = status || null;
  return error;
};

export class RazorpayClient {
  constructor({ keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.timeoutMs = timeoutMs;
    // In any test environment, always use mock responses.
    // This prevents live Razorpay HTTP calls when real credentials are injected as CI secrets.
    this.allowMock = isTestEnv();
  }

  assertConfigured() {
    if (this.allowMock) return;
    if (!this.keyId || !this.keySecret) {
      throw new Error('Razorpay is not configured on the server.');
    }
  }

  authHeader() {
    this.assertConfigured();
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  async request(path, { method = 'GET', body, idempotencyKey } = {}) {
    this.assertConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'X-Razorpay-Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw safeProviderError(`Razorpay request failed with status ${response.status}`, response.status);
      }
      return parsed;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw safeProviderError('Razorpay request timed out');
      }
      if (error.providerStatus) throw error;
      throw safeProviderError('Razorpay request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  async createOrder({ amount, currency, receipt, notes }) {
    if (this.allowMock) {
      return {
        id: `order_${receipt.replace(/[^A-Za-z0-9_]/g, '').slice(0, 30)}`,
        amount,
        currency,
        receipt,
        status: 'created',
        notes,
      };
    }
    return this.request('/orders', {
      method: 'POST',
      body: { amount, currency, receipt, notes },
    });
  }

  async fetchOrder(orderId) {
    if (this.allowMock) {
      return { id: orderId, status: 'paid' };
    }
    return this.request(`/orders/${encodeURIComponent(orderId)}`);
  }

  async fetchPayment(paymentId, expected = {}) {
    if (this.allowMock) {
      return {
        id: paymentId,
        order_id: expected.expectedOrderId,
        amount: expected.expectedAmountMinor,
        currency: expected.expectedCurrency || 'INR',
        status: 'captured',
      };
    }
    return this.request(`/payments/${encodeURIComponent(paymentId)}`);
  }

  async initiateRefund({ paymentId, amountMinor, notes, receipt, idempotencyKey }) {
    if (this.allowMock) {
      return {
        id: `rfnd_${idempotencyKey.replace(/[^A-Za-z0-9_]/g, '').slice(0, 24)}`,
        payment_id: paymentId,
        amount: amountMinor,
        currency: 'INR',
        status: 'processed',
        notes,
        receipt,
      };
    }
    return this.request(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      idempotencyKey,
      body: { amount: amountMinor, notes, receipt },
    });
  }

  async fetchRefund(paymentId, refundId) {
    if (this.allowMock) {
      return { id: refundId, payment_id: paymentId, status: 'processed' };
    }
    return this.request(`/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`);
  }
}
