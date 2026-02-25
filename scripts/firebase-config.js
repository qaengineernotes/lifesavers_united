// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
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

// Initialize App Check BEFORE any other Firebase service.
// On localhost: debug token (registered in Firebase Console → App Check → Manage debug tokens).
// On production: reCAPTCHA v3 runs invisibly — zero user friction.
const RECAPTCHA_V3_SITE_KEY = '6LfUJ3YsAAAAAKMf6JP9vmCkEAubCWuGaRYjWsC_';

const isLocalhost = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
);

if (isLocalhost) {
    // Debug token registered under name "my-local-test" in Firebase Console App Check
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = '9f4a2b8e-3c7d-4e1f-a5b6-c2d3e4f5a6b7';
}

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
    isTokenAutoRefreshEnabled: true
});

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const functions = getFunctions(app);

export {
    app,
    auth,
    db,
    analytics,
    functions,
    appCheck,
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
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    // Cloud Functions
    httpsCallable
};
