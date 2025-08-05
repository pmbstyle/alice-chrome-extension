/**
 * Memory management utilities for LLM-optimized Chrome Extension
 * Provides efficient memory management and DOM reference cleanup
 */

/**
 * Memory manager class for handling DOM references and memory cleanup
 */
export class MemoryManager {
  /**
   * Create a new MemoryManager
   */
  constructor() {
    this.domReferences = new WeakMap();
    this.timers = new Set();
    this.observers = new Set();
    this.eventListeners = new Map();
    this.cache = new Map();
    this.maxCacheSize = 50; // Maximum number of cached items
    this.cacheTimeout = 60000; // 1 minute cache timeout
  }

  /**
   * Initialize the memory manager
   */
  init() {
    // Set up periodic cleanup
    this.startPeriodicCleanup();
    
    // Set up memory pressure monitoring if available
    this.setupMemoryPressureMonitoring();
  }

  /**
   * Track a DOM reference for cleanup
   * @param {Element} element - DOM element to track
   * @param {Object} metadata - Metadata about the reference
   */
  trackDOMReference(element, metadata = {}) {
    if (!element || !(element instanceof Element)) {
      return;
    }

    this.domReferences.set(element, {
      timestamp: Date.now(),
      metadata: metadata
    });
  }

  /**
   * Clean up DOM references
   */
  cleanupDOMReferences() {
    // WeakMap automatically cleans up when elements are garbage collected
    // This method is for any additional cleanup needed
    console.log('[MemoryManager] DOM references cleanup completed');
  }

  /**
   * Register a timer for cleanup
   * @param {number} timerId - Timer ID to track
   */
  registerTimer(timerId) {
    if (timerId) {
      this.timers.add(timerId);
    }
  }

  /**
   * Clear all registered timers
   */
  clearAllTimers() {
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    this.timers.clear();
  }

  /**
   * Register a MutationObserver for cleanup
   * @param {MutationObserver} observer - Observer to track
   */
  registerObserver(observer) {
    if (observer) {
      this.observers.add(observer);
    }
  }

  /**
   * Disconnect all registered observers
   */
  disconnectAllObservers() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.error('[MemoryManager] Error disconnecting observer:', error);
      }
    });
    this.observers.clear();
  }

  /**
   * Register an event listener for cleanup
   * @param {Element} target - Event target
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   */
  registerEventListener(target, event, handler, options = {}) {
    if (!target || !event || !handler) {
      return;
    }

    const key = `${target.constructor.name}_${event}_${handler.name || 'anonymous'}`;
    
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, { target, event, handler, options });
      target.addEventListener(event, handler, options);
    }
  }

  /**
   * Remove all registered event listeners
   */
  removeAllEventListeners() {
    this.eventListeners.forEach(({ target, event, handler, options }) => {
      try {
        target.removeEventListener(event, handler, options);
      } catch (error) {
        console.error('[MemoryManager] Error removing event listener:', error);
      }
    });
    this.eventListeners.clear();
  }

  /**
   * Cache data with automatic cleanup
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} [timeout] - Custom timeout in milliseconds
   */
  cacheData(key, data, timeout = this.cacheTimeout) {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      timeout: timeout
    });
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if not found or expired
   */
  getCachedData(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.timeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clearAllCache() {
    this.cache.clear();
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 30000); // Cleanup every 30 seconds

    this.registerTimer(cleanupInterval);
  }

  /**
   * Perform comprehensive cleanup
   */
  performCleanup() {
    console.log('[MemoryManager] Performing periodic cleanup');
    
    // Clear expired cache
    this.clearExpiredCache();
    
    // Clean up DOM references
    this.cleanupDOMReferences();
    
    // Log memory usage if available
    this.logMemoryUsage();
  }

  /**
   * Set up memory pressure monitoring
   */
  setupMemoryPressureMonitoring() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const checkMemoryPressure = () => {
        const memory = performance.memory;
        const usedJSHeapSize = memory.usedJSHeapSize;
        const totalJSHeapSize = memory.totalJSHeapSize;
        const jsHeapSizeLimit = memory.jsHeapSizeLimit;
        
        const usageRatio = usedJSHeapSize / jsHeapSizeLimit;
        
        // If memory usage is high, perform aggressive cleanup
        if (usageRatio > 0.8) {
          console.warn('[MemoryManager] High memory usage detected, performing aggressive cleanup');
          this.performAggressiveCleanup();
        }
      };

      // Check memory pressure every minute
      const memoryCheckInterval = setInterval(checkMemoryPressure, 60000);
      this.registerTimer(memoryCheckInterval);
    }
  }

  /**
   * Perform aggressive cleanup when memory pressure is high
   */
  performAggressiveCleanup() {
    console.log('[MemoryManager] Performing aggressive cleanup');
    
    // Clear all cache
    this.clearAllCache();
    
    // Force garbage collection if available (development only)
    if (typeof gc !== 'undefined' && chrome.runtime.id.includes('development')) {
      try {
        gc();
        console.log('[MemoryManager] Garbage collection triggered');
      } catch (error) {
        console.error('[MemoryManager] Failed to trigger garbage collection:', error);
      }
    }
  }

  /**
   * Log memory usage statistics
   */
  logMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      console.log('[MemoryManager] Memory usage:', {
        used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
        usage: `${Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)}%`
      });
    }
  }

  /**
   * Get memory manager statistics
   * @returns {Object} Memory manager statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      timersCount: this.timers.size,
      observersCount: this.observers.size,
      eventListenersCount: this.eventListeners.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Destroy the memory manager and clean up all resources
   */
  destroy() {
    console.log('[MemoryManager] Destroying memory manager');
    
    // Clear all timers
    this.clearAllTimers();
    
    // Disconnect all observers
    this.disconnectAllObservers();
    
    // Remove all event listeners
    this.removeAllEventListeners();
    
    // Clear all cache
    this.clearAllCache();
    
    // Clean up DOM references
    this.cleanupDOMReferences();
  }
}

// Create a singleton instance
let memoryManagerInstance = null;

/**
 * Get the singleton memory manager instance
 * @returns {MemoryManager} The memory manager instance
 */
export function getMemoryManager() {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
    memoryManagerInstance.init();
  }
  return memoryManagerInstance;
}

/**
 * Utility function to create a memory-efficient DOM element scanner
 * @param {Element} root - Root element to scan
 * @param {Object} options - Scanning options
 * @returns {Object} Scanner with memory-efficient methods
 */
export function createMemoryEfficientScanner(root = document.body, options = {}) {
  const {
    maxElements = 1000,
    maxDepth = 10,
    batchSize = 50
  } = options;

  let processedCount = 0;
  let currentDepth = 0;

  /**
   * Process elements in batches to avoid memory spikes
   * @param {Function} processor - Element processor function
   * @param {Function} filter - Element filter function
   */
  async function processInBatches(processor, filter = () => true) {
    const elements = [];
    
    // Collect elements with depth and memory limits
    function collectElements(element, depth = 0) {
      if (depth > maxDepth || processedCount >= maxElements) {
        return;
      }

      if (filter(element)) {
        elements.push(element);
        processedCount++;
      }

      // Process children
      const children = element.children;
      for (let i = 0; i < children.length; i++) {
        collectElements(children[i], depth + 1);
      }
    }

    collectElements(root);

    // Process in batches
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      
      // Allow event loop to process other tasks
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Process batch
      batch.forEach(processor);
    }

    return elements.length;
  }

  return {
    processInBatches,
    getProcessedCount: () => processedCount,
    reset: () => {
      processedCount = 0;
      currentDepth = 0;
    }
  };
}