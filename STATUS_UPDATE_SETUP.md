# Status Update Setup Guide

## Overview
This guide will help you add status update functionality to your existing Google Apps Script so that clicking "Verified" and "Closed" buttons will update the status in your Google Sheets.

## Step 1: Update Your Google Apps Script

1. **Go to your Google Apps Script project**
   - Visit: https://script.google.com/
   - Open your existing blood request handler project

2. **Add the new functions**
   - Copy the content from `google-apps-script-status-update.js`
   - Add these functions to your existing Google Apps Script project

3. **Replace your existing `doPost` function**
   - Replace your current `doPost` function with the new one that handles status updates
   - The new function can handle both form submissions and status updates

4. **Save and deploy**
   - Save your project (Ctrl+S)
   - Deploy as a new version or update existing deployment

## ✅ **IMPORTANT: URL Updated**
Your new Google Apps Script URL is: `https://script.google.com/macros/s/AKfycbx6PcS-BKZyh495QmGf6PN9dw_tjssHPIgPwG81oMc6AmC_SotT6TZ3YNGb1BAyWIA7TA/exec`

The emergency request system has been updated to use this new URL.

## Step 2: Test the Functionality

1. **Test status updates in Google Apps Script**
   - Run the `testUpdateStatus()` function to test "Verified" status
   - Run the `testCloseRequest()` function to test "Closed" status
   - Check the execution logs for any errors

2. **Test from the web interface**
   - Open your emergency request system page
   - Click "Verified" or "Closed" buttons on any request
   - Verify that the status updates in your Google Sheets

## How It Works

### API Call Structure
When you click a button, the system sends a POST request to your Google Apps Script with:
- `action=update_status`
- `data={"patientName":"...","bloodType":"...","status":"Verified"}`

### Google Apps Script Processing
1. The script receives the request
2. Parses the form data to extract patient name, blood type, and status
3. Searches your Google Sheets for a matching request
4. Updates the status in column L (Status column)
5. Returns success/error response

### Frontend Response
1. Shows loading state while updating
2. Updates the UI to reflect the new status
3. Shows success/error message
4. Disables both buttons after successful update

## Troubleshooting

### Common Issues

1. **"No matching request found" error**
   - Check that patient name and blood type match exactly
   - Verify the data in your Google Sheets
   - Check for extra spaces or different formatting

2. **CORS errors**
   - Make sure your Google Apps Script is deployed as a web app
   - Ensure "Who has access" is set to "Anyone"

3. **Button not updating**
   - Check browser console for JavaScript errors
   - Verify the Google Apps Script URL is correct
   - Check Google Apps Script execution logs

### Debug Steps

1. **Check Google Apps Script logs**
   - Go to Google Apps Script
   - Click "View" → "Execution log"
   - Look for error messages

2. **Test manually**
   - Run the test functions in Google Apps Script
   - Check if they work correctly

3. **Check browser console**
   - Open browser developer tools (F12)
   - Look for network errors or JavaScript errors

## Files Modified

1. **`google-apps-script-status-update.js`** - New functions to add to your Google Apps Script
2. **`pages/emergency_request_system.html`** - Updated button functions to call the API

## Success Indicators

✅ Status updates in Google Sheets when buttons are clicked
✅ UI updates to show new status
✅ Success messages appear
✅ Buttons are disabled after update
✅ No "NaN days" in time display

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all setup steps are completed
3. Test with the provided test functions
4. Check browser console and Google Apps Script logs
