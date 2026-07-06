import { GraphQLError } from 'graphql';

export const isSystemDefinedUser = (viewer) => {
  return viewer?.isSystemDefine === true;
};

/**
 * Authentication Guard - ensures the request context contains a validated viewer.
 */
export const authenticate = (next) => async (parent, args, context, info) => {
  if (!context.viewer) {
    throw new GraphQLError('Authentication required. Please login.', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
  return next(parent, args, context, info);
};

/**
 * RBAC Module Guard - checks if the viewer's role has permission for module operations.
 */
export const checkPermissionFor = ({ module, operation }, next) =>
  async (parent, args, context, info) => {
    const { viewer, log } = context;
    
    if (!viewer) {
      throw new GraphQLError('Authentication required.', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }

    const { role } = viewer;

    if (isSystemDefinedUser(viewer)) {
      log.info('Bypassing permission checks for system defined user');
      return next(parent, args, context, info);
    }
    
    if (role?.permissions && role.permissions[module] && role.permissions[module][operation]) {
      log.info(`Granted permission for ${operation.toUpperCase()} operation on ${module.toUpperCase()} module`);
      return next(parent, args, context, info);
    } else {
      log.error(`Unauthorized access for ${operation} on ${module} by user ${viewer.id}`);
      throw new GraphQLError(`You do not have permission to ${operation} ${module}`, {
        extensions: { code: 'FORBIDDEN' }
      });
    }
  };
