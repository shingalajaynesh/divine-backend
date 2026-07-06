import { BaseManager } from './baseManager.js';

export class ParameterManager extends BaseManager {
  /**
   * Get a parameter value by key. Falls back to a global parameter (centerId = null) if centerId is provided but not found.
   * @param {string} key - Configuration key
   * @param {string} [centerId] - Center ID
   * @returns {Promise<string|null>} - Parameter value
   */
  async getParameter(key, centerId = null) {
    try {
      const Parameter = this.models.Parameter;
      
      // Try to find specific center configuration
      if (centerId) {
        const centerParam = await Parameter.findOne({
          where: { key, centerId }
        });
        if (centerParam) return centerParam.value;
      }

      // Fallback to global config
      const globalParam = await Parameter.findOne({
        where: { key, centerId: null }
      });
      return globalParam ? globalParam.value : null;
    } catch (error) {
      this.log.error(`Error fetching parameter ${key}:`, error);
      return null;
    }
  }

  /**
   * Set or update a configuration parameter.
   * @param {string} key - Configuration key
   * @param {string} value - Configuration value
   * @param {string} [centerId] - Center ID
   * @returns {Promise<Object>} - Updated Parameter model
   */
  async setParameter(key, value, centerId = null) {
    try {
      const Parameter = this.models.Parameter;
      
      const [param] = await Parameter.upsert({
        key,
        value: value !== null ? value.toString() : null,
        centerId: centerId || null
      });

      this.log.info(`Updated system parameter: ${key} = ${value} (center: ${centerId || 'GLOBAL'})`);
      return param;
    } catch (error) {
      this.log.error(`Error setting parameter ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple configuration keys at once.
   * @param {string[]} keys - Array of configuration keys
   * @param {string} [centerId] - Center ID
   * @returns {Promise<Object>} - Key-value map of configuration settings
   */
  async getParametersMap(keys, centerId = null) {
    const map = {};
    for (const key of keys) {
      map[key] = await this.getParameter(key, centerId);
    }
    return map;
  }
}
