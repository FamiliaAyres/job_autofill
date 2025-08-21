document.addEventListener('DOMContentLoaded', function() {
    async function safeSend(action, statusDiv) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) throw new Error('No active tab');
            const url = tab.url || '';
            if (!/^https?:\/\//i.test(url)) {
                statusDiv.textContent = 'Open a regular web page (http/https).';
                statusDiv.style.color = '#ea4335';
                return;
            }
            chrome.tabs.sendMessage(tab.id, { action }, function(response) {
                if (chrome.runtime.lastError) {
                    if (chrome.scripting) {
                        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, () => {
                            chrome.tabs.sendMessage(tab.id, { action }, () => {});
                        });
                    }
                }
            });
        } catch (e) {
            statusDiv.textContent = 'Error: ' + e.message;
            statusDiv.style.color = '#ea4335';
        }
    }
    const runButton = document.getElementById('run');
    const statusDiv = document.createElement('div');
    statusDiv.style.marginTop = '10px';
    statusDiv.style.fontSize = '14px';
    document.body.appendChild(statusDiv);
    
    runButton.addEventListener('click', async () => {
        statusDiv.textContent = 'Running autofill...';
        statusDiv.style.color = '#1a73e8';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) return;
            
            safeSend('runAutofill', statusDiv) /*, function(response) {
                if (response && response.success) {
                    if (response.filledCount > 0) {
                        statusDiv.textContent = `Autofilled ${response.filledCount} fields successfully!`;
                        statusDiv.style.color = '#0f9d58';
                    } else {
                        statusDiv.textContent = 'No fields could be autofilled. Try detecting fields first.';
                        statusDiv.style.color = '#ea4335';
                    }
                } else {
                    statusDiv.textContent = 'Autofill failed. Try detecting fields first.';
                    statusDiv.style.color = '#ea4335';
                }
            */
        } catch(e) {
            console.error('Popup error', e);
            statusDiv.textContent = 'Error: ' + e.message;
            statusDiv.style.color = '#ea4335';
        }
    });
    
    // Add detect fields button
    const detectButton = document.createElement('button');
    detectButton.textContent = 'Detect Fields';
    detectButton.style = `
        background: #f90;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        margin-top: 10px;
        width: 100%;
    `;
    detectButton.addEventListener('click', async () => {
        statusDiv.textContent = 'Detecting fields...';
        statusDiv.style.color = '#1a73e8';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) return;
            
            safeSend('detectFields', statusDiv) /*, function(response) {
                if (response && response.success) {
                    statusDiv.textContent = 'Fields detected!';
                    statusDiv.style.color = '#0f9d58';
                } else {
                    statusDiv.textContent = 'Field detection failed.';
                    statusDiv.style.color = '#ea4335';
                }
            */
        } catch(e) {
            console.error('Detection error', e);
            statusDiv.textContent = 'Error: ' + e.message;
            statusDiv.style.color = '#ea4335';
        }
    });
    
    document.body.insertBefore(detectButton, document.querySelector('.small'));
    
    // Update the shortcut text
    const shortcutElement = document.querySelector('.small');
    if (shortcutElement) {
        shortcutElement.innerHTML = 'Tip: Press <b>Ctrl/Cmd + Shift + Y</b> to run without opening the popup.';
    }
});