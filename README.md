# Alice Browser Context Extension

This Chrome extension provides comprehensive browser context data to the [Alice AI Assistant](https://github.com/pmbstyle/Alice) application via WebSocket communication.

## Features

- **Real-time browser context retrieval**: Extracts URL, page title, visible text, links, user selection, and surrounding context
- **WebSocket-based communication**: Persistent connection to Alice
- **Atomic data collection**: Retrieves all requested data types in a single operation
- **Selection-aware**: Captures user-selected text and surrounding context
- **Link extraction**: Collects all hyperlinks with their text and URLs
- **Context menu for selected content**
  
  Available actions for selected content on the web page:
  - **"Fact check this"**: ask Alice to use a web search to check if the content is fake or true
  - **"Summarize this"**: ask Alice to summarize selected content
  - **"Tell me more about it"**: ask Alice to use a web search to get more information on a selected content

## Installation

1. **Load the extension in Chrome:**
   ```bash
   $ git clone https://github.com/pmbstyle/alice-chrome-extension.git
   ```
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `alice-chrome-extension` folder

3. **Verify installation:**
   - The extension should appear in your Chrome toolbar
   - Double-click on the extension icon to open a pop-up

<img width="346" height="437" alt="image" src="https://github.com/user-attachments/assets/8e53ddcd-85e1-434e-ac49-00d19cc3fb4b" />


<img width="763" height="417" alt="image" src="https://github.com/user-attachments/assets/5d9cea41-de0b-4766-910a-570e7ca69852" />
