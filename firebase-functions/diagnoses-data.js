/**
 * Master Dataset of Standardized Clinical Diagnoses for Telegram Bot & Cloud Functions
 * Handles phonetic spellings, common typos, Hinglish phrases, and colloquial keywords.
 */

const DIAGNOSES = [
    {
        name: "Accident / Trauma & Fractures",
        category: "Emergency / Trauma",
        aliases: [
            "accident", "trauma", "injury", "fracture", "fractures", "limb fracture",
            "both lower limb and upper limb fracture", "lower limb", "upper limb",
            "bone fracture", "multiple fractures", "road accident", "rto", "head injury",
            "internal bleeding", "polytrauma", "fall from height", "accidental", "hit and run"
        ]
    },
    {
        name: "Pneumonia / Lung Infection",
        category: "Pulmonology",
        aliases: [
            "nimoniya", "nimonia", "pneumonia", "lung infection", "lungs infection",
            "lung", "lungs", "chest infection", "respiratory infection", "pneumonitis",
            "pulmonary", "ards", "severe chest infection", "bronchitis"
        ]
    },
    {
        name: "Kidney Disease / Dialysis",
        category: "Nephrology",
        aliases: [
            "dialysis", "dialisis", "kidney disease", "kidney", "kidney problem",
            "kidney failure", "renal failure", "renal", "ckd", "creatinine",
            "kidney transplant", "acute kidney injury", "aki", "esrd", "nephrology"
        ]
    },
    {
        name: "Heart Surgery (CABG / Bypass)",
        category: "Cardiothoracic",
        aliases: [
            "heart opretion", "hart opretion", "heart operation", "by pass surgery",
            "by pass", "bypass surgery", "bypass", "cabg", "open heart surgery",
            "cardiac surgery", "valve replacement", "angioplasty", "stent", "stenting"
        ]
    },
    {
        name: "Congenital Heart Defect (Hole in Heart / ASD / VSD)",
        category: "Pediatric Cardiology",
        aliases: [
            "hol in hart", "hole in heart", "hol in heart", "hole in hart",
            "dil me chhed", "dil ma chhed", "asd", "vsd", "pda", "tetralogy of fallot",
            "tof", "congenital heart defect", "chd"
        ]
    },
    {
        name: "Heart Disease / Cardiac Problem",
        category: "Cardiology",
        aliases: [
            "heart problem", "hart problem", "heart", "hart", "cardiac",
            "cardio", "heart disease", "heart attack", "dil ki bimari",
            "chest pain", "cad", "coronary", "congestive heart failure", "chf"
        ]
    },
    {
        name: "Severe Anemia (Low Hemoglobin)",
        category: "Hematology",
        aliases: [
            "low hb", "hb low", "low hemoglobin", "low haemoglobin", "anemia",
            "anaemia", "hb", "haemoglobin", "hemoglobin", "blood deficiency",
            "khoon ki kami", "severe anemia", "iron deficiency anemia"
        ]
    },
    {
        name: "Dengue / Low Platelets",
        category: "Infectious Disease",
        aliases: [
            "high dengue", "dengue", "dengu", "dengue fever", "low platelet",
            "low platelets", "platelet down", "platelets count", "thrombocytopenia",
            "platelet deficiency", "platelets low"
        ]
    },
    {
        name: "Plastic / Reconstructive Surgery",
        category: "Surgical",
        aliases: [
            "plastic surgery", "plastic surgery ke liye", "reconstructive surgery",
            "burns", "burn injury", "skin graft", "cosmetic surgery", "maxillofacial"
        ]
    },
    {
        name: "Surgery / General Operation",
        category: "General Surgery",
        aliases: [
            "surgery", "operation", "opretion", "surgical", "laparoscopy",
            "emergency surgery", "major operation", "general surgery"
        ]
    },
    {
        name: "Childbirth / Delivery (C-Section / PPH)",
        category: "Obstetrics",
        aliases: [
            "delivery", "c-section", "c section", "csection", "cesarean",
            "caesarean", "childbirth", "postpartum", "pph", "pregnancy",
            "labour", "cesarean delivery", "maternity"
        ]
    },
    {
        name: "Thalassemia",
        category: "Hematology",
        aliases: [
            "thalassemia", "thal", "thalasemia", "talasemia", "thalasimia",
            "thal major", "thalassemia major", "thal minor", "cooley's anemia"
        ]
    },
    {
        name: "Cancer Treatment / Oncology",
        category: "Oncology",
        aliases: [
            "cancer", "canser", "cancer treatment", "chemo", "chemotherapy",
            "tumor", "tumour", "carcinoma", "oncology", "malignancy", "radiation"
        ]
    },
    {
        name: "Leukemia (Blood Cancer)",
        category: "Hematology / Oncology",
        aliases: [
            "leukemia", "leukaemia", "lukemia", "blood cancer", "lymphoma",
            "multiple myeloma", "myeloma", "all", "aml"
        ]
    },
    {
        name: "Bone Marrow Transplant (BMT)",
        category: "Specialty Hematology",
        aliases: [
            "bone marrow transplant", "bmt", "bone marrow", "stem cell transplant", "hsct"
        ]
    },
    {
        name: "Bleeding Disorder (Hemophilia / ITP)",
        category: "Hematology",
        aliases: [
            "bleeding disorder", "hemophilia", "haemophilia", "itp",
            "coagulopathy", "von willebrand", "excessive bleeding"
        ]
    },
    {
        name: "Liver Disease / Cirrhosis",
        category: "Gastroenterology",
        aliases: [
            "liver disease", "liver failure", "liver problem", "cirrhosis",
            "liver cirrhosis", "jaundice", "hepatitis", "liver transplant"
        ]
    },
    {
        name: "Viral Fever / Infection",
        category: "Infectious Disease",
        aliases: [
            "viral fever", "viral", "fever", "bukhar", "infection",
            "sepsis", "septic shock", "typhoid"
        ]
    },
    {
        name: "Malaria",
        category: "Infectious Disease",
        aliases: [
            "malaria", "falciparum", "vivax", "cerebral malaria"
        ]
    },
    {
        name: "Brain Surgery / Neurosurgery",
        category: "Neurosurgery",
        aliases: [
            "brain surgery", "neurosurgery", "brain hemorrhage", "brain tumor",
            "head trauma", "craniotomy"
        ]
    },
    {
        name: "GI Bleeding / Internal Hemorrhage",
        category: "Gastroenterology",
        aliases: [
            "gi bleeding", "internal bleeding", "stomach bleeding", "hemorrhage",
            "blood vomiting", "hematemesis"
        ]
    },
    {
        name: "Sickle Cell Disease",
        category: "Hematology",
        aliases: [
            "sickle cell", "sickle cell anemia", "scd", "sickle"
        ]
    }
];

