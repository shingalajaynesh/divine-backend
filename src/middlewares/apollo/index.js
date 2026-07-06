import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import GraphQlLoggingPlugin from './graphql_logging_plugin.js';
import { expressMiddleware } from '@apollo/server/express4';
import { WebSocketServer } from 'ws';
import { PubSub } from 'graphql-subscriptions';
import { useServer } from 'graphql-ws/lib/use/ws';
import { unwrapResolverError } from '@apollo/server/errors';
import schema from '../../gql/schema/index.js';
import { UserManager } from '../../gql/models/userManager.js';
import { AuthManager } from '../../gql/models/authManager.js';
import { ParameterManager } from '../../gql/models/parameterManager.js';
import { DeviceManager } from '../../gql/models/deviceManager.js';
import { SessionManager } from '../../gql/models/sessionManager.js';
import { VitalsManager } from '../../gql/models/vitalsManager.js';
import Logger, { setContext, runWithContext } from '../../util/logger.js';

const pubSub = new PubSub();

const formatError = (formattedError, error) => {
  const log = new Logger('Apollo').configureLogger();
  const originalError = unwrapResolverError(error);
  log.error('Apollo Error', originalError);
  return formattedError;
};

const updateAllManagersViewer = (viewer, managers) => {
  const viewerManagers = ['userManager', 'authManager', 'parameterManager', 'deviceManager', 'sessionManager', 'vitalsManager'];
  viewerManagers.forEach((managerName) => {
    if (managers[managerName]) {
      managers[managerName].viewer = viewer;
    }
  });
};

const createContext = async ({ req, res }) => {
  const log = req.logger.configureLogger();
  const authHeader = req.headers.authorization || '';
  const requestId = req.requestId || uuidv4();
  
  let viewer = null;

  // Initialize managers
  const userManager = new UserManager(req.models, viewer, req.logger);
  const authManager = new AuthManager(req.models, viewer, req.logger);
  const parameterManager = new ParameterManager(req.models, viewer, req.logger);
  const deviceManager = new DeviceManager(req.models, viewer, req.logger);
  const sessionManager = new SessionManager(req.models, viewer, req.logger);
  const vitalsManager = new VitalsManager(req.models, viewer, req.logger);

  const managers = { userManager, authManager, parameterManager, deviceManager, sessionManager, vitalsManager };

  // Set initial request tracing
  setContext('requestId', requestId);

  try {
    if (authHeader.startsWith('Bearer ')) {
      // 1. Verify Clerk Auth token
      const tokenVerification = await authManager.verifyClerkToken(authHeader);
      
      if (tokenVerification.valid && tokenVerification.decoded) {
        // Clerk ID is stored as sub in token claims
        const clerkId = tokenVerification.decoded.sub;
        const sid = tokenVerification.decoded.sid; // Clerk session ID
        
        if (clerkId) {
          // 2. Fetch local user matching clerkId
          viewer = await req.models.User.findOne({
            where: { clerkId },
            include: [
              { model: req.models.Role, as: 'role' },
              { model: req.models.Center, as: 'center' }
            ]
          });

          if (viewer) {
            setContext('userId', viewer.id);
            setContext('centerId', viewer.centerId);
            
            // Update viewer in managers
            updateAllManagersViewer(viewer, managers);

            // 3. Extract device headers
            const deviceInfo = {
              deviceId: req.headers['x-device-id'] || '',
              deviceName: req.headers['x-device-name'] || '',
              deviceType: req.headers['x-device-type'] || 'web',
              userAgent: req.headers['user-agent'] || '',
              ipAddress: req.ip || req.connection.remoteAddress || '',
            };

            // 4. Validate device whitelisting
            const isDeviceOp = req.body?.query?.includes('registerDevice') || 
                               req.body?.query?.includes('deauthorizeDevice') || 
                               req.body?.query?.includes('getMyDevices');

            const deviceCheck = await deviceManager.validateDevice(viewer.id, deviceInfo.deviceId, viewer.centerId);
            if (!deviceCheck.isValid) {
              req.logger.warn(`Device check failed for user ${viewer.id}: ${deviceCheck.reason}`);
              if (deviceCheck.reason !== 'Device whitelisting disabled' && !isDeviceOp) {
                throw new Error(`Device unauthorized: ${deviceCheck.reason}`);
              }
            } else if (deviceInfo.deviceId) {
              // Register/update device
              await deviceManager.registerDevice(viewer.id, deviceInfo);
            }

            // 5. Validate User Session
            if (sid) {
              const sessionCheck = await sessionManager.validateSession(sid, viewer.centerId);
              if (!sessionCheck.valid) {
                if (sessionCheck.reason === 'SESSION_NOT_FOUND') {
                  try {
                    // Register session locally
                    await sessionManager.createSession(viewer.id, {
                      ...deviceInfo,
                      id: sid
                    });
                  } catch (e) {
                    if (e.name === 'SequelizeUniqueConstraintError') {
                      req.logger.info(`Session ${sid} was registered concurrently by another request. skipping duplicate insert.`);
                    } else {
                      throw e;
                    }
                  }
                } else {
                  req.logger.warn(`User session invalid: ${sessionCheck.reason}`);
                  throw new Error(`Session invalid: ${sessionCheck.reason}`);
                }
              }
            }
          } else {
            req.logger.warn('Clerk user validated but not found in local database:', { clerkId });
          }
        }
      } else {
        req.logger.warn('Invalid Clerk token received:', tokenVerification.error);
      }
    }
  } catch (error) {
    req.logger.error('Error establishing context user authentication:', error);
    throw error;
  }

  return {
    req,
    res,
    viewer,
    log: req.logger,
    requestId,
    pubSub,
    userManager,
    authManager,
    parameterManager,
    deviceManager,
    sessionManager,
    vitalsManager,
    models: req.models,
    sequelize: req.sequelize,
  };
};

