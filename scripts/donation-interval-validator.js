/**
 * LifeSavers United - Donation Interval Validator & Eligibility Engine
 * 
 * Clinical rules based on DGHS (Directorate General of Health Services) &
 * NBTC (National Blood Transfusion Council) India guidelines.
 */

import { normalizePhoneNumber } from './phone-normalizer.js';

// Mandatory minimum gap in days between donation types
// [Previous Donation Type] -> [Next Allowed Donation Type]
export const INTERVAL_MATRIX = {
    whole_blood: {
        platelets_sdp: 28,  // At least 28 days after whole blood before plateletpheresis
        plasma: 28,         // At least 28 days after whole blood before plasmapheresis
        whole_blood_male: 90,   // 3 months (90 days) for men
        whole_blood_female: 120 // 4 months (120 days) for women
    },
    platelets_sdp: {
        platelets_sdp: 14,  // 14 days between plateletpheresis
        plasma: 28,         // 28 days
        whole_blood: 28     // 28 days after plateletpheresis before whole blood
    },
    plasma: {
        platelets_sdp: 28,
        plasma: 28,
        whole_blood: 28
    },
    prbc: {
        platelets_sdp: 28,
        plasma: 28,
        whole_blood: 90
    }
};

// Maximum donations allowed within a rolling 365-day window
export const ANNUAL_LIMITS = {
    whole_blood_male: 4,     // Max 4 times a year for men
    whole_blood_female: 3,   // Max 3 times a year for women
    platelets_sdp: 24,       // Max 24 times a year
    plasma: 24
};

/**
 * Standardize donation type string
 */
export function normalizeDonationType(type) {
    if (!type) return 'whole_blood';
    const clean = String(type).toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (clean.includes('platelet') || clean === 'sdp') return 'platelets_sdp';
    if (clean.includes('plasma')) return 'plasma';
    if (clean.includes('prbc') || clean.includes('packed')) return 'prbc';
    return 'whole_blood';
}

/**
 * Get display label for donation type
 */
export function getDonationTypeLabel(type) {
    const norm = normalizeDonationType(type);
    switch (norm) {
        case 'platelets_sdp':
            return 'Single Donor Platelets (SDP)';
        case 'plasma':
            return 'Plasma';
        case 'prbc':
            return 'Packed Red Blood Cells (PRBC)';
        case 'whole_blood':
        default:
            return 'Whole Blood';
    }
}

/**
 * Convert Firestore Timestamp, string, or Date to JavaScript Date object
 */
