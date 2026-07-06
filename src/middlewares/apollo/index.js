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
import Logger, { setContext, runWithContext } from '../../util/logger.js';

const pubSub = new PubSub();

const formatError = (formattedError, error) => {
  const log = new Logger('Apollo').configureLogger();
  const originalError = unwrapResolverError(error);
  log.error('Apollo Error', originalError);
  return formattedError;
};

const updateAllManagersViewer = (viewer, managers) => {
  const viewerManagers = ['userManager', 'authManager'];
  viewerManagers.forEach((managerName) => {
    if (managers[managerName]) {
      managers[managerName].viewer = viewer;
    }
  });
};

const createContext = async ({ req, res }) => {
  const log = req.logger.configureLogger();
  const authHeader = req.headers.authorization || '';
  const requestId = uuidv4();
  
  let viewer = null;

  // Initialize managers
  const userManager = new UserManager(req.models, viewer, req.logger);
  const authManager = new AuthManager(req.models, viewer, req.logger);

  // Set initial request tracing
  setContext('requestId', requestId);

  try {
    if (authHeader.startsWith('Bearer ')) {
      // 1. Verify Clerk Auth token
      const tokenVerification = await authManager.verifyClerkToken(authHeader);
      
      if (tokenVerification.valid && tokenVerification.decoded) {
        // Clerk ID is stored as sub in token claims
        const clerkId = tokenVerification.decoded.sub;
        
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
            updateAllManagersViewer(viewer, { userManager, authManager });
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
