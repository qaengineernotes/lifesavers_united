# Quick Reference: Donation Logging System Changes

## 🔄 What Changed

### Google Apps Script (Backend)

| Feature | Before | After |
|---------|--------|-------|
| **Close Request** | Single action, collects one donor | Multiple donations tracked separately |
| **Telegram Integration** | ✅ Included | ❌ Removed completely |
| **Units Tracking** | Not tracked | ✅ Column R actively used |
| **Partial Donations** | ❌ Not supported | ✅ Fully supported |
| **Auto-Close** | Manual only | ✅ Auto when fulfilled |
| **Donation History** | Only in Column S | ✅ Separate "Donation Log" sheet |
| **Over-Donation** | No validation | ✅ Prevents over-donation |

---

## 📊 New API Endpoint

### `action=log_donation`

**Purpose:** Log a blood donation (partial or full)

**Parameters:**
```javascript
{
  patientName: "John Doe",      // Required
  bloodType: "O+",              // Required
  unitsDonated: 1,              // Required, must be > 0
  donorType: "donor",           // Required: "relative", "donor", or "other"
  donorName: "Jane Smith",      // Required if donorType="donor"
  donorContact: "9876543210",   // Optional
  closureReason: "Discharged"   // Optional, for donorType="other"
}
```

**Response (Success - Partial):**
```javascript
{
  success: true,
  message: "Donation logged successfully! 2 unit(s) remaining.",
  unitsFulfilled: 1,
  unitsRequired: 3,
  unitsRemaining: 2,
  autoClosed: false,
  newStatus: "Open"
}
```

**Response (Success - Fulfilled):**
```javascript
{
  success: true,
  message: "Donation logged and request closed successfully!",
  unitsFulfilled: 3,
  unitsRequired: 3,
  unitsRemaining: 0,
  autoClosed: true,
  newStatus: "Closed"
}
```

**Response (Error - Over-donation):**
```javascript
{
  success: false,
  message: "Cannot donate 3 units. Only 2 units remaining."
}
```

**Response (Error - Missing donor name):**
```javascript
{
  success: false,
  message: "Donor name is required when donor type is \"Donor\""
}
```

---

## 🗂️ Sheet Changes

### Form Responses 1
**Column R (Units Fulfilled):**
- **Before:** Empty/unused
- **After:** Actively tracks donated units
- **Default:** 0 for new requests
- **Updates:** Increments with each donation

**Column S (Donors):**
- **Before:** Single donor entry
- **After:** Pipe-separated list with units
- **Format:** `Donor Name (X units) | Relative (Y units) | ...`

### New Sheet: Donation Log
**Auto-created** on first donation

**Tracks:**
- Every donation separately
- Timestamp of each donation
- Donor details per donation
- Units per donation
- Closure reasons

---

## 🎯 User Workflow Changes

### Before (Old System)
```
1. Click "Close Request"
2. Enter password
3. Select donor type (Relative/Donor/Other)
4. If Donor: Enter ONE donor's details
5. Request closes immediately
```

### After (New System)
```
1. Click "Log Donation"
2. Enter password
3. Select units donated (1, 2, 3, custom)
4. Select donor type (Relative/Donor/Other)
5. If Donor: Enter donor details
6. If Other: Enter closure reason
7. Submit
8. Request stays open if units remaining > 0
9. Request auto-closes if units fulfilled >= units required
10. Repeat steps 1-9 for each new donor
```

---

## 🔐 Validation Rules

| Rule | Description | Error Message |
|------|-------------|---------------|
| **Units > 0** | Must donate at least 1 unit | "Units donated must be greater than 0" |
| **No Over-donation** | Cannot exceed remaining units | "Cannot donate X units. Only Y units remaining." |
| **Donor Name Required** | If type="donor", name is mandatory | "Donor name is required when donor type is \"Donor\"" |
| **Patient/Blood Match** | Must find matching request | "Request not found for patient: X, blood type: Y" |

---

## 📈 Data Examples

### Example 1: Three Separate Donations

**Initial Request:**
- Patient: John Doe
- Blood Type: O+
- Units Required: 3
- Units Fulfilled: 0

**Donation 1 (Day 1):**
- Donor: Jane Smith (9876543210)
- Units: 1
- Result: 1/3 fulfilled, status=Open

**Donation 2 (Day 3):**
- Donor: Relative
- Units: 1
- Result: 2/3 fulfilled, status=Open

**Donation 3 (Day 5):**
- Donor: Mike Johnson (9123456789)
- Units: 1
- Result: 3/3 fulfilled, status=Closed (auto)

**Final Column S:**
```
Jane Smith, 9876543210 (1 unit) | Relative (1 unit) | Mike Johnson, 9123456789 (1 unit)
```

### Example 2: Partial + Other Closure

**Initial Request:**
- Units Required: 3
- Units Fulfilled: 0

**Donation 1:**
- Donor: Sarah Lee
- Units: 1
- Result: 1/3 fulfilled, status=Open

**Donation 2 (Other):**
- Type: Other
- Reason: Patient discharged
- Units: 0
- Result: 1/3 fulfilled, status=Closed (manual)

---

## 🚨 Important Notes

### 1. **Column R is Critical**
- Do NOT delete or modify Column R
- Script relies on this for tracking
- Empty = 0 (safe default)

### 2. **Donation Log Sheet**
- Auto-created on first donation
- Do NOT rename or delete
- Provides complete audit trail

### 3. **Backward Compatibility**
- Existing requests work fine
- Empty Column R treated as 0
- First donation will initialize it

### 4. **Auto-Close Behavior**
- Triggers when: `Units Fulfilled >= Units Required`
- Sets: Status="Closed", Fulfilled Date=NOW
- Irreversible (unless manually reopened)

### 5. **"Other" Type Special Case**
- Closes request immediately
- Does NOT require full fulfillment
- Use for: Patient died, discharged, transferred, etc.

---

## 🔧 Frontend Integration Checklist

- [ ] Replace "Close" button with "Log Donation"
- [ ] Create donation popup with:
  - [ ] Units selector (1, 2, 3, custom)
  - [ ] Donor type radio buttons
  - [ ] Conditional donor details form
  - [ ] Closure reason field (for "Other")
- [ ] Update card display to show:
  - [ ] Units Fulfilled / Units Required
  - [ ] Units Remaining (if > 0)
  - [ ] Progress indicator (optional)
- [ ] Handle new API response format
- [ ] Show appropriate success messages
- [ ] Handle error messages (over-donation, etc.)
- [ ] Disable "Log Donation" when closed
- [ ] Update refresh logic to show new units data

---

## 📞 Testing Checklist

- [ ] Log 1 unit donation (partial)
- [ ] Log multiple donations on same request
- [ ] Complete fulfillment (auto-close)
- [ ] Try over-donation (should error)
- [ ] Log donation without donor name (should error)
- [ ] Use "Relative" donor type
- [ ] Use "Other" closure type
- [ ] Verify Donation Log sheet created
- [ ] Verify donor saved to Donors sheet
- [ ] Check Column R updates correctly
- [ ] Check Column S formats correctly
- [ ] Verify auto-close sets Fulfilled Date

---

**Ready to deploy?** Follow the steps in `DEPLOYMENT_GUIDE.md`