export function toDateObj(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get required cooldown days between two donation types
 */
export function getRequiredCooldownDays(prevType, nextType, gender = 'male') {
    const pType = normalizeDonationType(prevType);
    const nType = normalizeDonationType(nextType);
    const isFemale = String(gender).toLowerCase().startsWith('f');

    if (pType === 'whole_blood' || pType === 'prbc') {
        if (nType === 'whole_blood' || nType === 'prbc') {
            return isFemale ? INTERVAL_MATRIX.whole_blood.whole_blood_female : INTERVAL_MATRIX.whole_blood.whole_blood_male;
        }
        return INTERVAL_MATRIX.whole_blood[nType] || 28;
    }

    if (pType === 'platelets_sdp') {
        if (nType === 'platelets_sdp') return INTERVAL_MATRIX.platelets_sdp.platelets_sdp;
        return INTERVAL_MATRIX.platelets_sdp[nType] || 28;
    }

    if (pType === 'plasma') {
        return INTERVAL_MATRIX.plasma[nType] || 28;
    }

    return isFemale ? 120 : 90;
}

/**
 * Format date to human-readable Indian format: DD MMM YYYY (e.g. 15 Aug 2026)
 */
export function formatDateReadable(date) {
    const d = toDateObj(date);
    if (!d) return 'N/A';
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Validates a proposed donation against existing donations list
 * 
 * @param {Date|string} proposedDate - The date the donor wants to log
 * @param {string} proposedType - The type of blood donation
 * @param {Array} existingDonations - List of existing donation log objects
 * @param {string} gender - 'male' | 'female'
 * @param {string|null} excludeDonationId - If editing, exclude this donation ID from conflict checks
 * 
 * @returns {{ isValid: boolean, errorReason?: string, earliestAllowedDate?: Date }}
 */
export function validateDonationInterval(proposedDate, proposedType, existingDonations = [], gender = 'male', excludeDonationId = null) {
    const pDate = toDateObj(proposedDate);
    if (!pDate) {
        return { isValid: false, errorReason: 'Please enter a valid donation date.' };
    }

    // Rule 1: No Future Dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (pDate.getTime() > today.getTime()) {
        return { isValid: false, errorReason: 'Donation date cannot be in the future.' };
    }

    const normProposedType = normalizeDonationType(proposedType);
    const isFemale = String(gender).toLowerCase().startsWith('f');

    // Filter and sort active existing donations
    const activeDonations = (existingDonations || [])
        .filter(d => !excludeDonationId || d.id !== excludeDonationId)
        .map(d => ({
            ...d,
            dateObj: toDateObj(d.donatedAt || d.timestamp || d.date)
        }))
        .filter(d => d.dateObj !== null)
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Normalize proposed date time to midnight for exact day comparison
    const pTime = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();

    // Rule 2: Annual Rolling 12-Month Limits
    const oneYearBeforeProposed = new Date(pTime - (365 * 24 * 60 * 60 * 1000));
    const donationsInRollingYear = activeDonations.filter(d => 
        d.dateObj.getTime() >= oneYearBeforeProposed.getTime() && 
        d.dateObj.getTime() <= pTime
    );

    if (normProposedType === 'whole_blood' || normProposedType === 'prbc') {
        const wbCount = donationsInRollingYear.filter(d => {
            const t = normalizeDonationType(d.donationType);
            return t === 'whole_blood' || t === 'prbc';
        }).length;

        const maxAllowed = isFemale ? ANNUAL_LIMITS.whole_blood_female : ANNUAL_LIMITS.whole_blood_male;
        if (wbCount >= maxAllowed) {
            return {
                isValid: false,
                errorReason: `Annual Safety Limit Reached: You already have ${wbCount} whole blood donations in this 12-month period. Medical guidelines recommend a maximum of ${maxAllowed} whole blood donations per year to protect your iron stores.`
            };
        }
    } else if (normProposedType === 'platelets_sdp') {
        const sdpCount = donationsInRollingYear.filter(d => normalizeDonationType(d.donationType) === 'platelets_sdp').length;
        if (sdpCount >= ANNUAL_LIMITS.platelets_sdp) {
            return {
                isValid: false,
                errorReason: `Annual Safety Limit Reached: You have reached the maximum safe clinical limit of 24 platelet (SDP) donations in a 12-month period.`
            };
        }
    }

    // Rule 3: Forward and Backward Interval Conflict Checks
    for (const d of activeDonations) {
        const existingTime = new Date(d.dateObj.getFullYear(), d.dateObj.getMonth(), d.dateObj.getDate()).getTime();
        const existingType = normalizeDonationType(d.donationType);

        // Same-day check
        if (pTime === existingTime) {
            return {
                isValid: false,
                errorReason: `A donation (${getDonationTypeLabel(existingType)}) is already recorded on ${formatDateReadable(d.dateObj)}. You cannot log multiple donations on the same day.`
            };
        }

        // Case A: Existing donation occurred BEFORE proposed date (Forward check)
        if (existingTime < pTime) {
            const daysDiff = Math.round((pTime - existingTime) / (1000 * 60 * 60 * 24));
            const reqGap = getRequiredCooldownDays(existingType, normProposedType, gender);

            if (daysDiff < reqGap) {
                const earliestDate = new Date(existingTime + (reqGap * 24 * 60 * 60 * 1000));
                return {
                    isValid: false,
                    earliestAllowedDate: earliestDate,
                    errorReason: `Medical Cooldown Restriction: You have a ${getDonationTypeLabel(existingType)} recorded on ${formatDateReadable(d.dateObj)}. A mandatory gap of ${reqGap} days is required before donating ${getDonationTypeLabel(normProposedType)}. Earliest allowed date is ${formatDateReadable(earliestDate)}.`
                };
            }
        }

        // Case B: Existing donation occurred AFTER proposed date (Backward backfill check)
        if (existingTime > pTime) {
            const daysDiff = Math.round((existingTime - pTime) / (1000 * 60 * 60 * 24));
            const reqGap = getRequiredCooldownDays(normProposedType, existingType, gender);

            if (daysDiff < reqGap) {
                return {
                    isValid: false,
                    errorReason: `Medical Cooldown Conflict: You have a subsequent donation (${getDonationTypeLabel(existingType)}) on ${formatDateReadable(d.dateObj)}. Logging ${getDonationTypeLabel(normProposedType)} on ${formatDateReadable(pDate)} violates the required ${reqGap}-day recovery interval.`
                };
            }
        }
    }

    return { isValid: true };
}

/**
 * Checks whether a Thank-You email should be sent (within 7 days of today)
 */
export function shouldSendThankYouEmail(donationDate) {
    const d = toDateObj(donationDate);
    if (!d) return false;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return false; // future date, invalid anyway

    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
}

/**
 * Calculate multi-type eligibility dates and days remaining based on latest donation
 */
export function calculateEligibilityDates(lastDonationDate, lastDonationType = 'whole_blood', gender = 'male') {
    const lastDate = toDateObj(lastDonationDate);
    if (!lastDate) {
        // If never donated, donor is eligible for all types today
        return {
            hasDonated: false,
            wholeBlood: { eligibleDate: new Date(), daysRemaining: 0, isEligible: true, formattedDate: formatDateReadable(new Date()) },
            platelets: { eligibleDate: new Date(), daysRemaining: 0, isEligible: true, formattedDate: formatDateReadable(new Date()) },
            plasma: { eligibleDate: new Date(), daysRemaining: 0, isEligible: true, formattedDate: formatDateReadable(new Date()) }
        };
    }

    const normType = normalizeDonationType(lastDonationType);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const wbGap = getRequiredCooldownDays(normType, 'whole_blood', gender);
    const sdpGap = getRequiredCooldownDays(normType, 'platelets_sdp', gender);
    const plasmaGap = getRequiredCooldownDays(normType, 'plasma', gender);

    const lastDateMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

    const calcFor = (gapDays) => {
        const eligibleDate = new Date(lastDateMidnight.getFullYear(), lastDateMidnight.getMonth(), lastDateMidnight.getDate() + gapDays);
        const diffMs = eligibleDate.getTime() - todayMidnight.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
            eligibleDate,
            daysRemaining,
            isEligible: daysRemaining <= 0,
            formattedDate: formatDateReadable(eligibleDate)
        };
    };

    return {
        hasDonated: true,
        lastDonationDate: lastDate,
        lastDonationType: normType,
        wholeBlood: calcFor(wbGap),
        platelets: calcFor(sdpGap),
        plasma: calcFor(plasmaGap)
    };
}
