import { makeExecutableSchema } from '@graphql-tools/schema';
import { authenticate, checkPermissionFor } from './permissions/index.js';

const typeDefs = `#graphql
  type Center {
    id: ID!
    name: String!
    emailAddress: String
    contactno: String
    address: String
    isActive: Boolean!
  }

  type Role {
    id: ID!
    name: String!
    roleType: String!
    description: String
    permissions: String
  }

  type User {
    id: ID!
    clerkId: String
    emailAddress: String!
    displayName: String
    firstName: String
    lastName: String
    gender: String
    mobileNo: String
    isActive: Boolean!
    center: Center
    role: Role
  }

  type Query {
    me: User
    getUser(id: ID!): User
    getUsers(isActive: Boolean): [User!]!
  }

  type Mutation {
    syncUser(clerkUserPayload: String!): User!
    updateUser(id: ID!, firstName: String, lastName: String, displayName: String, mobileNo: String): User!
  }
`;

const resolvers = {
  User: {
    center: async (parent, args, context) => {
      if (parent.center) return parent.center;
      return await context.models.Center.findByPk(parent.centerId);
    },
    role: async (parent, args, context) => {
      if (parent.role) return parent.role;
      return await context.models.Role.findByPk(parent.roleId);
    }
  },
  
  Query: {
    me: authenticate(async (parent, args, context) => {
      return context.viewer;
    }),
    
    getUser: authenticate(checkPermissionFor({ module: 'user', operation: 'view' }, 
      async (parent, args, context) => {
        return await context.userManager.getUserById(args.id);
      }
    )),
    
    getUsers: authenticate(checkPermissionFor({ module: 'user', operation: 'view' },
      async (parent, args, context) => {
        return await context.userManager.getUsersByCenterId(args.isActive);
      }
    )),
  },
  
  Mutation: {
    // Open webhook-triggered mutation to synchronize user profile on login/sign-up
    syncUser: async (parent, args, context) => {
      const { log, authManager } = context;
      log.info('Clerk user sync mutation triggered');
      
      const payload = JSON.parse(args.clerkUserPayload);
      return await authManager.syncClerkUser(payload);
    },
    
    updateUser: authenticate(async (parent, args, context) => {
      const { userManager } = context;
      await userManager.updateUser(args);
      return await userManager.getUserById(args.id);
    })
  }
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
export const schema = typeDefs;
