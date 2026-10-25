/**
 * LifeSavers United - AI Entity Normalizer (Gemini Flash + Firestore Cache)
 * Dynamically normalizes colloquial/Hinglish/misspelled diagnoses and hospitals.
 *
 * API KEY CONFIGURATION:
 * 1. You can paste your Gemini API Key directly into GEMINI_API_KEY_DIRECT below, OR
 * 2. Set it in your environment: GEMINI_API_KEY="AIzaSy..." in firebase-functions/.env, OR
 * 3. Via Firebase CLI: firebase functions:config:set gemini.api_key="AIzaSy..."
 */

// =========================================================================
// 🔑 PASTE YOUR GEMINI API KEY BELOW IF NOT USING CLI / ENV VARIABLES:
// =========================================================================
const GEMINI_API_KEY_DIRECT = ""; // <--- Handled securely via .env
// =========================================================================

const axios = require("axios");

/**
 * Retrieves the Gemini API Key from direct constant, environment variable, or functions.config()
 */
function getGeminiApiKey() {
    if (GEMINI_API_KEY_DIRECT && GEMINI_API_KEY_DIRECT.trim() !== "") {
        return GEMINI_API_KEY_DIRECT.trim();
    }
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
        return process.env.GEMINI_API_KEY.trim();
    }
    // Check .env file directly if process.env is not yet populated
    try {
        const fs = require("fs");
        const path = require("path");
        const envPath = path.join(__dirname, ".env");
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, "utf8");
            const match = content.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
            if (match && match[1]) {
                process.env.GEMINI_API_KEY = match[1].trim();
                return process.env.GEMINI_API_KEY;
            }
        }
    } catch (e) {
        // Ignore file read error
    }
    try {
        const functions = require("firebase-functions");
        const config = (functions.config && functions.config()) || {};
        if (config.gemini && config.gemini.api_key) {
            return config.gemini.api_key.trim();
        }
    } catch (e) {
        // Outside functions runtime or config not initialized
    }
    return null;
}

/**
 * Generates a clean URL/document-safe key from raw text
 */
function toCacheKey(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 80);
}

/**
 * Calls Gemini 1.5/2.0 Flash to normalize an unlisted diagnosis / medical reason.
 * Handles Hindi, Gujarati, Hinglish, misspellings, and colloquial phrases.
 */
