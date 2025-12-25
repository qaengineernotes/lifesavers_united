---
description: Enable Firebase Phone Authentication
---

# Enable Firebase Phone Authentication

Follow these steps to enable phone authentication in your Firebase project:

## Step 1: Go to Firebase Console
1. Open https://console.firebase.google.com/
2. Select your project: **lifesavers-united-org**

## Step 2: Enable Phone Authentication
1. In the left sidebar, click **Build** → **Authentication**
2. Click on the **Sign-in method** tab
3. Find **Phone** in the list of providers
4. Click on **Phone** to expand it
5. Toggle the **Enable** switch to ON
6. Click **Save**

## Step 3: Add Authorized Domains
1. Still in the **Sign-in method** tab, scroll down to **Authorized domains**
2. Make sure these domains are listed:
   - `localhost` (for local testing)
   - `127.0.0.1` (for local testing)
   - Your production domain (if deployed)
3. If any are missing, click **Add domain** and add them

## Step 4: Configure reCAPTCHA (Important!)
1. Go to **Authentication** → **Settings** tab
2. Scroll to **App verification** section
3. Make sure **reCAPTCHA Enterprise** is configured or use the default reCAPTCHA v2
4. For testing purposes, you can add test phone numbers:
   - Click **Phone numbers for testing**
   - Add a test number like `+919999999999` with verification code `123456`

## Step 5: Check Firebase Billing (CRITICAL!)
Phone authentication requires Firebase to be on the **Blaze (Pay as you go)** plan:

1. In Firebase Console, click the gear icon ⚙️ → **Usage and billing**
2. Check your current plan
3. If you're on the **Spark (Free)** plan, you need to upgrade:
   - Click **Modify plan**
   - Select **Blaze (Pay as you go)**
   - Add a billing account
   - **Note:** Phone auth has a free tier (10K verifications/month), but requires billing to be enabled

## Step 6: Verify Configuration
After completing the above steps:
1. Go back to your application
2. Try to register/login with a phone number
3. Check the browser console (F12) for any error messages
4. If you still see errors, check the Firebase Console → **Authentication** → **Users** tab to see if any authentication attempts are logged

## Troubleshooting

### Error: "reCAPTCHA client element has been removed"
- Clear browser cache and reload the page
- Make sure you're testing on an authorized domain

### Error: "auth/invalid-phone-number"
- Ensure phone number is in E.164 format: +919876543210
- The code automatically adds +91 prefix for Indian numbers

### Error: "auth/quota-exceeded"
- You've exceeded the free tier limit
- Check your Firebase usage in the console

### Error: "auth/too-many-requests"
- Too many failed attempts from the same device
- Wait a few hours or use a different device/browser

## Testing Without Real Phone Numbers
For development, you can use test phone numbers:
1. Go to **Authentication** → **Sign-in method** → **Phone**
2. Scroll to **Phone numbers for testing**
3. Add test numbers with fixed verification codes:
   - Phone: `+919999999999`
   - Code: `123456`
4. These will work without sending actual SMS
