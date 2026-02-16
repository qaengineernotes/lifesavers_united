/**
 * Phone Number Normalization Utility
 * 
 * Normalizes phone numbers to a consistent 10-digit format
 * by removing country codes, spaces, and special characters.
 * 
 * Examples:
 * - "94283 54534" → "9428354534"
 * - "+91 94283 54534" → "9428354534"
 * - "+919428354534" → "9428354534"
 * - "9428354534" → "9428354534"
 */

/**
 * Normalize a phone number to 10-digit format
 * @param {string} phoneNumber - The phone number to normalize
 * @returns {string} - Normalized 10-digit phone number
 */
export function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
        return '';
    }

    // Convert to string and trim whitespace
    let normalized = String(phoneNumber).trim();

    // Remove all non-digit characters (spaces, +, -, (, ), etc.)
    normalized = normalized.replace(/\D/g, '');

    // Remove country code if present
    // Indian country code is 91
    // If the number starts with 91 and has more than 10 digits, remove the 91
    if (normalized.startsWith('91') && normalized.length > 10) {
        normalized = normalized.substring(2);
    }

    // If the number still has more than 10 digits, take the last 10 digits
    // This handles cases like "00919428354534"
    if (normalized.length > 10) {
        normalized = normalized.slice(-10);
    }

    return normalized;
}

/**
 * Validate if a normalized phone number is valid
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidPhoneNumber(phoneNumber) {
    const normalized = normalizePhoneNumber(phoneNumber);

    // Check if it's exactly 10 digits and starts with a valid digit (6-9 for Indian mobile numbers)
    return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Format a phone number for display (adds spaces for readability)
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted phone number (e.g., "94283 54534")
 */
export function formatPhoneNumberForDisplay(phoneNumber) {
    const normalized = normalizePhoneNumber(phoneNumber);

    if (normalized.length === 10) {
        // Format as: XXXXX XXXXX
        return `${normalized.substring(0, 5)} ${normalized.substring(5)}`;
    }

    return normalized;
}
