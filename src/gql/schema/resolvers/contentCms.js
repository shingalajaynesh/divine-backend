import { authenticate, authorizeRoles } from '../permissions/index.js';

const staff = (next) => authenticate(authorizeRoles(['STAFF', 'ADMIN'], next));

export const contentCmsResolvers = {
  ContentItem: {
    translation: (parent) => parent.translations?.find((item) => item.language === parent.requestedLanguage) || parent.translations?.find((item) => item.language === 'en') || parent.translations?.[0] || null,
  },
  Query: {
    contentFeed: authenticate((parent, args, context) => context.contentCmsManager.getFeed(args)),
    manageContent: staff((parent, args, context) => context.contentCmsManager.manage(args)),
    searchContent: authenticate((parent, args, context) => context.contentCmsManager.search(args)),
    recentContentSearches: authenticate((parent, args, context) => context.contentCmsManager.recentSearches()),
    savedContent: authenticate((parent, args, context) => context.contentCmsManager.savedContent(args)),
    getContentViewHistory: authenticate((parent, args, context) => context.contentCmsManager.getViewHistory(args)),
  },
  Mutation: {
    createContentItem: staff((parent, args, context) => context.contentCmsManager.create(args.input)),
    publishContentItem: authenticate(authorizeRoles(['ADMIN'], (parent, args, context) => context.contentCmsManager.publish(args.id))),
    reviewContentItem: staff((parent, args, context) => context.contentCmsManager.review(args.id, args.reviewed)),
    registerMediaAsset: staff((parent, args, context) => context.contentCmsManager.registerMedia(args.input)),
    setContentBookmark: authenticate((parent, args, context) => context.contentCmsManager.setBookmark(args.input)),
    clearRecentContentSearches: authenticate((parent, args, context) => context.contentCmsManager.clearRecentSearches()),
    recordContentView: authenticate((parent, args, context) => context.contentCmsManager.recordView(args.input)),
  },
};
