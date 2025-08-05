export class MemoryManager {
  constructor() {
    this.domReferences = new WeakMap();
    this.timers = new Set();
    this.observers = new Set();
    this.eventListeners = new Map();
    this.cache = new Map();
    this.maxCacheSize = 50;
    this.cacheTimeout = 60000;
  }

  init() {
    this.startPeriodicCleanup();
    this.setupMemoryPressureMonitoring();
  }

  trackDOMReference(element, metadata = {}) {
    if (!element || !(element instanceof Element)) {
      return;
    }

    this.domReferences.set(element, {
      timestamp: Date.now(),
      metadata: metadata
    });
  }

  cleanupDOMReferences() {
  }

  registerTimer(timerId) {
    if (timerId) {
      this.timers.add(timerId);
    }
  }

  clearAllTimers() {
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    this.timers.clear();
  }

  registerObserver(observer) {
    if (observer) {
      this.observers.add(observer);
    }
  }

  disconnectAllObservers() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
      }
    });
    this.observers.clear();
  }

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

  removeAllEventListeners() {
    this.eventListeners.forEach(({ target, event, handler, options }) => {
      try {
        target.removeEventListener(event, handler, options);
      } catch (error) {
      }
    });
    this.eventListeners.clear();
  }

  cacheData(key, data, timeout = this.cacheTimeout) {
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

  getCachedData(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clearExpiredCache() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.timeout) {
        this.cache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.cache.clear();
  }

  startPeriodicCleanup() {
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 30000);

    this.registerTimer(cleanupInterval);
  }

  performCleanup() {
    this.clearExpiredCache();
    this.cleanupDOMReferences();
  }

  setupMemoryPressureMonitoring() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const checkMemoryPressure = () => {
        const memory = performance.memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usageRatio > 0.8) {
          this.performAggressiveCleanup();
        }
      };

      const memoryCheckInterval = setInterval(checkMemoryPressure, 60000);
      this.registerTimer(memoryCheckInterval);
    }
  }

  performAggressiveCleanup() {
    this.clearAllCache();
    
    if (typeof gc !== 'undefined' && chrome.runtime.id.includes('development')) {
      try {
        gc();
      } catch (error) {
      }
    }
  }

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

  destroy() {
    this.clearAllTimers();
    this.disconnectAllObservers();
    this.removeAllEventListeners();
    this.clearAllCache();
    this.cleanupDOMReferences();
  }
}

let memoryManagerInstance = null;

export function getMemoryManager() {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
    memoryManagerInstance.init();
  }
  return memoryManagerInstance;
}

export function createMemoryEfficientScanner(root = document.body, options = {}) {
  const {
    maxElements = 1000,
    maxDepth = 10,
    batchSize = 50
  } = options;

  let processedCount = 0;
  let currentDepth = 0;

  async function processInBatches(processor, filter = () => true) {
    const elements = [];
    
    function collectElements(element, depth = 0) {
      if (depth > maxDepth || processedCount >= maxElements) {
        return;
      }

      if (filter(element)) {
        elements.push(element);
        processedCount++;
      }

      const children = element.children;
      for (let i = 0; i < children.length; i++) {
        collectElements(children[i], depth + 1);
      }
    }

    collectElements(root);

    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
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