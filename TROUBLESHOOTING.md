# Troubleshooting Guide

## Common Issues and Solutions

### 1. CORS Error When Submitting Forms Locally

**Problem**: You see an error when trying to submit the blood request form from a local file.

**Cause**: Browsers block requests to external URLs when opening HTML files directly (using `file://` protocol).

**Solutions**:

#### Option A: Use the Local Server (Recommended)

1. **Using Python** (if you have Python installed):
   ```bash
   python server.py
   ```

2. **Using Node.js** (if you have Node.js installed):
   ```bash
   npm install
   node server.js
   ```

3. **Using the batch file** (Windows):
   ```bash
   start-server.bat
   ```

4. **Simple Python HTTP server**:
   ```bash
   python -m http.server 8000
   ```

Then open: `http://localhost:8000/pages/emergency_blood_request.html`

#### Option B: Use a Browser Extension

Install a CORS browser extension like "CORS Unblock" or "Allow CORS" for Chrome/Firefox.

#### Option C: Disable Web Security (Chrome Only - Not Recommended)

```bash
# Windows
chrome.exe --user-data-dir="C://Chrome dev session" --disable-web-security

# Mac
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security

# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_test"
```

### 2. Google Apps Script Permission Errors

**Problem**: "Permission denied" or "Access denied" errors.

**Solutions**:

1. **Check Google Apps Script deployment**:
   - Make sure it's deployed as a "Web app"
   - Set "Execute as" to "Me"
   - Set "Who has access" to "Anyone"

2. **Re-authorize the script**:
   - Go to Google Apps Script
   - Click "Deploy" → "Manage deployments"
   - Click "Edit" → "Authorize access"

3. **Check Google Sheets permissions**:
   - Make sure you have edit access to the Google Sheets document
   - Verify the spreadsheet ID is correct

### 3. Form Data Not Appearing in Google Sheets

**Problem**: Form submission succeeds but data doesn't appear in the sheet.

**Solutions**:

1. **Check the Google Apps Script logs**:
   - Go to Google Apps Script
   - Click "View" → "Execution log"
   - Look for error messages

2. **Test the script manually**:
   - Run the `testSubmission()` function in Google Apps Script
   - Check the logs for any errors

3. **Verify spreadsheet ID**:
   - Make sure the spreadsheet ID in `google-apps-script.js` matches your actual Google Sheets document

### 4. Emergency Requests Not Displaying

**Problem**: The emergency request system page shows "No Active Emergency Requests".

**Solutions**:

1. **Check if there are "Open" requests**:
   - Verify that your Google Sheets has requests with "Open" status in column L

2. **Test the fetch function**:
   - Run the `testFetchRequests()` function in Google Apps Script
   - Check the logs for any errors

3. **Check the fetch URL**:
   - Make sure the `GOOGLE_SHEETS_FETCH_URL` in `emergency_request_system.html` is correct

### 5. JavaScript Console Errors

**Problem**: Errors in the browser's developer console.

**Solutions**:

1. **Open Developer Tools**:
   - Press F12 or right-click → "Inspect"
   - Go to the "Console" tab
   - Look for red error messages

2. **Common errors and fixes**:
   - **CORS errors**: Use the local server (see Solution 1 above)
   - **Network errors**: Check your internet connection
   - **Syntax errors**: Check for typos in the JavaScript code

### 6. Form Validation Issues

**Problem**: Form doesn't submit or shows validation errors.

**Solutions**:

1. **Check required fields**:
   - Make sure all required fields are filled out
   - Required fields are marked with asterisks (*)

2. **Check field formats**:
   - Phone numbers should be valid format
   - Email addresses should be valid format
   - Dates should be in the correct format

### 7. Mobile/Responsive Issues

**Problem**: The form doesn't work properly on mobile devices.

**Solutions**:

1. **Use the local server** (see Solution 1 above)
2. **Check viewport meta tag**:
   - Make sure the HTML has: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
3. **Test on different devices**:
   - Use browser developer tools to simulate mobile devices

## Getting Help

If you're still experiencing issues:

1. **Check the browser console** for specific error messages
2. **Check Google Apps Script logs** for backend errors
3. **Verify all URLs and IDs** are correct
4. **Test with the provided test functions** in Google Apps Script

## Quick Test Checklist

- [ ] Google Apps Script is deployed as a web app
- [ ] Google Apps Script has proper permissions
- [ ] Spreadsheet ID is correct
- [ ] Using local server (not file:// protocol)
- [ ] All required form fields are filled
- [ ] Internet connection is working
- [ ] No JavaScript errors in console
