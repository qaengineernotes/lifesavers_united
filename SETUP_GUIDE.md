# Google Sheets Integration Setup Guide

## Overview
This guide will help you set up the blood request form to automatically submit data to your Google Sheets document using Google Apps Script.

## Step 1: Set up Google Apps Script

1. **Go to Google Apps Script**
   - Visit: https://script.google.com/
   - Sign in with your Google account

2. **Create a new project**
   - Click "New Project"
   - Name it "Blood Request Handler"

3. **Copy the Google Apps Script code**
   - Replace the default code with the content from `google-apps-script.js`
   - Make sure the spreadsheet ID matches your Google Sheets document

4. **Save the project**
   - Click "Save" (Ctrl+S)
   - Give it a name like "Blood Request Handler"

## Step 2: Deploy as Web App

1. **Deploy the script**
   - Click "Deploy" → "New deployment"
   - Choose "Web app" as the type

2. **Configure deployment settings**
   - **Execute as**: "Me" (your Google account)
   - **Who has access**: "Anyone" (for public access)
   - Click "Deploy"

3. **Authorize the app**
   - Click "Authorize access"
   - Choose your Google account
   - Grant the necessary permissions

4. **Copy the Web App URL**
   - After deployment, copy the provided URL
   - It will look like: `https://script.google.com/macros/s/AKfycbz.../exec`
   - **Important**: This URL will handle both form submissions (POST) and data fetching (GET)

## Step 3: Update the HTML Files

1. **Update the Emergency Blood Request Form**
   - Open `pages/emergency_blood_request.html`
   - Find the line: `const GOOGLE_APPS_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';`
   - Replace with your actual Web App URL from Step 2

2. **Update the Emergency Request System Page**
   - Open `pages/emergency_request_system.html`
   - Find the line: `const GOOGLE_SHEETS_FETCH_URL = 'YOUR_GOOGLE_APPS_SCRIPT_FETCH_URL_HERE';`
   - Replace with your actual Web App URL from Step 2

## Step 4: Test the Integration

1. **Test the form submission**
   - Open the emergency blood request page
   - Fill out the form with test data
   - Submit the form
   - Check your Google Sheets to see if the data was added

2. **Test the emergency request display**
   - Open the emergency request system page
   - The page should automatically load and display any "Open" requests from your Google Sheets
   - Check that the requests are displayed with correct urgency levels and styling

3. **Verify the data structure**
   - The data should be added as a new row in your spreadsheet
   - Check that all fields are mapping correctly
   - Verify that only requests with "Open" status are displayed

## Troubleshooting

### Common Issues:

1. **CORS Error**
   - Make sure your Google Apps Script is deployed as a web app
   - Ensure "Who has access" is set to "Anyone"

2. **Permission Denied**
   - Make sure you've authorized the Google Apps Script
   - Check that you have edit access to the Google Sheets document

3. **Data not appearing**
   - Check the browser console for JavaScript errors
   - Verify the spreadsheet ID in the Google Apps Script
   - Make sure the sheet is active (first sheet in the workbook)

### Testing the Google Apps Script:

1. **Run the test function**
   - In Google Apps Script, run the `testSubmission()` function
   - Check the logs for any errors

2. **Check the execution log**
   - View → Execution log to see detailed error messages

## Data Mapping

The form data maps to your Google Sheets columns as follows:

| Form Field | Sheet Column | Description |
|------------|--------------|-------------|
| patientName | C | Patient Name |
| contactNumber | D | Contact |
| unitsRequired | E | Required Units |
| bloodType | F | Required BG |
| hospitalName | I | Hospital |
| additionalInfo | J | Diagnosis / Patient Suffering From |
| inquiryDate | B | Inquiry Date (auto-generated) |
| status | L | Status (set to "Open") |

## Security Notes

- The Google Apps Script URL will be visible in your HTML code
- Consider implementing additional validation in the Google Apps Script
- You may want to add rate limiting to prevent spam submissions

## Support

If you encounter any issues:
1. Check the browser console for JavaScript errors
2. Check the Google Apps Script execution logs
3. Verify all URLs and IDs are correct
4. Ensure proper permissions are set
