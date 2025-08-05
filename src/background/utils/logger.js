/**
 * Centralized logging system for the background script
 */

import { LOG_LEVELS } from '../../shared/constants/default-config.js';

/**
 * Logger class for managing logs in the background script
 */
export class Logger {
  /**
   * Create a new Logger
   * @param {Object} config - Logging configuration
   */
  constructor(config = {}) {
    this.config = {
      level: LOG_LEVELS.INFO,
      enableConsoleLogging: true,
      maxLogEntries: 1000,
      includeTimestamps: true,
      includeContext: true,
      ...config
    };
    
    this.logs = [];
    this.logCallbacks = new Map();
  }

  /**
   * Initialize the logger
   */
  init() {
    this.info('Logger initialized', { config: this.config });
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {Object} [data] - Additional data to log
   */
  debug(message, data = {}) {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {Object} [data] - Additional data to log
   */
  info(message, data = {}) {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {Object} [data] - Additional data to log
   */
  warn(message, data = {}) {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {Object} [data] - Additional data to log
   */
  error(message, data = {}) {
    this.log(LOG_LEVELS.ERROR, message, data);
  }

  /**
   * Log a message with the specified level
   * @param {number} level - The log level
   * @param {string} message - The message to log
   * @param {Object} [data] - Additional data to log
   */
  log(level, message, data = {}) {
    if (level < this.config.level) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, data);
    
    // Add to internal log storage
    this.addLogEntry(logEntry);
    
    // Log to console if enabled
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }
    
    // Execute callbacks
    this.executeLogCallbacks(logEntry);
  }

  /**
   * Create a log entry object
   * @param {number} level - The log level
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to log
   * @returns {Object} The log entry object
   */
  createLogEntry(level, message, data) {
    const entry = {
      level,
      message,
      data,
      timestamp: this.config.includeTimestamps ? new Date().toISOString() : null
    };

    // Add context information if enabled
    if (this.config.includeContext) {
      entry.context = this.getContext();
    }

    return entry;
  }

  /**
   * Get context information for the log entry
   * @returns {Object} Context information
   */
  getContext() {
    return {
      extensionVersion: chrome.runtime.getManifest().version,
      extensionId: chrome.runtime.id,
      url: location.href,
      userAgent: navigator.userAgent,
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }

  /**
   * Add a log entry to the internal storage
   * @param {Object} entry - The log entry to add
   */
  addLogEntry(entry) {
    this.logs.push(entry);
    
    // Maintain maximum log size
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs.shift();
    }
  }

  /**
   * Log a message to the console
   * @param {Object} entry - The log entry to log
   */
  logToConsole(entry) {
    const levelName = this.getLevelName(entry.level);
    const prefix = this.config.includeTimestamps ? `[${entry.timestamp}] ` : '';
    const message = `${prefix}[${levelName}] ${entry.message}`;
    
    switch (entry.level) {
      case LOG_LEVELS.DEBUG:
        console.debug(message, entry.data);
        break;
      case LOG_LEVELS.INFO:
        console.info(message, entry.data);
        break;
      case LOG_LEVELS.WARN:
        console.warn(message, entry.data);
        break;
      case LOG_LEVELS.ERROR:
        console.error(message, entry.data);
        break;
      default:
        console.log(message, entry.data);
    }
  }

  /**
   * Get the name of a log level
   * @param {number} level - The log level
   * @returns {string} The level name
   */
  getLevelName(level) {
    switch (level) {
      case LOG_LEVELS.DEBUG:
        return 'DEBUG';
      case LOG_LEVELS.INFO:
        return 'INFO';
      case LOG_LEVELS.WARN:
        return 'WARN';
      case LOG_LEVELS.ERROR:
        return 'ERROR';
      case LOG_LEVELS.NONE:
        return 'NONE';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Execute callbacks registered for log entries
   * @param {Object} entry - The log entry
   */
  executeLogCallbacks(entry) {
    const callbacks = this.logCallbacks.get('all') || [];
    const levelCallbacks = this.logCallbacks.get(entry.level) || [];
    
    const allCallbacks = [...callbacks, ...levelCallbacks];
    
    for (const callback of allCallbacks) {
      try {
        callback(entry);
      } catch (error) {
        console.error('Error in log callback:', error);
      }
    }
  }

  /**
   * Register a callback for log entries
   * @param {string|number} type - Log level or 'all' for all levels
   * @param {Function} callback - Callback function to execute
   */
  onLog(type, callback) {
    if (!this.logCallbacks.has(type)) {
      this.logCallbacks.set(type, []);
    }
    this.logCallbacks.get(type).push(callback);
  }

  /**
   * Remove a callback for log entries
   * @param {string|number} type - Log level or 'all' for all levels
   * @param {Function} callback - Callback function to remove
   */
  offLog(type, callback) {
    const callbacks = this.logCallbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get all log entries
   * @param {number} [level] - Optional level to filter by
   * @returns {Array} Array of log entries
   */
  getLogs(level = null) {
    if (level === null) {
      return [...this.logs];
    }
    return this.logs.filter(entry => entry.level === level);
  }

  /**
   * Get log entries within a time range
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {number} [level] - Optional level to filter by
   * @returns {Array} Array of log entries
   */
  getLogsInRange(startTime, endTime, level = null) {
    return this.logs.filter(entry => {
      const entryTime = new Date(entry.timestamp);
      const inRange = entryTime >= startTime && entryTime <= endTime;
      const levelMatch = level === null || entry.level === level;
      return inRange && levelMatch;
    });
  }

  /**
   * Clear all log entries
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {},
      oldest: null,
      newest: null
    };

    // Count by level
    for (const entry of this.logs) {
      const levelName = this.getLevelName(entry.level);
      stats.byLevel[levelName] = (stats.byLevel[levelName] || 0) + 1;
    }

    // Find oldest and newest
    if (this.logs.length > 0) {
      stats.oldest = this.logs[0].timestamp;
      stats.newest = this.logs[this.logs.length - 1].timestamp;
    }

    return stats;
  }

  /**
   * Set the log level
   * @param {number} level - The new log level
   */
  setLevel(level) {
    this.config.level = level;
    this.debug(`Log level set to ${this.getLevelName(level)}`);
  }

  /**
   * Enable or disable console logging
   * @param {boolean} enabled - Whether to enable console logging
   */
  setConsoleLogging(enabled) {
    this.config.enableConsoleLogging = enabled;
    this.debug(`Console logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set the maximum number of log entries
   * @param {number} maxEntries - The maximum number of log entries
   */
  setMaxLogEntries(maxEntries) {
    this.config.maxLogEntries = maxEntries;
    
    // Trim logs if necessary
    if (this.logs.length > maxEntries) {
      this.logs = this.logs.slice(-maxEntries);
    }
    
    this.debug(`Max log entries set to ${maxEntries}`);
  }

  /**
   * Destroy the logger and clean up resources
   */
  destroy() {
    this.clearLogs();
    this.logCallbacks.clear();
  }
}

// Create a singleton instance
let loggerInstance = null;

/**
 * Get the singleton logger instance
 * @param {Object} config - Logger configuration
 * @returns {Logger} The logger instance
 */
export function getLogger(config = {}) {
  if (!loggerInstance) {
    loggerInstance = new Logger(config);
  }
  return loggerInstance;
}