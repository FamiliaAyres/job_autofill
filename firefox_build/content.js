// ===== Enhanced Job Autofill Content Script =====
(function() {
    // Configuration
    const DEBUG = true;
    const VERSION = "1.0.9";
    
    // State
    let profileData = {};
    let fieldMappings = {};
    let currentDomain = window.location.hostname;
    
    // Logging function
    function log(...args) {
        if (DEBUG) {
            console.log('[JobAutofill]', ...args);
        }
    }
    
    // Initialize the extension
    function init() {
        log("Initializing Job Autofill v" + VERSION);
        loadProfileData();
        injectUI();
        addMessageListeners();
    }
    
    // Load profile data from storage
    
function loadProfileData() {
    chrome.storage.sync.get(null, function(data) {
        let profile = {};
        if (data && data.profile && typeof data.profile === 'object') {
            profile = data.profile;
        } else {
            for (const [k, v] of Object.entries(data || {})) {
                if (k === 'mappings') continue;
                if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                    profile[k] = v;
                }
            }
        }
        profileData = profile || {};
        log("Profile data loaded:", Object.keys(profileData).length + " fields");
        if (data && data.mappings && data.mappings[currentDomain]) {
            fieldMappings = data.mappings[currentDomain];
            log("Field mappings loaded for", currentDomain, ":", Object.keys(fieldMappings).length + " mappings");
        }
    });
}

    
    // Save field mappings to storage
    function saveFieldMappings() {
        chrome.storage.sync.get(['mappings'], function(data) {
            const allMappings = data.mappings || {};
            allMappings[currentDomain] = fieldMappings;
            
            chrome.storage.sync.set({ mappings: allMappings }, function() {
                log("Field mappings saved for", currentDomain);
                showToast("Field mappings saved for this website!");
            });
        });
    }
    
    
    // Get a reasonable string value from a form field
    function getFieldCurrentValue(el) {
        try {
            if (!el) return '';
            const tag = (el.tagName || '').toLowerCase();
            const type = (el.type || '').toLowerCase();
            if (tag === 'select') {
                return String(el.value ?? '').trim();
            }
            if (type === 'checkbox') {
                return el.checked ? (el.value ? String(el.value) : 'true') : 'false';
            }
            if (type === 'radio') {
                if (el.name) {
                    const checked = el.ownerDocument.querySelector(`input[type="radio"][name="${el.name}"]:checked`);
                    return checked ? String(checked.value ?? '').trim() : '';
                }
                return el.checked ? String(el.value ?? '').trim() : '';
            }
            return String(el.value ?? '').trim();
        } catch (e) {
            return '';
        }
    }

    // Persist a newly mapped profile field so it appears in Options
    function persistProfileField(key, value, preferNewIfPresent=true) {
        if (!key) return;
        try {
            chrome.storage.sync.get(null, (data) => {
                const existing = data && (data.profile && typeof data.profile === 'object' ? data.profile[key] : data[key]);
                let finalVal = existing;
                if (preferNewIfPresent && value && String(value).length) {
                    finalVal = value;
                } else if (finalVal == null) {
                    finalVal = value || '';
                }
                // Store at root for Options compatibility
                const payload = {};
                payload[key] = finalVal;
                chrome.storage.sync.set(payload, () => log("Profile field persisted:", key, "=", finalVal));
            });
        } catch(e) {
            log("Persist field error", e);
        }
    }

    // Safely set input/select/textarea value and fire proper events (works with frameworks/UI5)
    function setFieldValue(field, value) {
        try { field.focus(); } catch(e){}
        try {
            const tag = (field.tagName || '').toLowerCase();
            if (tag === 'select') {
                field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                return;
            }
            const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                         : field instanceof HTMLInputElement ? HTMLInputElement.prototype
                         : HTMLElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc && desc.set) {
                desc.set.call(field, value);
            } else {
                field.value = value;
            }
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
            field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        } catch (e) {
            // Fallback: simulate typing
            try { field.focus(); } catch(e){}
            field.value = '';
            for (const ch of String(value)) {
                field.value += ch;
                field.dispatchEvent(new Event('input', { bubbles: true }));
            }
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        }
    }
    
    // Default keys for quick profile editing
    const DEFAULT_PROFILE_KEYS = [
        'firstName','lastName','email','phone','phoneCountryCode',
        'address','city','county','state','postcode','zip','country',
        'linkedin','portfolio','github','website','rightToWork','noticePeriod','visa','salary'
    ];

    const LABELS = {
        firstName: 'First Name', lastName: 'Last Name', email: 'Email',
        phone: 'Phone', phoneCountryCode: 'Phone Country Code',
        address: 'Address', city: 'City', county: 'County', state:'State/Province',
        postcode: 'Postcode', zip: 'ZIP/Postal Code', country: 'Country',
        linkedin: 'LinkedIn', portfolio: 'Portfolio URL', github:'GitHub', website:'Website',
        rightToWork: 'Right to Work', noticePeriod:'Notice Period', visa:'Visa', salary:'Salary'
    };

    function titleForKey(k){ return LABELS[k] || k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()); }

    // Build list of candidate keys from default + profileData + mapped field names
    function buildCandidateKeys() {
        const set = new Set(DEFAULT_PROFILE_KEYS);
        Object.keys(profileData || {}).forEach(k => set.add(k));
        // Include mapped profile fields (values of fieldMappings)
        Object.values(fieldMappings || {}).forEach(k => set.add(k));
        return Array.from(set);
    }

    function showQuickFillPanel(runAfterSave=false) {
        const keys = buildCandidateKeys();
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed; inset: 0; z-index: 10002;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.35);
        `;
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #fff; width: clamp(320px, 520px, 90vw);
            max-height: 80vh; overflow: auto; border-radius: 10px; padding: 18px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        `;
        panel.innerHTML = `
            <h3 style="margin:0 0 10px 0;">Quick Fill – Profile</h3>
            <p style="margin:0 0 12px 0; color:#555">Edite seus dados e aplique no formulário.</p>
            <div id="qf-rows"></div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px;">
                <button id="qf-cancel" style="padding:8px 12px;">Cancelar</button>
                <button id="qf-save" style="padding:8px 12px; background:#3498db; color:#fff; border:none; border-radius:6px;">Salvar</button>
                <button id="qf-save-fill" style="padding:8px 12px; background:#2ecc71; color:#fff; border:none; border-radius:6px;">Salvar & Autofill</button>
            </div>
        `;
        dialog.appendChild(panel);
        document.body.appendChild(dialog);

        const rows = panel.querySelector('#qf-rows');
        keys.forEach(k => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:grid; grid-template-columns: 140px 1fr; gap:8px; align-items:center; margin:6px 0;';
            wrap.innerHTML = `
                <label style="color:#333;">${titleForKey(k)}</label>
                <input data-k="${k}" value="${(profileData && profileData[k] != null) ? String(profileData[k]).replace(/"/g,'&quot;') : ''}"
                       style="padding:8px; border:1px solid #ddd; border-radius:6px;" />
            `;
            rows.appendChild(wrap);
        });

        function collectPayload() {
            const inputs = rows.querySelectorAll('input[data-k]');
            const payload = {};
            inputs.forEach(inp => payload[inp.getAttribute('data-k')] = inp.value);
            return payload;
        }

        function saveProfile(payload, cb) {
            // Store flat at root for Options compatibility
            chrome.storage.sync.set(payload, () => {
                // Refresh local cache
                profileData = { ...(profileData||{}), ...payload };
                log('QuickFill saved:', Object.keys(payload));
                if (cb) cb();
            });
        }

        panel.querySelector('#qf-cancel').addEventListener('click', ()=> dialog.remove());
        panel.querySelector('#qf-save').addEventListener('click', ()=> {
            const payload = collectPayload();
            saveProfile(payload, ()=> showToast('Profile saved!'));
        });
        panel.querySelector('#qf-save-fill').addEventListener('click', ()=> {
            const payload = collectPayload();
            saveProfile(payload, ()=> { showToast('Profile saved! Running autofill...'); runAutofill(); });
        });
    }

    // Inject the extension UI into the page
    function injectUI() {
        // Remove existing UI if present
        const existingUI = document.getElementById('job-autofill-ui');
        if (existingUI) {
            existingUI.remove();
        }
        
        // Create the UI container
        const uiContainer = document.createElement('div');
        uiContainer.id = 'job-autofill-ui';
        uiContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        // Create buttons
        const detectBtn = createButton('Detect Fields', '#3498db', detectFormFields);
        const autofillBtn = createButton('Autofill', '#2ecc71', runAutofill);
        const mapBtn = createButton('Map Field', '#e67e22', startFieldMapping);
        
        uiContainer.appendChild(detectBtn);
        uiContainer.appendChild(autofillBtn);
        uiContainer.appendChild(mapBtn);
        
        document.body.appendChild(uiContainer);
    }
    
    // Create a styled button
    function createButton(text, color, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 12px 16px;
            background: ${color};
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: transform 0.2s, background 0.2s;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'none';
        });
        
        button.addEventListener('click', onClick);
        
        return button;
    }
    
    // Detect form fields on the page
    function detectFormFields() {
        log("Detecting form fields...");
        
        const allInputs = document.querySelectorAll('input, textarea, select');
        const detectedFields = [];
        
        allInputs.forEach(input => {
            const fieldInfo = analyzeField(input);
            if (fieldInfo && fieldInfo.type) {
                detectedFields.push(fieldInfo);
            }
        });
        
        log("Detected", detectedFields.length, "form fields");
        showToast(`Detected ${detectedFields.length} form fields`);
        
        // Try to auto-match fields with profile data
        autoMatchFields(detectedFields);
    }
    
    // Analyze a form field to determine its type
    function analyzeField(field) {
        const id = field.id || '';
        const name = field.name || '';
        const type = field.type || '';
        const placeholder = field.placeholder || '';
        const label = findFieldLabel(field);
        
        // Skip buttons and hidden fields
        if (type === 'button' || type === 'submit' || type === 'hidden' || type === 'reset') {
            return null;
        }
        
        // Skip read-only and disabled fields
        if (field.readOnly || field.disabled) {
            return null;
        }
        
        // Determine field type based on various attributes
        let fieldType = determineFieldType(id, name, type, placeholder, label);
        
        return {
            element: field,
            id,
            name,
            type: fieldType,
            label
        };
    }
    
    // Find the label associated with a field
    function findFieldLabel(field) {
        // Check for explicit label association
        if (field.id) {
            const label = document.querySelector(`label[for="${field.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        // Check for parent label
        if (field.parentNode.tagName === 'LABEL') {
            return field.parentNode.textContent.trim();
        }
        
        // Check for aria-labelledby
        if (field.hasAttribute('aria-labelledby')) {
            const labelledById = field.getAttribute('aria-labelledby');
            const labelElement = document.getElementById(labelledById);
            if (labelElement) return labelElement.textContent.trim();
        }
        
        // Check for nearby text that might be a label
        const parent = field.closest('div, p, li, td, span');
        if (parent) {
            // Look for text content in the parent
            const textContent = parent.textContent.trim();
            if (textContent && textContent.length < 100) {
                return textContent;
            }
            
            // Look for previous sibling that might be a label
            let prevSibling = field.previousElementSibling;
            while (prevSibling) {
                if (prevSibling.textContent && prevSibling.textContent.trim().length > 0) {
                    return prevSibling.textContent.trim();
                }
                prevSibling = prevSibling.previousElementSibling;
            }
        }
        
        return '';
    }
    
    // Determine the type of field based on its attributes
    function determineFieldType(id, name, inputType, placeholder, label) {
        const combinedText = `${id} ${name} ${placeholder} ${label}`.toLowerCase();
        
        // Check for first name fields
        if (/(firstname|first-name|fname|first.*name|givenname|forename)/.test(combinedText)) {
            return 'firstName';
        }
        
        // Check for last name fields
        if (/(lastname|last-name|lname|last.*name|surname|familyname)/.test(combinedText)) {
            return 'lastName';
        }
        
        // Check for email fields
        if (/(email|e-mail|mail)/.test(combinedText) || inputType === 'email') {
            return 'email';
        }
        
        // Check for phone fields
        if (/(phone|tel|mobile|cell)/.test(combinedText) || inputType === 'tel') {
            return 'phone';
        }
        
        // Check for address fields
        if (/(address|addr|street)/.test(combinedText)) {
            return 'address';
        }
        
        // Check for city fields
        if (/(city|town)/.test(combinedText)) {
            return 'city';
        }
        
        // Check for state fields
        if (/(state|province|region)/.test(combinedText)) {
            return 'state';
        }
        
        // Check for zip code fields
        if (/(zip|postal|postcode)/.test(combinedText)) {
            return 'zip';
        }
        
        // Check for country fields
        if (/(country|nation)/.test(combinedText)) {
            return 'country';
        }
        
        // Check for LinkedIn fields
        if (/(linkedin|linked-in|profile)/.test(combinedText)) {
            return 'linkedin';
        }
        
        // Check for portfolio fields
        if (/(portfolio|website|url)/.test(combinedText)) {
            return 'portfolio';
        }
        
        return null;
    }
    
    // Automatically match detected fields with profile data
    function autoMatchFields(detectedFields) {
        let matchedCount = 0;
        
        detectedFields.forEach(field => {
            const key = field.name || field.id;
            if (key && field.type && profileData[field.type] && !fieldMappings[key]) { fieldMappings[key] = field.type;
                matchedCount++;
                log("Auto-matched", field.id, "to", field.type);
            }
        });
        
        // Save the auto-matched fields
        if (matchedCount > 0) {
            saveFieldMappings();
            showToast(`Auto-matched ${matchedCount} fields!`);
        } else {
            showToast("No fields could be auto-matched. Try manual mapping.");
        }
    }
    
    // Start field mapping process
    function startFieldMapping() {
        showToast("Click on a field to map it to your profile");
        
        // Add click listener to all inputs
        const allInputs = document.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => {
            // Skip buttons and hidden fields
            if (input.type === 'button' || input.type === 'submit' || input.type === 'hidden') {
                return;
            }
            
            input.style.outline = '2px dashed #3498db';
            input.addEventListener('click', handleFieldMappingClick);
        });
    }
    
    // Handle field mapping click
    function handleFieldMappingClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const field = event.target;
        const fieldInfo = analyzeField(field);
        
        // Remove outline and click listeners
        const allInputs = document.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => {
            input.style.outline = '';
            input.removeEventListener('click', handleFieldMappingClick);
        });
        
        if (fieldInfo) {
            showFieldMappingDialog(fieldInfo);
        } else {
            showToast("Could not analyze this field. Try a different one.");
        }
    }
    
    // Show dialog for mapping a field to profile data
    function showFieldMappingDialog(fieldInfo) {
        // Create dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            min-width: 300px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top: 0;">Map Field</h3>
            <p>Field: <strong>${fieldInfo.id || fieldInfo.name || 'unnamed'}</strong></p>
            <p>Detected as: <strong>${fieldInfo.type || 'Unknown'}</strong></p>
            <label for="fieldMapping">Map to profile field:</label>
            <select id="fieldMapping" style="width: 100%; padding: 8px; margin: 10px 0;">
                <option value="">-- Select field --</option>
                <option value="firstName">First Name</option>
                <option value="lastName">Last Name</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="address">Address</option>
                <option value="city">City</option>
                <option value="state">State</option>
                <option value="zip">ZIP Code</option>
                <option value="country">Country</option>
                <option value="linkedin">LinkedIn</option>
                <option value="portfolio">Portfolio</option>
            </select>
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                <button id="cancelMapping" style="padding: 8px 16px;">Cancel</button>
                <button id="saveMapping" style="padding: 8px 16px; background: #2ecc71; color: white; border: none;">Save Mapping</button>
            </div>
        `;
        
        // Pre-select if already mapped or detected
        if (fieldInfo.type) {
            dialog.querySelector('#fieldMapping').value = fieldInfo.type;
        }
        
        document.body.appendChild(dialog);
        
        // Add event listeners
        dialog.querySelector('#cancelMapping').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('#saveMapping').addEventListener('click', () => {
    const selectedField = dialog.querySelector('#fieldMapping').value;
    if (selectedField) {
        // Prefer name over id as stable key
        let fieldIdentifier = fieldInfo.name || fieldInfo.id;
        if (!fieldIdentifier) {
            const gen = `jobautofill_${Date.now()}`;
            fieldInfo.element.setAttribute("data-jobautofill", gen);
            fieldIdentifier = gen;
        }
        fieldMappings[fieldIdentifier] = selectedField;
        saveFieldMappings();

        // Persist mapped field into profile so it appears in Options
        const currentVal = getFieldCurrentValue(fieldInfo.element);
        persistProfileField(selectedField, currentVal, true);

        dialog.remove();

        // Try to immediately fill the field if we have data
        if (profileData[selectedField]) {
            setFieldValue(fieldInfo.element, profileData[selectedField]);
            fieldInfo.element.style.backgroundColor = '#e8f5e8';
            setTimeout(() => {
                fieldInfo.element.style.backgroundColor = '';
            }, 1000);
        }
    }
});
    }
    
    // Run autofill on the form
    function runAutofill() {
        log("Running autofill...");
        
        let filledCount = 0;
        
        // First try to fill based on mappings
        for (const fieldIdentifier in fieldMappings) {
            const profileField = fieldMappings[fieldIdentifier];
            
            if (profileData[profileField]) {
                // Try to find the field by ID
                let field = document.getElementById(fieldIdentifier);
                
                // If not found by ID, try by name
                if (!field) {
                    field = document.querySelector(`input[name="${fieldIdentifier}"], textarea[name="${fieldIdentifier}"], select[name="${fieldIdentifier}"], [id="${fieldIdentifier}"], [data-jobautofill="${fieldIdentifier}"]`);
                }
                
                if (field && !field.disabled && !field.readOnly) {
                    setFieldValue(field, profileData[profileField]);
                    filledCount++;
                    
                    // Highlight the filled field
                    field.style.backgroundColor = '#e8f5e8';
                    setTimeout(() => {
                        field.style.backgroundColor = '';
                    }, 1000);
                    
                    // Trigger change events for dynamic forms
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
        
        // If no fields were filled with mappings, try to auto-detect and fill
        if (filledCount === 0) {
            log("No mappings found, trying auto-detection");
            const allInputs = document.querySelectorAll('input, textarea, select');
            
            allInputs.forEach(input => {
                const fieldInfo = analyzeField(input);
                if (fieldInfo && fieldInfo.type && profileData[fieldInfo.type]) {
                    setFieldValue(input, profileData[fieldInfo.type]);
                    filledCount++;
                    
                    // Highlight the filled field
                    input.style.backgroundColor = '#e8f5e8';
                    setTimeout(() => {
                        input.style.backgroundColor = '';
                    }, 1000);
                    
                    // Trigger change events for dynamic forms
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }
        
        if (filledCount > 0) {
            showToast(`Autofilled ${filledCount} fields successfully!`);
        } else {
            showToast("No fields could be autofilled. Try mapping fields first.");
        }
        
        return filledCount;
    }
    
    // Show a toast message
    function showToast(message) {
        // Remove existing toast if present
        const existingToast = document.getElementById('job-autofill-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.id = 'job-autofill-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #333;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    // Add message listeners for communication with popup
    function addMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'runAutofill') {
                const filledCount = runAutofill();
                sendResponse({ success: true, filledCount });
            } else if (request.action === 'detectFields') {
                detectFormFields();
                sendResponse({ success: true });
            }
            return true;
        });
    }
    
    // Initialize the extension
    init();
})();