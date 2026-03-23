// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, getCountFromServer, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyBBhXKv-U_Ze2cUr6_QCX9mLN7Jrfjr7aA",
    authDomain: "lifesavers-united-org.firebaseapp.com",
    projectId: "lifesavers-united-org",
    storageBucket: "lifesavers-united-org.firebasestorage.app",
    messagingSenderId: "650101444178",
    appId: "1:650101444178:web:af4df324979b7d5878998b",
    measurementId: "G-NJLTYGM973"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const functions = getFunctions(app);

// LAZY LOAD APP CHECK (Google reCAPTCHA v3) to save 1.5+ seconds of load time!
let appCheckInitialized = false;
let appCheckPromise = null;

const initAppCheck = () => {
    if (appCheckInitialized) return appCheckPromise;
    appCheckInitialized = true;
    
    appCheckPromise = (async () => {
        try {
            // Dynamically import App Check so the browser ignores it completely until it's needed
            const { initializeAppCheck, ReCaptchaV3Provider } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js");
            
            const RECAPTCHA_V3_SITE_KEY = '6LfUJ3YsAAAAAKMf6JP9vmCkEAubCWuGaRYjWsC_';
            const isLocalhost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

            if (isLocalhost) {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = '9f4a2b8e-3c7d-4e1f-a5b6-c2d3e4f5a6b7';
            }

            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
                isTokenAutoRefreshEnabled: true
            });
            
            console.log("Lazy-loaded Firebase App Check (reCAPTCHA v3) successfully.");
        } catch (e) {
            console.error("Failed to load Firebase App Check lazily:", e);
        }
    })();
    return appCheckPromise;
};

// Trigger App Check on the very first user interaction (mouse movement, scroll, touch, or click)
const interactionEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
const triggerAppCheck = () => {
    initAppCheck();
    // Remove the listeners once triggered so it only runs once
    interactionEvents.forEach(e => window.removeEventListener(e, triggerAppCheck));
};

// Add listeners passively to not hurt performance
interactionEvents.forEach(e => window.addEventListener(e, triggerAppCheck, { once: true, passive: true }));

// Fallback: If the user doesn't interact within 5 seconds, load it anyway just to be safe
setTimeout(triggerAppCheck, 5000);

export {
    app,
    auth,
    db,
    analytics,
    functions,
    // Auth functions
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged,
    updateProfile,
    // Firestore functions
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getCountFromServer,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    // Cloud Functions
    httpsCallable,
    initAppCheck
};
