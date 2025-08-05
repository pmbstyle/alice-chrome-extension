/**
 * Configuration management system for the background script
 */

import { 
  WEBSOCKET_DEFAULTS, 
  CONTENT_FILTER_DEFAULTS, 
  LOGGING_DEFAULTS, 
  BROWSER_CONTEXT_DEFAULTS, 
  ENVIRONMENT_DEFAULTS 
} from '../../shared/constants/default-config.js';
import { createError } from '../../shared/constants/error-codes.js';

/**
 * Configuration manager class for managing extension configuration
 */
export class ConfigManager {
  /**
   * Create a new ConfigManager
   */
  constructor() {
    this.config = this.getDefaultConfig();
    this.configCallbacks = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the configuration manager
   */
  async init() {
    try {
      // Load configuration from storage
      await this.loadConfig();
      
      // Apply environment-specific overrides
      this.applyEnvironmentOverrides();
      
      // Validate configuration
      this.validateConfig();
      
      this.isInitialized = true;
      return this.config;
    } catch (error) {
      throw createError('CONFIG_VALIDATION_FAILED', 'Failed to initialize configuration', { originalError: error });
    }
  }

  /**
   * Get the default configuration
   * @returns {Object} Default configuration object
   */
  getDefaultConfig() {
    return {
      websocket: { ...WEBSOCKET_DEFAULTS },
      contentFilter: { ...CONTENT_FILTER_DEFAULTS },
      logging: { ...LOGGING_DEFAULTS },
      browserContext: { ...BROWSER_CONTEXT_DEFAULTS },
      environment: { ...ENVIRONMENT_DEFAULTS }
    };
  }

  /**
   * Load configuration from chrome.storage
   */
  async loadConfig() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['aliceExtensionConfig'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (result.aliceExtensionConfig) {
          // Merge with defaults to ensure all properties exist
          this.config = this.mergeConfig(this.getDefaultConfig(), result.aliceExtensionConfig);
        }

        resolve();
      });
    });
  }

  /**
   * Save configuration to chrome.storage
   */
  async saveConfig() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ aliceExtensionConfig: this.config }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Merge configuration objects
   * @param {Object} target - Target configuration object
   * @param {Object} source - Source configuration object
   * @returns {Object} Merged configuration object
   */
  mergeConfig(target, source) {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.mergeConfig(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Apply environment-specific configuration overrides
   */
  applyEnvironmentOverrides() {
    const environment = this.config.environment.environment;
    const overrides = this.config.environment.envSpecific[environment];
    
    if (overrides) {
      this.config = this.mergeConfig(this.config, overrides);
    }
  }

  /**
   * Validate the configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    const errors = [];
    
    // Validate WebSocket configuration
    if (!this.config.websocket.url || typeof this.config.websocket.url !== 'string') {
      errors.push('WebSocket URL is required and must be a string');
    }
    
    if (!this.config.websocket.url.startsWith('ws://') && !this.config.websocket.url.startsWith('wss://')) {
      errors.push('WebSocket URL must start with ws:// or wss://');
    }
    
    // Validate numeric values
    if (typeof this.config.websocket.reconnectInterval !== 'number' || this.config.websocket.reconnectInterval <= 0) {
      errors.push('WebSocket reconnect interval must be a positive number');
    }
    
    if (typeof this.config.websocket.connectionTimeout !== 'number' || this.config.websocket.connectionTimeout <= 0) {
      errors.push('WebSocket connection timeout must be a positive number');
    }
    
    // Validate content filter configuration
    if (typeof this.config.contentFilter.minTextDensity !== 'number' || 
        this.config.contentFilter.minTextDensity < 0 || 
        this.config.contentFilter.minTextDensity > 1) {
      errors.push('Content filter min text density must be a number between 0 and 1');
    }
    
    if (typeof this.config.contentFilter.maxLinkDensity !== 'number' || 
        this.config.contentFilter.maxLinkDensity < 0 || 
        this.config.contentFilter.maxLinkDensity > 1) {
      errors.push('Content filter max link density must be a number between 0 and 1');
    }
    
    // Validate logging configuration
    const validLogLevels = ['debug', 'info', 'warn', 'error', 'none'];
    if (!validLogLevels.includes(this.config.logging.level)) {
      errors.push(`Logging level must be one of: ${validLogLevels.join(', ')}`);
    }
    
    // Validate browser context configuration
    if (typeof this.config.browserContext.contentScriptTimeout !== 'number' || 
        this.config.browserContext.contentScriptTimeout <= 0) {
      errors.push('Content script timeout must be a positive number');
    }
    
    // Validate environment configuration
    const validEnvironments = ['development', 'staging', 'production'];
    if (!validEnvironments.includes(this.config.environment.environment)) {
      errors.push(`Environment must be one of: ${validEnvironments.join(', ')}`);
    }
    
    if (errors.length > 0) {
      throw createError('CONFIG_VALIDATION_FAILED', 'Configuration validation failed', { errors });
    }
  }

  /**
   * Get the current configuration
   * @returns {Object} Current configuration object
   */
  getConfig() {
    if (!this.isInitialized) {
      throw createError('CONFIG_INVALID', 'Configuration manager is not initialized');
    }
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   * @param {string} path - Dot-separated path to the configuration value
   * @returns {any} The configuration value
   */
  get(path) {
    if (!this.isInitialized) {
      throw createError('CONFIG_INVALID', 'Configuration manager is not initialized');
    }
    
    const keys = path.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set a specific configuration value
   * @param {string} path - Dot-separated path to the configuration value
   * @param {any} value - The new value
   */
  async set(path, value) {
    if (!this.isInitialized) {
      throw createError('CONFIG_INVALID', 'Configuration manager is not initialized');
    }
    
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    
    // Navigate to the parent object
    for (const key of keys) {
      if (target[key] && typeof target[key] === 'object') {
        target = target[key];
      } else {
        target[key] = {};
        target = target[key];
      }
    }
    
    // Set the value
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    try {
      // Validate the updated configuration
      this.validateConfig();
      
      // Save the configuration
      await this.saveConfig();
      
      // Notify callbacks
      this.notifyConfigChange(path, value, oldValue);
    } catch (error) {
      // Revert the change on error
      target[lastKey] = oldValue;
      throw error;
    }
  }

  /**
   * Update multiple configuration values
   * @param {Object} updates - Object containing configuration updates
   */
  async update(updates) {
    if (!this.isInitialized) {
      throw createError('CONFIG_INVALID', 'Configuration manager is not initialized');
    }
    
    const oldConfig = { ...this.config };
    
    try {
      // Apply updates
      this.config = this.mergeConfig(this.config, updates);
      
      // Validate the updated configuration
      this.validateConfig();
      
      // Save the configuration
      await this.saveConfig();
      
      // Notify callbacks for all changed paths
      this.notifyConfigUpdate(updates, oldConfig);
    } catch (error) {
      // Revert the change on error
      this.config = oldConfig;
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async reset() {
    const oldConfig = { ...this.config };
    
    try {
      this.config = this.getDefaultConfig();
      this.applyEnvironmentOverrides();
      
      // Validate the configuration
      this.validateConfig();
      
      // Save the configuration
      await this.saveConfig();
      
      // Notify callbacks
      this.notifyConfigReset(oldConfig);
    } catch (error) {
      // Revert the change on error
      this.config = oldConfig;
      throw error;
    }
  }

  /**
   * Register a callback for configuration changes
   * @param {string} path - Dot-separated path to watch (or 'all' for all changes)
   * @param {Function} callback - Callback function to execute
   */
  onChange(path, callback) {
    if (!this.configCallbacks.has(path)) {
      this.configCallbacks.set(path, []);
    }
    this.configCallbacks.get(path).push(callback);
  }

  /**
   * Remove a callback for configuration changes
   * @param {string} path - Dot-separated path that was being watched
   * @param {Function} callback - Callback function to remove
   */
  offChange(path, callback) {
    const callbacks = this.configCallbacks.get(path);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify callbacks of a configuration change
   * @param {string} path - Path that changed
   * @param {any} newValue - New value
   * @param {any} oldValue - Old value
   */
  notifyConfigChange(path, newValue, oldValue) {
    const callbacks = this.configCallbacks.get(path) || [];
    const allCallbacks = this.configCallbacks.get('all') || [];
    
    const allCallbacksToExecute = [...callbacks, ...allCallbacks];
    
    for (const callback of allCallbacksToExecute) {
      try {
        callback(path, newValue, oldValue);
      } catch (error) {
        console.error('Error in configuration change callback:', error);
      }
    }
  }

  /**
   * Notify callbacks of a configuration update
   * @param {Object} updates - Object containing the updates
   * @param {Object} oldConfig - Old configuration object
   */
  notifyConfigUpdate(updates, oldConfig) {
    // Notify for each specific path that changed
    for (const [path, newValue] of Object.entries(this.flattenObject(updates))) {
      const oldValue = this.getFromFlattened(oldConfig, path);
      this.notifyConfigChange(path, newValue, oldValue);
    }
  }

  /**
   * Notify callbacks of a configuration reset
   * @param {Object} oldConfig - Old configuration object
   */
  notifyConfigReset(oldConfig) {
    // Notify for all paths that changed
    const flatOldConfig = this.flattenObject(oldConfig);
    const flatNewConfig = this.flattenObject(this.config);
    
    for (const [path, newValue] of Object.entries(flatNewConfig)) {
      const oldValue = flatOldConfig[path];
      if (oldValue !== newValue) {
        this.notifyConfigChange(path, newValue, oldValue);
      }
    }
  }

  /**
   * Flatten an object with dot-separated keys
   * @param {Object} obj - Object to flatten
   * @param {string} [prefix=''] - Prefix for nested keys
   * @returns {Object} Flattened object
   */
  flattenObject(obj, prefix = '') {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value, path));
      } else {
        result[path] = value;
      }
    }
    
    return result;
  }

  /**
   * Get a value from a flattened object
   * @param {Object} obj - Flattened object
   * @param {string} path - Dot-separated path
   * @returns {any} The value at the path
   */
  getFromFlattened(obj, path) {
    return obj[path];
  }

  /**
   * Export configuration to JSON
   * @returns {string} JSON string representation of the configuration
   */
  exportToJson() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   * @param {string} json - JSON string to import
   */
  async importFromJson(json) {
    try {
      const importedConfig = JSON.parse(json);
      await this.update(importedConfig);
    } catch (error) {
      throw createError('CONFIG_INVALID', 'Failed to import configuration from JSON', { originalError: error });
    }
  }

  /**
   * Destroy the configuration manager and clean up resources
   */
  destroy() {
    this.configCallbacks.clear();
    this.isInitialized = false;
  }
}

// Create a singleton instance
let configManagerInstance = null;

/**
 * Get the singleton configuration manager instance
 * @returns {ConfigManager} The configuration manager instance
 */
export function getConfigManager() {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}