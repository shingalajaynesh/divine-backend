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

  if (process.env.NODE_ENV === 'production') {
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
