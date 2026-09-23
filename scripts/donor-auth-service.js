/**
 * LifeSavers United - Donor Authentication Service
 * 
 * Handles strict phone authentication restricted to registered donors only.
 */

import {
    auth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged,
    db,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    initAppCheck
} from './firebase-config.js';

import { signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

import { normalizePhoneNumber, formatPhoneNumberForDisplay } from './phone-normalizer.js';

const IS_LOCAL_DEV = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const TEST_DONOR_PHONE = '9000000000'; // Donor with past donation history
export const TEST_DONOR_PHONE_NEW = '9000000001'; // First-time donor (0 donations)
export const DEFAULT_TEST_OTP = '123456';

export const DEFAULT_TEST_DONOR = {
    id: 'test_donor_9000000000',
    fullName: 'Test Hero Donor',
    contactNumber: '9000000000',
    bloodGroup: 'O+',
    gender: 'Male',
    city: 'Ahmedabad',
    area: 'Navrangpura',
    email: 'testdonor@lifesaversunited.org',
    emergencyAvailable: 'Yes',
    registeredAt: '2025-01-01T00:00:00.000Z',
    isTestDonor: true
};

export const DEFAULT_TEST_FIRST_TIME_DONOR = {
    id: 'test_donor_9000000001',
    fullName: 'Priya Patel',
    contactNumber: '9000000001',
    bloodGroup: 'B+',
    gender: 'Female',
    city: 'Ahmedabad',
    area: 'Satellite',
    email: 'priyapatel@lifesaversunited.org',
    emergencyAvailable: 'Yes',
    registeredAt: '2026-03-01T00:00:00.000Z',
    isTestDonor: true,
    isFirstTime: true
};

let currentDonor = null;
let donorAuthListeners = [];
let confirmationResult = null;
let recaptchaVerifier = null;

/**
 * Check if a phone number is registered in the donors collection
 * @param {string} phoneNumber - Raw or normalized phone number
 * @returns {Promise<{ isRegistered: boolean, donorDoc?: object, donorId?: string }>}
 */
export async function checkDonorRegistration(phoneNumber) {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized || normalized.length !== 10) {
        return { isRegistered: false, error: 'Invalid 10-digit mobile number.' };
    }

    try {
        await initAppCheck();
        const donorsRef = collection(db, 'donors');
        const contactVariations = [
            normalized,
            '+91' + normalized,
            '91' + normalized,
            Number(normalized)
        ].filter(v => v !== undefined && !Number.isNaN(v));

        const q = query(donorsRef, where('contactNumber', 'in', contactVariations));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const donorDoc = snapshot.docs[0];
            const data = donorDoc.data();
            const isTest = Boolean(data.isTestDonor || (IS_LOCAL_DEV && (normalized === TEST_DONOR_PHONE || normalized === TEST_DONOR_PHONE_NEW)));
            return {
                isRegistered: true,
                donorId: donorDoc.id,
                donorData: {
                    id: donorDoc.id,
                    ...data,
                    isTestDonor: isTest
                }
            };
        }

        // Test donor bypass if not found in Firestore (Local Dev only)
        if (IS_LOCAL_DEV && normalized === TEST_DONOR_PHONE) {
            return {
                isRegistered: true,
                donorId: DEFAULT_TEST_DONOR.id,
                donorData: DEFAULT_TEST_DONOR
            };
        }
        if (IS_LOCAL_DEV && normalized === TEST_DONOR_PHONE_NEW) {
            return {
                isRegistered: true,
                donorId: DEFAULT_TEST_FIRST_TIME_DONOR.id,
                donorData: DEFAULT_TEST_FIRST_TIME_DONOR
            };
        }

        return { isRegistered: false };
    } catch (error) {
        console.error('Error checking donor registration:', error);
        // Fallback for test donor even if Firestore network error occurs (Local Dev only)
        if (IS_LOCAL_DEV && normalized === TEST_DONOR_PHONE) {
            return {
                isRegistered: true,
                donorId: DEFAULT_TEST_DONOR.id,
                donorData: DEFAULT_TEST_DONOR
            };
        }
        if (IS_LOCAL_DEV && normalized === TEST_DONOR_PHONE_NEW) {
            return {
                isRegistered: true,
                donorId: DEFAULT_TEST_FIRST_TIME_DONOR.id,
                donorData: DEFAULT_TEST_FIRST_TIME_DONOR
            };
        }
        throw error;
    }
}

