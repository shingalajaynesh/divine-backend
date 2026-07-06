import { authenticate, authorizeRoles } from '../permissions/index.js';
import { InquiryService } from '../../../modules/inquiries/inquiry.service.js';
import { GraphQLError } from 'graphql';
import { ZodError } from 'zod';

const staffOnly = (next) => authenticate(authorizeRoles(['STAFF', 'ADMIN'], next));

const getService = (context) => new InquiryService(context.models, context.sequelize);

const runValidated = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new GraphQLError('Please check the submitted information.', {
        extensions: {
          code: 'BAD_USER_INPUT',
          fields: error.issues.map((issue) => issue.path.join('.')),
        },
      });
    }
    throw error;
  }
};

export const inquiryResolvers = {
  Inquiry: {
    createdAt: (parent) => parent.createdAt.toISOString(),
    updatedAt: (parent) => parent.updatedAt.toISOString(),
    responses: async (parent, args, context) => {
      if (parent.responses) return parent.responses;
      return context.models.InquiryResponse.findAll({
        where: { inquiryId: parent.id },
        include: [{ model: context.models.User, as: 'author' }],
        order: [['createdAt', 'ASC']],
      });
    },
  },
  InquiryResponse: {
    createdAt: (parent) => parent.createdAt.toISOString(),
    author: async (parent, args, context) =>
      parent.author || context.models.User.findByPk(parent.authorId),
  },
  Query: {
    getInquiries: staffOnly(async (parent, args, context) =>
      getService(context).list({
        ...args,
        centerId: context.viewer.centerId,
      }),
    ),
  },
  Mutation: {
    submitInquiry: async (parent, { input }, context) =>
      runValidated(() => getService(context).submit(input)),
    updateInquiryStatus: staffOnly(async (parent, args, context) =>
      runValidated(() => getService(context).updateStatus({
        ...args,
        centerId: context.viewer.centerId,
        actorId: context.viewer.id,
      })),
    ),
    replyToInquiry: staffOnly(async (parent, args, context) =>
      runValidated(() => getService(context).reply({
        ...args,
        centerId: context.viewer.centerId,
        actorId: context.viewer.id,
      })),
    ),
  },
};
