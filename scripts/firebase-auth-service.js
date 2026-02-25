// Firebase Authentication Service
// Handles phone number authentication and user session management

import {
    auth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged,
    updateProfile
} from './firebase-config.js';

import { db, doc, setDoc, getDoc, getDocs, onSnapshot, serverTimestamp, collection, query, where, updateDoc } from './firebase-config.js';

// Current user state
let currentUser = null;
let authStateListeners = [];

let userDocUnsubscribe = null;

// ============================================================================
// INITIALIZE AUTH STATE LISTENER
// ============================================================================
export function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        // Unsubscribe from previous user doc listener if it exists
        if (userDocUnsubscribe) {
            userDocUnsubscribe();
            userDocUnsubscribe = null;
        }

        if (user) {
            // User is signed in

            // First, try to find the user's Firestore document by UID
            const userRef = doc(db, 'users', user.uid);
            const uidSnap = await getDoc(userRef);

            if (uidSnap.exists()) {
                // Document found by UID — set up real-time listener on it
                userDocUnsubscribe = onSnapshot(userRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        currentUser = {
                            uid: user.uid,
                            phoneNumber: user.phoneNumber,
                            ...userData
                        };
                    } else {
                        currentUser = {
                            uid: user.uid,
                            phoneNumber: user.phoneNumber,
                            displayName: null,
                            status: 'pending',
                            role: 'volunteer',
                            isNewUser: true
                        };
                    }
                    authStateListeners.forEach(callback => callback(currentUser));
                }, (error) => {
                    console.error('Error listening to user doc:', error);
                });
            } else {
                // No document found by UID — try to find by phoneNumber
                const phoneNorm = user.phoneNumber;
                const q = query(collection(db, 'users'), where('phoneNumber', '==', phoneNorm));
                const phoneSnap = await getDocs(q);

                if (!phoneSnap.empty) {
                    // Found an existing document with this phone number
                    const existingDoc = phoneSnap.docs[0];
                    const existingRef = existingDoc.ref;

                    // Update lastLogin on the existing document
                    await updateDoc(existingRef, { lastLogin: serverTimestamp() });

                    // Set up real-time listener on the EXISTING document
                    userDocUnsubscribe = onSnapshot(existingRef, async (docSnap) => {
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            currentUser = {
                                uid: user.uid,
                                firestoreDocId: existingDoc.id,
                                phoneNumber: user.phoneNumber,
                                ...userData
                            };
                        }
                        authStateListeners.forEach(callback => callback(currentUser));
                    }, (error) => {
                        console.error('Error listening to user doc (phone-matched):', error);
                    });
                } else {
                    // Truly new user — no document by UID or phone number
                    currentUser = {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        displayName: null,
                        status: 'pending',
                        role: 'volunteer',
                        isNewUser: true
                    };
                    authStateListeners.forEach(callback => callback(currentUser));
                }
            }
        } else {
            // User is signed out
            currentUser = null;

            // Notify all listeners
            authStateListeners.forEach(callback => callback(null));
        }
    });
}

// ============================================================================
// SUBSCRIBE TO AUTH STATE CHANGES
// ============================================================================
export function onAuthChange(callback) {
    authStateListeners.push(callback);

    // Immediately call with current state
    if (currentUser !== null) {
        callback(currentUser);
    }

    // Return unsubscribe function
    return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
    };
}

// ============================================================================
// GET CURRENT USER
// ============================================================================
export function getCurrentUser() {
    return currentUser;
}

// ============================================================================
// CHECK IF USER IS AUTHENTICATED
// ============================================================================
export function isAuthenticated() {
    return currentUser !== null;
}

// ============================================================================
// GET OR CREATE USER PROFILE
// ============================================================================
async function getUserProfile(uid, phoneNumber) {
    try {
        // Step 1: Try to find document by Firebase Auth UID
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            // Found by UID — update last login and return
            await setDoc(userRef, {
                lastLogin: serverTimestamp()
            }, { merge: true });

            return {
                uid: uid,
                phoneNumber: phoneNumber,
                ...userDoc.data()
            };
        }

        // Step 2: Not found by UID — search by phone number to avoid creating duplicates
        console.log('No user doc found by UID, searching by phone number:', phoneNumber);
        const q = query(collection(db, 'users'), where('phoneNumber', '==', phoneNumber));
        const phoneSnap = await getDocs(q);

        if (!phoneSnap.empty) {
            // Existing user found by phone number (UID may have changed)
            const existingDoc = phoneSnap.docs[0];
            const existingRef = existingDoc.ref;

            // Update lastLogin on the original document
            await updateDoc(existingRef, { lastLogin: serverTimestamp() });

            console.log('✅ Found existing user by phone number, doc ID:', existingDoc.id);
            return {
                uid: uid,
                firestoreDocId: existingDoc.id,
                phoneNumber: phoneNumber,
                ...existingDoc.data()
            };
        }

        // Step 3: Truly new user — no document by UID or phone
        return {
            uid: uid,
            phoneNumber: phoneNumber,
            displayName: null,
            isNewUser: true
        };

    } catch (error) {
        console.error('Error fetching user profile:', error);

        // If it's a permission error, throw it so we can handle it properly
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Please ensure Firestore rules are deployed correctly.');
        }

        // For other errors, treat as new user (fallback)
        return {
            uid: uid,
            phoneNumber: phoneNumber,
            displayName: null,
            isNewUser: true
        };
    }
}

