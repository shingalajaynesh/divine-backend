import http from 'http';
import https from 'https';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { initializeApp, cert } from 'firebase-admin/app';
import { createPrivateKey } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { initializeDataModels } from './config/db-init.js';
import Logger, { runWithContext } from './util/logger.js';
import bootstrapApollo from './middlewares/apollo/index.js';
import {
  allowedOrigins,
  assertSecureConfiguration,
  corsOptions,
} from './config/security.js';

dotenv.config();

const log = new Logger('Server').configureLogger();
const PORT = process.env.PORT || 4000;

/**
 * Starts a background loop to self-ping the server's health check endpoint.
 * This keeps the Render free tier container active.
 * @param {string} urlStr - The full health check URL of the backend (e.g. https://your-app.onrender.com/health)
 */
const startSelfPing = (urlStr) => {
  if (!urlStr) {
    log.info('BACKEND_SELF_PING_URL not configured. Self-ping keep-awake is disabled.');
    return;
  }

  const intervalMs = parseInt(process.env.SELF_PING_INTERVAL_MS, 10) || 10 * 60 * 1000; // default 10 minutes

  log.info(`Self-ping keep-awake initialized for URL: ${urlStr} (Interval: ${intervalMs / 1000}s)`);

  setInterval(() => {
    try {
      const pingUrl = new URL(urlStr);
      const requester = pingUrl.protocol === 'https:' ? https : http;
      requester.get(urlStr, (res) => {
        log.info(`Self-ping response status: ${res.statusCode}`);
      }).on('error', (err) => {
        log.error(`Self-ping request failed: ${err.message}`);
      });
    } catch (e) {
      log.error(`Invalid BACKEND_SELF_PING_URL configuration: ${e.message}`);
    }
  }, intervalMs);
};


const startServer = async () => {
  try {
    assertSecureConfiguration();

    // Initialize Firebase Admin SDK
    const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
    let hasServiceAccount = false;
    if (firebasePrivateKey?.startsWith('-----BEGIN PRIVATE KEY-----') && process.env.FIREBASE_CLIENT_EMAIL?.includes('@')) {
      try {
        createPrivateKey(firebasePrivateKey);
        hasServiceAccount = true;
      } catch {
        log.warn('Ignoring an invalid Firebase private key; replace it with a service-account key before production.');
      }
    }
    if (!hasServiceAccount) {
      log.warn('Firebase service account is not configured; ID-token verification will use the project ID only.');
    }
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      ...(hasServiceAccount ? {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: firebasePrivateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      } : {}),
    });
    // 1. Initialize centralized database models
    const dataModels = initializeDataModels(new Logger('Database'));

    log.info('Centralized database models initialized successfully.');

    // 2. Create Express app
    const app = express();
    app.set('trust proxy', 1);
    app.use(cors(corsOptions));
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: process.env.NODE_ENV === 'production' ? 300 : 3000,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      }),
    );
    app.use(express.json({ limit: '1mb' }));

    // Inject database models and connection into the express request object
    app.use((req, res, next) => {
      const requestId = uuidv4();
      runWithContext({ requestId }, () => {
        req.models = dataModels.models;
        req.sequelize = dataModels.sequelize;
        req.logger = new Logger('Request');
        req.requestId = requestId;
        next();
      });
    });

    // Ping endpoint for simple checking
    app.get('/ping', (req, res) => {
      res.status(200).json({ message: 'pong' });
    });

    // Health check endpoint with database check
    app.get('/health', async (req, res) => {
      try {
        await req.sequelize.authenticate();
        res.status(200).json({
          status: 'OK',
          database: 'connected',
          uptime: process.uptime(),
        });
      } catch (error) {
        log.error('Health check failed:', error);
        res.status(500).json({
          status: 'ERROR',
          message: 'Database connection failed',
          error: error.message,
        });
      }
    });

    // 3. Create HTTP Server
    const httpServer = http.createServer(app);

    // 4. Bootstrap Apollo Server and mount Apollo middleware onto Express
    const apolloApp = await bootstrapApollo(httpServer, dataModels.models);
    app.use('/graphql', apolloApp);

    // 5. Start listening
    httpServer.listen(PORT, () => {
      log.info(`🚀 Server ready at http://localhost:${PORT}/graphql`);
      log.info(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);
      
      // Start self-pinging keep-alive if configured
      startSelfPing(process.env.BACKEND_SELF_PING_URL);
    });
  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
