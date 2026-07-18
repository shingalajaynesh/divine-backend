import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { Op } from 'sequelize';
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
import { ProgramManager } from '../../gql/models/programManager.js';
import { ContentCmsManager } from '../../gql/models/contentCmsManager.js';
import { NotificationManager } from '../../gql/models/notificationManager.js';
import Logger, { setContext, runWithContext } from '../../util/logger.js';


const pubSub = new PubSub();

const formatError = (formattedError, error) => {
  const correlationId = uuidv4();
  const log = new Logger('Apollo').configureLogger();
  const originalError = unwrapResolverError(error) || error;

  // Log detailed error stack and path on the server side with the correlation ID
  log.error(`Apollo Error [Correlation ID: ${correlationId}]:`, {
    message: error.message,
    stack: originalError.stack,
    path: error.path,
    extensions: error.extensions,
  });

  if (process.env.NODE_ENV === 'production') {
    // Client-safe codes that are safe to expose
    const safeCodes = ['UNAUTHENTICATED', 'FORBIDDEN', 'BAD_USER_INPUT', 'PAYMENTS_NOT_CONFIGURED', 'DEVICE_UNAUTHORIZED'];
    const code = error.extensions?.code;
    const isSafe = safeCodes.includes(code);

    return {
      message: isSafe ? error.message : 'An unexpected error occurred. Please contact support.',
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: isSafe ? code : 'INTERNAL_SERVER_ERROR',
        correlationId,
      },
    };
  }

  // In non-production, return details but append the correlationId
  return {
    ...formattedError,
    extensions: {
      ...formattedError.extensions,
      correlationId,
    }
  };
};

const updateAllManagersViewer = (viewer, managers) => {
  const viewerManagers = ['userManager', 'authManager', 'parameterManager', 'deviceManager', 'sessionManager', 'vitalsManager', 'programManager', 'contentCmsManager', 'notificationManager'];
  viewerManagers.forEach((managerName) => {
    if (managers[managerName]) {
      managers[managerName].viewer = viewer;
    }
  });
};

const buildDeviceInfo = (headersLike = {}, fallbackType = 'web') => ({
  deviceId: headersLike['x-device-id'] || headersLike.deviceId || '',
  deviceName: headersLike['x-device-name'] || headersLike.deviceName || '',
  deviceType: headersLike['x-device-type'] || headersLike.deviceType || fallbackType,
  userAgent: headersLike['user-agent'] || headersLike.userAgent || '',
  ipAddress: headersLike.ipAddress || '',
});

