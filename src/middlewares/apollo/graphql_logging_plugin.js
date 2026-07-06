// GraphQL Logging Plugin with parameter sanitization
const LOG_GRAPH_QL_REQUESTS = 'true' === (process.env.LOG_GRAPH_QL_REQUESTS || 'true').toLowerCase();
const LOG_GRAPH_QL_RESPONSES = 'true' === (process.env.LOG_GRAPH_QL_RESPONSES || 'true').toLowerCase();

const SENSITIVE_KEYS = new Set([
  'password',
  'pwhash',
  'token',
  'refreshtoken',
  'emailaddress',
  'mobileno',
  'clientsecret',
  'secret',
  'authtoken',
  'pin',
]);

const sanitize = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        newObj[key] = '[REDACTED]';
      } else {
        newObj[key] = sanitize(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

const GraphQlLoggingPlugin = {
  async requestDidStart(requestContext) {
    const { log } = requestContext.contextValue;
    if (LOG_GRAPH_QL_REQUESTS) {
      if (requestContext.request.operationName !== 'IntrospectionQuery') {
        const sanitizedRequest = {
          query: requestContext.request.query,
          operationName: requestContext.request.operationName,
          variables: sanitize(requestContext.request.variables),
        };
        log.info('graphql request <<<', sanitizedRequest);
      }
    }
    return {
      async willSendResponse(requestContext) {
        if (LOG_GRAPH_QL_RESPONSES) {
          if (requestContext.request.operationName !== 'IntrospectionQuery') {
            const errors = requestContext.response.body?.singleResult?.errors || requestContext.response.errors;
            const logMeta = {
              operationName: requestContext.request.operationName,
              hasErrors: !!errors,
            };
            if (errors) {
              logMeta.errors = errors;
            }
            log.info('graphql response >>>', logMeta);
          }
        }
      },
    };
  },
};

export default GraphQlLoggingPlugin;
