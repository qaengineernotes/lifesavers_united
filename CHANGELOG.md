# Features and Fixes Log

This document records new features and fixes implemented in the LifeSavers United platform. In accordance with project conventions, future updates will be appended to the top or bottom of this document as new entries, and existing text will never be edited.

---

### [2026-06-12] — Gallery SEO Optimization (Option A with Brand and Schema Enhancements)

* **Build Automation Script**: Created [update-gallery-seo.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/update-gallery-seo.js) to automate fetching image files recursively from Firebase Storage, converting names to title case, and rendering them statically.
* **Build Integration**: Added the shortcut `"update:gallery-seo"` in [package.json](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/package.json) to execute the SEO generation pipeline with one command.
* **Pre-rendered Noscript Image Grid**: Prepared [gallery.html](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/gallery.html) with injection markers. The automation script populates this block with `<noscript>` static `<img>` tags representing all gallery images with brand-augmented `alt` tags (e.g., `alt="[Name] - LifeSavers United"`).
* **SEO Image Sitemap**: Enhanced [sitemap.xml](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/sitemap.xml) with the Google Image schema namespace, and configured the script to generate detailed `<image:image>` entries containing `<image:title>` and `<image:caption>` with the brand name.
* **Structured Data Schema**: Integrated an `ImageGallery` JSON-LD schema markup block in [gallery.html](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/gallery.html) declaring the gallery ownership by LifeSavers United.

---

### [2026-06-05] — Email Broadcast Detailed Metrics and Firestore Logging

* **Detailed Delivery Breakdown**: Added client-side results parsing in [broadcast-system.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/broadcast-system.js) to compute exactly how many emails were successfully delivered by each provider (`resend`, `brevo`, `mailjet`) and how many failed.
* **UI Delivery Feedback**: Updated the toast notification in the admin dashboard to show a detailed breakdown to the Superuser immediately upon broadcast completion.
* **Persistent Broadcast Auditing**: Configured automatic logging of every broadcast to a new Firestore collection `broadcast_logs` with broadcast payload and delivery stats per provider.
* **Firestore Security Rules**: Created rule overrides for `broadcast_logs` in [firestore.rules](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/firestore.rules) to restrict read and write permissions exclusively to Superusers (`isSuperuser()`), while preventing updates or deletions to make logs immutable.

---

### [2026-06-05] — Fix Search and Filter Clear Buttons on All Donors Page

* **Tab Navigation Event Handling**: Refactored `switchTab` in [donors.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/donors.js) to accept an event object explicitly and use standard `currentTarget` or `target` properties. This avoids reliance on the deprecated global `window.event` object and prevents `ReferenceError: event is not defined` inside ES module strict-mode contexts, especially in strict browsers like Firefox.
* **HTML Event Passing**: Modified [donors.html](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/donors.html) to pass the `event` object dynamically in inline `onclick` handler calls.
* **Z-Index Layering on Clear Search Button**: Added `z-index: 10` and `pointer-events: auto` to `.clear-search-btn` in [donors-redesign.css](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/css/donors-redesign.css) to prevent the search input element from intercepting click events meant for the clear button.
* **Filter Clear Integration**: Updated the "Clear All" click listener in [donors.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/donors.js) to also clear the `searchQuery` and `searchInput` element value, and hide the search clear button.
* **Active Filter Status Update**: Updated `hasActiveFilters` in [donors.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/donors.js) to verify if `searchQuery` is active. This ensures the "Clear All" button correctly displays when only a search term is present.

---

### [2026-06-05] — Replace Default Reopen Popups with Theme-Based Custom Dialogs on All Requests Page

* **Theme-Based Dialog Backdrops**: Added a smooth overlay fade-in animation `@keyframes customFadeIn` and backdrop filter blurs to `showCustomConfirm` and `showCustomAlert` in [all-requests.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/all-requests.js) to match the premium blood-donation theme.
* **Configurable Dialog Buttons**: Parameterized the proceed and cancel button text in `showCustomConfirm` to allow fully dynamic confirmations.
* **Reopen Request Integration**: Configured the reopen flow in `reopenRequest` to use `showCustomConfirm` with the customized label `'Yes, Reopen'` and `showCustomAlert` for success/error states, completely eliminating legacy browser-native `confirm()` and `alert()` calls.
* **Script Cache Busting**: Updated [all_requests.html](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/all_requests.html) to append a version cache buster query parameter (`?v=1.0.1`) to the script import tag, ensuring users immediately receive the new theme-based popup logic instead of running cached legacy code.

---

### [2026-06-09] — Update Email Broadcast Toast Notification Styling & Positioning

* **Alignment with Theme Success Messages**: Redesigned `showToast` in [broadcast-system.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/broadcast-system.js) using inline style positioning (`top: 20px; right: 20px;`) and HSL/theme-aligned colors (`#10B981` success, `#EF4444` error) to perfectly match toast notifications used on other pages.
* **Premium Transitions & Animation**: Integrated smooth CSS keyframe slide-in and fade-out animations (`toastSlideIn` and `toastFadeOut`) and custom checkmark/alert SVGs for a polished user experience.
* **Script Cache Busting**: Updated the dynamic import in [donors.html](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/donors.html) to request `scripts/broadcast-system.js?v=1.0.1` to force browsers to load the fresh styled module.
* **Fix Success Toast Undefined Placeholders**: Resolved an issue in [broadcast-system.js](file:///d:/Lifesavers%20United/life_savers_donors/life_savers_donors/scripts/broadcast-system.js) where the success toast displayed `undefined` for sent and failed counts due to referencing `result.sent` and `result.failed` properties not present in the Cloudflare Pages function response. Configured the success toast message to dynamically fetch the returned `result.message` or fall back to calculated provider totals.



