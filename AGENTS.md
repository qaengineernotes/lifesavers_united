# AGENTS.md - LifeSavers United

## Project Overview
Static HTML/CSS/JS site with Firebase backend (Firestore, Auth, Cloud Functions) for blood donation platform.

**Firebase Project**: `lifesavers-united-org`

## Developer Commands

### CSS Build (Tailwind)
```bash
npm run build:css     # Build production CSS (runs @dhiwise/component-tagger then tailwindcss)
npm run watch:css     # Watch mode for development
npm run dev           # Alias for watch:css
```

### Firebase Functions
```bash
cd firebase-functions
npm run serve         # Firebase emulators:start --only functions
npm run deploy        # firebase deploy --only functions
npm run logs          # firebase functions:log
```

### Local Server
```bash
python server.py      # Custom CORS-aware server with API proxies (port 8000)
python -m http.server 8000  # Simple alternative
```

## Architecture

### Frontend
- Static HTML files in root (not `pages/` subdirectory despite some paths suggesting it)
- Tailwind CSS via custom build → `css/main.css`
- Firebase SDK loaded from CDN (v11.x)
- No build step for JS - files served directly

### Backend Services
- **Firestore**: Primary database for users, donors, emergency_requests, donation_logs
- **Firebase Auth**: Phone authentication (requires reCAPTCHA v3)
- **Cloud Functions** (`firebase-functions/index.js`):
  - `telegramBot`: Telegram webhook for blood requests
  - `postRequestToTwitter`: Callable function for Twitter posting
  - `processNewUser`: Auth trigger for user creation
- **Google Apps Script**: Secondary data storage/proxy (referenced in `server.py`)

### Firestore Collections
- `users` - User profiles with roles (superuser/volunteer/approved/pending)
- `emergency_requests` - Blood requests with status tracking
- `donors` - Donor profiles (public read)
- `donation_logs` - Donation tracking
- `telegram_users` - Telegram bot users

### Firestore Security Rules
- `firestore.rules` contains App Check verification (`isVerifiedApp()`)
- Public can read emergency_requests and donors (for duplicate detection)
- Authenticated/approved users required for writes
- Superuser required for role management

## Configuration Files
- `tailwind.config.js` - Custom theme with blood-donation colors
- `firebase.json` - Firebase Hosting config (public: ".", rewrites all to index.html)
- `.firebaserc` - Project: `lifesavers-united-org`
- `manifest.json` - Web app manifest
- `firestore.rules` - Security rules
- `firestore.indexes.json` - Currently empty

## Important Conventions

### CSS Build
The CSS build runs `@dhiwise/component-tagger` BEFORE tailwindcss. Always use:
```bash
npm run build:css
```
NOT bare `npx tailwindcss` which would miss the component tagging.

### Local Development
- Use `server.py` for local dev - it handles CORS and proxies to Google Apps Script
- Direct file:// won't work due to CORS restrictions
- App Check debug token for localhost is hardcoded in `firebase-config.js`

### Phone Number Handling
Phone numbers are normalized to 10-digit format (no +91 prefix) across:
- `firebase-functions/index.js` - `normalizePhoneNumber()`
- `server.py` - `normalize_phone_number()`

### Request Submission Flow
1. Web form → Firestore `emergency_requests`
2. Also proxied through server.py → Google Apps Script
3. Telegram bot creates requests in Firestore
4. Cloud Function posts to Twitter (config via `firebase functions:config:set`)

## Key Files
- `scripts/firebase-config.js` - Firebase init with lazy App Check
- `firebase-functions/index.js` - Cloud Functions (730 lines, Telegram + Twitter)
- `server.py` - Local dev server with API proxies
- `index.html` - Main landing page with Tailwind CSS
- `emergency_blood_request.html` - Request submission form
- `donor_registration.html` - Donor signup form
- `emergency_request_system.html` - Admin dashboard

## Secrets Management
Firebase Functions uses `functions.config()` for:
- `telegram.token`
- `twitter.api_key`, `twitter.api_secret`, `twitter.access_token`, `twitter.access_secret`

Set via: `firebase functions:config:set telegram.token="..." twitter.api_key="..."`
