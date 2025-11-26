# Google Apps Script Deployment Guide
## Donation Logging System - Version 2.0

---

## 📋 What's New

### ✅ Features Added
1. **Partial Donation Tracking** - Track donations incrementally as they come in
2. **Auto-Close on Fulfillment** - Automatically closes requests when all units are fulfilled
3. **Donation Log Sheet** - Separate sheet to track all donation history
4. **Over-Donation Prevention** - Validates that donations don't exceed required units
5. **Multiple Donor Types** - Support for Relative, Donor (with details), and Other (closure reasons)
6. **Units Remaining Display** - Shows progress: "2/3 units fulfilled"

### ❌ Features Removed
1. **All Telegram Bot Code** - Completely removed Telegram integration
2. **Telegram Notifications** - No more Telegram message handling

---

## 🗂️ Sheet Structure Changes

### **Form Responses 1** (Emergency Requests)
**Updated Columns:**
- Column R (Units Fulfilled) - Now actively used (previously empty)
- This column tracks how many units have been donated so far

**Column Layout:**
```
A: No (auto-increment)
B: Inquiry Date
C: Patient Name
D: Contact Number
E: Units Required
F: Required BG (Blood Type)
G: Patient BG
H: Age
I: Hospital Name
J: Diagnosis
K: Status (Open/Verified/Closed)
L: Urgency Level
M: Hospital Address
N: City
O: Contact Person
P: Email
Q: Fulfilled Date
R: Units Fulfilled ⭐ NOW ACTIVELY USED
S: Donors (Name & Contact)
T: Donor BG
U: Additional Information
```

### **Donation Log** (NEW SHEET - Auto-Created)
This sheet will be automatically created when the first donation is logged.

**Columns:**
```
A: Timestamp
B: Patient Name
C: Blood Type
D: Units Donated
E: Donor Type (relative/donor/other)
F: Donor Name
G: Donor Contact
H: Closure Reason (for "other" type)
```

**Purpose:** Maintains a complete history of all donations across all requests.

---

## 🚀 Deployment Steps

### Step 1: Open Google Apps Script
1. Open your Google Sheet: [Life Savers Donors Spreadsheet](https://docs.google.com/spreadsheets/d/1ZXoQBHZqrwoYaNHOf6LdQL0xkhSF0P_xeo19oI6-lkY)
2. Click **Extensions** → **Apps Script**

### Step 2: Replace Code
1. Delete all existing code in `Code.gs`
2. Copy the entire contents of `Code.gs` from this folder
3. Paste into the Apps Script editor

### Step 3: Save
1. Click the **Save** icon (💾) or press `Ctrl+S`
2. Give it a name: "Life Savers Donors - v2.0"

### Step 4: Deploy
1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description:** "Donation Logging System v2.0"
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
5. Click **Deploy**
6. **Authorize** the app (you may need to click "Advanced" → "Go to [project name]")
7. **Copy the Web App URL** - you'll need this for the frontend

### Step 5: Update Frontend
The Web App URL should remain the same:
```
https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec
```

If it changes, update it in:
- `scripts/emergency_request_system.js` (line 2)

---

## 🔌 API Endpoints

### 1. **GET** - Fetch Emergency Requests
**URL:** `[WEB_APP_URL]`

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "patientName": "John Doe",
      "bloodType": "O+",
      "unitsRequired": 3,
      "unitsFulfilled": 1,
      "unitsRemaining": 2,
      "status": "Open",
      ...
    }
  ],
  "statistics": {
    "total": 10,
    "open": 5,
    "verified": 3,
    "closed": 2
  }
}
```

### 2. **POST** - Log Donation (NEW)
**Action:** `log_donation`

**Request:**
```json
{
  "action": "log_donation",
  "data": {
    "patientName": "John Doe",
    "bloodType": "O+",
    "unitsDonated": 1,
    "donorType": "donor",
    "donorName": "Jane Smith",
    "donorContact": "9876543210"
  }
}
```

**Response (Partial):**
```json
{
  "success": true,
  "message": "Donation logged successfully! 2 unit(s) remaining.",
  "unitsFulfilled": 1,
  "unitsRequired": 3,
  "unitsRemaining": 2,
  "autoClosed": false,
  "newStatus": "Open"
}
```

**Response (Fulfilled):**
```json
{
  "success": true,
  "message": "Donation logged and request closed successfully!",
  "unitsFulfilled": 3,
  "unitsRequired": 3,
  "unitsRemaining": 0,
  "autoClosed": true,
  "newStatus": "Closed"
}
```

**Error (Over-donation):**
```json
{
  "success": false,
  "message": "Cannot donate 3 units. Only 2 units remaining."
}
```

### 3. **POST** - Update Status (Verify)
**Action:** `update_status`

**Request:**
```json
{
  "action": "update_status",
  "data": {
    "patientName": "John Doe",
    "bloodType": "O+",
    "status": "Verified"
  }
}
```

### 4. **POST** - Update Request (Edit)
**Action:** `update_request`

**Request:**
```json
{
  "action": "update_request",
  "data": {
    "originalContactNumber": "9876543210",
    "patientName": "John Doe Updated",
    "contactNumber": "9876543210",
    "unitsRequired": 4,
    ...
  }
}
```

### 5. **POST** - Submit New Request
**No action parameter** (default behavior)

**Request:**
```json
{
  "data": {
    "patientName": "John Doe",
    "contactNumber": "9876543210",
    "bloodType": "O+",
    "hospitalName": "City Hospital",
    "unitsRequired": 3,
    ...
  }
}
```

---

## 🧪 Testing

### Test 1: Log First Donation
1. Open emergency request system page
2. Click "Log Donation" on a request requiring 3 units
3. Select "Donor", enter name and contact
4. Enter 1 unit donated
5. Submit
6. **Expected:** Request shows "1/3 units fulfilled", remains open

### Test 2: Log Second Donation
1. Click "Log Donation" again on same request
2. Select "Relative"
3. Enter 1 unit donated
4. Submit
5. **Expected:** Request shows "2/3 units fulfilled", still open

### Test 3: Complete Fulfillment (Auto-Close)
1. Click "Log Donation" again
2. Select "Donor", enter details
3. Enter 1 unit donated
4. Submit
5. **Expected:** Request shows "3/3 units fulfilled", status = "Closed", button disabled

### Test 4: Over-Donation Prevention
1. On a request with 2 units remaining
2. Try to log 3 units
3. **Expected:** Error message: "Cannot donate 3 units. Only 2 units remaining."

### Test 5: "Other" Closure
1. Click "Log Donation"
2. Select "Other"
3. Enter reason: "Patient discharged"
4. Submit
5. **Expected:** Request closed immediately, reason logged

### Test 6: Donation Log Sheet
1. After logging several donations
2. Check for "Donation Log" sheet in your spreadsheet
3. **Expected:** All donations listed with timestamps, donor details, units

---

## 📊 Data Flow

```
User clicks "Log Donation"
    ↓
