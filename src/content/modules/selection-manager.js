/**
 * Selection manager module for the content script
 * Handles user text selection and context extraction
 */

/**
 * Selection manager class
 */
export class SelectionManager {
  /**
   * Create a new SelectionManager
   */
  constructor() {
    this.currentSelection = null;
    this.selectionContext = null;
    this.selectionCallbacks = new Map();
  }

  /**
   * Initialize the selection manager
   */
  init() {
    // Set up selection change listener
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
    
    // Set up mouseup listener for more immediate selection detection
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  /**
   * Handle selection change event
   */
  handleSelectionChange() {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      this.currentSelection = selection.toString().trim();
      this.selectionContext = this.getSelectionContext();
      this.notifySelectionCallbacks('change', this.currentSelection, this.selectionContext);
    }
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp() {
    // Small delay to ensure selection is updated
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        this.currentSelection = selection.toString().trim();
        this.selectionContext = this.getSelectionContext();
        this.notifySelectionCallbacks('select', this.currentSelection, this.selectionContext);
      }
    }, 10);
  }

  /**
   * Get user selection and surrounding context
   * @param {number} [maxLength=2000] - Maximum context length
   * @returns {Object} Selection data
   */
  getSelectionContext(maxLength = 2000) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return {
        selection: '',
        context: '',
        hasSelection: false
      };
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      return {
        selection: '',
        context: '',
        hasSelection: false
      };
    }

    // Get surrounding context
    const container = range.commonAncestorContainer;
    const contextElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container;

    let context = '';
    if (contextElement) {
      context = contextElement.textContent || '';
      
      // Find the selection within the context
      const selectionIndex = context.indexOf(selectedText);
      if (selectionIndex !== -1) {
        const start = Math.max(0, selectionIndex - Math.floor(maxLength / 2));
        const end = Math.min(context.length, selectionIndex + selectedText.length + Math.floor(maxLength / 2));
        context = context.substring(start, end);
      }
    }

    return {
      selection: selectedText,
      context: context.trim(),
      hasSelection: true
    };
  }

  /**
   * Get the current selection
   * @returns {string} Current selection text
   */
  getCurrentSelection() {
    return this.currentSelection || '';
  }

  /**
   * Get the current selection context
   * @returns {Object} Current selection context
   */
  getCurrentSelectionContext() {
    return this.selectionContext || {
      selection: '',
      context: '',
      hasSelection: false
    };
  }

  /**
   * Check if there is a current selection
   * @returns {boolean} True if there is a selection
   */
  hasSelection() {
    return !!this.currentSelection && this.currentSelection.length > 0;
  }

  /**
   * Clear the current selection
   */
  clearSelection() {
    this.currentSelection = null;
    this.selectionContext = null;
    window.getSelection().removeAllRanges();
    this.notifySelectionCallbacks('clear', '', null);
  }

  /**
   * Select text in the document
   * @param {string} text - Text to select
   * @param {boolean} [caseSensitive=false] - Whether to search case-sensitively
   * @returns {boolean} True if text was found and selected
   */
  selectText(text, caseSensitive = false) {
    if (!text) return false;

    const searchFlags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), searchFlags);
    
    // Search for the text in the document
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const match = regex.exec(node.textContent);
      if (match) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Update internal state
        this.currentSelection = match[0];
        this.selectionContext = this.getSelectionContext();
        
        this.notifySelectionCallbacks('select', this.currentSelection, this.selectionContext);
        
        // Scroll to selection
        node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * Highlight the current selection
   * @param {string} [color='yellow'] - Highlight color
   * @returns {Element} The highlight element or null if no selection
   */
  highlightSelection(color = 'yellow') {
    if (!this.hasSelection()) return null;

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.backgroundColor = color;
    span.className = 'alice-selection-highlight';
    
    try {
      range.surroundContents(span);
      return span;
    } catch (e) {
      // If the range cannot be surrounded (e.g., it crosses element boundaries),
      // we'll just highlight the text nodes individually
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      return span;
    }
  }

  /**
   * Remove all highlights
   */
  removeHighlights() {
    const highlights = document.querySelectorAll('.alice-selection-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);
    });
  }

  /**
   * Register a callback for selection events
   * @param {string} event - Event type ('change', 'select', 'clear')
   * @param {Function} callback - Callback function
   */
  onSelection(event, callback) {
    if (!this.selectionCallbacks.has(event)) {
      this.selectionCallbacks.set(event, []);
    }
    this.selectionCallbacks.get(event).push(callback);
  }

  /**
   * Remove a callback for selection events
   * @param {string} event - Event type
   * @param {Function} callback - Callback function to remove
   */
  offSelection(event, callback) {
    const callbacks = this.selectionCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify selection callbacks
   * @param {string} event - Event type
   * @param {string} selection - Selection text
   * @param {Object} context - Selection context
   */
  notifySelectionCallbacks(event, selection, context) {
    const callbacks = this.selectionCallbacks.get(event) || [];
    
    for (const callback of callbacks) {
      try {
        callback(selection, context);
      } catch (error) {
        console.error('Error in selection callback:', error);
      }
    }
  }

  /**
   * Get selection manager statistics
   * @returns {Object} Selection manager statistics
   */
  getStats() {
    return {
      hasSelection: this.hasSelection(),
      selectionLength: this.currentSelection ? this.currentSelection.length : 0,
      callbackCount: {
        change: (this.selectionCallbacks.get('change') || []).length,
        select: (this.selectionCallbacks.get('select') || []).length,
        clear: (this.selectionCallbacks.get('clear') || []).length
      }
    };
  }

  /**
   * Destroy the selection manager and clean up resources
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('selectionchange', this.handleSelectionChange);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Clear callbacks
    this.selectionCallbacks.clear();
    
    // Clear selection
    this.clearSelection();
  }
}