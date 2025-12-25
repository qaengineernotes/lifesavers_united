# Telegram Bot - Smart Field Update Summary

## 🎯 Changes Implemented

### **1. Smart Field Comparison**
The bot now compares old vs new values and **only shows fields that actually changed**.

### **2. Old → New Value Display**
Changed fields are shown in the format:
```
• Units Required: 2 Units → 1 SDP
• Hospital: Old Hospital → New Hospital
```

### **3. History Tracking**
All updates made via Telegram bot are now tracked in the request's history:
- **Type**: `UPDATED` or `REOPENED`
- **Changed Fields**: List of fields that were modified
- **User Info**: Telegram username, ID, and phone number
- **Timestamp**: When the change was made
- **Note**: Human-readable summary of changes

**Example History Entry:**
```javascript
{
    timestamp: "2025-12-25T10:00:00Z",
    type: "UPDATED",
    userName: "john_doe",
    userUid: "telegram_123456789",
    note: "Request updated via Telegram by john_doe. Changes: Hospital: Old → New, Units Required: 2 Units → 3 SDP",
    changedFields: ["Hospital: Old → New", "Units Required: 2 Units → 3 SDP"],
    telegramId: 123456789,
    phoneNumber: "+919876543210"
}
```

### **4. Duplicate Submission Handling**

| Scenario | Previous Status | Action | Message |
|----------|----------------|--------|---------|
| **No Changes + Closed** | Closed | Reopen | `🔄 Request Reopened`<br>`⚠️ No changes detected - reopened with same data` |
| **No Changes + Active** | Open/Verified/Reopened | None | `ℹ️ Request Already Exists`<br>`Status: [Current Status]`<br>`⚠️ No changes detected - no action taken` |
| **Changes + Closed** | Closed | Reopen & Update | `🔄 Request Reopened & Saved`<br>`📝 Updated fields:`<br>`• Field: old → new` |
| **Changes + Active** | Open/Verified/Reopened | Update | `✅ Request Updated & Saved`<br>`📝 Updated fields:`<br>`• Field: old → new` |

## 📝 Example Messages

### **Example 1: Only Hospital Name Changed (User Field)**
```
🔄 Request Reopened & Saved

✅ Database confirmed!
Patient: Aabhay Mishra
Document ID: aabhaymishra_9878987898_1766602966196

📝 Updated fields:
• Hospital: Namesl → Hospital
```

**Note:** System fields like `Units Fulfilled`, `Donor Summary`, `Donation Log Ids`, and `Reopen Count` are automatically reset when reopening but are **NOT shown** in the message since they weren't changed by the user.

### **Example 2: Multiple Fields Changed**
```
✅ Request Updated & Saved

✅ Database confirmed!
Patient: Aabhay Mishra
Document ID: aabhaymishra_9878987898_1766602966196

📝 Updated fields:
• Units Required: 2 Units → 1 SDP
• Hospital: Old Hospital → New Hospital Name
• Location: Old City → Asharva
```

### **Example 3: Exact Duplicate (Closed Request)**
```
🔄 Request Reopened

✅ Database confirmed!
Patient: Aabhay Mishra
Document ID: aabhaymishra_9878987898_1766602966196

⚠️ No changes detected - reopened with same data
```

### **Example 4: Exact Duplicate (Active Request)**
```
ℹ️ Request Already Exists

Patient: Aabhay Mishra
Document ID: aabhaymishra_9878987898_1766602966196
Status: Open

⚠️ No changes detected - no action taken
```

## 🔧 **Technical Details**

### **User-Submitted Fields (Compared for Changes):**
Only these fields are checked for changes and shown in the update message:
- Patient Name
- Age
- Blood Group
- Units Required
- Hospital
- Location
- Suffering From
- Contact Person
- Contact Number

### **System-Generated Fields (Excluded from Comparison):**
These fields are automatically managed by the system and **never shown** in update messages:
- Units Fulfilled (reset to 0 on reopen)
- Donor Summary (reset to "" on reopen)
- Donation Log Ids (reset to [] on reopen)
- Reopen Count (auto-incremented)
- updatedAt (timestamp)
- reopenedAt (timestamp)
- status (managed by system)
- submittedBy (preserved)
- source (preserved)
- createdAt (preserved)
- allDonationLogIds (history tracking)

### **Comparison Logic:**
- Converts both old and new values to strings
- Trims whitespace
- Case-sensitive comparison
- Empty/null values shown as "(empty)"

## 🚀 Deployment

To deploy these changes:
```bash
cd functions
firebase deploy --only functions:telegramBot
```

## ✅ Testing Checklist

- [ ] Test updating single field (e.g., Units Required)
- [ ] Test updating multiple fields
- [ ] Test exact duplicate on closed request (should reopen)
- [ ] Test exact duplicate on open request (should show already exists)
- [ ] Test exact duplicate on verified request (should show already exists)
- [ ] Verify old → new format displays correctly
- [ ] Verify empty values show as "(empty)"
