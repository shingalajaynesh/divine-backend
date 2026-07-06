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
      const item = await this.models.ContentItem.create({
        centerId: this.viewer.centerId || null, categoryId: input.categoryId || null, coverAssetId: input.coverAssetId || null,
        createdBy: this.viewer.id, updatedBy: this.viewer.id, slug: input.slug, contentType: input.contentType,
        visibility: input.visibility || 'free', status: 'draft', publishAt: input.publishAt || null, unpublishAt: input.unpublishAt || null,
      }, { transaction });
      await this.models.ContentTranslation.bulkCreate(input.translations.map((translation) => ({ ...translation, title: translation.title.trim(), contentItemId: item.id })), { transaction, validate: true });
      return item.reload({ include: this.includes(), transaction });
    });
  }

  async publish(id) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null }, include: [{ model: this.models.ContentTranslation, as: 'translations' }] });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    if (!item.translations?.length) throw new GraphQLError('Content requires a translation before publishing.', { extensions: { code: 'BAD_USER_INPUT' } });
    await item.update({ status: 'published', publishAt: item.publishAt || new Date(), updatedBy: this.viewer.id });
    return item.reload({ include: this.includes() });
  }

  async review(id, medicalReviewed = true) {
    const item = await this.models.ContentItem.findOne({ where: { id, centerId: this.viewer.centerId || null } });
    if (!item) throw new GraphQLError('Content item not found.', { extensions: { code: 'NOT_FOUND' } });
    // Require admin or staff role
    if (this.viewer.role?.roleType !== 'ADMIN' && this.viewer.role?.roleType !== 'STAFF') {
      throw new GraphQLError('Unauthorized access', { extensions: { code: 'UNAUTHORIZED' } });
    }
    await item.update({ medicalReviewed, updatedBy: this.viewer.id });
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
}