Frontend shows popup (donor type, units, details)
    ↓
User submits donation info
    ↓
POST to Google Apps Script (action=log_donation)
    ↓
Script validates:
    - Units donated > 0
    - Units donated <= units remaining
    - Donor name required if type="donor"
    ↓
Script updates "Form Responses 1":
    - Column R: Units Fulfilled += units donated
    - Column S: Donors list (append)
    ↓
Script logs to "Donation Log" sheet
    ↓
Script checks: Units Fulfilled >= Units Required?
    ↓
    YES → Auto-close request (Status="Closed", Fulfilled Date=NOW)
    NO  → Keep open, return units remaining
    ↓
If donor type="donor" → Save to "Donors" sheet
    ↓
Return success response with updated counts
    ↓
Frontend updates UI:
    - Show "X/Y units fulfilled"
    - If closed: Disable button, show "Closed"
    - If open: Keep button active
```

---

## 🔍 Troubleshooting

### Issue: "Request not found"
**Cause:** Patient name or blood type doesn't match exactly
**Solution:** Check for extra spaces, case sensitivity in sheet

### Issue: "Cannot donate X units. Only Y units remaining."
**Cause:** Trying to donate more than needed
**Solution:** Reduce units donated to match remaining units

### Issue: "Donor name is required"
**Cause:** Selected "Donor" type but didn't enter name
**Solution:** Enter donor name or select "Relative"/"Other"

### Issue: Donation Log sheet not created
**Cause:** First donation hasn't been logged yet
**Solution:** Log at least one donation, sheet will auto-create

### Issue: Duplicate donors in Donors sheet
**Cause:** Same donor logged multiple times
**Solution:** Script automatically updates existing donor record (by name + contact)

---

## 📝 Column R Migration

**Important:** Existing requests in your sheet may have empty values in Column R (Units Fulfilled).

**What happens:**
- Script treats empty as `0`
- First donation will set it to the donated amount
- No data loss or corruption

**Manual Fix (Optional):**
If you want to set existing closed requests to their fulfilled amounts:
1. Open your sheet
2. For closed requests, set Column R = Column E (Units Required)
3. This is cosmetic only - not required for functionality

---

## 🎯 Next Steps

After deploying this script, you'll need to update the frontend JavaScript to:
1. Replace "Close" button with "Log Donation" button
2. Create the donation logging popup
3. Handle the new API response format
4. Display units fulfilled/remaining on cards

Would you like me to proceed with the frontend implementation?

---

## 📞 Support

If you encounter any issues:
1. Check the Apps Script logs: **Executions** tab in Apps Script editor
2. Verify sheet names: "Form Responses 1", "Donors"
3. Check column positions match the layout above
4. Ensure Web App is deployed with "Anyone" access

---

**Version:** 2.0  
**Last Updated:** 2025-11-25  
**Author:** Life Savers United Development Team
