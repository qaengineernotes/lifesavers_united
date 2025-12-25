# Duplicate Request Logic Update - Implementation Summary

## Overview
Updated the duplicate request detection logic in `Code.gs` to prevent duplicate requests based on **Patient Name OR Contact Number** matches, checking against **ALL** existing requests (Open, Verified, and Closed).

## Changes Made

### 1. Updated `handleNewRequest` Function
- **Changed Matching Logic**:
  - **Old**: Required BOTH `Patient Name` AND `Contact Number` to match.
  - **New**: logical **OR** check. Matches if `Patient Name` is same OR `Contact Number` is same.
- **Expanded Search Scope**:
  - Now checks **ALL** requests in the sheet (Open, Verified, Closed).
- **Added Conflict Handling**:
  - If **Multiple Matches** are found (e.g., 2 different requests match the criteria), returns an error: `"Multiple requests found for this patient/contact. Please contact the admin."`.
- **Refined Single Match Handling**:
  - **If Open/Verified**: Returns error `"A blood request for this patient is already open (Name or Contact match)..."`.
  - **If Closed**: Calls `reopenClosedRequest` to reopen/update the existing request.

### 2. Added `findAllMatchingRequests` Helper Function
- New function to scan the entire sheet.
- **Normalizes Inputs**:
  - Names: Trimmed and Lowercased (`.toLowerCase().trim()`).
  - Contact Numbers: Stripped of non-digits (`.replace(/\D/g, '')`) for better matching (e.g., "987-654-3210" matches "9876543210").
- Returns an array of all matching request objects.

## Usage
- **Deploy**: Please **deploy this updated script** as a web app (New Version) for the changes to take effect.
- **Testing**:
  1. Submit a request with a Name that already exists (different phone) → Should be detected as duplicate.
  2. Submit a request with a Contact that already exists (different name) → Should be detected as duplicate.
  3. Submit a request with both matching → Should be detected as duplicate.
  4. Submit a completely new request → Should be created successfully.

## File Path
`google-apps-script/Code.gs`