export default async (httpServer) => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS setup
  const corsOptions = {
    origin: true,
    credentials: true,
  };
  app.use(cors(corsOptions));

  // WebSocket Server setup for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  useServer(
    {
      schema,
      context: async (ctx) => {
        const log = new Logger('WS');
        const token = ctx.connectionParams?.authorization || '';
        let viewer = null;

        // Models reference from main db object
        const { models } = wsServer; // we bind models during setup below

        const userManager = new UserManager(models, null, log);
        const authManager = new AuthManager(models, null, log);
        const parameterManager = new ParameterManager(models, null, log);
        const deviceManager = new DeviceManager(models, null, log);
        const sessionManager = new SessionManager(models, null, log);
        const vitalsManager = new VitalsManager(models, null, log);

        const managers = { userManager, authManager, parameterManager, deviceManager, sessionManager, vitalsManager };

        try {
          if (token.startsWith('Bearer ')) {
            const tokenVerification = await authManager.verifyClerkToken(token);
            if (tokenVerification.valid && tokenVerification.decoded) {
              const clerkId = tokenVerification.decoded.sub;
              viewer = await models.User.findOne({
                where: { clerkId },
                include: [
                  { model: models.Role, as: 'role' },
                  { model: models.Center, as: 'center' }
                ]
              });
              if (viewer) {
                updateAllManagersViewer(viewer, managers);
              }
            }
          }
        } catch (err) {
          log.error('WS token verification failed:', err);
        }

        return {
          pubSub,
          requestId: uuidv4(),
          log,
          viewer,
          userManager,
          authManager,
          parameterManager,
          deviceManager,
          sessionManager,
          vitalsManager,
          models,
        };
      },
    },
    wsServer
  );

  const landingPagePlugin =
    process.env.NODE_ENV === 'production'
      ? ApolloServerPluginLandingPageDisabled()
      : ApolloServerPluginLandingPageLocalDefault({
          embed: false,
          includeCookies: true,
        });

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: 'bounded',
    introspection: true,
    allowBatchedHttpRequests: true,
    plugins: [
      landingPagePlugin,
      GraphQlLoggingPlugin,
      {
        async serverWillStart() {
          return {
            async drainServer() {
              wsServer.close();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        // Share models to ws server for subscription connections
        wsServer.models = req.models;
        return createContext({ req, res });
      },
    })
  );

  return app;
};
