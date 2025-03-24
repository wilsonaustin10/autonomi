        

## How Text Input Works in the AutonoM3 Interactive Browser

The AutonoM3 Agent Builder implements a sophisticated text input system that allows users to enter text into web forms and input fields within the embedded browser. This system is designed with multiple layers of functionality for reliability across different websites.

### Key Components

1. **Direct Input UI**: A dedicated text input field in the main interface allows users to type longer text without having to type character by character.

2. **Keyboard Capture**: The system captures individual keystrokes when the browser is focused, allowing for character-by-character input.

3. **Focus Management**: A focus system that tracks when the browser is active and ready to receive input.

4. **Multi-strategy Text Input**: The backend implements several fallback strategies to ensure text input works reliably across different websites.

### How It Works

#### 1. User Interface Components

The system provides two main ways to input text:

```html
<!-- Direct text input field for longer text -->
<div id="direct-input-container">
    <input id="direct-input-field" type="text" placeholder="Type text here">
    <button id="direct-input-send">Send</button>
    <div class="form-check">
        <input class="form-check-input" type="checkbox" id="send-enter-after">
        <label class="form-check-label" for="send-enter-after">Send Enter after text</label>
    </div>
</div>

<!-- The browser container that can be focused to receive keyboard input -->
<div id="browser-container">
    <iframe id="browser-frame" src="browser.html"></iframe>
</div>
```

#### 2. Focus Management

A critical part of the system is tracking when the browser is focused:

```javascript
// Focus tracking
let isBrowserFocused = false;

// Focus browser button
const focusButton = document.createElement('button');
focusButton.className = 'btn btn-sm btn-outline-info me-2';
focusButton.textContent = 'Focus Browser';
focusButton.onclick = function() {
    isBrowserFocused = !isBrowserFocused;
    if (isBrowserFocused) {
        browserContainer.style.outline = '3px solid #0d6efd';
        focusButton.textContent = 'Unfocus Browser';
        statusElement.textContent = 'Browser is focused - you can now type directly into the browser';
        // Focus the input field after a short delay
        setTimeout(() => directInputField.focus(), 50);
    } else {
        browserContainer.style.outline = 'none';
        focusButton.textContent = 'Focus Browser';
        statusElement.textContent = '';
    }
    updateBrowserFocusVisual();
};
```

#### 3. Keyboard Input Capture

When the browser is focused, keystrokes are captured and forwarded to the embedded browser:

```javascript
// Capture keyboard events when browser is focused
document.addEventListener('keydown', function(e) {
    if (!isBrowserFocused) return;
    
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape' || 
        e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
        e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
        e.key === 'Backspace' || e.key === 'Delete') {
        // Special keys
        browserFrame.contentWindow.postMessage({
            type: 'keyboard',
            data: {
                action: 'key',
                key: e.key
            }
        }, '*');
        
        // Prevent default behavior (like tabbing out of the browser)
        e.preventDefault();
    } else if (e.key.length === 1) {
        // Handle all printable characters, including those requiring Shift
        browserFrame.contentWindow.postMessage({
            type: 'keyboard',
            data: {
                action: 'type',
                text: e.key
            }
        }, '*');
        
        // Prevent default behavior
        e.preventDefault();
    }
});
```

#### 4. Direct Text Input

For longer text, the system provides a direct input field:

```javascript
// Send text from the direct input field to the browser
function sendDirectInput() {
    if (!isBrowserFocused) return;
    
    const text = directInputField.value;
    if (!text) return;
    
    // Check if we should send Enter after text
    const sendEnter = document.getElementById('send-enter-after').checked;
    
    // Send the text to the browser
    browserFrame.contentWindow.postMessage({
        type: 'keyboard',
        data: {
            action: 'type',
            text: text,
            sendEnter: sendEnter
        }
    }, '*');
    
    // Clear the input field
    directInputField.value = '';
    
    // Focus back on the input field for continued typing
    directInputField.focus();
}
```

#### 5. Browser Frame Communication

The browser frame receives the keyboard events and forwards them to the server:

```javascript
// Inside browser.html
window.addEventListener('message', function(event) {
    const { type, data } = event.data;
    
    if (type === 'keyboard') {
        if (data.action === 'type') {
            // Send the text to the server
            socket.emit('browser-type', { text: data.text });
            
            // For longer text, also send an Enter key press if requested
            if (text.length > 1 && data.sendEnter) {
                setTimeout(() => {
                    socket.emit('browser-key', { key: 'Enter' });
                }, 100); // Small delay before Enter
            }
        } else if (data.action === 'key') {
            socket.emit('browser-key', { key: data.key });
        }
    }
});
```

