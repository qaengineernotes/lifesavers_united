# Units Required Field - Fix Summary

## Issue
The "Units Required" field was not showing the exact value from the Excel sheet when displaying requests or sharing them. For example:
- Excel shows: "1 Blood - 1 SDP" 
- System was showing: "1 Units" or "1 unit"

## Root Cause
The system was using `requestData.unitsRequired` (which is parsed as a number) instead of `requestData.unitsRequiredText` (which contains the exact text from Excel).

## Changes Made

### 1. Emergency Request System (emergency_request_system.js)

#### Request Card Display (Already Fixed)
- Lines 355-358: Already had logic to use `unitsRequiredText` when available
- This ensures the request cards show the exact value from Excel

#### Copy Function
- Line 1658: Updated to use `requestData.unitsRequiredText || requestData.unitsRequired`
- Now when copying request details, it shows the exact Excel value

#### Twitter Sharing Function
- Line 2297: Updated to use `requestData.unitsRequiredText || requestData.unitsRequired`
- Line 2307: Removed automatic "unit/units" suffix addition
- Now shows exact value like "1 Blood - 1 SDP" instead of "1 unit of B+"

#### Social Media Sharing Function
- Line 2356: Updated to use `requestData.unitsRequiredText || requestData.unitsRequired`
- Line 2366: Removed automatic "unit/units" suffix addition
- Now shows exact value in all social media shares

### 2. Poster Generator (poster-generator.js)

#### Poster Badge Display
- Line 148: Updated to use `requestData.unitsRequiredText || requestData.unitsRequired`
- Line 167: Changed from `${units} UNITS REQUIRED` to just `${units}`
- Now the poster shows the exact value from Excel (e.g., "1 Blood - 1 SDP")

#### WhatsApp Message Generator
- Line 294: Updated to use `requestData.unitsRequiredText || requestData.unitsRequired`
- Now WhatsApp messages show the exact Excel value

## How It Works

The system now follows this logic:
1. **Primary**: Use `unitsRequiredText` if available (exact value from Excel)
2. **Fallback**: Use `unitsRequired` if `unitsRequiredText` is not available
3. **Default**: Use a default value if neither is available

## Examples

### Before Fix
- Excel: "1 Blood - 1 SDP"
- Display: "1 Units"
- Share: "1 unit of B+"
- Poster: "1 UNITS REQUIRED"

### After Fix
- Excel: "1 Blood - 1 SDP"
- Display: "1 Blood - 1 SDP"
- Share: "1 Blood - 1 SDP of B+"
- Poster: "1 Blood - 1 SDP"

### Simple Numeric Values Still Work
- Excel: "2"
- Display: "2"
- Share: "2 of B+"
- Poster: "2"

## Testing Recommendations

1. Test with complex unit values like "1 Blood - 1 SDP"
2. Test with simple numeric values like "2"
3. Test all sharing options:
   - Copy to clipboard
   - Share to WhatsApp
   - Share to Twitter
   - Generate poster
4. Verify the request card displays correctly
5. Verify the edit request popup shows the correct value

## Backend Requirements

The Google Apps Script backend must send both fields:
- `unitsRequired`: Numeric value for calculations
- `unitsRequiredText`: Exact text from Excel for display

This ensures backward compatibility while supporting complex unit descriptions.
