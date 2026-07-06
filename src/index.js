import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { DataModels } from 'divine-data-models';
import Logger, { runWithContext } from './util/logger.js';
import bootstrapApollo from './middlewares/apollo/index.js';

dotenv.config();

const log = new Logger('Server').configureLogger();
const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
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
    app.use(express.json({ limit: '10mb' }));

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
    const apolloApp = await bootstrapApollo(httpServer);
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
