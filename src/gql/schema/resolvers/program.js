import { authenticate } from '../permissions/index.js';

export const programResolvers = {
  Query: {
    programCatalog: authenticate((parent, args, context) => context.programManager.getCatalog()),
    myProgramEnrollments: authenticate((parent, args, context) => context.programManager.getMyEnrollments()),
  },
  Mutation: {
    enrollInProgram: authenticate((parent, args, context) => context.programManager.enroll(args.programId)),
    updateActivityProgress: authenticate((parent, args, context) => context.programManager.updateProgress(args.activityId, args.input)),
  },
};
