/**
 * Browser context manager for the background script
 */

import { createError } from '../../shared/constants/error-codes.js';
import { MESSAGE_TYPES } from '../../shared/constants/default-config.js';

/**
 * Browser context manager class
 */
export class BrowserContextManager {
  /**
   * Create a new BrowserContextManager
   * @param {Object} configManager - Configuration manager instance
   * @param {Object} logger - Logger instance
   * @param {Object} errorHandler - Error handler instance
   */
  constructor(configManager, logger, errorHandler) {
    this.configManager = configManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    this.activeTabCache = null;
    this.activeTabCacheTime = 0;
    this.cacheTimeout = 5000; // 5 seconds
  }

  /**
   * Initialize the browser context manager
   */
  init() {
    this.logger.info('Browser context manager initialized');
    
    // Set up tab update listener to invalidate cache
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    chrome.tabs.onActivated.addListener(this.handleTabActivation.bind(this));
  }

  /**
   * Handle tab update event
   * @param {number} tabId - The ID of the updated tab
   * @param {Object} changeInfo - Information about the change
   * @param {Object} tab - The updated tab object
   */
  handleTabUpdate(tabId, changeInfo, tab) {
    // Invalidate cache if the active tab was updated
    if (this.activeTabCache && this.activeTabCache.id === tabId) {
      this.activeTabCache = null;
      this.activeTabCacheTime = 0;
      this.logger.debug('Active tab cache invalidated due to tab update');
    }
  }

  /**
   * Handle tab activation event
   * @param {Object} activeInfo - Information about the activated tab
   */
  handleTabActivation(activeInfo) {
    // Invalidate cache when a different tab is activated
    this.activeTabCache = null;
    this.activeTabCacheTime = 0;
    this.logger.debug('Active tab cache invalidated due to tab activation');
  }

  /**
   * Collect browser context data
   * @param {Object} options - Collection options
   * @returns {Promise<Object>} Promise that resolves to the browser context data
   */
  async collectBrowserContext(options = {}) {
    this.logger.debug('Collecting browser context', { options });
    
    try {
      // Get the active tab
      const activeTab = await this.getActiveTab();
      
      if (!activeTab) {
        throw createError('BC_NO_ACTIVE_TAB', 'No active tab found');
      }
      
      // Check if this is a restricted page
      this.checkRestrictedPage(activeTab);
      
      // Check if tab is ready
      this.checkTabReady(activeTab);
      
      // Get browser context from content script
      const contextData = await this.getBrowserContextFromContentScript(activeTab, options);
      
      this.logger.debug('Browser context collected successfully', {
        url: contextData.url,
        title: contextData.title,
        textLength: contextData.visibleText?.length || 0,
        linksCount: contextData.links?.length || 0,
        hasSelection: contextData.hasSelection
      });
      
      return contextData;
      
    } catch (error) {
      this.logger.error('Failed to collect browser context', { error: error.message });
      throw error;
    }
  }

  /**
   * Get the active tab
   * @returns {Promise<Object>} Promise that resolves to the active tab
   */
  async getActiveTab() {
    const now = Date.now();
    
    // Return cached tab if it's still valid
    if (this.activeTabCache && (now - this.activeTabCacheTime) < this.cacheTimeout) {
      this.logger.debug('Returning cached active tab');
      return this.activeTabCache;
    }
    
    const config = this.configManager.getConfig();
    const timeout = config.browserContext.tabQueryTimeout;
    
    try {
      // Query for active tab with timeout
      const tabs = await Promise.race([
        chrome.tabs.query({ active: true, currentWindow: true }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tab query timeout')), timeout)
        )
      ]);
      
      if (tabs.length === 0) {
        // Try all windows if no active tab in current window
        const allWindowTabs = await chrome.tabs.query({ active: true });
        if (allWindowTabs.length === 0) {
          return null;
        }
        this.activeTabCache = allWindowTabs[0];
      } else {
        this.activeTabCache = tabs[0];
      }
      
      this.activeTabCacheTime = now;
      
      this.logger.debug('Found active tab', {
        id: this.activeTabCache.id,
        url: this.activeTabCache.url,
        title: this.activeTabCache.title
      });
      
      return this.activeTabCache;
      
    } catch (error) {
      this.logger.error('Failed to get active tab', { error: error.message });
      throw createError('BC_NO_ACTIVE_TAB', 'Failed to get active tab', { originalError: error });
    }
  }

  /**
   * Check if the page is restricted
   * @param {Object} tab - The tab to check
   * @throws {Error} If the page is restricted
   */
  checkRestrictedPage(tab) {
    const config = this.configManager.getConfig();
    const restrictedProtocols = config.browserContext.restrictedProtocols;
    
    const isRestricted = restrictedProtocols.some(protocol => 
      tab.url.startsWith(protocol)
    );
    
    if (isRestricted) {
      const url = new URL(tab.url);
      throw createError('BC_RESTRICTED_PAGE', 'Cannot access restricted page', {
        protocol: url.protocol,
        hostname: url.hostname,
        url: tab.url
      });
    }
  }

  /**
   * Check if the tab is ready
   * @param {Object} tab - The tab to check
   */
  checkTabReady(tab) {
    if (tab.status !== 'complete') {
      this.logger.warn('Tab not fully loaded', { 
        tabId: tab.id, 
        status: tab.status 
      });
    }
  }

