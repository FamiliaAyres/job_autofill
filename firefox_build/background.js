
// Background script: robust command handling with safe messaging
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'run-autofill') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const url = tab.url || '';
    const allowed = /^https?:\/\//i.test(url);
    if (!allowed) {
      // Friendly feedback: cannot run on chrome://, edge://, chrome web store, etc.
      try {
        await chrome.action.setBadgeText({ text: '!', tabId: tab.id });
        await chrome.action.setBadgeBackgroundColor({ color: '#EF4444', tabId: tab.id });
        await chrome.action.setTitle({ tabId: tab.id, title: 'Open a regular web page (not chrome://) to use autofill' });
        setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
      } catch(e) {}
      return;
    }
    // Try to send message; if no receiver, inject content.js then retry
    chrome.tabs.sendMessage(tab.id, { action: 'runAutofill' }, async (response) => {
      if (chrome.runtime.lastError) {
        try {
          if (chrome.scripting) {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            chrome.tabs.sendMessage(tab.id, { action: 'runAutofill' }, () => void chrome.runtime.lastError);
          }
        } catch (e) {
          // Swallow; nothing else to do
        }
      }
    });
  } catch (e) {
    // no-op
  }
});
