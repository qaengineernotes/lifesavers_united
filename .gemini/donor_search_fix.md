# Donor Search Issue - Fixed

## Problem Summary
**Issue:** Kushal Mehta (8460161016) was registered in the database but not appearing in the frontend donor search.

## Root Cause Analysis

### 1. **Missing Field in Query**
The donors page (`scripts/donors.js`) was using a Firestore query with `orderBy('registeredAt', 'desc')`:

```javascript
const q = query(donorsRef, orderBy('registeredAt', 'desc'));
```

**Problem:** Firestore queries with `orderBy` on a field will **exclude all documents that don't have that field**.

### 2. **Inconsistent Field Names**
Donors created through different flows had different timestamp fields:
- **Donor Registration Form**: Sets `registeredAt`
- **Donation Logging**: Only set `createdAt` (not `registeredAt`)

### 3. **Result**
Kushal Mehta's donor record (created via donation logging) had:
- ✅ `createdAt`: February 8, 2026
- ✅ `createdBy`: "Nikunj Mistri"
- ❌ `registeredAt`: **MISSING**

This caused the donor to be **excluded from the query results**, making them invisible in the search.

---

## Solution Implemented

### Fix 1: Updated Donor Loading Query (`scripts/donors.js`)
**Changed from:**
```javascript
const q = query(donorsRef, orderBy('registeredAt', 'desc'));
const snapshot = await getDocs(q);
```

**Changed to:**
```javascript
// Fetch ALL donors without field requirement
const snapshot = await getDocs(donorsRef);

// Sort in memory using registeredAt OR createdAt as fallback
allDonors.sort((a, b) => {
    const getTimestamp = (donor) => {
        const regAt = donor.registeredAt;
        const createdAt = donor.createdAt;
        
        if (regAt) {
            return regAt.seconds ? regAt.seconds : new Date(regAt).getTime() / 1000;
        } else if (createdAt) {
            return createdAt.seconds ? createdAt.seconds : new Date(createdAt).getTime() / 1000;
        }
        return 0;
    };
    
    return getTimestamp(b) - getTimestamp(a); // Newest first
});
```

### Fix 2: Updated Statistics Calculation
Changed the "New This Month" calculation to use `registeredAt || createdAt`:

```javascript
const newThisMonth = allDonors.filter(d => {
    // Use registeredAt if available, otherwise use createdAt
    const regDate = d.registeredAt || d.createdAt;
    if (!regDate) return false;
    const dateObj = regDate.seconds
        ? new Date(regDate.seconds * 1000)
        : new Date(regDate);
    return dateObj >= thisMonth;
}).length;
```

### Fix 3: Updated Display Fields
Updated the "Registered Date" column and modal to use fallback:

```javascript
// Table display
const regDate = donor.registeredAt || donor.createdAt;
const registered = regDate
    ? `<div>${formatDateTime(regDate)}<br><small>${getTimeAgo(regDate)}</small></div>`
    : 'N/A';

// Modal display
<div class="info-value">${formatDateTime(donor.registeredAt || donor.createdAt)}</div>
```

### Fix 4: Future-Proof Donor Creation (`scripts/firebase-data-service.js`)
Added `registeredAt` field when creating new donors during donation logging:

```javascript
const donorData = {
    fullName: donationInfo.donorName,
    contactNumber: donationInfo.donorContact,
    bloodGroup: bloodGroupToStore,
    lastDonatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser?.displayName || 'System'
};

// Add createdAt and registeredAt only for new donors
if (!donorExists) {
    donorData.createdAt = serverTimestamp();
    donorData.registeredAt = serverTimestamp();
    donorData.createdBy = currentUser?.displayName || 'System';
}

await setDoc(donorRef, donorData, { merge: true });
```

---

## Impact

### ✅ Immediate Benefits
1. **Kushal Mehta is now searchable** - All existing donors without `registeredAt` will now appear
2. **Accurate statistics** - "New This Month" count includes all donors
3. **Consistent display** - Registered date shows correctly for all donors

### ✅ Future Benefits
1. **New donors created via donation logging** will have both `createdAt` and `registeredAt`
2. **No more missing donors** in search results
3. **Backward compatible** - Works with both old and new donor records

---

## Testing Checklist

- [ ] Refresh the donors page and search for "Kushal Mehta"
- [ ] Verify Kushal Mehta appears in search results
- [ ] Check that the registered date displays correctly
- [ ] Verify statistics are accurate
- [ ] Test creating a new donor via donation logging
- [ ] Confirm new donor appears immediately in search

---

## Files Modified

1. `scripts/donors.js` - Updated query, sorting, statistics, and display
2. `scripts/firebase-data-service.js` - Added `registeredAt` field to new donors

---

## Database State

### Existing Donors (like Kushal Mehta)
- **No database migration needed**
- The code now handles missing `registeredAt` field gracefully
- Uses `createdAt` as fallback

### Future Donors
- Will have both `createdAt` and `registeredAt` fields
- Fully compatible with search and statistics

---

**Status:** ✅ **FIXED** - Ready to test
