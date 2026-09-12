# 📖 LifeSavers United - Command Cheat Sheet

A central reference guide containing all manual commands, scripts, and developer tools used across the project with descriptions and examples.

---

## 📑 Quick Navigation
1. [Image Optimization & Batch Renaming](#1-image-optimization--batch-renaming)
2. [Gallery & SEO Automation](#2-gallery--seo-automation)
3. [Local Development Server](#3-local-development-server)
4. [CSS & Tailwind Build](#4-css--tailwind-build)
5. [Firebase Hosting & Backend](#5-firebase-hosting--backend)
6. [Donor Utilities & Email Services](#6-donor-utilities--email-services)

---

## 1. Image Optimization & Batch Renaming

### 🔹 Batch Convert, Optimize & Sequentially Number Images
Converts raw images (JPG, PNG, etc.) in any folder into compressed `.webp` format, resizes them for fast web loading, and renames them sequentially (`-1.webp`, `-2.webp`, ...). Output files are automatically placed in `./imgs/`.

```bash
# Basic Syntax:
node scripts/optimize-and-rename.js "<FOLDER_PATH>" "<BASE_NAME>"

# Example:
node scripts/optimize-and-rename.js "D:\Lifesavers United\drive-download-20260910T172701Z-1-001" "blood-donation-camp-at-sahay-with-help-volunteer-blood-center"
```
* **Optional Flags:**
  * `--output "<custom_folder>"` : Specify a custom output folder instead of `./imgs`.
  * `--quality 80` : Set WebP quality (default is 80).
  * `--max-width 1920` : Set max image width in pixels (default is 1920px).

---

### 🔹 Clean & Hyphenate Image Names in Bulk
Scans a folder and renames all files to lowercase, trims whitespace, and replaces spaces or underscores with hyphens (e.g. `"Manav Shah 1.webp"` ➔ `"manav-shah-1.webp"`).

```bash
node scripts/rename-images.js "<FOLDER_PATH>"

# Example:
node scripts/rename-images.js "D:\Lifesavers United\life_savers_donors\life_savers_donors\imgs"
```

---

### 🔹 Optimize All Existing Images in `/imgs`
Scans the project's `./imgs` directory and converts all uncompressed `.jpg`, `.jpeg`, and `.png` files into `.webp` at quality 80.

```bash
npm run optimize-images
```

---

### 🔹 Auto-Watch `/imgs` Folder for New Files
Runs a background file watcher on `./imgs`. Whenever you drop a new JPG or PNG file into the folder, it automatically converts it into a WebP file in real-time.

```bash
npm run watch-images
```

---

### 🔹 Extract Dates from Gallery Image Filenames
Parses date patterns from image filenames in your gallery folder and processes date metadata.

```bash
node scripts/process-gallery-dates.js
```

---

## 2. Gallery & SEO Automation

### 🔹 Sync Firebase Gallery with SEO Schema & Noscript Grid
Connects to Firebase Storage, downloads the list of all gallery photos across categories (`Blood Donors`, `Donation Camps`, `Events`, `Awards & Recognition`), and automatically updates:
1. The `<noscript>` static image grid in `gallery.html` (so search engine crawlers can index every image).
2. The `ImageGallery` JSON-LD schema markup block in `gallery.html`.

```bash
npm run update:gallery-seo
# or
node scripts/update-gallery-seo.js
```

---

## 3. Local Development Server

### 🔹 Run Custom Dev Server (Recommended)
Starts a custom Python HTTP server on port `8000`. Handles CORS headers, clean URL routing without `.html` extensions, and proxies requests to Google Apps Script.

```bash
python server.py
```
* **URL:** `http://localhost:8000`
* **Note:** Opens `http://localhost:8000/emergency_request_system` automatically in your browser.

---

### 🔹 Run Simple Fallback HTTP Server
A lightweight alternative if you only need static HTML file serving without CORS proxies:

```bash
python -m http.server 8000
```

---

## 4. CSS & Tailwind Build

> ⚠️ **Important Note for CSS Builds**:  
> The build script runs `@dhiwise/component-tagger` before `tailwindcss`. Always use `npm run build:css`, never run bare `tailwindcss`.

### 🔹 Production CSS Build
Compiles all Tailwind utility classes from HTML and JS files into `css/main.css`.

```bash
npm run build:css
```

---

### 🔹 Development Watch Mode
Watches HTML and JavaScript files for new Tailwind classes and rebuilds `css/main.css` automatically on save.

```bash
npm run watch:css
# or
npm run dev
```

---

## 5. Firebase Hosting & Backend

### 🔹 Deploy Frontend to Firebase Hosting
Uploads all static pages, assets, scripts, and stylesheets to production hosting (`lifesaversunited.org` / `lifesavers-united-org.web.app`).

```bash
firebase deploy --only hosting
```

---

### 🔹 Deploy Firestore Security Rules
Deploys `firestore.rules` (including App Check verification and access permissions).

```bash
firebase deploy --only firestore:rules
```

---

### 🔹 Deploy Cloud Functions
Deploys Telegram bot webhook, Twitter auto-poster, and new user auth trigger functions from `firebase-functions/`.

```bash
firebase deploy --only functions
```

---

### 🔹 Run Cloud Functions Locally (Emulator)
Runs a local Firebase Functions emulator for debugging and testing function triggers without deploying to the cloud.

```bash
cd firebase-functions
npm run serve
```

---

### 🔹 View Live Cloud Functions Logs
Streams real-time execution logs and errors from Google Cloud / Firebase Cloud Functions.

```bash
firebase functions:log
```

---

### 🔹 Set Production Secrets / Config
Configures environment tokens for the Telegram bot and Twitter/X API integration.

```bash
firebase functions:config:set telegram.token="YOUR_TELEGRAM_BOT_TOKEN" twitter.api_key="YOUR_KEY" twitter.api_secret="YOUR_SECRET" twitter.access_token="YOUR_TOKEN" twitter.access_secret="YOUR_SECRET"
```

---

## 6. Donor Utilities & Email Services

### 🔹 Trigger Automated Donor Birthday Greetings
Scans the donors database and automatically triggers birthday congratulation emails to eligible donors for the current day.

```bash
node scripts/auto-birthday-emails.js
```

---

### 🔹 Test Email / SMTP Providers
Runs diagnostics to verify connectivity and delivery status across configured SMTP and email service providers.

```bash
node test-email-providers.mjs
```

---

## 💡 Quick Tips
* **Running from Windows PowerShell / Command Prompt**: Always run commands from the project root folder (`d:\Lifesavers United\life_savers_donors\life_savers_donors`).
* **Clean URLs**: When testing locally with `python server.py`, URLs like `/events`, `/gallery?filter=Events`, and `/blogs` work without needing the `.html` extension.
