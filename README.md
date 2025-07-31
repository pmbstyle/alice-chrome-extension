# Alice Browser Context Extension

This Chrome extension provides comprehensive browser context data to the Alice AI application via WebSocket communication.

## Features

- **Real-time browser context retrieval**: Extracts URL, page title, visible text, links, user selection, and surrounding context
- **WebSocket-based communication**: Persistent connection to Alice on port 5421
- **Atomic data collection**: Retrieves all requested data types in a single operation
- **Selection-aware**: Captures user-selected text and surrounding context
- **Link extraction**: Collects all hyperlinks with their text and URLs
- **Error handling**: Robust connection management and error recovery

## Installation

1. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `AliceChromeExtension` folder

2. **Verify installation:**
   - The extension should appear in your Chrome toolbar
   - Check the console for connection status messages

## Usage

### Data Format
The extension responds to browser context requests with the following JSON structure:

```json
{
  "url": "https://example.com/current-page",
  "title": "Current Page Title",
  "visibleText": "All visible text content from the page...",
  "links": [
    {
      "text": "Link Text",
      "href": "https://example.com/link-target",
      "title": "Link Title"
    }
  ],
  "selection": "User-selected text",
  "surroundingContext": "Text surrounding the selection...",
  "hasSelection": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## WebSocket Protocol

### Request Format (from Alice)
```json
{
  "type": "browser_context",
  "requestId": "unique-request-id",
  "data": {
    "includeUrl": true,
    "includeText": true,
    "includeLinks": true,
    "includeSelection": true,
    "includeContext": true,
    "maxContextLength": 2000
  }
}
```

### Response Format (to Alice)
```json
{
  "type": "browser_context_response",
  "requestId": "matching-request-id",
  "data": { /* browser context data */ },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```
