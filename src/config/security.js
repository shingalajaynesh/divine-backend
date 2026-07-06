import 'dotenv/config';

const splitCsv = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const allowedOrigins = splitCsv(
  process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:5174,http://localhost:8081',
);

export const clerkAuthorizedParties = splitCsv(
  process.env.CLERK_AUTHORIZED_PARTIES || process.env.ALLOWED_ORIGINS || '',
);

export const assertSecureConfiguration = () => {
  if (!process.env.CLERK_SECRET_KEY && !process.env.CLERK_JWT_KEY) {
    throw new Error('CLERK_SECRET_KEY or CLERK_JWT_KEY is required.');
  }

  if (process.env.NODE_ENV === 'production') {
    const required = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'ALLOWED_ORIGINS'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
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