/**
 * Setup or retrieve existing reCAPTCHA verifier for phone auth
 * @param {string} containerId - ID of the container element for reCAPTCHA
 */
export async function getOrCreateRecaptchaVerifier(containerId = 'recaptcha-container') {
    if (window.donorRecaptchaVerifier) {
        return window.donorRecaptchaVerifier;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`reCAPTCHA container #${containerId} not found.`);
        return null;
    }

    try {
        window.donorRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                console.log('✅ reCAPTCHA solved successfully');
            },
            'expired-callback': () => {
                console.warn('reCAPTCHA expired. Resetting...');
                resetRecaptcha();
            }
        });

        await window.donorRecaptchaVerifier.render();
        console.log('✅ Donor reCAPTCHA initialized and rendered.');
        return window.donorRecaptchaVerifier;
    } catch (err) {
        console.error('Failed to initialize reCAPTCHA verifier:', err);
        return null;
    }
}

/**
 * Reset reCAPTCHA widget on error without destroying the verifier
 */
export function resetRecaptcha() {
    if (window.donorRecaptchaVerifier) {
        try {
            window.donorRecaptchaVerifier.render().then(widgetId => {
                if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
                    grecaptcha.reset(widgetId);
                }
            }).catch(() => {});
        } catch (e) {
            console.warn('Error resetting reCAPTCHA:', e);
        }
    }
}

/**
 * Request Phone Auth OTP
 * Verifies donor registration first before requesting SMS OTP from Firebase.
 * 
 * @param {string} phoneNumber - 10-digit mobile number
 * @param {string} recaptchaContainerId
 * @returns {Promise<{ success: boolean, message?: string, isRegistered?: boolean, donorData?: object }>}
 */
export async function sendDonorOtp(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized || normalized.length !== 10) {
        return {
            success: false,
            message: 'Please enter a valid 10-digit mobile number.'
        };
    }

    // 1. Mandatory Pre-check: Is this number registered in the donors collection?
    const regCheck = await checkDonorRegistration(normalized);
    if (!regCheck.isRegistered) {
        return {
            success: false,
            isRegistered: false,
            message: 'This mobile number is not registered as a donor with LifeSavers United. Please register first to access your portal.'
        };
    }

    // 2. Setup reCAPTCHA & Request OTP
    try {
        // Test donor bypass for 9000000000 and 9000000001 with default OTP 123456 (Local Dev only)
        if (IS_LOCAL_DEV && (normalized === TEST_DONOR_PHONE || normalized === TEST_DONOR_PHONE_NEW)) {
            console.log(`🧪 Test donor bypass active for ${normalized} (Default OTP: ${DEFAULT_TEST_OTP})`);
            confirmationResult = {
                confirm: async (otp) => {
                    if (String(otp).trim() === DEFAULT_TEST_OTP) {
                        return {
                            user: {
                                uid: `test_donor_uid_${normalized}`,
                                phoneNumber: `+91${normalized}`
                            }
                        };
                    } else {
                        const err = new Error(`Incorrect verification code. For test donor ${normalized}, use default OTP ${DEFAULT_TEST_OTP}.`);
                        err.code = 'auth/invalid-verification-code';
                        throw err;
                    }
                }
            };

            return {
                success: true,
                isRegistered: true,
                donorData: regCheck.donorData,
                message: `OTP sent successfully to +91 ${formatPhoneNumberForDisplay(normalized)} (Test Mode: Default OTP is ${DEFAULT_TEST_OTP})`
            };
        }

        const verifier = await getOrCreateRecaptchaVerifier(recaptchaContainerId);
        if (!verifier) {
            throw new Error('reCAPTCHA verifier could not be initialized. Please refresh the page.');
        }

        const e164Number = '+91' + normalized;
        confirmationResult = await signInWithPhoneNumber(auth, e164Number, verifier);

        return {
            success: true,
            isRegistered: true,
            donorData: regCheck.donorData,
            message: `OTP sent successfully to +91 ${formatPhoneNumberForDisplay(normalized)}`
        };
    } catch (error) {
        console.error('Error sending OTP to donor:', error);
        resetRecaptcha();

        let msg = error.message || 'Failed to send OTP. Please try again.';
        if (error.code === 'auth/too-many-requests') {
            msg = 'Too many attempts. Please wait a few minutes before trying again.';
        } else if (error.code === 'auth/invalid-phone-number') {
            msg = 'Invalid phone number format.';
        } else if (error.code === 'auth/quota-exceeded') {
            msg = 'SMS quota exceeded for today. Please contact support or try again later.';
        } else if (error.code === 'auth/captcha-check-failed') {
            msg = 'reCAPTCHA verification failed. Please refresh the page and try again.';
        } else if (error.code === 'auth/invalid-app-credential') {
            msg = 'reCAPTCHA check failed. Please reload the page and try again.';
        } else if (error.code === 'auth/billing-not-enabled') {
            msg = 'Firebase SMS billing is not enabled. Please use designated test number 9000000000.';
        } else if (error.code === 'auth/app-not-authorized') {
            msg = 'This domain is not authorized for phone sign-in in Firebase Console.';
        }

        return {
            success: false,
            isRegistered: true,
            message: msg,
            errorCode: error.code,
            rawError: error
        };
    }
}

