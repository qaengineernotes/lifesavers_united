// Firebase Authentication Service
// Handles phone number authentication and user session management

import {
    auth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged,
    updateProfile
} from './firebase-config.js';

import { db, doc, setDoc, getDoc, onSnapshot, serverTimestamp } from './firebase-config.js';

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

            // Set up real-time listener for the user's Firestore document
            const userRef = doc(db, 'users', user.uid);
            userDocUnsubscribe = onSnapshot(userRef, async (docSnap) => {
                if (docSnap.exists()) {
                    // Update current user state with Firestore data
                    const userData = docSnap.data();
                    currentUser = {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        ...userData
                    };

                } else {
                    // Document doesn't exist yet (new user awaiting profile creation)
                    currentUser = {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        displayName: null,
                        status: 'pending',
                        role: 'volunteer',
                        isNewUser: true
                    };

                }

                // Notify all listeners of the updated user state
                authStateListeners.forEach(callback => callback(currentUser));
            }, (error) => {
                console.error('Error listening to user doc:', error);
            });
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
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            // Update last login
            await setDoc(userRef, {
                lastLogin: serverTimestamp()
            }, { merge: true });

            return {
                uid: uid,
                phoneNumber: phoneNumber,
                ...userDoc.data()
            };
        } else {
            // User doesn't exist - will be created after name input
            return {
                uid: uid,
                phoneNumber: phoneNumber,
                displayName: null,
                isNewUser: true
            };
        }
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

        // Send OTP
        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();

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
                alert('Failed to send OTP. Please try again.');
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

            const otp = otpInput.value.trim();

            if (otp.length !== 6) {
                alert('Please enter a valid 6-digit OTP');
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
                    alert('Authentication successful, but there was a permission error. Please contact support.');
                    modal.remove();
                    resolve(null);
                } else {
                    alert('Invalid OTP. Please try again.');
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
