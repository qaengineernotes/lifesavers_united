// Firebase Configuration and Initialization
// This file initializes Firebase services for the LifeSavers United application

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBBhXKv-U_Ze2cUr6_QCX9mLN7Jrfjr7aA",
    authDomain: "lifesavers-united-org.firebaseapp.com",
    projectId: "lifesavers-united-org",
    storageBucket: "lifesavers-united-org.firebasestorage.app",
    messagingSenderId: "650101444178",
    appId: "1:650101444178:web:af4df324979b7d5878998b",
    measurementId: "G-NJLTYGM973"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const functions = getFunctions(app);

// Export for use in other modules
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


