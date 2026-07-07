import { BaseManager } from './baseManager.js';
import crypto from 'crypto';

export class DeviceManager extends BaseManager {
  /**
   * Generates a deterministic device ID hash from user-agent and IP.
   */
  generateDeviceId(userAgent, ipAddress) {
    const data = `${userAgent || ''}-${ipAddress || ''}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Register a new device or update last seen details of an existing one.
   */
  async registerDevice(userId, deviceInfo) {
    try {
      const RegisteredDevice = this.models.RegisteredDevice;
      const deviceId = deviceInfo.deviceId || this.generateDeviceId(deviceInfo.userAgent, deviceInfo.ipAddress);

      if (!global.DEVICE_PARAM_CACHE) {
        global.DEVICE_PARAM_CACHE = new Map();
      }
      const cacheKey = `device_reg_cache_${userId}_${deviceId}`;
      const now = Date.now();

      if (global.DEVICE_PARAM_CACHE.has(cacheKey) && global.DEVICE_PARAM_CACHE.get(cacheKey).expiry > now) {
        return global.DEVICE_PARAM_CACHE.get(cacheKey).device;
      }

      // Check if device is already registered for this user
      const existing = await RegisteredDevice.findOne({
        where: { deviceId, registeredBy: userId }
      });

      if (existing) {
        const updateKey = `device_update_throttle_${existing.id}`;
        if (!global.DEVICE_PARAM_CACHE.has(updateKey) || global.DEVICE_PARAM_CACHE.get(updateKey).expiry < now) {
          await existing.update({
            lastSeenAt: new Date(),
            ipAddress: deviceInfo.ipAddress || existing.ipAddress,
            location: deviceInfo.location || existing.location,
          });
          global.DEVICE_PARAM_CACHE.set(updateKey, { value: true, expiry: now + 60000 });
        }
        global.DEVICE_PARAM_CACHE.set(cacheKey, { device: existing, expiry: now + 300000 }); // Cache for 5 mins
        return existing;
      }

      // Check how many active devices the user currently has
      const activeCount = await RegisteredDevice.count({
        where: { registeredBy: userId, isActive: true }
      });

      // Get configuration limits via parameters
      const Parameter = this.models.Parameter;
      const user = await this.models.User.findByPk(userId);
      const centerId = user ? user.centerId : null;

      // Find max devices parameter (default to 3 if not set)
      let maxDevices = 3;
      const maxParam = await Parameter.findOne({
        where: { key: 'MAX_DEVICES_PER_USER', centerId }
      });
      if (maxParam) maxDevices = parseInt(maxParam.value, 10) || 3;

      if (activeCount >= maxDevices) {
        throw new Error(`Maximum concurrent device limit reached (${maxDevices}). Please remove a device first.`);
      }

      // Check if approval is required (default to false if not set)
      let approvalRequired = false;
      const approvalParam = await Parameter.findOne({
        where: { key: 'DEVICE_APPROVAL_REQUIRED', centerId }
      });
      if (approvalParam) approvalRequired = approvalParam.value === 'true';

      const status = approvalRequired ? 'pending' : 'approved';
      const approvedAt = approvalRequired ? null : new Date();

      const newDevice = await RegisteredDevice.create({
        deviceId,
        deviceName: deviceInfo.deviceName || deviceInfo.operatingSystem || 'Web Client',
        deviceType: deviceInfo.deviceType || 'web',
        browser: deviceInfo.browser || 'Unknown',
        operatingSystem: deviceInfo.operatingSystem || 'Unknown',
        userAgent: deviceInfo.userAgent || '',
        deviceFingerprint: deviceInfo.deviceFingerprint || '',
        ipAddress: deviceInfo.ipAddress || '',
        location: deviceInfo.location || '',
        status,
        isActive: true,
        registeredBy: userId,
        approvedAt,
        lastSeenAt: new Date()
      });

      this.log.info(`Device registered successfully: ${deviceId} (User: ${userId}, Status: ${status})`);
      return newDevice;
    } catch (error) {
      this.log.error('Failed to register device:', error);
      throw error;
    }
  }

  /**
   * Validates if a user's device is authorized to log in.
   */
  async validateDevice(userId, deviceId, centerId = null) {
    try {
      const Parameter = this.models.Parameter;
      const RegisteredDevice = this.models.RegisteredDevice;

      // Check if device whitelisting is enabled (with short-term in-memory cache)
      if (!global.DEVICE_PARAM_CACHE) {
        global.DEVICE_PARAM_CACHE = new Map();
      }
      const cacheKey = `ENABLE_DEVICE_WHITELISTING_${centerId || 'null'}`;
      const now = Date.now();
      let whitelistEnabled = false;

      if (global.DEVICE_PARAM_CACHE.has(cacheKey) && global.DEVICE_PARAM_CACHE.get(cacheKey).expiry > now) {
        whitelistEnabled = global.DEVICE_PARAM_CACHE.get(cacheKey).value;
      } else {
        const whitelistParam = await Parameter.findOne({
          where: { key: 'ENABLE_DEVICE_WHITELISTING', centerId }
        });
        whitelistEnabled = whitelistParam ? whitelistParam.value === 'true' : false;
        global.DEVICE_PARAM_CACHE.set(cacheKey, { value: whitelistEnabled, expiry: now + 60000 }); // Cache for 1 min
      }

      if (!whitelistEnabled) {
        return { isValid: true, reason: 'Device whitelisting disabled' };
      }

      if (!deviceId) {
        return { isValid: false, reason: 'Device ID is required when whitelisting is enabled' };
      }

      const device = await RegisteredDevice.findOne({
        where: { deviceId, registeredBy: userId, isActive: true }
      });

      if (!device) {
        return { isValid: false, reason: 'Device is not registered' };
      }

      if (device.status !== 'approved') {
        return { isValid: false, reason: `Device status is: ${device.status}` };
      }

      // Update last seen (throttled to max once per minute)
      const lastSeenKey = `device_last_seen_${device.id}`;
      if (!global.DEVICE_PARAM_CACHE.has(lastSeenKey) || global.DEVICE_PARAM_CACHE.get(lastSeenKey).expiry < now) {
        await device.update({ lastSeenAt: new Date() });
        global.DEVICE_PARAM_CACHE.set(lastSeenKey, { value: true, expiry: now + 60000 });
      }

      return { isValid: true, device };
    } catch (error) {
      this.log.error('Error validating device:', error);
      return { isValid: false, reason: 'Device validation system error' };
    }
  }

  /**
   * Update the status of a registered device (e.g. Approve, Reject, Suspend).
   */
  async updateDeviceStatus(deviceId, status, approvedBy, centerId) {
    try {
      const RegisteredDevice = this.models.RegisteredDevice;
      const device = await RegisteredDevice.findOne({ where: { deviceId, centerId } });

      if (!device) {
        throw new Error('Device not found');
      }

      const updates = {
        status,
        approvedBy: status === 'approved' ? approvedBy : null,
        approvedAt: status === 'approved' ? new Date() : null,
        isActive: status === 'approved'
      };

      await device.update(updates);
      this.log.info(`Device ${deviceId} status updated to: ${status} (by admin: ${approvedBy})`);
      return device;
    } catch (error) {
      this.log.error('Failed to update device status:', error);
      throw error;
    }
  }

  /**
   * Fetch all registered devices for a user.
   */
  async getUserDevices(userId) {
    try {
      return await this.models.RegisteredDevice.findAll({
        where: { registeredBy: userId },
        order: [['lastSeenAt', 'DESC']]
      });
    } catch (error) {
      this.log.error(`Error getting devices for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Deauthorize / delete a device for self-service slots.
   */
  async deauthorizeDevice(userId, deviceId) {
    try {
      const RegisteredDevice = this.models.RegisteredDevice;
      const device = await RegisteredDevice.findOne({
        where: { deviceId, registeredBy: userId }
      });

      if (!device) {
        throw new Error('Device not found or not owned by you');
      }

      await device.destroy();
      this.log.info(`Device ${deviceId} deauthorized successfully by user ${userId}`);
      return true;
    } catch (error) {
      this.log.error('Failed to deauthorize device:', error);
      throw error;
    }
  }
}
