# Deployment Guide for GitHub Pages

## Changes Made for GitHub Pages Compatibility

### Problem
Your website was using `http://localhost:8000` for API calls, which won't work when deployed on GitHub Pages because:
- Localhost doesn't exist on GitHub's servers
- Mixed content security issues (HTTPS vs HTTP)
- CORS restrictions

### Solution Applied
Updated all API endpoints to call Google Apps Script directly instead of going through the local Python server.

### Files Modified
1. **`index.html`** - Updated SUBMIT_URL
2. **`pages/emergency_blood_request.html`** - Updated SUBMIT_URL and form submission method
3. **`pages/emergency_request_system.html`** - Updated FETCH_URL

### Technical Changes

#### Before (Local Development)
```javascript
const SUBMIT_URL = 'http://localhost:8000/api/submit-blood-request';
const FETCH_URL = 'http://localhost:8000/api/fetch-requests';
```

#### After (GitHub Pages)
```javascript
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbz7dBZqc2t36QwY8nRw2rPViKpiKWelilUPlre5TrsvhWenaBXW5UKndknbyMb7A5q3zQ/exec';
const FETCH_URL = 'https://script.google.com/macros/s/AKfycbz7dBZqc2t36QwY8nRw2rPViKpiKWelilUPlre5TrsvhWenaBXW5UKndknbyMb7A5q3zQ/exec';
```

#### Form Submission Method Change
- **Before**: JSON POST request
- **After**: Form-encoded POST request with data parameter

```javascript
// Old method
const response = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

// New method
const submitData = new URLSearchParams();
submitData.append('data', JSON.stringify(data));
const response = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: submitData
});
```

## What This Means

### ✅ What Works Now
- Your website will work on GitHub Pages
- API calls will go directly to Google Apps Script
- No need to run a local server for production

### ⚠️ What You Need to Know
- **Local Development**: You can still use `server.py` for local development by reverting the URLs
- **Google Apps Script**: Make sure your Google Apps Script is published and accessible
- **CORS**: Google Apps Script handles CORS automatically

## Testing

### Local Testing
1. Run `python server.py` for local development
2. Temporarily change URLs back to `localhost:8000` if needed

### Production Testing
1. Deploy to GitHub Pages
2. Test all forms and API calls
3. Verify data is being saved to Google Sheets

## Alternative Solutions

If you prefer to keep using a backend server, consider:

1. **Deploy server.py to a cloud platform**:
   - Heroku (free tier)
   - Railway (free tier)
   - Render (free tier)
   - PythonAnywhere (free tier)

2. **Use a different backend service**:
   - Firebase Functions
   - AWS Lambda
   - Vercel Functions

## Rollback Instructions

If you need to revert to local development:

1. Change URLs back to `localhost:8000`
2. Change form submission back to JSON format
3. Run `python server.py` locally

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify Google Apps Script is published
3. Test API endpoints directly in browser
4. Check Google Sheets for data updates
