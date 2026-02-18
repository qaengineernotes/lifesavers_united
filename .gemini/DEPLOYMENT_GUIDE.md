# 🚀 Deployment Guide - Phone Number Normalization Fix

## Overview
You've made changes to fix phone number normalization on your **local development environment**. Now you need to deploy these changes to your **live website** (Firebase Hosting) so users can benefit from the fix.

---

## 📦 What Needs to be Deployed

### 1. **Website Files (Firebase Hosting)**
These files need to be deployed to Firebase Hosting:
- ✅ `scripts/phone-normalizer.js` (NEW FILE)
- ✅ `scripts/emergency_blood_request.js` (MODIFIED)
- ✅ `scripts/donor_registration.js` (MODIFIED)
- ✅ `emergency_blood_request.html` (MODIFIED)
- ✅ `donor_registration.html` (MODIFIED)

### 2. **Firebase Functions (Backend)**
This file needs to be deployed to Firebase Functions:
- ✅ `functions/index.js` (MODIFIED - Telegram bot normalization)

---

## 🚀 Deployment Steps

### Step 1: Deploy Firebase Hosting (Website Files)

Open your terminal in the project directory and run:

```bash
firebase deploy --only hosting
```

**What this does:**
- Uploads all your website files (HTML, CSS, JavaScript) to Firebase Hosting
- Makes the phone normalization changes live on your website
- Users will now see the fixed forms with proper phone number handling

**Expected Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project/overview
Hosting URL: https://your-project.web.app
```

---

### Step 2: Deploy Firebase Functions (Telegram Bot)

Run this command to deploy the updated Telegram bot:

```bash
firebase deploy --only functions
```

**What this does:**
- Deploys the updated `functions/index.js` with phone normalization
- Updates the Telegram bot to normalize phone numbers
- Updates the webhook handler

**Expected Output:**
```
✔  functions: Finished running predeploy script.
✔  functions[telegramWebhook(us-central1)]: Successful update operation.
✔  Deploy complete!
```

---

### Step 3: Deploy Everything at Once (Recommended)

If you want to deploy both hosting and functions together:

```bash
firebase deploy
```

**What this does:**
- Deploys all changes (hosting + functions + firestore rules if changed)
- Ensures everything is in sync

---

## ⚡ Quick Deployment (One Command)

If you're in a hurry, just run:

```bash
firebase deploy
```

This will deploy everything and ensure all changes are live.

---

## ✅ Verify Deployment

After deployment, verify the changes are live:

### 1. **Check Website**
- Open your live website: `https://lifesaversunited.org/emergency_blood_request.html`
- Check if the CAPTCHA is showing (should display a math question)
- Fill out the form with a phone number like `+91 94283 54534`
- Submit the form
- Check Firebase to verify it's stored as `9428354534`

### 2. **Check Telegram Bot**
- Send a test blood request via Telegram
- Use a phone number like `+91 94283 54534`
- Check Firebase to verify it's stored as `9428354534`

### 3. **Check Browser Console**
- Open Developer Tools (F12)
- Go to the Console tab
- Refresh the page
- Should see no errors related to `phone-normalizer.js`

---

## 🔍 Troubleshooting

### Issue: "Command not found: firebase"
**Solution:** Install Firebase CLI first:
```bash
npm install -g firebase-tools
```

Then login:
```bash
firebase login
```

---

### Issue: "Permission denied" or "Not authorized"
**Solution:** Make sure you're logged in:
```bash
firebase login
```

---

### Issue: CAPTCHA still blank after deployment
**Solution:** 
1. Clear your browser cache (Ctrl + Shift + Delete)
2. Hard refresh the page (Ctrl + F5)
3. Try in incognito/private mode

---

### Issue: Phone numbers still not normalized
**Solution:**
1. Check browser console for errors
2. Verify deployment was successful
3. Make sure you're testing on the live site, not localhost

---

## 📝 Deployment Checklist

Before deploying:
- [ ] All changes are saved locally
- [ ] You've tested on localhost and everything works
- [ ] Firebase CLI is installed (`firebase --version`)
- [ ] You're logged in to Firebase (`firebase login`)

Deploy:
- [ ] Run `firebase deploy` (or separate commands for hosting/functions)
- [ ] Wait for deployment to complete
- [ ] Note the Hosting URL from the output

After deploying:
- [ ] Visit your live website
- [ ] Test the emergency blood request form
- [ ] Test the donor registration form
- [ ] Test the Telegram bot
- [ ] Verify phone numbers are normalized in Firebase

---

## 🎯 Expected Timeline

- **Hosting deployment:** ~1-2 minutes
- **Functions deployment:** ~2-3 minutes
- **Total time:** ~3-5 minutes

---

## 📞 Need Help?

If you encounter any issues during deployment:
1. Check the error message carefully
2. Make sure you have the right permissions
3. Verify you're in the correct project directory
4. Check Firebase Console for deployment status

---

## 🔄 Rollback (If Needed)

If something goes wrong, you can rollback:

```bash
firebase hosting:rollback
```

This will revert to the previous version.

---

**Ready to deploy?** Just run:

```bash
firebase deploy
```

And your phone number normalization fix will be live! 🎉