/**
 * Verify 6-digit OTP code entered by donor
 * @param {string} otpCode 
 * @returns {Promise<{ success: boolean, donor?: object, message?: string }>}
 */
export async function verifyDonorOtp(otpCode) {
    if (!confirmationResult) {
        return { success: false, message: 'Please request an OTP first.' };
    }

    const cleanOtp = String(otpCode).trim();
    if (cleanOtp.length !== 6) {
        return { success: false, message: 'Please enter a valid 6-digit verification code.' };
    }

    try {
        const result = await confirmationResult.confirm(cleanOtp);
        const user = result.user;

        // Fetch the corresponding donor document
        const normalized = normalizePhoneNumber(user.phoneNumber);
        const regCheck = await checkDonorRegistration(normalized);

        if (!regCheck.isRegistered) {
            try { await firebaseSignOut(auth); } catch (e) {}
            currentDonor = null;
            clearDonorSession();
            return {
                success: false,
                message: 'Access restricted: No registered donor profile was found for this phone number.'
            };
        }

        // Link authUid and update lastLogin on donor document (skip for mock test donor)
        if (!regCheck.donorData?.isTestDonor) {
            try {
                const donorRef = doc(db, 'donors', regCheck.donorId);
                await updateDoc(donorRef, {
                    authUid: user.uid,
                    lastLogin: serverTimestamp()
                });
            } catch (e) {
                console.warn('Note: Could not update lastLogin on donor doc:', e.message);
            }
        }

        const isTest = Boolean(regCheck.donorData?.isTestDonor || (IS_LOCAL_DEV && (normalized === TEST_DONOR_PHONE || normalized === TEST_DONOR_PHONE_NEW)));
        currentDonor = {
            ...regCheck.donorData,
            authUid: user.uid,
            phoneNumber: user.phoneNumber,
            isTestDonor: isTest
        };

        // Persist session across refreshes and tabs
        saveDonorSession(currentDonor);
        notifyDonorAuthListeners(currentDonor);

        return {
            success: true,
            donor: currentDonor
        };
    } catch (error) {
        console.error('Error verifying donor OTP:', error);
        let msg = error.message || 'Verification failed. Please check the code and try again.';
        if (error.code === 'auth/invalid-verification-code') {
            msg = error.message.includes('123456') ? error.message : 'Incorrect OTP. Please enter the correct 6-digit code.';
        } else if (error.code === 'auth/code-expired') {
            msg = 'OTP has expired. Please request a new verification code.';
        }
        return { success: false, message: msg, error: error.code };
    }
}

/**
 * Persist donor session in localStorage with fallback
 */
function saveDonorSession(donor) {
    if (!donor) return;
    try {
        localStorage.setItem('lsu_donor_session', JSON.stringify(donor));
    } catch (e) {
        try {
            sessionStorage.setItem('lsu_donor_session', JSON.stringify(donor));
        } catch (err) {}
    }
}

/**
 * Clear stored donor session
 */
function clearDonorSession() {
    try { localStorage.removeItem('lsu_donor_session'); } catch (e) {}
    try { sessionStorage.removeItem('lsu_donor_session'); } catch (e) {}
}

/**
 * Retrieve stored donor session
 */
function getStoredDonorSession() {
    try {
        const stored = localStorage.getItem('lsu_donor_session') || sessionStorage.getItem('lsu_donor_session');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Error reading stored donor session:', e);
    }
    return null;
}

/**
 * Initialize donor authentication state listener
 */
