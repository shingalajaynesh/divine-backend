import assert from 'node:assert/strict';
import test from 'node:test';
import { PlatformConfigService } from '../src/modules/platform/platformConfig.service.js';

const VIEWER_ADMIN = { id: 'admin_1', role: { roleType: 'ADMIN' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('PlatformConfigService - System settings, Feature flags cohort evaluations, and Localization dictionary', async () => {
  const mockSettings = [];
  const mockFlags = [];
  const mockLocales = [];

  const mockModels = {
    SystemSetting: {
      findOne: async (options) => mockSettings.find(s => s.key === options.where.key) || null,
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date(), save: async function() { return this; } };
        mockSettings.push(row);
        return row;
      },
      findAll: async () => mockSettings
    },
    FeatureFlag: {
      findOne: async (options) => mockFlags.find(f => f.name === options.where.name) || null,
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date(), save: async function() { return this; } };
        mockFlags.push(row);
        return row;
      },
      findAll: async () => mockFlags
    },
    LocaleString: {
      findOne: async (options) => mockLocales.find(l => l.lang === options.where.lang && l.key === options.where.key) || null,
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date(), save: async function() { return this; } };
        mockLocales.push(row);
        return row;
      },
      findAll: async (options) => mockLocales.filter(l => l.lang === options.where.lang)
    }
  };

  const service = new PlatformConfigService(mockModels);

  // 1. System Settings
  await assert.rejects(
    service.updateSystemSetting(VIEWER_MOTHER, { key: 'support_email', value: 'help@test.com' }),
    /Unauthorized access/
  );

  const setting = await service.updateSystemSetting(VIEWER_ADMIN, { key: 'support_email', value: 'support@care.com' });
  assert.equal(setting.key, 'support_email');
  assert.equal(setting.value, 'support@care.com');

  const settingsList = await service.getSystemSettings();
  assert.equal(settingsList.length, 1);
  assert.equal(settingsList[0].value, 'support@care.com');

  // Update existing setting
  await service.updateSystemSetting(VIEWER_ADMIN, { key: 'support_email', value: 'info@care.com' });
  assert.equal(settingsList[0].value, 'info@care.com');

  // 2. Feature Flags
  await assert.rejects(
    service.updateFeatureFlag(VIEWER_MOTHER, { name: 'chat_module', isEnabled: true }),
    /Unauthorized access/
  );

  const flag = await service.updateFeatureFlag(VIEWER_ADMIN, {
    name: 'chat_module',
    isEnabled: true,
    rules: JSON.stringify({
      centers: ['center_alpha'],
      tiers: ['PREMIUM']
    })
  });
  assert.equal(flag.name, 'chat_module');
  assert.equal(flag.isEnabled, true);

  const flagsList = await service.getFeatureFlags();
  assert.equal(flagsList.length, 1);

  // Evaluation - Matches center and tier whitelist rule
  const matchedUser = { id: 'mother_123', centerId: 'center_alpha', subscriptionTier: 'PREMIUM' };
  const ok = await service.checkFeatureFlag(matchedUser, 'chat_module');
  assert.equal(ok, true);

  // Evaluation - Mismatched center
  const mismatchedCenterUser = { id: 'mother_123', centerId: 'center_beta', subscriptionTier: 'PREMIUM' };
  const failCenter = await service.checkFeatureFlag(mismatchedCenterUser, 'chat_module');
  assert.equal(failCenter, false);

  // Evaluation - Mismatched tier
  const mismatchedTierUser = { id: 'mother_123', centerId: 'center_alpha', subscriptionTier: 'FREE' };
  const failTier = await service.checkFeatureFlag(mismatchedTierUser, 'chat_module');
  assert.equal(failTier, false);

  // 3. Localization Dictionaries
  await assert.rejects(
    service.upsertLocaleString(VIEWER_MOTHER, { lang: 'hi', key: 'welcome', value: 'नमस्ते' }),
    /Unauthorized access/
  );

  const itemHi = await service.upsertLocaleString(VIEWER_ADMIN, { lang: 'hi', key: 'welcome', value: 'नमस्ते' });
  assert.equal(itemHi.lang, 'hi');
  assert.equal(itemHi.value, 'नमस्ते');

  const localeStringsList = await service.getLocaleStrings('hi');
  assert.equal(localeStringsList.length, 1);
  assert.equal(localeStringsList[0].value, 'नमस्ते');
});