  /**
   * Get browser context from content script
   * @param {Object} tab - The tab to get context from
   * @param {Object} options - Collection options
   * @returns {Promise<Object>} Promise that resolves to the browser context data
   */
  async getBrowserContextFromContentScript(tab, options) {
    const config = this.configManager.getConfig();
    const timeout = config.browserContext.contentScriptTimeout;
    
    try {
      // Check if content script is available
      await this.pingContentScript(tab);
      
      // Send message to content script
      const message = {
        type: MESSAGE_TYPES.GET_BROWSER_CONTEXT,
        ...options
      };
      
      this.logger.debug('Sending GET_BROWSER_CONTEXT message to content script', {
        tabId: tab.id,
        options
      });
      
      // Send message with timeout
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, message),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Content script response timeout')), timeout)
        )
      ]);
      
      this.logger.debug('Received response from content script', {
        tabId: tab.id,
        success: response.success,
        hasData: !!response.data
      });
      
      // Validate response
      if (!response || typeof response !== 'object') {
        throw createError('BC_CONTENT_SCRIPT_ERROR', 'Invalid response from content script');
      }
      
      if (!response.success) {
        throw createError('BC_CONTENT_SCRIPT_ERROR', response.error || 'Content script operation failed');
      }
      
      if (!response.data) {
        throw createError('BC_CONTENT_SCRIPT_ERROR', 'No data received from content script');
      }
      
      return response.data;
      
    } catch (error) {
      this.logger.error('Failed to get browser context from content script', {
        tabId: tab.id,
        error: error.message
      });
      
      // Try to inject content script if it failed
      if (error.message.includes('Could not establish connection') || 
          error.message.includes('The message port closed') ||
          error.message.includes('Content script injection failed')) {
        try {
          await this.injectContentScript(tab);
          // Retry the request after injection
          return await this.getBrowserContextFromContentScript(tab, options);
        } catch (injectError) {
          throw createError('BC_CONTENT_SCRIPT_INJECTION_FAILED', 'Failed to inject content script', { originalError: injectError });
        }
      }
      
      throw createError('BC_CONTENT_SCRIPT_ERROR', 'Failed to communicate with content script', { originalError: error });
    }
  }

  /**
   * Ping the content script to check if it's available
   * @param {Object} tab - The tab to ping
   * @returns {Promise<void>} Promise that resolves when the content script responds
   */
  async pingContentScript(tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.PING });
      this.logger.debug('Content script is responsive', { tabId: tab.id });
    } catch (error) {
      this.logger.debug('Content script not responding, attempting to inject', { 
        tabId: tab.id, 
        error: error.message 
      });
      
      // Try to inject content script
      await this.injectContentScript(tab);
      
      // Wait a moment for the script to initialize
      const config = this.configManager.getConfig();
      await new Promise(resolve => setTimeout(resolve, config.browserContext.contentScriptInitDelay));
    }
  }

  /**
   * Inject content script into a tab
   * @param {Object} tab - The tab to inject the script into
   * @returns {Promise<void>} Promise that resolves when the script is injected
   */
  async injectContentScript(tab) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      this.logger.info('Content script injected successfully', { tabId: tab.id });
      
    } catch (error) {
      this.logger.error('Failed to inject content script', {
        tabId: tab.id,
        error: error.message
      });
      
      throw createError('BC_CONTENT_SCRIPT_INJECTION_FAILED', 'Failed to inject content script', { originalError: error });
    }
  }

  /**
   * Get the current active tab URL
   * @returns {Promise<string>} Promise that resolves to the active tab URL
   */
  async getCurrentUrl() {
    try {
      const tab = await this.getActiveTab();
      return tab ? tab.url : null;
    } catch (error) {
      this.logger.error('Failed to get current URL', { error: error.message });
      return null;
    }
  }

  /**
   * Get the current active tab title
   * @returns {Promise<string>} Promise that resolves to the active tab title
   */
  async getCurrentTitle() {
    try {
      const tab = await this.getActiveTab();
      return tab ? tab.title : null;
    } catch (error) {
      this.logger.error('Failed to get current title', { error: error.message });
      return null;
    }
  }

  /**
   * Invalidate the active tab cache
   */
  invalidateCache() {
    this.activeTabCache = null;
    this.activeTabCacheTime = 0;
    this.logger.debug('Active tab cache invalidated');
  }

  /**
   * Get browser context manager statistics
   * @returns {Object} Browser context manager statistics
   */
  getStats() {
    return {
      hasCachedTab: !!this.activeTabCache,
      cacheAge: this.activeTabCacheTime ? Date.now() - this.activeTabCacheTime : 0,
      cacheTimeout: this.cacheTimeout,
      cachedTabId: this.activeTabCache ? this.activeTabCache.id : null,
      cachedTabUrl: this.activeTabCache ? this.activeTabCache.url : null
    };
  }

  /**
   * Destroy the browser context manager and clean up resources
   */
  destroy() {
    this.activeTabCache = null;
    this.activeTabCacheTime = 0;
    
    // Remove event listeners
    chrome.tabs.onUpdated.removeListener(this.handleTabUpdate);
    chrome.tabs.onActivated.removeListener(this.handleTabActivation);
  }
}

// Create a singleton instance
let browserContextManagerInstance = null;

/**
 * Get the singleton browser context manager instance
 * @param {Object} configManager - Configuration manager instance
 * @param {Object} logger - Logger instance
 * @param {Object} errorHandler - Error handler instance
 * @returns {BrowserContextManager} The browser context manager instance
 */
export function getBrowserContextManager(configManager, logger, errorHandler) {
  if (!browserContextManagerInstance) {
    browserContextManagerInstance = new BrowserContextManager(configManager, logger, errorHandler);
  }
  return browserContextManagerInstance;
}