async function normalizeDiagnosisWithAI(rawText, db = null) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return null;
    }

    const trimmed = rawText.trim();
    const cacheKey = toCacheKey(trimmed);

    // 1. Check Firestore Cache first (0ms AI cost)
    if (db && cacheKey) {
        try {
            const cacheDoc = await db.collection("diagnosis_cache").doc(cacheKey).get();
            if (cacheDoc.exists) {
                const data = cacheDoc.data();
                console.log(`⚡ [Cache Hit] Diagnosis: "${trimmed}" -> "${data.standardizedName}"`);
                return {
                    name: data.standardizedName,
                    category: data.category || "Medical / Clinical",
                    matched: true,
                    source: "cache"
                };
            }
        } catch (err) {
            console.warn("⚠️ Failed reading diagnosis_cache:", err.message);
        }
    }

    // 2. Check if API key is configured
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        console.log("ℹ️ Gemini API key not set. Skipping AI diagnosis normalization.");
        return null;
    }

    // 3. Call Gemini Flash API
    try {
        const prompt = `You are a medical triage assistant for an emergency blood donation platform in India.
Convert the following user-submitted reason for blood requirement into a concise, professional clinical diagnosis title.
The input may be in English, Hindi, Gujarati, Hinglish slang, or have severe spelling mistakes (e.g., "gir gaye hai" -> "Accident / Trauma (Fall Injury)", "dil ma chhed" -> "Congenital Heart Defect (ASD/VSD)", "nimoniya" -> "Pneumonia / Lung Infection", "chhat se slip" -> "Accident / Trauma & Fractures", "khoon ki kami" -> "Severe Anemia (Low Hemoglobin)").

User Input: "${trimmed}"

Respond strictly with valid JSON with these exact fields:
{
  "standardizedName": "Concise standard clinical diagnosis title (English)",
  "category": "Medical category (e.g. Trauma, Cardiology, Hematology, Pulmonology, Surgical, Oncology, Maternal)"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(
            url,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            },
            { timeout: 5000 }
        );

        const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) return null;

        const parsed = JSON.parse(candidateText);
        if (!parsed.standardizedName) return null;

        console.log(`🤖 [Gemini AI] Standardized Diagnosis: "${trimmed}" -> "${parsed.standardizedName}"`);

        // 4. Save to Firestore Cache for permanent zero-cost future hits
        if (db && cacheKey) {
            db.collection("diagnosis_cache").doc(cacheKey).set({
                rawQuery: trimmed,
                standardizedName: parsed.standardizedName,
                category: parsed.category || "Clinical",
                createdAt: new Date().toISOString()
            }, { merge: true }).catch(e => console.warn("Cache write failed:", e.message));
        }

        return {
            name: parsed.standardizedName,
            category: parsed.category || "Clinical",
            matched: true,
            source: "gemini_ai"
        };
    } catch (err) {
        console.error("❌ Gemini AI diagnosis normalization error:", err.response?.data?.error?.message || err.message);
        return null;
    }
}

/**
 * Calls Gemini 1.5/2.0 Flash to normalize an unlisted hospital name and extract city/area.
 */
async function normalizeHospitalWithAI(rawText, db = null) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return null;
    }

    const trimmed = rawText.trim();
    const cacheKey = toCacheKey(trimmed);

    // 1. Check Firestore Cache first
    if (db && cacheKey) {
        try {
            const cacheDoc = await db.collection("hospital_cache").doc(cacheKey).get();
            if (cacheDoc.exists) {
                const data = cacheDoc.data();
                console.log(`⚡ [Cache Hit] Hospital: "${trimmed}" -> "${data.name}"`);
                return {
                    name: data.name,
                    city: data.city || "",
                    area: data.area || "",
                    address: data.address || "",
                    matched: true,
                    source: "cache"
                };
            }
        } catch (err) {
            console.warn("⚠️ Failed reading hospital_cache:", err.message);
        }
    }

    // 2. Check if API key is configured
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        console.log("ℹ️ Gemini API key not set. Skipping AI hospital normalization.");
        return null;
    }

    // 3. Call Gemini Flash API
    try {
        const prompt = `You are a hospital location assistant for an emergency blood donation platform in India (focus on Gujarat and major cities).
Given the following raw hospital name text (which may contain spelling errors, ward numbers, or informal names like "civil asarwa 1200 bed", "surat new civil", "dhiraj hospital pipariya vadodara", "amc svp"):
Extract the clean official hospital name, city, and general area/address.

User Input: "${trimmed}"

Respond strictly with valid JSON with these exact fields:
{
  "name": "Standardized Official Hospital Name (e.g. Civil Hospital, Asarwa)",
  "city": "City name if identifiable (e.g. Ahmedabad, Surat, Vadodara, Rajkot) or empty string",
  "area": "Area / locality if identifiable or empty string",
  "address": "Brief address or landmark if identifiable or empty string"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(
            url,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            },
            { timeout: 5000 }
        );

        const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) return null;

        const parsed = JSON.parse(candidateText);
        if (!parsed.name) return null;

        console.log(`🤖 [Gemini AI] Standardized Hospital: "${trimmed}" -> "${parsed.name}" (${parsed.city || 'No City'})`);

        // 4. Save to Firestore Cache
        if (db && cacheKey) {
            db.collection("hospital_cache").doc(cacheKey).set({
                rawQuery: trimmed,
                name: parsed.name,
                city: parsed.city || "",
                area: parsed.area || "",
                address: parsed.address || "",
                createdAt: new Date().toISOString()
            }, { merge: true }).catch(e => console.warn("Cache write failed:", e.message));
        }

        return {
            name: parsed.name,
            city: parsed.city || "",
            area: parsed.area || "",
            address: parsed.address || "",
            matched: true,
            source: "gemini_ai"
        };
    } catch (err) {
        console.error("❌ Gemini AI hospital normalization error:", err.response?.data?.error?.message || err.message);
        return null;
    }
}

module.exports = {
    getGeminiApiKey,
    normalizeDiagnosisWithAI,
    normalizeHospitalWithAI,
    toCacheKey
};
