# Job Autofill Assistant

**Author:** Franklin Ayres  
**Repository:** https://github.com/FamiliaAyres/job_autofill  
**Contact / PayPal (donations welcome):** franklin.ayres@hotmail.com

> _“I know what it’s like to fill the same job application forms over and over.
> To save time and reduce the grind, I built this extension.”_ — Franklin Ayres

## What it does
A browser extension to **autofill job application forms**. Detect fields on the page, map them to your profile (name, email, phone, etc.), tweak data in **Quick Fill**, and apply with **one shortcut**: `Ctrl/Cmd + Shift + Y`.

- **Detect Fields:** find inputs on the page
- **Map Field:** map a page input to a profile key
- **Quick Fill:** edit your profile inline before applying
- **Autofill:** fill all mapped inputs at once

Works on **Chrome (MV3)** and **Firefox (MV2)**. Improved compatibility with platforms like **SAP SuccessFactors (UI5)**.

## Install (dev)
### Chrome
1. Download this repo or the build ZIP.
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** → select `chrome_build/`.
4. (Optional) Set the shortcut in `chrome://extensions/shortcuts` to **Ctrl/Cmd + Shift + Y**.

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** → select the `manifest.json` inside `firefox_build/`.

> **Note:** internal pages (`about:`/`chrome://`) do not accept content scripts. Use regular `http/https` pages.

## Fill your profile (Options)
This is how you **add or edit your profile values** (firstName, lastName, email, phone, etc.), which the extension uses during Autofill.

### Chrome — open the extension’s Options
- Click the **Extensions** icon (puzzle) → **Job Autofill Assistant** → **Options**, *or*  
- Go to `chrome://extensions` → **Details** for *Job Autofill Assistant* → **Extension options**.

Then in **Options**:
1. You’ll see **Key / Value** rows. Use keys like:
   - `firstName`, `lastName`, `email`, `phone`, `phoneCountryCode`
   - `address`, `city`, `state`/`county`, `zip`/`postcode`, `country`
   - `linkedin`, `portfolio`, `website`, `github`
   - and any **custom keys** you’ve mapped on pages
2. Enter your values and click **Save**.

### Firefox — open the extension’s Options
- Go to `about:addons` → **Extensions** → **Job Autofill Assistant** → **Preferences**/**Options**.

Then in **Options**: same steps as Chrome — fill your **Key / Value** rows and **Save**.

> Tip: You can also use **Quick Fill** (on-page panel) to edit and save profile values quickly, then **Save & Autofill** in one go.

## Basic usage
1. Open a job application page → click **Detect Fields**.  
2. Click a field and use **Map Field** to link it to a profile key (e.g., `lastName`).  
3. Adjust values in **Quick Fill** if needed.  
4. Press **Ctrl/Cmd + Shift + Y** or click **Autofill**.

The extension remembers mappings **per domain**. When you map a new field, it’s also added to your profile so you can edit it later in **Options**.

## Contributing & contact
Found an issue or want to improve something? **Issues and PRs welcome!**  
- Open an issue or PR in the repo: https://github.com/FamiliaAyres/job_autofill  
- Or email me: **franklin.ayres@hotmail.com**

If this extension helps you and you want to support the project:
- **Donate (optional):** PayPal — **franklin.ayres@hotmail.com**

## Privacy
Your profile data stays **in your browser** (`browser.storage`/`chrome.storage`). Nothing is sent to servers.

## License
Distributed under the **MIT License**. See `LICENSE`.
