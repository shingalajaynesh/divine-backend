import 'dotenv/config';

const splitCsv = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const allowedOrigins = splitCsv(
  process.env.ALLOWED_ORIGINS ||
    'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8081',
);

export const assertSecureConfiguration = () => {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is required.');
  }
  if (Boolean(process.env.FIREBASE_PRIVATE_KEY) !== Boolean(process.env.FIREBASE_CLIENT_EMAIL)) {
    throw new Error('FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL must be provided together.');
  }
  if (Boolean(process.env.RAZORPAY_KEY_ID) !== Boolean(process.env.RAZORPAY_KEY_SECRET)) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be provided together.');
  }
  if (Boolean(process.env.WP_FALLBACK_ACCESS_TOKEN) !== Boolean(process.env.WP_FALLBACK_PHONE_NUMBER_ID)) {
    throw new Error('WP_FALLBACK_ACCESS_TOKEN and WP_FALLBACK_PHONE_NUMBER_ID must be provided together.');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production.');
    }
    if (process.env.RAZORPAY_KEY_ID === 'mock_key_id' || process.env.RAZORPAY_KEY_SECRET === 'mock_key_secret') {
      throw new Error('Mock Razorpay credentials are not allowed in production.');
    }

    // RAZORPAY_WEBHOOK_SECRET is required for webhook signature verification.
    // Warn on startup if missing — payment webhooks will be rejected until this is set.
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.warn(
        '[SECURITY WARNING] RAZORPAY_WEBHOOK_SECRET is not set. ' +
        'Incoming Razorpay webhook events will not be verified and will be rejected. ' +
        'Add this secret from your Razorpay Dashboard → Webhooks.'
      );
    }

    // WhatsApp credentials are optional until messaging is activated.
    // Warn on startup if missing — WhatsApp notifications will be silently skipped.
    if (!process.env.WP_FALLBACK_ACCESS_TOKEN || !process.env.WP_FALLBACK_PHONE_NUMBER_ID) {
      console.warn(
        '[SECURITY WARNING] WP_FALLBACK_ACCESS_TOKEN or WP_FALLBACK_PHONE_NUMBER_ID is not set. ' +
        'WhatsApp notification delivery will be disabled until these are configured.'
      );
    } else if (process.env.WP_FALLBACK_ACCESS_TOKEN === 'EAA...' || process.env.WP_FALLBACK_PHONE_NUMBER_ID === '123456') {
      throw new Error('Mock WhatsApp provider credentials are not allowed in production.');
    }

    if (process.env.DATABASE_URL) {
      if (!process.env.ALLOWED_ORIGINS) {
        throw new Error('Missing required production configuration: ALLOWED_ORIGINS');
      }
    } else {
      const required = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'ALLOWED_ORIGINS'];
      const missing = required.filter((key) => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
      }
    }
  }
};

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-Id',
    'X-Device-Name',
    'X-Device-Type',
  ],
};