export function initializeDonorAuth() {
    // 1. Immediately restore session from localStorage so refresh keeps the user logged in with no flicker
    const stored = getStoredDonorSession();
    if (stored) {
        currentDonor = stored;
        notifyDonorAuthListeners(currentDonor);
    }

    // 2. Observe Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (user && user.phoneNumber) {
            const normalized = normalizePhoneNumber(user.phoneNumber);
            const regCheck = await checkDonorRegistration(normalized);

            if (regCheck.isRegistered) {
                currentDonor = {
                    ...regCheck.donorData,
                    authUid: user.uid,
                    phoneNumber: user.phoneNumber,
                    isTestDonor: Boolean(regCheck.donorData?.isTestDonor || (IS_LOCAL_DEV && (normalized === TEST_DONOR_PHONE || normalized === TEST_DONOR_PHONE_NEW)))
                };
                saveDonorSession(currentDonor);
                notifyDonorAuthListeners(currentDonor);
            } else {
                // Check if this authenticated user is a Volunteer or Superuser in the 'users' collection
                let volunteerUser = null;
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        volunteerUser = userSnap.data();
                    } else {
                        const uQ = query(collection(db, 'users'), where('phoneNumber', '==', user.phoneNumber));
                        const uSnap = await getDocs(uQ);
                        if (!uSnap.empty) {
                            volunteerUser = uSnap.docs[0].data();
                        }
                    }
                } catch (uErr) {
                    console.warn('Could not query users collection for volunteer profile:', uErr);
                }

                if (volunteerUser) {
                    // Authenticated volunteer or admin visiting Donor Portal: auto-synthesize donor session
                    const synthesizedDonor = {
                        id: 'volunteer_donor_' + user.uid,
                        fullName: volunteerUser.displayName || 'Volunteer Lifesaver',
                        contactNumber: normalized,
                        phoneNumber: user.phoneNumber,
                        bloodGroup: volunteerUser.bloodGroup || 'O+',
                        gender: volunteerUser.gender || 'Not Specified',
                        city: volunteerUser.city || 'Ahmedabad',
                        area: volunteerUser.area || '',
                        email: volunteerUser.email || '',
                        authUid: user.uid,
                        isEmergencyAvailable: 'yes',
                        emergencyAvailable: 'yes',
                        isVolunteer: true,
                        isFirstTime: false
                    };

                    currentDonor = synthesizedDonor;
                    saveDonorSession(currentDonor);
                    notifyDonorAuthListeners(currentDonor);
                } else {
                    currentDonor = null;
                    clearDonorSession();
                    notifyDonorAuthListeners(null);
                }
            }
        } else {
            // Firebase Auth does not report an active user (e.g. local test bypass or unauthenticated state)
            if (currentDonor?.isTestDonor || (IS_LOCAL_DEV && currentDonor)) {
                // Keep active local test donor or dev session across refreshes without forced logout
                saveDonorSession(currentDonor);
            } else if (!stored) {
                // If there was never any active session, ensure user is set to logged out
                currentDonor = null;
                clearDonorSession();
                notifyDonorAuthListeners(null);
            } else if (!IS_LOCAL_DEV) {
                // In production, real accounts require verified Firebase Auth
                currentDonor = null;
                clearDonorSession();
                notifyDonorAuthListeners(null);
            }
        }
    });
}

/**
 * Subscribe to donor auth changes
 */
export function onDonorAuthChange(callback) {
    donorAuthListeners.push(callback);
    if (currentDonor !== undefined && currentDonor !== null) {
        callback(currentDonor);
    }
    return () => {
        donorAuthListeners = donorAuthListeners.filter(cb => cb !== callback);
    };
}

function notifyDonorAuthListeners(donor) {
    donorAuthListeners.forEach(cb => {
        try {
            cb(donor);
        } catch (err) {
            console.error('Donor auth listener error:', err);
        }
    });

    try {
        window.dispatchEvent(new CustomEvent('lsu_donor_auth_change', {
            detail: donor ? {
                uid: donor.authUid || donor.id,
                phoneNumber: donor.contactNumber || donor.phoneNumber,
                displayName: donor.fullName || donor.displayName,
                role: 'donor',
                status: 'approved',
                ...donor
            } : null
        }));
    } catch (e) {
        console.warn('Could not dispatch lsu_donor_auth_change event:', e);
    }
}

/**
 * Get current logged in donor
 */
export function getLoggedInDonor() {
    return currentDonor;
}

/**
 * Sign out donor
 */
export async function donorSignOut() {
    clearDonorSession();
    try {
        await firebaseSignOut(auth);
    } catch (e) {}
    currentDonor = null;
    notifyDonorAuthListeners(null);
}


