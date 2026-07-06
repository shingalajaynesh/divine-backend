import { BaseManager } from './baseManager.js';
import { Op } from 'sequelize';

export class SessionManager extends BaseManager {
  /**
   * Create a new user session in the PostgreSQL database.
   */
  async createSession(userId, deviceInfo = {}) {
    try {
      const UserSession = this.models.UserSession;
      const Parameter = this.models.Parameter;
      const user = await this.models.User.findByPk(userId);
      const centerId = user ? user.centerId : null;

      // Fetch dynamic configuration keys
      let enableSingleSession = false;
      let maxConcurrentSessions = 5;
      let sessionTimeout = 24 * 60 * 60; // 24 hours in seconds

      const configParams = await Parameter.findAll({
        where: {
          centerId,
          key: {
            [Op.in]: ['enableSingleSession', 'maxConcurrentSessions', 'sessionTimeout']
          }
        }
      });

      configParams.forEach(param => {
        if (param.key === 'enableSingleSession') enableSingleSession = param.value === 'true';
        if (param.key === 'maxConcurrentSessions') maxConcurrentSessions = parseInt(param.value, 10) || 5;
        if (param.key === 'sessionTimeout') sessionTimeout = parseInt(param.value, 10) || 86400;
      });

      // Handle single-session lock
      if (enableSingleSession) {
        await this.terminateUserSessions(userId);
      } else {
        // Enforce maximum concurrent session limits
        const activeSessions = await UserSession.findAll({
          where: { userId, isActive: true },
          order: [['lastAccessedAt', 'ASC']]
        });

        if (activeSessions.length >= maxConcurrentSessions) {
          // Terminate the oldest session(s)
          const overflow = activeSessions.length - maxConcurrentSessions + 1;
          const oldestSessions = activeSessions.slice(0, overflow);
          for (const s of oldestSessions) {
            await s.update({ isActive: false });
            this.log.info(`Terminated oldest concurrent session ${s.id} for user ${userId}`);
          }
        }
      }

      // Calculate expiration date
      const expiredAt = new Date();
      expiredAt.setSeconds(expiredAt.getSeconds() + sessionTimeout);

      // Create new database session record
      const session = await UserSession.create({
        id: deviceInfo.id || undefined, // Set Clerk session ID if provided, otherwise default to generated UUID
        userId,
        ipAddress: deviceInfo.ipAddress || '',
        userAgent: deviceInfo.userAgent || '',
        deviceType: deviceInfo.deviceType || 'web',
        browser: deviceInfo.browser || '',
        operatingSystem: deviceInfo.operatingSystem || '',
        location: deviceInfo.location || '',
        isActive: true,
        lastAccessedAt: new Date(),
        expiredAt
      });

      this.log.info(`Created new session in database: ${session.id} (User: ${userId})`);
      return session;
    } catch (error) {
      this.log.error('Failed to create user session:', error);
      throw error;
    }
  }

  /**
   * Validates a session ID and checks for inactivity timeouts.
   */
  async validateSession(sessionId, centerId = null) {
    try {
      const UserSession = this.models.UserSession;
      const Parameter = this.models.Parameter;

      const session = await UserSession.findByPk(sessionId);
      if (!session || !session.isActive) {
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      // Check if session has expired based on fixed expiredAt column
      if (session.expiredAt && new Date() > new Date(session.expiredAt)) {
        await session.update({ isActive: false });
        return { valid: false, reason: 'SESSION_EXPIRED' };
      }

      // Fetch inactivity timeout configuration
      let inactivityTimeout = 2 * 60 * 60; // Default to 2 hours in seconds
      const timeoutParam = await Parameter.findOne({
        where: { key: 'sessionInactivityTimeout', centerId }
      });
      if (timeoutParam) inactivityTimeout = parseInt(timeoutParam.value, 10) || 7200;

      // Verify inactivity time
      if (inactivityTimeout > 0) {
        const lastAccessed = new Date(session.lastAccessedAt);
        const now = new Date();
        const inactiveSeconds = (now - lastAccessed) / 1000;

        if (inactiveSeconds > inactivityTimeout) {
          await session.update({ isActive: false });
          this.log.info(`Session ${sessionId} timed out due to inactivity (${inactiveSeconds}s)`);
          return { valid: false, reason: 'SESSION_INACTIVE' };
        }
      }

      // Update last accessed time
      await session.update({ lastAccessedAt: new Date() });
      return { valid: true, session };
    } catch (error) {
      this.log.error(`Error validating session ${sessionId}:`, error);
      return { valid: false, reason: 'SESSION_SYSTEM_ERROR' };
    }
  }

  /**
   * Terminate a specific session.
   */
  async terminateSession(sessionId) {
    try {
      const UserSession = this.models.UserSession;
      const session = await UserSession.findByPk(sessionId);
      if (session) {
        await session.update({ isActive: false });
        this.log.info(`Terminated session ${sessionId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.log.error(`Error terminating session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Terminate all active sessions for a user (with optional exclusion).
   */
  async terminateUserSessions(userId, excludeSessionId = null) {
    try {
      const UserSession = this.models.UserSession;
      const where = { userId, isActive: true };
      if (excludeSessionId) {
        where.id = { [Op.ne]: excludeSessionId };
      }

      const count = await UserSession.update(
        { isActive: false },
        { where }
      );
      this.log.info(`Terminated ${count} sessions for user ${userId}`);
      return count;
    } catch (error) {
      this.log.error(`Failed to terminate sessions for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get all active sessions for a user.
   */
  async getUserActiveSessions(userId) {
    try {
      return await this.models.UserSession.findAll({
        where: { userId, isActive: true },
        order: [['lastAccessedAt', 'DESC']]
      });
    } catch (error) {
      this.log.error(`Failed to get active sessions for user ${userId}:`, error);
      return [];
    }
  }
}