### Backend Text Input Processing

The server implements several strategies to ensure reliable text input across different websites:

```javascript
// Handle keyboard input from the UI
socket.on('browser-type', async (data) => {
  try {
    const { text } = data;
    await ensureBrowserInitialized();
    
    // For longer text, try various methods
    if (text.length > 1) {
      try {
        // First, try to use active element if it exists
        const activeElementExists = await activePage.evaluate(() => {
          return document.activeElement && 
                 (document.activeElement.tagName === 'INPUT' || 
                  document.activeElement.tagName === 'TEXTAREA' ||
                  document.activeElement.contentEditable === 'true');
        });
        
        if (activeElementExists) {
          // Use focused element - clear it first then type
          await activePage.evaluate((inputText) => {
            if (document.activeElement) {
              // For input and textarea elements
              if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                document.activeElement.value = '';
                document.activeElement.value = inputText;
                // Trigger events
                document.activeElement.dispatchEvent(new Event('input', {bubbles: true}));
                document.activeElement.dispatchEvent(new Event('change', {bubbles: true}));
              } 
              // For contentEditable elements
              else if (document.activeElement.contentEditable === 'true') {
                document.activeElement.textContent = inputText;
                document.activeElement.dispatchEvent(new Event('input', {bubbles: true}));
              }
            }
          }, text);
        } else {
          // No active element, use regular keyboard typing
          await activePage.keyboard.type(text);
        }
      } catch (evalError) {
        // Fallback to keyboard typing
        await activePage.keyboard.type(text);
      }
    } else if (text.length === 1) {
      // For single characters
      await activePage.keyboard.type(text);
    }
  } catch (error) {
    console.error(`Error typing text: ${error.message}`);
    socket.emit('test-output', { data: `Error typing text: ${error.message}\n` });
  }
});
```

### Handling Form Filling

For scripted form filling operations, the system implements a robust multi-strategy approach:

```javascript
// Handle a fill step from the script
if (step.type === 'fill') {
  const selector = getEffectiveSelector(step.data);
  try {
    // First attempt: Standard Playwright fill
    await activePage.fill(selector, step.data.value);
    
  } catch (fillError) {
    try {
      // Second attempt: Click first, then type
      await activePage.click(selector, { clickCount: 3 }); // Triple click to select all
      await activePage.keyboard.press('Backspace');
      await activePage.keyboard.type(step.data.value);
      
    } catch (clickTypeError) {
      try {
        // Third attempt: JavaScript injection
        await activePage.evaluate(({selector, value}) => {
          const element = document.querySelector(selector);
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, {selector, value: step.data.value});
        
      } catch (jsError) {
        // If all methods fail, report error
        throw new Error(`Could not fill ${selector} after multiple attempts`);
      }
    }
  }
}
```

### Special Website Handling

The system also includes specialized handling for certain websites that have unique form behavior, such as Investing.com:

```javascript
// Special handling for Investing.com search
if (currentUrl.includes('investing.com')) {
  // Try a variety of known selectors
  const searchSelectors = [
    'input[data-testid="search-input"]', 
    '#searchText', 
    'input[placeholder*="Search"]'
  ];
  
  // Try to find and click on the search icon first
  try {
    await activePage.click('[data-testid="search-button"], .searchGlassIcon', { timeout: 3000 });
    await activePage.waitForTimeout(500);
  } catch (e) {
    console.log('No search icon found, continuing...');
  }
  
  // Try each selector until one works
  for (const searchSelector of searchSelectors) {
    try {
      await activePage.fill(searchSelector, step.data.value);
      searchSuccessful = true;
      break;
    } catch (e) {
      // Continue to next selector
    }
  }
}
```

## Summary

The text input system in AutonoM3 Agent Builder is designed with multiple layers:

1. **User Interface Layer**: Provides direct text input field and keystroke capture
2. **Communication Layer**: Messages between the main UI and the embedded browser
3. **Server Processing Layer**: Handles text input requests with multiple strategies
4. **Fallback Mechanisms**: Multiple methods to ensure text input works across different websites

This robust approach ensures that users can reliably enter text into forms and input fields within the embedded browser, even on complex websites with non-standard form implementations.
