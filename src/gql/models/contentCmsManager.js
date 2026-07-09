import { GraphQLError } from 'graphql';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { BaseManager } from './baseManager.js';

const contentTypes = new Set(['article', 'video', 'audio', 'story', 'prayer', 'affirmation', 'recipe', 'yoga', 'meditation']);
const visibilities = new Set(['free', 'enrolled', 'premium', 'staff']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mediaKinds = new Set(['image', 'audio', 'video', 'document']);

export class ContentCmsManager extends BaseManager {
  includes() {
    return [
      { model: this.models.ContentTranslation, as: 'translations' },
      { model: this.models.ContentCategory, as: 'category' },
      { model: this.models.MediaAsset, as: 'coverAsset' },
    ];
  }

  async getFeed({ language = 'en', categorySlug, contentType, limit = 30, offset = 0 }) {
    const now = new Date();
    const allowedVisibility = ['free'];
    const activeEnrollment = await this.models.ProgramEnrollment.count({ where: { userId: this.viewer.id, status: 'active' } });
    if (activeEnrollment > 0) allowedVisibility.push('enrolled');
    if (this.viewer.subscriptionStatus && this.viewer.subscriptionStatus !== 'free') allowedVisibility.push('premium');
    const where = {
      status: 'published',
      medicalReviewed: true,
      visibility: { [Op.in]: allowedVisibility },
      [Op.and]: [
        { [Op.or]: [{ centerId: null }, ...(this.viewer.centerId ? [{ centerId: this.viewer.centerId }] : [])] },
        { [Op.or]: [{ publishAt: null }, { publishAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ unpublishAt: null }, { unpublishAt: { [Op.gt]: now } }] },
      ],
    };
    if (contentType) where.contentType = contentType;
    const include = this.includes();
    if (categorySlug) include[1].where = { slug: categorySlug, isActive: true };
    const items = await this.models.ContentItem.findAll({ where, include, limit: Math.min(Math.max(limit, 1), 100), offset: Math.max(offset, 0), order: [['sortOrder', 'ASC'], ['publishAt', 'DESC']] });
    return items.map((item) => { item.requestedLanguage = language; return item; });
  }

  async memberVisibility() {
    const allowed = ['free'];
    const activeEnrollment = await this.models.ProgramEnrollment.count({ where: { userId: this.viewer.id, status: 'active' } });
    if (activeEnrollment > 0) allowed.push('enrolled');
    if (this.viewer.subscriptionStatus && this.viewer.subscriptionStatus !== 'free') allowed.push('premium');
    return allowed;
  }

  async accessibleContentWhere(extra = {}) {
    const now = new Date();
    return {
      ...extra,
      status: 'published',
      medicalReviewed: true,
      visibility: { [Op.in]: await this.memberVisibility() },
      [Op.and]: [
        { [Op.or]: [{ centerId: null }, ...(this.viewer.centerId ? [{ centerId: this.viewer.centerId }] : [])] },
        { [Op.or]: [{ publishAt: null }, { publishAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ unpublishAt: null }, { unpublishAt: { [Op.gt]: now } }] },
      ],
    };
  }

  async search({ query, language = 'en', categorySlug, contentType, limit = 30, offset = 0 }) {
    const normalized = query?.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length < 2 || normalized.length > 120) throw new GraphQLError('Search query must contain 2 to 120 characters.', { extensions: { code: 'BAD_USER_INPUT' } });
    const include = this.includes();
    include[0] = {
      ...include[0], required: true,
      where: {
        language,
        [Op.or]: [
          { title: { [Op.iLike]: `%${normalized}%` } },
          { summary: { [Op.iLike]: `%${normalized}%` } },
          { body: { [Op.iLike]: `%${normalized}%` } },
        ],
      },
    };
    if (categorySlug) include[1].where = { slug: categorySlug, isActive: true };
    const where = await this.accessibleContentWhere(contentType ? { contentType } : {});
    const items = await this.models.ContentItem.findAll({ where, include, distinct: true, limit: Math.min(Math.max(limit, 1), 100), offset: Math.max(offset, 0), order: [['sortOrder', 'ASC'], ['publishAt', 'DESC']] });
    await this.models.RecentSearch.create({ userId: this.viewer.id, query: normalized, filters: { language, categorySlug: categorySlug || null, contentType: contentType || null }, resultCount: items.length });
    const stale = await this.models.RecentSearch.findAll({ where: { userId: this.viewer.id }, order: [['searchedAt', 'DESC']], offset: 10, attributes: ['id'] });
    if (stale.length) await this.models.RecentSearch.destroy({ where: { id: { [Op.in]: stale.map((item) => item.id), userId: this.viewer.id } } });
    return items.map((item) => { item.requestedLanguage = language; return item; });
  }

  recentSearches() {
    return this.models.RecentSearch.findAll({ where: { userId: this.viewer.id }, order: [['searchedAt', 'DESC']], limit: 10 });
  }

  async clearRecentSearches() {
    await this.models.RecentSearch.destroy({ where: { userId: this.viewer.id } });
    return true;
  }

  async requireAccessibleContent(contentItemId) {
    const content = await this.models.ContentItem.findOne({ where: await this.accessibleContentWhere({ id: contentItemId }) });
    if (!content) throw new GraphQLError('Content item not found or unavailable.', { extensions: { code: 'NOT_FOUND' } });
    return content;
  }

  async setBookmark({ contentItemId, kind = 'bookmark', saved = true }) {
    if (!['bookmark', 'watch_later'].includes(kind)) throw new GraphQLError('Unsupported bookmark kind.', { extensions: { code: 'BAD_USER_INPUT' } });
    await this.requireAccessibleContent(contentItemId);
    const where = { userId: this.viewer.id, contentItemId, kind };
    if (saved) await this.models.ContentBookmark.findOrCreate({ where, defaults: where });
    else await this.models.ContentBookmark.destroy({ where });
    return { contentItemId, kind, saved };
  }

  async savedContent({ kind = 'bookmark', language = 'en' }) {
    if (!['bookmark', 'watch_later'].includes(kind)) throw new GraphQLError('Unsupported bookmark kind.', { extensions: { code: 'BAD_USER_INPUT' } });
    const bookmarks = await this.models.ContentBookmark.findAll({
      where: { userId: this.viewer.id, kind },
      include: [{ model: this.models.ContentItem, as: 'contentItem', required: true, where: await this.accessibleContentWhere(), include: this.includes() }],
      order: [['createdAt', 'DESC']],
    });
    return bookmarks.map((bookmark) => { bookmark.contentItem.requestedLanguage = language; return bookmark.contentItem; });
  }

  async recordView({ contentItemId, dailyContentId, lastPositionSeconds = 0, progressPercent = 0, completed = false }) {
    if (lastPositionSeconds < 0 || progressPercent < 0 || progressPercent > 100) throw new GraphQLError('View progress is outside the allowed range.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!contentItemId && !dailyContentId) throw new GraphQLError('Either contentItemId or dailyContentId must be provided.', { extensions: { code: 'BAD_USER_INPUT' } });

    const where = { userId: this.viewer.id };
    if (contentItemId) {
      await this.requireAccessibleContent(contentItemId);
      where.contentItemId = contentItemId;
    } else {
      where.dailyContentId = dailyContentId;
    }

    const [history, created] = await this.models.ContentViewHistory.findOrCreate({ where, defaults: { ...where, lastPositionSeconds, progressPercent, completed, viewedAt: new Date() } });
    if (!created) await history.update({ lastPositionSeconds, progressPercent, completed, viewedAt: new Date(), viewCount: history.viewCount + 1 });
    return history;
  }

  async getViewHistory({ contentItemId, dailyContentId }) {
    if (!contentItemId && !dailyContentId) return null;
    const where = { userId: this.viewer.id };
    if (contentItemId) where.contentItemId = contentItemId;
    if (dailyContentId) where.dailyContentId = dailyContentId;
    return this.models.ContentViewHistory.findOne({ where });
  }

  async manage({ status, search, limit = 50, offset = 0 }) {
    const where = { centerId: this.viewer.centerId || null };
    if (status) where.status = status;
    if (search) where.slug = { [Op.iLike]: `%${search.trim()}%` };
    return this.models.ContentItem.findAll({ where, include: this.includes(), limit: Math.min(Math.max(limit, 1), 100), offset: Math.max(offset, 0), order: [['updatedAt', 'DESC']] });
  }

  validateInput(input) {
    if (!slugPattern.test(input.slug || '')) throw new GraphQLError('Slug must contain lowercase letters, numbers, and hyphens.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!contentTypes.has(input.contentType)) throw new GraphQLError('Unsupported content type.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!visibilities.has(input.visibility || 'free')) throw new GraphQLError('Unsupported visibility.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!input.translations?.length) throw new GraphQLError('At least one translation is required.', { extensions: { code: 'BAD_USER_INPUT' } });
    const languages = new Set();
    for (const translation of input.translations) {
      if (!translation.language || !translation.title?.trim() || languages.has(translation.language)) throw new GraphQLError('Translations require unique language and title values.', { extensions: { code: 'BAD_USER_INPUT' } });
      languages.add(translation.language);
    }
  }

  async create(input) {
    this.validateInput(input);
    return this.models.ContentItem.sequelize.transaction(async (transaction) => {
      const isAdmin = this.viewer.role?.roleType === 'ADMIN';
      const item = await this.models.ContentItem.create({
        centerId: this.viewer.centerId || null, categoryId: input.categoryId || null, coverAssetId: input.coverAssetId || null,
        createdBy: this.viewer.id, updatedBy: this.viewer.id, slug: input.slug, contentType: input.contentType,
        visibility: input.visibility || 'free',
        status: isAdmin ? 'approved' : 'draft',
        medicalReviewed: isAdmin ? true : false,
        publishAt: input.publishAt || null, unpublishAt: input.unpublishAt || null,
      }, { transaction });
      await this.models.ContentTranslation.bulkCreate(input.translations.map((translation) => ({ ...translation, title: translation.title.trim(), contentItemId: item.id })), { transaction, validate: true });
      return item.reload({ include: this.includes(), transaction });
    });
  }

  async publish(id) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null }, include: [{ model: this.models.ContentTranslation, as: 'translations' }] });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    if (!item.translations?.length) throw new GraphQLError('Content requires a translation before publishing.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (item.status !== 'approved') throw new GraphQLError('Only approved content items can be published.', { extensions: { code: 'BAD_USER_INPUT' } });
    await item.update({ status: 'published', publishAt: item.publishAt || new Date(), updatedBy: this.viewer.id });
    return item.reload({ include: this.includes() });
  }

  async submitForReview(id) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    if (item.status !== 'draft') throw new GraphQLError('Only draft content items can be submitted for review.', { extensions: { code: 'BAD_USER_INPUT' } });
    await item.update({ status: 'review', updatedBy: this.viewer.id });
    return item.reload({ include: this.includes() });
  }

  async approveMedicalContent(id, feedback) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    if (item.status !== 'review') throw new GraphQLError('Only content items under review can be approved.', { extensions: { code: 'BAD_USER_INPUT' } });
    
    await item.update({
      status: 'approved',
      medicalReviewed: true,
      reviewedBy: this.viewer.id,
      feedback: feedback || null,
      updatedBy: this.viewer.id
    });
    return item.reload({ include: this.includes() });
  }

  async flagMedicalContent(id, feedback) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    if (item.status !== 'review') throw new GraphQLError('Only content items under review can be flagged.', { extensions: { code: 'BAD_USER_INPUT' } });
    
    await item.update({
      status: 'draft',
      medicalReviewed: false,
      reviewedBy: this.viewer.id,
      feedback: feedback || null,
      updatedBy: this.viewer.id
    });
    return item.reload({ include: this.includes() });
  }

  async review(id, medicalReviewed = true) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    // Require admin or staff role
    if (this.viewer.role?.roleType !== 'ADMIN' && this.viewer.role?.roleType !== 'STAFF') {
      throw new GraphQLError('Unauthorized access', { extensions: { code: 'UNAUTHORIZED' } });
    }
    await item.update({
      medicalReviewed,
      status: medicalReviewed ? 'approved' : 'draft',
      reviewedBy: this.viewer.id,
      updatedBy: this.viewer.id
    });
    return item.reload({ include: this.includes() });
  }

  async registerMedia(input) {
    if (!mediaKinds.has(input.kind)) throw new GraphQLError('Unsupported media kind.', { extensions: { code: 'BAD_USER_INPUT' } });
    let parsedUrl;
    try { parsedUrl = new URL(input.url); } catch { throw new GraphQLError('A valid HTTPS media URL is required.', { extensions: { code: 'BAD_USER_INPUT' } }); }
    if (parsedUrl.protocol !== 'https:') throw new GraphQLError('Media URL must use HTTPS.', { extensions: { code: 'BAD_USER_INPUT' } });
    return this.models.MediaAsset.create({
      centerId: this.viewer.centerId || null,
      ownerId: this.viewer.id,
      storageKey: `external/${this.viewer.centerId || 'global'}/${uuidv4()}`,
      url: parsedUrl.toString(),
      mimeType: input.mimeType,
      kind: input.kind,
      sizeBytes: input.sizeBytes || 0,
      durationSeconds: input.durationSeconds || null,
      altText: input.altText || null,
      status: 'ready',
      metadata: { source: 'external_url' },
    });
  }

  async update(id, input) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });

    if (input.slug && !slugPattern.test(input.slug)) throw new GraphQLError('Slug must contain lowercase letters, numbers, and hyphens.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (input.contentType && !contentTypes.has(input.contentType)) throw new GraphQLError('Unsupported content type.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (input.visibility && !visibilities.has(input.visibility)) throw new GraphQLError('Unsupported visibility.', { extensions: { code: 'BAD_USER_INPUT' } });

    return this.models.ContentItem.sequelize.transaction(async (transaction) => {
      await item.update({
        slug: input.slug ?? item.slug,
        contentType: input.contentType ?? item.contentType,
        visibility: input.visibility ?? item.visibility,
        categoryId: input.categoryId !== undefined ? input.categoryId : item.categoryId,
        coverAssetId: input.coverAssetId !== undefined ? input.coverAssetId : item.coverAssetId,
        publishAt: input.publishAt !== undefined ? input.publishAt : item.publishAt,
        unpublishAt: input.unpublishAt !== undefined ? input.unpublishAt : item.unpublishAt,
        trimester1Safe: input.trimester1Safe !== undefined ? input.trimester1Safe : item.trimester1Safe,
        trimester2Safe: input.trimester2Safe !== undefined ? input.trimester2Safe : item.trimester2Safe,
        trimester3Safe: input.trimester3Safe !== undefined ? input.trimester3Safe : item.trimester3Safe,
        contraindications: input.contraindications !== undefined ? input.contraindications : item.contraindications,
        medicalReviewed: input.medicalReviewed !== undefined ? input.medicalReviewed : item.medicalReviewed,
        status: input.medicalReviewed !== undefined ? (input.medicalReviewed ? (item.status === 'published' ? 'published' : 'approved') : 'draft') : (input.status ?? item.status),
        updatedBy: this.viewer.id,
      }, { transaction });

      if (input.translations && input.translations.length > 0) {
        for (const translation of input.translations) {
          if (!translation.language || !translation.title?.trim()) {
            throw new GraphQLError('Translations require language and title values.', { extensions: { code: 'BAD_USER_INPUT' } });
          }
          
          const existingTranslation = await this.models.ContentTranslation.findOne({
            where: { contentItemId: item.id, language: translation.language },
            transaction
          });

          if (existingTranslation) {
            await existingTranslation.update({
              title: translation.title.trim(),
              summary: translation.summary !== undefined ? translation.summary : existingTranslation.summary,
              body: translation.body !== undefined ? translation.body : existingTranslation.body,
            }, { transaction });
          } else {
            await this.models.ContentTranslation.create({
              contentItemId: item.id,
              language: translation.language,
              title: translation.title.trim(),
              summary: translation.summary || null,
              body: translation.body || null,
            }, { transaction });
          }
        }
      }

      return item.reload({ include: this.includes(), transaction });
    });
  }

  async deleteContentItem(id) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    await item.destroy();
    return true;
  }

  async getRecommendedContent({ language = 'en', limit = 10 }) {
    const { calculatePregnancyStats } = await import('../../util/pregnancy.js');
    const stats = calculatePregnancyStats(this.viewer.lmpDate, this.viewer.dueDate);
    const trimester = stats.currentTrimester || 1;

    // Fetch user's latest logged vitals/symptoms
    const latestVitals = await this.models.VitalsLog.findOne({
      where: { userId: this.viewer.id },
      order: [['loggedAt', 'DESC']]
    });

    // Check completed content items
    const completedViews = await this.models.ContentViewHistory.findAll({
      where: { userId: this.viewer.id, completed: true },
      attributes: ['contentItemId']
    });
    const completedIds = completedViews.map(v => v.contentItemId).filter(Boolean);

    // Build the query conditions
    const where = {
      status: 'published',
      medicalReviewed: true,
      id: { [Op.notIn]: completedIds.length ? completedIds : ['00000000-0000-0000-0000-000000000000'] }
    };

    // Filter by trimester safety
    if (trimester === 1) {
      where.trimester1Safe = true;
    } else if (trimester === 2) {
      where.trimester2Safe = true;
    } else {
      where.trimester3Safe = true;
    }

    // Determine category priorities based on logged symptoms
    let prioritizedCategories = [];
    if (latestVitals) {
      let parsedSymptoms = [];
      try {
        parsedSymptoms = JSON.parse(latestVitals.symptoms || '[]');
      } catch (e) {}

      if (parsedSymptoms.includes('Insomnia') || latestVitals.mood === 'ANXIOUS' || latestVitals.mood === 'SAD') {
        prioritizedCategories.push('mindfulness', 'meditation');
      }
      if (parsedSymptoms.includes('Nausea')) {
        prioritizedCategories.push('diet', 'recipes');
      }
      if (parsedSymptoms.includes('Backache')) {
        prioritizedCategories.push('yoga', 'exercise');
      }
    }

    const include = this.includes();
    const items = await this.models.ContentItem.findAll({
      where,
      include,
      order: [['sortOrder', 'ASC'], ['publishAt', 'DESC']]
    });

    // Post-process: sort in memory to prioritize categories
    if (prioritizedCategories.length > 0) {
      items.sort((a, b) => {
        const aCat = a.category?.slug;
        const bCat = b.category?.slug;
        const aPri = prioritizedCategories.includes(aCat) ? 0 : 1;
        const bPri = prioritizedCategories.includes(bCat) ? 0 : 1;
        if (aPri !== bPri) return aPri - bPri;
        return a.sortOrder - b.sortOrder;
      });
    }

    const sliced = items.slice(0, Math.min(Math.max(limit, 1), 50));
    return sliced.map((item) => { item.requestedLanguage = language; return item; });
  }

  async getLearningPaths({ language = 'en' }) {
    // Define the static learning paths
    const pathsData = [
      {
        id: 'path-foundation',
        titleEn: 'Garbh Sanskar Daily Foundation Path',
        titleHi: 'गर्भ संस्कार दैनिक बुनियादी मार्ग',
        descEn: 'Learn the primary daily principles of meditation, breathing, and baby bonding.',
        descHi: 'ध्यान, श્वास और शिशु बंधन के प्राथमिक दैनिक सिद्धांतों को जानें।',
        icon: '🌸',
        slugs: ['five-comfortable-breaths', 'one-kind-message']
      }
    ];

    // Fetch completion history for the user
    const completedHistory = await this.models.ContentViewHistory.findAll({
      where: { userId: this.viewer.id, completed: true },
      attributes: ['contentItemId']
    });
    const completedIds = new Set(completedHistory.map(h => h.contentItemId).filter(Boolean));

    const paths = [];

    for (const path of pathsData) {
      // Find content items in this path
      const items = await this.models.ContentItem.findAll({
        where: { slug: path.slugs },
        include: this.includes()
      });

      // Map to correct language
      items.forEach(item => { item.requestedLanguage = language; });

      // Sort items according to slugs order
      items.sort((a, b) => path.slugs.indexOf(a.slug) - path.slugs.indexOf(b.slug));

      // Calculate progress
      const completedInPath = items.filter(item => completedIds.has(item.id)).length;
      const progressPercent = items.length > 0 ? Math.round((completedInPath / items.length) * 100) : 0;

      paths.push({
        id: path.id,
        title: language === 'hi' ? path.titleHi : path.titleEn,
        description: language === 'hi' ? path.descHi : path.descEn,
        icon: path.icon,
        progressPercent,
        items
      });
    }

    return paths;
  }

  async getContentPerformanceAnalytics() {
    if (this.viewer.role?.roleType !== 'ADMIN' && this.viewer.role?.roleType !== 'STAFF') {
      throw new GraphQLError('Unauthorized access', { extensions: { code: 'UNAUTHORIZED' } });
    }

    const items = await this.models.ContentItem.findAll({
      include: this.includes()
    });

    const reports = [];

    for (const item of items) {
      const viewLogs = await this.models.ContentViewHistory.findAll({
        where: { contentItemId: item.id }
      });

      const totalViews = viewLogs.reduce((sum, log) => sum + log.viewCount, 0);
      const uniqueViewers = viewLogs.length;
      const completionCount = viewLogs.filter(log => log.completed).length;

      const completionRate = uniqueViewers > 0 ? parseFloat(((completionCount / uniqueViewers) * 100).toFixed(2)) : 0.0;
      const totalProgress = viewLogs.reduce((sum, log) => sum + (log.progressPercent || 0), 0);
      const avgProgress = uniqueViewers > 0 ? parseFloat((totalProgress / uniqueViewers).toFixed(2)) : 0.0;
      const dropOffRate = uniqueViewers > 0 ? parseFloat((100 - completionRate).toFixed(2)) : 0.0;

      const saveCount = await this.models.ContentBookmark.count({
        where: { contentItemId: item.id }
      });

      const translation = item.translations?.find(t => t.language === 'en') || item.translations?.[0];

      reports.push({
        id: item.id,
        slug: item.slug,
        contentType: item.contentType,
        title: translation?.title || item.slug,
        totalViews,
        uniqueViewers,
        completionCount,
        completionRate,
        saveCount,
        avgProgress,
        dropOffRate
      });
    }

    return reports.sort((a, b) => b.totalViews - a.totalViews);
  }
}
