/**
 * Master Dataset of Standardized Clinical Diagnoses & Medical Reasons for Emergency Blood Requests
 * Includes comprehensive aliases, phonetic misspellings, colloquial terms, and Hinglish phrases.
 */

export const DIAGNOSES = [
    {
        name: "Accident / Trauma & Fractures",
        category: "Emergency / Trauma",
        badge: "Trauma",
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
        badge: "Respiratory",
        aliases: [
            "nimoniya", "nimonia", "pneumonia", "lung infection", "lungs infection",
            "lung", "lungs", "chest infection", "respiratory infection", "pneumonitis",
            "pulmonary", "ards", "severe chest infection", "bronchitis"
        ]
    },
    {
        name: "Kidney Disease / Dialysis",
        category: "Nephrology",
        badge: "Renal",
        aliases: [
            "dialysis", "dialisis", "kidney disease", "kidney", "kidney problem",
            "kidney failure", "renal failure", "renal", "ckd", "creatinine",
            "kidney transplant", "acute kidney injury", "aki", "esrd", "nephrology"
        ]
    },
    {
        name: "Heart Surgery (CABG / Bypass)",
        category: "Cardiothoracic",
        badge: "Cardiac",
        aliases: [
            "heart opretion", "hart opretion", "heart operation", "by pass surgery",
            "by pass", "bypass surgery", "bypass", "cabg", "open heart surgery",
            "cardiac surgery", "valve replacement", "angioplasty", "stent", "stenting"
        ]
    },
    {
        name: "Congenital Heart Defect (Hole in Heart / ASD / VSD)",
        category: "Pediatric Cardiology",
        badge: "Cardiac",
        aliases: [
            "hol in hart", "hole in heart", "hol in heart", "hole in hart",
            "dil me chhed", "dil ma chhed", "asd", "vsd", "pda", "tetralogy of fallot",
            "tof", "congenital heart defect", "chd"
        ]
    },
    {
        name: "Heart Disease / Cardiac Problem",
        category: "Cardiology",
        badge: "Cardiac",
        aliases: [
            "heart problem", "hart problem", "heart", "hart", "cardiac",
            "cardio", "heart disease", "heart attack", "dil ki bimari",
            "chest pain", "cad", "coronary", "congestive heart failure", "chf"
        ]
    },
    {
        name: "Severe Anemia (Low Hemoglobin)",
        category: "Hematology",
        badge: "Hematology",
        aliases: [
            "low hb", "hb low", "low hemoglobin", "low haemoglobin", "anemia",
            "anaemia", "hb", "haemoglobin", "hemoglobin", "blood deficiency",
            "khoon ki kami", "severe anemia", "iron deficiency anemia"
        ]
    },
    {
        name: "Dengue / Low Platelets",
        category: "Infectious Disease",
        badge: "Platelets",
        aliases: [
            "high dengue", "dengue", "dengu", "dengue fever", "low platelet",
            "low platelets", "platelet down", "platelets count", "thrombocytopenia",
            "platelet deficiency", "platelets low"
        ]
    },
    {
        name: "Plastic / Reconstructive Surgery",
        category: "Surgical",
        badge: "Surgery",
        aliases: [
            "plastic surgery", "plastic surgery ke liye", "reconstructive surgery",
            "burns", "burn injury", "skin graft", "cosmetic surgery", "maxillofacial"
        ]
    },
    {
        name: "Surgery / General Operation",
        category: "General Surgery",
        badge: "Surgery",
        aliases: [
            "surgery", "operation", "opretion", "surgical", "laparoscopy",
            "emergency surgery", "major operation", "general surgery"
        ]
    },
    {
        name: "Childbirth / Delivery (C-Section / PPH)",
        category: "Obstetrics",
        badge: "Maternal",
        aliases: [
            "delivery", "c-section", "c section", "csection", "cesarean",
            "caesarean", "childbirth", "postpartum", "pph", "pregnancy",
            "labour", "cesarean delivery", "maternity"
        ]
    },
    {
        name: "Thalassemia",
        category: "Hematology",
        badge: "Hematology",
        aliases: [
            "thalassemia", "thal", "thalasemia", "talasemia", "thalasimia",
            "thal major", "thalassemia major", "thal minor", "cooley's anemia"
        ]
    },
    {
        name: "Cancer Treatment / Oncology",
        category: "Oncology",
        badge: "Cancer",
        aliases: [
            "cancer", "canser", "cancer treatment", "chemo", "chemotherapy",
            "tumor", "tumour", "carcinoma", "oncology", "malignancy", "radiation"
        ]
    },
    {
        name: "Leukemia (Blood Cancer)",
        category: "Hematology / Oncology",
        badge: "Cancer",
        aliases: [
            "leukemia", "leukaemia", "lukemia", "blood cancer", "lymphoma",
            "multiple myeloma", "myeloma", "all", "aml"
        ]
    },
    {
        name: "Bone Marrow Transplant (BMT)",
        category: "Specialty Hematology",
        badge: "Specialty",
        aliases: [
            "bone marrow transplant", "bmt", "bone marrow", "stem cell transplant", "hsct"
        ]
    },
    {
        name: "Bleeding Disorder (Hemophilia / ITP)",
        category: "Hematology",
        badge: "Hematology",
        aliases: [
            "bleeding disorder", "hemophilia", "haemophilia", "itp",
            "coagulopathy", "von willebrand", "excessive bleeding"
        ]
    },
    {
        name: "Liver Disease / Cirrhosis",
        category: "Gastroenterology",
        badge: "Hepatic",
        aliases: [
            "liver disease", "liver failure", "liver problem", "cirrhosis",
            "liver cirrhosis", "jaundice", "hepatitis", "liver transplant"
        ]
    },
    {
        name: "Viral Fever / Infection",
        category: "Infectious Disease",
        badge: "Infection",
        aliases: [
            "viral fever", "viral", "fever", "bukhar", "infection",
            "sepsis", "septic shock", "typhoid"
        ]
    },
    {
        name: "Malaria",
        category: "Infectious Disease",
        badge: "Infection",
        aliases: [
            "malaria", "falciparum", "vivax", "cerebral malaria"
        ]
    },
    {
        name: "Brain Surgery / Neurosurgery",
        category: "Neurosurgery",
        badge: "Surgery",
        aliases: [
            "brain surgery", "neurosurgery", "brain hemorrhage", "brain tumor",
            "head trauma", "craniotomy"
        ]
    },
    {
        name: "GI Bleeding / Internal Hemorrhage",
        category: "Gastroenterology",
        badge: "Emergency",
        aliases: [
            "gi bleeding", "internal bleeding", "stomach bleeding", "hemorrhage",
            "blood vomiting", "hematemesis"
        ]
    },
    {
        name: "Sickle Cell Disease",
        category: "Hematology",
        badge: "Hematology",
        aliases: [
            "sickle cell", "sickle cell anemia", "scd", "sickle"
        ]
    }
];

