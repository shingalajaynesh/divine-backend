import assert from 'node:assert/strict';
import test from 'node:test';
import { DataModels } from 'divine-data-models';

const logger = { info() {}, warn() {}, error() {} };
const createModels = () => {
  const dataModels = new DataModels(logger);
  dataModels.init({ database: 'content_contract_test', dbUser: 'test', dbPassword: 'test', host: '127.0.0.1', dialect: 'postgres', pool: { max: 1, min: 0 } });
  return { sequelize: dataModels.sequelize, models: dataModels.models };
};

test('CMS models expose category, media, translation, and ownership associations', async () => {
  const { sequelize, models } = createModels();
  try {
    assert.equal(models.ContentCategory.associations.children.target, models.ContentCategory);
    assert.equal(models.ContentItem.associations.translations.target, models.ContentTranslation);
    assert.equal(models.ContentItem.associations.coverAsset.target, models.MediaAsset);
    assert.equal(models.MediaAsset.associations.owner.target, models.User);
  } finally { await sequelize.close(); }
});

test('ready media requires a valid URL and supported kind', async () => {
  const { sequelize, models } = createModels();
  try {
    await models.MediaAsset.build({ ownerId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', storageKey: 'media/demo.mp3', url: 'https://cdn.example.com/demo.mp3', mimeType: 'audio/mpeg', kind: 'audio', status: 'ready' }).validate();
    await assert.rejects(models.MediaAsset.build({ ownerId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', storageKey: 'media/bad', mimeType: 'x/test', kind: 'binary', status: 'ready' }).validate(), /Validation error|URL/);
  } finally { await sequelize.close(); }
});

test('content publication contracts validate slugs, states, and publication windows', async () => {
  const { sequelize, models } = createModels();
  try {
    await models.ContentItem.build({ createdBy: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', updatedBy: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', slug: 'gentle-evening-practice', contentType: 'meditation', status: 'draft', visibility: 'free' }).validate();
    await assert.rejects(models.ContentItem.build({ createdBy: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', updatedBy: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', slug: 'Bad Slug', contentType: 'unknown', status: 'published', publishAt: new Date('2026-08-02'), unpublishAt: new Date('2026-08-01') }).validate(), /Validation error|Unpublish/);
  } finally { await sequelize.close(); }
});

test('discovery models enforce member ownership associations and progress ranges', async () => {
  const { sequelize, models } = createModels();
  try {
    assert.equal(models.ContentBookmark.associations.user.target, models.User);
    assert.equal(models.ContentBookmark.associations.contentItem.target, models.ContentItem);
    assert.equal(models.ContentViewHistory.associations.contentItem.target, models.ContentItem);
    assert.equal(models.RecentSearch.associations.user.target, models.User);
    await models.ContentBookmark.build({ userId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', contentItemId: 'a77901a4-965f-47fb-950b-bfedcd1ef90e', kind: 'watch_later' }).validate();
    await assert.rejects(models.ContentBookmark.build({ userId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', contentItemId: 'a77901a4-965f-47fb-950b-bfedcd1ef90e', kind: 'shared' }).validate(), /Validation error/);
    await assert.rejects(models.ContentViewHistory.build({ userId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', contentItemId: 'a77901a4-965f-47fb-950b-bfedcd1ef90e', progressPercent: 101 }).validate(), /Validation error/);
  } finally { await sequelize.close(); }
});

test('notification foundation exposes inbox, preference, reminder, and delivery ownership', async () => {
  const { sequelize, models } = createModels();
  try {
    assert.equal(models.Notification.associations.user.target, models.User);
    assert.equal(models.Notification.associations.deliveries.target, models.NotificationDelivery);
    assert.equal(models.NotificationPreference.associations.user.target, models.User);
    assert.equal(models.ReminderSchedule.associations.user.target, models.User);
    await models.ReminderSchedule.build({ userId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', reminderType: 'daily_activity', label: 'Morning practice', localTime: '08:30', channel: 'push' }).validate();
    await assert.rejects(models.Notification.build({ userId: 'b77901a4-965f-47fb-950b-bfedcd1ef90e', kind: 'reminder', title: 'Practice', body: 'Time to begin', status: 'read' }).validate(), /requires readAt/);
  } finally { await sequelize.close(); }
});

test('database consistency associations expose approved FK relationships', async () => {
  const { sequelize, models } = createModels();
  try {
    assert.equal(models.ContentItem.associations.reviewer.target, models.User);
    assert.equal(models.RegisteredDevice.associations.approver.target, models.User);
    assert.equal(models.Testimonial.associations.approver.target, models.User);
    assert.equal(models.UserMealPlan.associations.contentItem.target, models.ContentItem);
    assert.equal(models.QuizAttempt.associations.question.target, models.QuizQuestion);
    assert.equal(models.PartnerActivityLog.associations.activity.target, models.PartnerActivity);
    assert.equal(models.SensoryActivityLog.associations.activity.target, models.SensoryActivity);
    assert.equal(models.PaymentProviderEvent.associations.storeCheckoutIntent.target, models.StoreCheckoutIntent);
    assert.equal(models.Payment.associations.storeOrder.target, models.StoreOrder);
    assert.equal(models.StoreOrder.associations.payment.target, models.Payment);
    assert.equal(models.StoreOrder.associations.invoice.target, models.Invoice);
    assert.equal(models.StoreOrder.associations.checkoutIntent.target, models.StoreCheckoutIntent);
    assert.equal(models.StoreCheckoutIntent.associations.coupon.target, models.Coupon);
  } finally { await sequelize.close(); }
});
