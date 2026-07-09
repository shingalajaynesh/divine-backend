import { v4 as uuidv4 } from 'uuid';

export class PlatformConfigService {
  constructor(models) {
    this.models = models;
  }

  // Helper check admin/staff permissions
  _verifyPrivileges(viewer) {
    if (viewer?.role?.roleType !== 'ADMIN' && viewer?.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
  }

  // 1. System Settings
  async getSystemSettings() {
    return this.models.SystemSetting.findAll({
      order: [['key', 'ASC']]
    });
  }

  async updateSystemSetting(viewer, { key, value }) {
    this._verifyPrivileges(viewer);

    let setting = await this.models.SystemSetting.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      setting.updatedBy = viewer.id;
      await setting.save();
    } else {
      setting = await this.models.SystemSetting.create({
        id: uuidv4(),
        key,
        value,
        updatedBy: viewer.id
      });
    }
    return setting;
  }

  // 2. Feature Flags
  async getFeatureFlags() {
    return this.models.FeatureFlag.findAll({
      order: [['name', 'ASC']]
    });
  }

  async updateFeatureFlag(viewer, { name, isEnabled, rules }) {
    this._verifyPrivileges(viewer);

    let flag = await this.models.FeatureFlag.findOne({ where: { name } });
    const parsedRules = rules ? JSON.parse(rules) : null;

    if (flag) {
      flag.isEnabled = isEnabled;
      flag.rules = parsedRules;
      flag.updatedBy = viewer.id;
      await flag.save();
    } else {
      flag = await this.models.FeatureFlag.create({
        id: uuidv4(),
        name,
        isEnabled,
        rules: parsedRules,
        updatedBy: viewer.id
      });
    }
    return flag;
  }

  async checkFeatureFlag(viewer, name) {
    const flag = await this.models.FeatureFlag.findOne({ where: { name } });
    if (!flag || !flag.isEnabled) return false;

    // Evaluate rules
    if (flag.rules) {
      const { centers, users, tiers } = flag.rules;

      // Center restriction check
      if (centers && Array.isArray(centers)) {
        if (!viewer?.centerId || !centers.includes(viewer.centerId)) {
          return false;
        }
      }

      // User ID restriction check
      if (users && Array.isArray(users)) {
        if (!viewer?.id || !users.includes(viewer.id)) {
          return false;
        }
      }

      // Entitlement plan tier check
      if (tiers && Array.isArray(tiers)) {
        if (!viewer?.subscriptionTier || !tiers.includes(viewer.subscriptionTier)) {
          return false;
        }
      }
    }

    return true;
  }

  // 3. Localization
  async getLocaleStrings(lang) {
    if (lang !== 'en' && lang !== 'hi') {
      throw new Error('Unsupported language');
    }
    return this.models.LocaleString.findAll({
      where: { lang },
      order: [['key', 'ASC']]
    });
  }

  async upsertLocaleString(viewer, { lang, key, value }) {
    this._verifyPrivileges(viewer);

    if (lang !== 'en' && lang !== 'hi') {
      throw new Error('Unsupported language');
    }

    let item = await this.models.LocaleString.findOne({ where: { lang, key } });
    if (item) {
      item.value = value;
      item.updatedBy = viewer.id;
      await item.save();
    } else {
      item = await this.models.LocaleString.create({
        id: uuidv4(),
        lang,
        key,
        value,
        updatedBy: viewer.id
      });
    }
    return item;
  }
}
