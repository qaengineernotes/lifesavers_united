# Phone Number Normalization Implementation

## Overview
This document describes the phone number normalization implementation across the LifeSavers United application.

## Problem Statement
Phone numbers were being stored in various formats:
- With spaces: "94283 54534"
- With country code and spaces: "+91 94283 54534"
- With country code, no spaces: "+919428354534"
- Plain 10-digit: "9428354534"

This inconsistency made it difficult to:
- Search for requests by phone number
- Prevent duplicate entries
- Match donors with requests

## Solution
Implemented a consistent phone number normalization that:
1. Removes all non-digit characters (spaces, +, -, (, ), etc.)
2. Removes Indian country code (+91 or 91) if present
3. Stores only the 10-digit mobile number

## Implementation Details

### 1. JavaScript Utility (`scripts/phone-normalizer.js`)
Created a reusable utility module with three functions:
- `normalizePhoneNumber(phoneNumber)` - Main normalization function
- `isValidPhoneNumber(phoneNumber)` - Validates if normalized number is valid
- `formatPhoneNumberForDisplay(phoneNumber)` - Formats for display (XXXXX XXXXX)

### 2. Telegram Bot (`functions/index.js`)
- Added `normalizePhoneNumber()` function
- Applied normalization in `parseRequestText()` after parsing contact number
- All phone numbers from Telegram are now normalized before storage

### 3. Emergency Blood Request Form (`scripts/emergency_blood_request.js`)
- Imported phone normalizer utility
- Applied normalization when collecting form data
- Contact numbers are normalized before Firebase/Google Sheets submission

### 4. Donor Registration Form (`scripts/donor_registration.js`)
- Imported phone normalizer utility
- Applied normalization when collecting form data
- Donor contact numbers are normalized before registration

### 5. Python Server (`server.py`)
- Added `normalize_phone_number()` function
- Applied normalization in three endpoints:
  - Donor registration (`/api/submit-donor-registration`)
  - Donor details from emergency system (`/api/submit-donor-details`)
  - Acts as a safety net for data coming through the local proxy

## Test Cases

### Input Examples and Expected Output
All of the following inputs should normalize to: `9428354534`

| Input Format | Example | Expected Output |
|--------------|---------|-----------------|
| With spaces | "94283 54534" | "9428354534" |
| With +91 and spaces | "+91 94283 54534" | "9428354534" |
| With +91, no spaces | "+919428354534" | "9428354534" |
| With 91, no + | "919428354534" | "9428354534" |
| Plain 10-digit | "9428354534" | "9428354534" |
| With dashes | "94283-54534" | "9428354534" |
| With parentheses | "(94283) 54534" | "9428354534" |
| International format | "0091 94283 54534" | "9428354534" |

### Edge Cases Handled
1. **Empty/null values**: Returns empty string
2. **Extra country codes**: Takes last 10 digits if length > 10
3. **Special characters**: All non-digits are removed
4. **Multiple spaces**: All whitespace is removed

## Validation
The `isValidPhoneNumber()` function checks:
- Exactly 10 digits after normalization
- Starts with valid digit (6-9 for Indian mobile numbers)

## Entry Points Covered
✅ Telegram Bot - Blood requests via Telegram
✅ Website Request Form - Emergency blood requests
✅ Donor Registration Form - New donor registration
✅ Python Local Server - Proxy for local development

## Database Impact
- **New entries**: All phone numbers will be stored in normalized format
- **Existing entries**: Will remain in their current format
- **Duplicate detection**: Will work better with normalized numbers
- **Search functionality**: More reliable phone number matching

## Migration Considerations
If you need to normalize existing phone numbers in the database:
1. Create a migration script
2. Read all documents with phone numbers
3. Apply normalization
4. Update documents

Example migration script structure:
```javascript
// For Firebase
const requests = await db.collection('emergency_requests').get();
requests.forEach(async (doc) => {
  const data = doc.data();
  if (data.contactNumber) {
    const normalized = normalizePhoneNumber(data.contactNumber);
    if (normalized !== data.contactNumber) {
      await doc.ref.update({ contactNumber: normalized });
    }
  }
});
```

## Testing Checklist
- [ ] Test Telegram bot with various phone formats
- [ ] Test emergency request form with different formats
- [ ] Test donor registration with different formats
- [ ] Verify Firebase storage shows normalized numbers
- [ ] Test duplicate detection with normalized numbers
- [ ] Test search functionality with normalized numbers

## Future Enhancements
1. Add country code support for international numbers
2. Add phone number validation on the UI
3. Display formatted numbers (with spaces) while storing normalized
4. Add migration script for existing data
