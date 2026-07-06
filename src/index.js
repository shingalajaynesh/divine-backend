import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import { v4 as uuidv4 } from 'uuid';
import { DataModels } from 'divine-data-models';
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

const startServer = async () => {
  try {
    assertSecureConfiguration();
    // 1. Initialize centralized database models
    const dataModels = new DataModels(new Logger('Database'));
    const useSSL = process.env.DB_SSL === 'true';
    dataModels.init({
      database: process.env.DB_NAME || 'divine_garbh_sanskar',
      dbUser: process.env.DB_USER || 'postgres',
      dbPassword: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      dialectOptions: useSSL ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    });

    log.info('Centralized database models initialized successfully.');

    // 2. Create Express app
    const app = express();
    app.set('trust proxy', 1);
    app.use(
      clerkMiddleware({
        authorizedParties: allowedOrigins,
      }),
    );
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use(cors(corsOptions));
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

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', uptime: process.uptime() });
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
    });
  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