// ============================================================================
// CREATE USER PROFILE
// ============================================================================
export async function createUserProfile(uid, displayName) {
    try {
        // 1. Update Firebase Auth profile
        await updateProfile(auth.currentUser, {
            displayName: displayName
        });

        // 2. Store in Firestore users collection
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
            displayName: displayName,
            phoneNumber: auth.currentUser.phoneNumber,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            role: 'volunteer',
            status: 'pending' // New users start as pending
        });

        // 3. Update current user state
        currentUser = {
            ...currentUser,
            displayName: displayName,
            isNewUser: false
        };

        console.log('✅ User profile created successfully with displayName:', displayName);
        return true;
    } catch (error) {
        console.error('Error creating user profile:', error);
        return false;
    }
}

// ============================================================================
// SHOW PHONE LOGIN MODAL
// ============================================================================
export function showPhoneLoginModal() {
    return new Promise((resolve, reject) => {
        // Create modal
        const modal = createLoginModal();
        document.body.appendChild(modal);

        // Setup reCAPTCHA
        setupRecaptcha();

        // Handle phone submission
        const phoneForm = modal.querySelector('#phoneForm');
        const otpForm = modal.querySelector('#otpForm');
        const phoneInput = modal.querySelector('#phoneNumber');
        const otpInput = modal.querySelector('#otpCode');
        const sendOtpBtn = modal.querySelector('#sendOtpBtn');
        const verifyOtpBtn = modal.querySelector('#verifyOtpBtn');
        const cancelBtn = modal.querySelector('#cancelLoginBtn');

        let confirmationResult = null;

        // Helper: show inline error in the given container
        function showInlineError(boxId, textId, message) {
            const box = modal.querySelector('#' + boxId);
            const txt = modal.querySelector('#' + textId);
            if (box && txt) {
                txt.textContent = message;
                box.style.display = 'flex';
            }
        }
        function hideInlineError(boxId) {
            const box = modal.querySelector('#' + boxId);
            if (box) box.style.display = 'none';
        }

        // Send OTP
        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideInlineError('phoneError');

            let phoneNumber = phoneInput.value.trim();

            // Add +91 if not present
            if (!phoneNumber.startsWith('+')) {
                phoneNumber = '+91' + phoneNumber;
            }

            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = 'Sending OTP...';

            try {
                const appVerifier = window.recaptchaVerifier;
                confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);

                // Show OTP form
                phoneForm.style.display = 'none';
                otpForm.style.display = 'block';

            } catch (error) {
                console.error('Error sending OTP:', error);
                const msg = error.code === 'auth/too-many-requests'
                    ? 'Too many attempts. Please wait a few minutes and try again.'
                    : 'Failed to send OTP. Please check the number and try again.';
                showInlineError('phoneError', 'phoneErrorText', msg);
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = 'Send OTP';

                // Reset reCAPTCHA
                window.recaptchaVerifier.render().then(widgetId => {
                    grecaptcha.reset(widgetId);
                });
            }
        });

        // Verify OTP
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideInlineError('otpError');

            const otp = otpInput.value.trim();

            if (otp.length !== 6) {
                showInlineError('otpError', 'otpErrorText', 'Please enter a valid 6-digit OTP.');
                return;
            }

            verifyOtpBtn.disabled = true;
            verifyOtpBtn.textContent = 'Verifying...';

            try {
                const result = await confirmationResult.confirm(otp);
                const user = result.user;

                // Check if new user needs to enter name
                const userProfile = await getUserProfile(user.uid, user.phoneNumber);

                if (userProfile.isNewUser) {
                    // Show name input only for truly new users
                    const displayName = await showNameInputModal();
                    if (displayName) {
                        await createUserProfile(user.uid, displayName);
                        currentUser = await getUserProfile(user.uid, user.phoneNumber);
                    }
                } else {
                    // Existing user - update currentUser
                    currentUser = userProfile;
                }

                modal.remove();
                resolve(currentUser);

            } catch (error) {
                console.error('Error verifying OTP:', error);

                // Check if it's a permission error
                if (error.message && error.message.includes('Permission denied')) {
                    showInlineError('otpError', 'otpErrorText', 'Authentication successful, but a permission error occurred. Please contact support.');
                    setTimeout(() => { modal.remove(); resolve(null); }, 3000);
                } else if (error.code === 'auth/invalid-verification-code') {
                    showInlineError('otpError', 'otpErrorText', 'Incorrect OTP. Please check and try again.');
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.textContent = 'Verify OTP';
                } else if (error.code === 'auth/code-expired') {
                    showInlineError('otpError', 'otpErrorText', 'OTP has expired. Please go back and request a new one.');
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.textContent = 'Verify OTP';
                } else {
                    showInlineError('otpError', 'otpErrorText', 'Verification failed. Please try again.');
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.textContent = 'Verify OTP';
                }
            }
        });

        // Cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });
    });
}