/**
 * Common filler/stop words to strip when matching user input (especially Hinglish or colloquial sentences)
 */
const STOP_WORDS = new Set([
    "ke", "liye", "ki", "k", "ka", "se", "ko", "hai", "problem", "bimari",
    "patient", "suffering", "from", "treatment", "case", "high", "severe",
    "acute", "dr", "doctor", "urgent", "needed", "need", "for"
]);

/**
 * Cleans a query string by removing punctuation and extra whitespace
 */
export function cleanDiagnosisQuery(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calculates match score between query and a diagnosis entry
 */
export function scoreDiagnosis(query, diagnosis) {
    const cleanQ = cleanDiagnosisQuery(query);
    if (!cleanQ) return 0;

    const queryWords = cleanQ.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));
    const cleanName = cleanDiagnosisQuery(diagnosis.name);

    let maxScore = 0;

    // 1. Direct exact alias match (e.g. "nimoniya" === "nimoniya", "low hb" === "low hb")
    for (const alias of diagnosis.aliases) {
        const cleanAlias = cleanDiagnosisQuery(alias);
        if (cleanAlias === cleanQ) {
            return 120; // Highest confidence
        }
        if (cleanQ.includes(cleanAlias)) {
            maxScore = Math.max(maxScore, 100);
        } else if (cleanAlias.includes(cleanQ)) {
            maxScore = Math.max(maxScore, 80);
        }
    }

    // 2. Direct exact or substring in canonical name
    if (cleanName === cleanQ) {
        return 110;
    }
    if (cleanName.includes(cleanQ)) {
        maxScore = Math.max(maxScore, 75);
    }

    // 3. Token-level overlap (catches phrases like "both lower limb and upper limb fracture", "plastic surgery ke liye")
    if (queryWords.length > 0) {
        let tokenMatches = 0;
        for (const word of queryWords) {
            for (const alias of diagnosis.aliases) {
                const aliasTokens = cleanDiagnosisQuery(alias).split(' ');
                if (aliasTokens.some(at => at === word || (at.length > 3 && (word.startsWith(at) || at.startsWith(word))))) {
                    tokenMatches++;
                    break;
                }
            }
        }
        if (tokenMatches > 0) {
            const tokenScore = Math.min(85, 40 + (tokenMatches * 20));
            maxScore = Math.max(maxScore, tokenScore);
        }
    }

    return maxScore;
}