const STOP_WORDS = new Set([
    "ke", "liye", "ki", "k", "ka", "se", "ko", "hai", "problem", "bimari",
    "patient", "suffering", "from", "treatment", "case", "high", "severe",
    "acute", "dr", "doctor", "urgent", "needed", "need", "for"
]);

function cleanText(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Matches a single phrase against diagnosis dataset
 */
function matchSingleDiagnosis(phrase) {
    const cleanQ = cleanText(phrase);
    if (!cleanQ) return null;

    const queryWords = cleanQ.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));

    let bestMatch = null;
    let highestScore = 0;

    for (const diagnosis of DIAGNOSES) {
        let score = 0;
        const cleanName = cleanText(diagnosis.name);

        // 1. Exact alias match
        for (const alias of diagnosis.aliases) {
            const cleanAlias = cleanText(alias);
            if (cleanAlias === cleanQ) {
                score = 120;
                break;
            } else if (cleanQ.includes(cleanAlias)) {
                score = Math.max(score, 100);
            } else if (cleanAlias.includes(cleanQ)) {
                score = Math.max(score, 80);
            }
        }

        // 2. Canonical name match
        if (cleanName === cleanQ) {
            score = Math.max(score, 110);
        } else if (cleanName.includes(cleanQ)) {
            score = Math.max(score, 75);
        }

        // 3. Token-level overlap
        if (queryWords.length > 0) {
            let tokenMatches = 0;
            for (const word of queryWords) {
                for (const alias of diagnosis.aliases) {
                    const aliasTokens = cleanText(alias).split(' ');
                    if (aliasTokens.some(at => at === word || (at.length > 3 && (word.startsWith(at) || at.startsWith(word))))) {
                        tokenMatches++;
                        break;
                    }
                }
            }
            if (tokenMatches > 0) {
                const tokenScore = Math.min(85, 40 + (tokenMatches * 20));
                score = Math.max(score, tokenScore);
            }
        }

        if (score > highestScore && score >= 40) {
            highestScore = score;
            bestMatch = diagnosis;
        }
    }

    return bestMatch;
}

/**
 * Resolves a raw diagnosis input into a standardized medical title.
 * Handles comma-separated conditions (e.g. "dialysis, nimoniya").
 * Returns { name: string, matched: boolean } or null if empty.
 */
function resolveDiagnosis(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // Check if input contains comma or multiple parts (e.g., "dialysis, nimoniya")
    if (trimmed.includes(',') || trimmed.toLowerCase().includes(' and ') || trimmed.includes('&')) {
        const parts = trimmed.split(/[,&]|\band\b/i).map(p => p.trim()).filter(Boolean);
        const resolvedNames = [];

        for (const part of parts) {
            const match = matchSingleDiagnosis(part);
            if (match && !resolvedNames.includes(match.name)) {
                resolvedNames.push(match.name);
            }
        }

        if (resolvedNames.length > 0) {
            return {
                name: resolvedNames.join(" & "),
                matched: true
            };
        }
    }

    // Single phrase match
    const match = matchSingleDiagnosis(trimmed);
    if (match) {
        return {
            name: match.name,
            matched: true
        };
    }

    return null;
}

/**
 * Hybrid Diagnosis Resolver:
 * Tier 1: Predefined exact & token matcher (0ms, 0 API calls)
 * Tier 2 & 3: Firestore Cache & Gemini Flash AI Normalizer
 */
async function resolveDiagnosisHybrid(rawText, db = null) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return null;

    // Tier 1: Check Predefined Master List
    const predefinedMatch = resolveDiagnosis(rawText);
    if (predefinedMatch) {
        return {
            name: predefinedMatch.name,
            matched: true,
            source: "predefined"
        };
    }

    // Tier 2 & 3: Check Firestore Cache & Gemini AI
    try {
        const { normalizeDiagnosisWithAI } = require("./ai-resolver");
        const aiResult = await normalizeDiagnosisWithAI(rawText, db);
        if (aiResult && aiResult.matched) {
            return aiResult;
        }
    } catch (e) {
        console.warn("⚠️ AI diagnosis resolution error:", e.message);
    }

    return null;
}

module.exports = {
    DIAGNOSES,
    resolveDiagnosis,
    resolveDiagnosisHybrid
};

