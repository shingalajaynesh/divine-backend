import crypto from 'node:crypto';

export const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const verifyRazorpayWebhookSignature = ({ rawBody, signature, secret }) => {
  if (!secret) throw new Error('Razorpay webhook secret is not configured.');
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    const error = new Error('Empty webhook body');
    error.statusCode = 400;
    throw error;
  }
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature)) {
    const error = new Error('Missing or malformed Razorpay webhook signature');
    error.statusCode = 401;
    throw error;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    const error = new Error('Invalid Razorpay webhook signature');
    error.statusCode = 401;
    throw error;
  }
};

export const verifyRazorpayCheckoutSignature = ({ orderId, paymentId, signature, secret, allowMock = false }) => {
  if (allowMock) return true;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
};