// ============================================================================
// CREATE LOGIN MODAL HTML
// ============================================================================
function createLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'phoneLoginModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg style="width: 32px; height: 32px; color: white;" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                    </svg>
                </div>
                <h3 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Phone Verification</h3>
                <p style="color: #6b7280;">Enter your phone number to continue</p>
            </div>
            
            <!-- Phone Number Form -->
            <form id="phoneForm">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
                        Phone Number <span style="color: #dc2626;">*</span>
                    </label>
                    <input type="tel" id="phoneNumber" placeholder="9876543210" required
                        style="width: 100%; padding: 12px 16px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Enter 10-digit mobile number</p>
                </div>

                <!-- Inline error for phone step -->
                <div id="phoneError" style="display:none; align-items: center; gap: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
                    <svg style="width:16px;height:16px;flex-shrink:0;color:#dc2626;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                    <span id="phoneErrorText" style="font-size:13px;color:#dc2626;font-weight:500;"></span>
                </div>
                
                <div id="recaptcha-container" style="margin-bottom: 20px;"></div>
                
                <div style="display: flex; gap: 12px;">
                    <button type="button" id="cancelLoginBtn" style="flex: 1; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #374151; font-weight: 500; cursor: pointer;">
                        Cancel
                    </button>
                    <button type="submit" id="sendOtpBtn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
                        Send OTP
                    </button>
                </div>
            </form>
            
            <!-- OTP Verification Form -->
            <form id="otpForm" style="display: none;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
                        Enter OTP <span style="color: #dc2626;">*</span>
                    </label>
                    <input type="text" id="otpCode" placeholder="123456" maxlength="6" required
                        style="width: 100%; padding: 12px 16px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 20px; letter-spacing: 4px; text-align: center; box-sizing: border-box;">
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Enter the 6-digit code sent to your phone</p>
                </div>

                <!-- Inline error for OTP step -->
                <div id="otpError" style="display:none; align-items: center; gap: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
                    <svg style="width:16px;height:16px;flex-shrink:0;color:#dc2626;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                    <span id="otpErrorText" style="font-size:13px;color:#dc2626;font-weight:500;"></span>
                </div>
                
                <button type="submit" id="verifyOtpBtn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
                    Verify OTP
                </button>
            </form>
        </div>
    `;

    return modal;
}

// ============================================================================
// SETUP RECAPTCHA
// ============================================================================
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: (response) => {

            },
            'expired-callback': () => {

            }
        });

        window.recaptchaVerifier.render();
    }
}

// ============================================================================
// SHOW NAME INPUT MODAL
// ============================================================================
function showNameInputModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%;">
                <h3 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">Welcome! 👋</h3>
                <p style="color: #6b7280; margin-bottom: 20px;">Please enter your name to complete registration</p>
                
                <form id="nameForm">
                    <input type="text" id="displayName" placeholder="Your Full Name" required
                        style="width: 100%; padding: 12px 16px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px; margin-bottom: 16px; box-sizing: border-box;">
                    
                    <button type="submit" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
                        Continue
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#nameForm');
        const input = modal.querySelector('#displayName');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = input.value.trim();
            if (name) {
                modal.remove();
                resolve(name);
            }
        });

        input.focus();
    });
}

// ============================================================================
// SIGN OUT
// ============================================================================
export async function signOut() {
    try {
        await auth.signOut();
        currentUser = null;

        return true;
    } catch (error) {
        console.error('Error signing out:', error);
        return false;
    }
}

// Initialize auth on module load
initializeAuth();