const createContext = async ({ req, res }) => {
  const log = req.logger.configureLogger();
  const requestId = req.requestId || uuidv4();
  
  let viewer = null;

  // Initialize managers
  const userManager = new UserManager(req.models, viewer, req.logger);
  const authManager = new AuthManager(req.models, viewer, req.logger);
  const parameterManager = new ParameterManager(req.models, viewer, req.logger);
  const deviceManager = new DeviceManager(req.models, viewer, req.logger);
  const sessionManager = new SessionManager(req.models, viewer, req.logger);
  const vitalsManager = new VitalsManager(req.models, viewer, req.logger);
  const programManager = new ProgramManager(req.models, viewer, req.logger);
  const contentCmsManager = new ContentCmsManager(req.models, viewer, req.logger);
  const notificationManager = new NotificationManager(req.models, viewer, req.logger);

  const managers = { userManager, authManager, parameterManager, deviceManager, sessionManager, vitalsManager, programManager, contentCmsManager, notificationManager };

  // Set initial request tracing
  setContext('requestId', requestId);

  let firebaseUserId = null;
  let firebaseAuth = null;
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decodedToken = await getAuth().verifyIdToken(token);
      firebaseAuth = decodedToken;
      firebaseUserId = decodedToken.uid;
      const emailAddress = decodedToken.email?.trim().toLowerCase() || '';
      const sid = firebaseUserId + '_' + decodedToken.auth_time;

      // 2. Fetch local user matching firebaseUid or emailAddress
      viewer = await req.models.User.findOne({
        where: {
          [req.sequelize.Sequelize.Op.or]: [
            { firebaseUid: firebaseUserId },
            ...(decodedToken.email_verified && emailAddress ? [{ emailAddress, firebaseUid: null }] : [])
          ]
        },
        include: [
          { model: req.models.Role, as: 'role' },
          { model: req.models.Center, as: 'center' }
        ]
      });

      if (viewer) {
        // Auto-link firebaseUid if it was found via email but not yet set
        if (!viewer.firebaseUid) {
          await viewer.update({ firebaseUid: firebaseUserId });
        }

        setContext('userId', viewer.id);
        setContext('centerId', viewer.centerId);
        
        // Update viewer in managers
        updateAllManagersViewer(viewer, managers);

        // 3. Extract device headers
        const deviceInfo = buildDeviceInfo({
          ...req.headers,
          ipAddress: req.ip || req.connection.remoteAddress || '',
        }, 'web');

        // 4. Validate User Session
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
        req.logger.warn('Firebase user validated but not found in local database:', { firebaseUserId });
      }
    }
  } catch (error) {
    req.logger.warn('Error establishing context user authentication (proceeding as unauthenticated):', error.message || error);
    viewer = null;
    firebaseUserId = null;
    firebaseAuth = null;
    updateAllManagersViewer(null, managers);
  }

  return {
    req,
    res,
    viewer,
    firebaseUserId: firebaseUserId || null,
    firebaseAuth,
    log: req.logger,
    requestId,
    pubSub,
    userManager,
    authManager,
    parameterManager,
    deviceManager,
    sessionManager,
    vitalsManager,
    programManager,
    contentCmsManager,
    notificationManager,
    models: req.models,
    sequelize: req.sequelize,
  };
};

export default async (httpServer, models) => {
  const app = express();

  // WebSocket Server setup for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });
  wsServer.models = models;

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
        const programManager = new ProgramManager(models, null, log);
        const contentCmsManager = new ContentCmsManager(models, null, log);
        const notificationManager = new NotificationManager(models, null, log);

        const managers = { userManager, authManager, parameterManager, deviceManager, sessionManager, vitalsManager, programManager, contentCmsManager, notificationManager };

        try {
          if (token.startsWith('Bearer ')) {
            const verifiedToken = await getAuth().verifyIdToken(token.replace('Bearer ', ''));
            if (verifiedToken?.uid) {
              const firebaseUid = verifiedToken.uid;
              const emailAddress = verifiedToken.email?.trim().toLowerCase() || '';
              const sid = firebaseUid + '_' + verifiedToken.auth_time;
              viewer = await models.User.findOne({
                where: {
                  [Op.or]: [
                    { firebaseUid },
                    ...(verifiedToken.email_verified && emailAddress ? [{ emailAddress, firebaseUid: null }] : [])
                  ]
                },
                include: [
                  { model: models.Role, as: 'role' },
                  { model: models.Center, as: 'center' }
                ]
              });
              if (viewer) {
                if (!viewer.firebaseUid) {
                  await viewer.update({ firebaseUid });
                }

                const deviceInfo = buildDeviceInfo(ctx.connectionParams || {}, 'websocket');
                const deviceCheck = await deviceManager.validateDevice(viewer.id, deviceInfo.deviceId, viewer.centerId);
                if (!deviceCheck.isValid && deviceCheck.reason !== 'Device whitelisting disabled') {
                  throw new Error(`Device unauthorized: ${deviceCheck.reason}`);
                }

                if (sid) {
                  const sessionCheck = await sessionManager.validateSession(sid, viewer.centerId);
                  if (!sessionCheck.valid && sessionCheck.reason !== 'SESSION_NOT_FOUND') {
                    throw new Error(`Session invalid: ${sessionCheck.reason}`);
                  }
                }

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
          programManager,
          contentCmsManager,
          notificationManager,
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
    introspection: process.env.NODE_ENV !== 'production',
    allowBatchedHttpRequests: process.env.NODE_ENV !== 'production',
    formatError,
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
