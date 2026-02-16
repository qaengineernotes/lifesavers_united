# Phone Number Normalization - Testing Checklist

## 🔍 Manual Testing Required

Since the browser automation isn't available, please manually test the following to ensure nothing broke:

---

## ✅ 1. Emergency Blood Request Form
**URL:** `http://localhost:8000/emergency_blood_request.html`

### Visual Checks:
- [ ] Page loads without errors
- [ ] **CAPTCHA displays correctly** (should show a math question like "What is 5 + 3?")
- [ ] Refresh CAPTCHA button works (circular arrow icon)
- [ ] All form fields are visible and properly styled
- [ ] Submit button is visible

### Functional Checks:
- [ ] Fill in patient name
- [ ] Enter phone number in different formats:
  - Try: `94283 54534` (with space)
  - Try: `+91 94283 54534` (with country code)
  - Try: `+919428354534` (compact format)
- [ ] Select blood type
- [ ] Fill in hospital details
- [ ] Answer CAPTCHA correctly
- [ ] Submit form
- [ ] **Verify in Firebase** that the phone number is stored as `9428354534` (10 digits, no spaces or country code)

### Browser Console Check:
- [ ] Open Developer Tools (F12)
- [ ] Check Console tab for any errors (should be clean)
- [ ] Look for any red error messages

---

## ✅ 2. Donor Registration Form
**URL:** `http://localhost:8000/donor_registration.html`

### Visual Checks:
- [ ] Page loads without errors
- [ ] **CAPTCHA displays correctly** (should show a math question like "What is 7 + 2?")
- [ ] Refresh CAPTCHA button works
- [ ] All form fields are visible and properly styled
- [ ] Blood group selection works
- [ ] City autocomplete works
- [ ] Submit button is visible

### Functional Checks:
- [ ] Fill in full name
- [ ] Enter phone number in different formats:
  - Try: `8460161016` (plain 10-digit)
  - Try: `+91 8460161016` (with country code and space)
  - Try: `918460161016` (with country code, no +)
- [ ] Select blood group
- [ ] Fill in other required fields
- [ ] Check both consent checkboxes
- [ ] Answer CAPTCHA correctly
- [ ] Submit form
- [ ] **Verify in Firebase** that the phone number is stored as `8460161016` (10 digits, no spaces or country code)

### Browser Console Check:
- [ ] Open Developer Tools (F12)
- [ ] Check Console tab for any errors (should be clean)
- [ ] Look for any red error messages

---

## ✅ 3. Telegram Bot
**Test via Telegram**

### Send a test blood request:
```
Patient Name: Test Patient
Contact Number: +91 94283 54534
Blood Group: O+
Units Required: 2
Hospital: Test Hospital
City: Ahmedabad
```

### Verify:
- [ ] Bot accepts the request
- [ ] Check Firebase to confirm phone number is stored as `9428354534`
- [ ] No errors in Firebase Functions logs

---

## ✅ 4. Database Verification

### Check Firebase Console:
1. Go to Firebase Console → Firestore Database
2. Open `emergency_requests` collection
3. Find the latest test request
4. **Verify `contactNumber` field:**
   - Should be: `9428354534` (10 digits)
   - Should NOT be: `94283 54534` or `+91 94283 54534`

5. Open `donors` collection
6. Find the latest test donor
7. **Verify `contactNumber` field:**
   - Should be: `8460161016` (10 digits)
   - Should NOT have spaces or country code

---

## ✅ 5. Google Sheets Verification (if applicable)

### Check Google Sheets:
1. Open your blood requests Google Sheet
2. Find the latest test entry
3. Verify phone number column shows normalized format (10 digits)

---

## 🚨 What to Look For (Potential Issues)

### If CAPTCHA is blank:
- Clear browser cache (Ctrl + Shift + Delete)
- Hard refresh the page (Ctrl + F5)
- Check browser console for errors

### If form doesn't submit:
- Check browser console for JavaScript errors
- Verify all required fields are filled
- Ensure CAPTCHA answer is correct

### If phone number isn't normalized:
- Check browser console for errors related to `phone-normalizer.js`
- Verify the import statement is working

---

## ✅ Expected Results Summary

### Before Normalization:
- Input: `+91 94283 54534`
- Stored: `+91 94283 54534` (inconsistent)

### After Normalization:
- Input: `+91 94283 54534`
- Stored: `9428354534` (consistent 10-digit format)

---

## 📝 Changes Made (For Reference)

### Files Modified:
1. **Created:** `scripts/phone-normalizer.js` - Utility for phone normalization
2. **Modified:** `functions/index.js` - Added normalization to Telegram bot
3. **Modified:** `scripts/emergency_blood_request.js` - Added import and normalization
4. **Modified:** `scripts/donor_registration.js` - Added import and normalization
5. **Modified:** `server.py` - Added Python normalization function
6. **Modified:** `emergency_blood_request.html` - Changed script tag to `type="module"`
7. **Modified:** `donor_registration.html` - Changed script tag to `type="module"`

### Key Fix for CAPTCHA Issue:
- Changed `<script src="scripts/emergency_blood_request.js"></script>`
- To: `<script type="module" src="scripts/emergency_blood_request.js"></script>`
- This allows the `import` statement to work properly

---

## ✅ Quick Test (2 minutes)

**Fastest way to verify everything works:**

1. Open `http://localhost:8000/emergency_blood_request.html`
2. Look for the CAPTCHA question (e.g., "What is 5 + 3?")
   - ✅ If you see it: **Everything is working!**
   - ❌ If it's blank: Clear cache and hard refresh (Ctrl + F5)
3. Fill out the form with a test phone number like `+91 94283 54534`
4. Submit the form
5. Check Firebase to see if it's stored as `9428354534`

---

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Clear browser cache and try again
3. Verify the local server is running
4. Check Firebase Functions logs for backend errors

---

**Last Updated:** 2026-02-16 19:05 IST
