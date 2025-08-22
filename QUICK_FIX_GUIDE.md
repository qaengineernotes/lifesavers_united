# 🚨 Quick Fix Guide - Google Apps Script CORS Error

## The Problem
You encountered this error in your Google Apps Script:
```
TypeError: ContentService.createTextOutput(...).setMimeType(...).setHeaders is not a function
```

## The Solution
I've fixed the Google Apps Script code to use the correct method for setting CORS headers.

## ✅ What I Fixed

### 1. **Updated Google Apps Script Code**
- **Problem**: Used `.setHeaders()` which doesn't exist in Google Apps Script
- **Solution**: Used `.addHeader()` method for each CORS header individually

### 2. **Updated All API URLs**
- **Old URL**: `AKfycbz7dBZqc2t36QwY8nRw2rPViKpiKWelilUPlre5TrsvhWenaBXW5UKndknbyMb7A5q3zQ`
- **New URL**: `AKfycbwTAf6iXbV1x238Khx3rqBwvf0klhnR4BTWgnh--bFc2TBa63EcgfWtv05f_eciHN-IGw`

### 3. **Files Updated**
- ✅ `index.html`
- ✅ `pages/emergency_blood_request.html`
- ✅ `pages/emergency_request_system.html`
- ✅ `test-api.html`

## 🔧 Next Steps

### Step 1: Access Your Google Apps Script Project

**Option A: Through Google Apps Script Dashboard**
1. **Go to**: https://script.google.com/
2. **Sign in** with your Google account
3. **Find your project** in the list (look for "Life Savers Donors" or similar name)
4. **Click on it** to open

**Option B: Direct URL Access**
1. **Go to**: https://script.google.com/d/AKfycbwTAf6iXbV1x238Khx3rqBwvf0klhnR4BTWgnh--bFc2TBa63EcgfWtv05f_eciHN-IGw/edit
2. **Sign in** if prompted

**Option C: Find Project ID**
1. **Go to**: https://script.google.com/
2. **Look for your project** in the list
3. **The project ID** is in the URL when you click on it

### Step 2: Update Your Google Apps Script
1. **Replace ALL code** with the updated version from `google-apps-script-status-update.js`
2. **Save** the project (Ctrl+S)
3. **Deploy** as a new web app:
   - Click "Deploy" → "New deployment"
   - Type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Click "Deploy"

### Step 3: Test Your API
1. **Upload the updated files** to your GitHub repository
2. **Visit**: `https://qaengineernotes.github.io/lifesavers_united/test-api.html`
3. **Run all tests** to verify everything works

### Step 4: Verify Your Main Site
1. **Emergency Blood Request Form**: Should submit successfully
2. **Emergency Request System**: Should load requests without CORS errors
3. **All API calls**: Should work from GitHub Pages

## 🎯 What Changed in the Code

### Before (Broken)
```javascript
return ContentService
  .createTextOutput(JSON.stringify(data))
  .setMimeType(ContentService.MimeType.JSON)
  .setHeaders(headers); // ❌ This method doesn't exist
```

### After (Fixed)
```javascript
return ContentService
  .createTextOutput(JSON.stringify(data))
  .setMimeType(ContentService.MimeType.JSON)
  .addHeader('Access-Control-Allow-Origin', '*')
  .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  .addHeader('Access-Control-Allow-Headers', 'Content-Type')
  .addHeader('Access-Control-Max-Age', '86400'); // ✅ Correct method
```

## 🚀 Expected Results

After applying these fixes:
- ✅ No more CORS errors
- ✅ API calls work from GitHub Pages
- ✅ Forms submit successfully
- ✅ Emergency requests load properly
- ✅ All functionality works as expected

## 📞 If You Still Have Issues

1. **Check the test page** first: `https://qaengineernotes.github.io/lifesavers_united/test-api.html`
2. **Verify Google Apps Script deployment** is active
3. **Check browser console** for any remaining errors
4. **Ensure your Google Sheets** has the correct structure

The fix addresses the core issue with Google Apps Script's CORS header implementation!
