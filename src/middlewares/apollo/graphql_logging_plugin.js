// GraphQL Logging Plugin with parameter sanitization
const LOG_GRAPH_QL_REQUESTS = 'true' === (process.env.LOG_GRAPH_QL_REQUESTS || 'false').toLowerCase();
const LOG_GRAPH_QL_RESPONSES = 'true' === (process.env.LOG_GRAPH_QL_RESPONSES || 'false').toLowerCase();
const LOG_GRAPH_QL_VARIABLES = 'true' === (process.env.LOG_GRAPH_QL_VARIABLES || 'false').toLowerCase();
const LOG_GRAPH_QL_DOCUMENTS = 'true' === (process.env.LOG_GRAPH_QL_DOCUMENTS || 'false').toLowerCase();

const SENSITIVE_KEYS = new Set([
  'password',
  'pwhash',
  'token',
  'refreshtoken',
  'emailaddress',
  'mobileno',
  'clientsecret',
  'secret',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'clientemail',
  'client_email',
  'authtoken',
  'authorization',
  'razorpaykeysecret',
  'razorpaysignature',
  'razorpay_signature',
  'firebasetoken',
  'firebase_token',
  'databaseurl',
  'database_url',
  'pin',
  'email',
  'phone',
  'mobile',
  'name',
  'city',
  'message',
  'content',
  'lmpdate',
  'duedate',
  'weight',
  'bloodsugar',
  'systolicbp',
  'diastolicbp',
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
          operationName: requestContext.request.operationName,
        };
        if (LOG_GRAPH_QL_DOCUMENTS) sanitizedRequest.query = requestContext.request.query;
        if (LOG_GRAPH_QL_VARIABLES) sanitizedRequest.variables = sanitize(requestContext.request.variables);
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
              logMeta.errors = errors.map((error) => ({
                message: error.message,
                code: error.extensions?.code,
              }));
            }
            log.info('graphql response >>>', logMeta);
          }
        }
      },
    };
  },
};

export default GraphQlLoggingPlugin;
