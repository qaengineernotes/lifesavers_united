const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Telegraf, Markup } = require("telegraf");
const { TwitterApi } = require("twitter-api-v2");
const { resolveHospital, resolveHospitalHybrid } = require("./hospitals-data");
const { resolveDiagnosis, resolveDiagnosisHybrid } = require("./diagnoses-data");

admin.initializeApp();

const db = admin.firestore();

// Initialize Bot and Twitter Client (lazily or global if config available)
// We rely on functions.config() for secrets
// Run: firebase functions:config:set telegram.token="YOUR_TOKEN" twitter.api_key="KEY" ...
const telegramConfig = (functions.config && functions.config().telegram) || {};
const bot = new Telegraf(telegramConfig.token || "");

// Twitter Client Setup (Lazy initialized to avoid crash during deployment analysis)
const getTwitterClient = () => {
    const twitterConfig = (functions.config && functions.config().twitter) || {};
    if (!twitterConfig.api_key) {
        return null;
    }
    return new TwitterApi({
        appKey: twitterConfig.api_key,
        appSecret: twitterConfig.api_secret || "",
        accessToken: twitterConfig.access_token || "",
        accessSecret: twitterConfig.access_secret || "",
    });
};

// --- SHARED TWITTER POSTING FUNCTION ---

/**
 * Post a blood request to Twitter
 * @param {Object} requestData - The blood request data
 * @returns {Object} - { success: boolean, tweetLink?: string, error?: string }
 */
const postBloodRequestToTwitter = async (requestData) => {
    console.log("ℹ️ Twitter posting on blood request submission is disabled.");
    return {
        success: true,
        disabled: true,
        tweetLink: "(Twitter posting disabled)"
    };
};

// --- HELPER FUNCTIONS ---

/**
 * Normalize phone number to 10-digit format
 * Removes country code (+91 or 91), spaces, and special characters
 * Examples: "94283 54534" → "9428354534", "+91 94283 54534" → "9428354534"
 */
const normalizePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) {
        return '';
    }

    // Convert to string and trim whitespace
    let normalized = String(phoneNumber).trim();

    // Strip out forwarded message timestamps (e.g., "10:23 AM", "9:45 pm")
    normalized = normalized.replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/gi, '').trim();

    // Remove all non-digit characters (spaces, +, -, (, ), etc.)
    normalized = normalized.replace(/\D/g, '');

    // Remove country code if present (91 for India)
    if (normalized.startsWith('91') && normalized.length > 10) {
        normalized = normalized.substring(2);
    }

    // If the number still has more than 10 digits, take the last 10 digits
    if (normalized.length > 10) {
        normalized = normalized.slice(-10);
    }

    return normalized;
};

/**
 * Formats a string to Title Case (e.g., "nikunj mistri" -> "Nikunj Mistri")
 * @param {string} str - The string to format
 * @returns {string} - The formatted string
 */
const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().trim().split(/\s+/).map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

// Parse the "One-Shot" Text
const parseRequestText = async (text, db = null) => {
    // Map Telegram field names to Firestore database field names
    const mapping = {
        "patient name": "patientName",
        "age": "patientAge",
        "blood group": "requiredBloodGroup",
        "component": "bloodComponentText",
        "blood component": "bloodComponentText",
        "donation type": "bloodComponentText",
        "components": "bloodComponentText",
        "units required": "unitsRequired",
        "hospital": "hospitalName",
        "location": "hospitalCity",
        "city": "hospitalCity",
        "suffering from": "patientSufferingFrom",
        "diagnosis": "patientSufferingFrom",
        "contact person": "contactPerson",
        "contact number": "contactNumber",
        "email": "contactEmail",
        "urgency": "urgencyLevel",
        "hospital address": "hospitalAddress",
        "additional info": "additionalInfo",
        "info": "additionalInfo"
    };

    const lines = text.split("\n");
    const data = {};

    lines.forEach(line => {
        if (!line.includes(":")) return;
        const [key, ...values] = line.split(":");
        const cleanKey = key.trim().toLowerCase();
        const cleanValue = values.join(":").trim(); // Rejoin in case value has :

        if (mapping[cleanKey]) {
            let val = cleanValue;
            // Apply Title Case to name fields
            if (mapping[cleanKey] === 'patientName' || mapping[cleanKey] === 'contactPerson') {
                val = toTitleCase(val);
            }
            data[mapping[cleanKey]] = val;
        }
    });

    // Normalize contact number if present
    if (data.contactNumber) {
        data.contactNumber = normalizePhoneNumber(data.contactNumber);
    }

    // Standardize Hospital Name & enrich location/address (Hybrid: Predefined -> Cache -> Gemini AI)
    if (data.hospitalName) {
        const matchedHospital = await resolveHospitalHybrid(data.hospitalName, db);
        if (matchedHospital && matchedHospital.name) {
            console.log(`🏥 Standardized Telegram hospital (${matchedHospital.source || 'hybrid'}): "${data.hospitalName}" -> "${matchedHospital.name}"`);
            data.hospitalName = matchedHospital.name;
            if (!data.hospitalCity || data.hospitalCity.trim() === '') {
                data.hospitalCity = matchedHospital.city || '';
            }
            if (!data.hospitalAddress || data.hospitalAddress.trim() === '') {
                data.hospitalAddress = matchedHospital.address || '';
            }
        } else {
            data.hospitalName = toTitleCase(data.hospitalName);
        }
    }

    if (data.hospitalCity) {
        data.hospitalCity = toTitleCase(data.hospitalCity);
    }

    // Standardize Diagnosis / Suffering From (Hybrid: Predefined -> Cache -> Gemini AI)
    if (data.patientSufferingFrom) {
        const resolved = await resolveDiagnosisHybrid(data.patientSufferingFrom, db);
        if (resolved && resolved.name) {
            console.log(`🩺 Standardized Telegram diagnosis (${resolved.source || 'hybrid'}): "${data.patientSufferingFrom}" -> "${resolved.name}"`);
            data.patientSufferingFrom = resolved.name;
        } else {
            data.patientSufferingFrom = toTitleCase(data.patientSufferingFrom);
        }
    }

    // Parse blood components and breakdown from component or units text
    const parseComponentsBreakdown = (componentRawText, unitsRawText) => {
        const textToAnalyze = `${componentRawText || ''} ${unitsRawText || ''}`.trim();
        const componentsMap = [
            { regex: /\b(sdp|single donor platelet|plateletpheresis)\b/i, name: 'Single Donor Platelets (SDP)', code: 'platelets_sdp' },
            { regex: /\b(rdp|random donor platelet)\b/i, name: 'Random Donor Platelets (RDP)', code: 'platelets_rdp' },
            { regex: /\b(prbc|packed red blood|packed cells)\b/i, name: 'Packed Red Blood Cells (PRBC)', code: 'prbc' },
            { regex: /\b(ffp|fresh frozen plasma|plasma)\b/i, name: 'Fresh Frozen Plasma (FFP)', code: 'plasma' },
            { regex: /\b(cryo|cryoprecipitate)\b/i, name: 'Cryoprecipitate', code: 'cryoprecipitate' },
            { regex: /\b(whole blood|wb)\b/i, name: 'Whole Blood', code: 'whole_blood' }
        ];

        const breakdown = [];
        const detectedComponents = [];

        // Check if explicit multiple components mentioned (e.g., "4 Whole Blood, 2 SDP")
        const parts = (componentRawText || unitsRawText || '').split(/[,;+&]/);
        parts.forEach(part => {
            const cleanPart = part.trim();
            if (!cleanPart) return;

            const numMatch = cleanPart.match(/\b(\d+)\b/);
            const units = numMatch ? parseInt(numMatch[1]) : 1;

            const matched = componentsMap.find(c => c.regex.test(cleanPart));
            if (matched && !detectedComponents.includes(matched.name)) {
                detectedComponents.push(matched.name);
                breakdown.push({
                    component: matched.name,
                    code: matched.code,
                    units: units
                });
            }
        });

        // Fallback: check text for component keywords
        if (breakdown.length === 0 && textToAnalyze) {
            componentsMap.forEach(c => {
                if (c.regex.test(textToAnalyze) && !detectedComponents.includes(c.name)) {
                    detectedComponents.push(c.name);
                    breakdown.push({
                        component: c.name,
                        code: c.code,
                        units: parseInt(unitsRawText) || 1
                    });
                }
            });
        }

        // Default to Whole Blood if nothing detected
        if (breakdown.length === 0) {
            detectedComponents.push('Whole Blood');
            breakdown.push({
                component: 'Whole Blood',
                code: 'whole_blood',
                units: parseInt(unitsRawText) || 1
            });
        }

        const totalUnits = breakdown.reduce((sum, item) => sum + item.units, 0);
        const unitsRequiredText = breakdown.map(item => `${item.units} ${item.units > 1 ? 'units' : 'unit'} ${item.component}`).join(', ');

        return {
            bloodComponents: detectedComponents,
            componentBreakdown: breakdown,
            totalUnits: totalUnits,
            unitsRequiredText: unitsRequiredText
        };
    };

    const compInfo = parseComponentsBreakdown(data.bloodComponentText, data.unitsRequired);
    data.bloodComponents = compInfo.bloodComponents;
    data.componentBreakdown = compInfo.componentBreakdown;
    data.unitsRequired = compInfo.totalUnits || parseInt(data.unitsRequired) || 1;
    data.unitsRequiredText = compInfo.unitsRequiredText;

    return data;
};

// Validate Mandatory Fields
const validateRequest = (data) => {
    const mandatory = ["patientName", "contactNumber", "requiredBloodGroup", "unitsRequired", "hospitalName"];
    const missing = mandatory.filter(field => !data[field] || data[field] === "");
    return missing;
};

// Check for Duplicates
const checkDuplicate = async (patientName, contactNumber) => {
    console.log("🔎 Checking for duplicates - Name:", patientName, "Contact:", contactNumber);

    // Convert contact number to both string and number for comparison
    const contactAsString = String(contactNumber);
    const contactAsNumber = parseInt(contactNumber);

    console.log("🔎 Searching as string:", contactAsString, "and number:", contactAsNumber);

    // Check by Contact Number (try both string and number)
    const contactQueryString = await db.collection("emergency_requests")
        .where("contactNumber", "==", contactAsString)
        .get();

    console.log("📊 String query results:", contactQueryString.size);
    if (!contactQueryString.empty) {
        console.log("✅ Found duplicate by contact string!");
        return contactQueryString.docs[0];
    }

    const contactQueryNumber = await db.collection("emergency_requests")
        .where("contactNumber", "==", contactAsNumber)
        .get();

    console.log("📊 Number query results:", contactQueryNumber.size);
    if (!contactQueryNumber.empty) {
        console.log("✅ Found duplicate by contact number!");
        return contactQueryNumber.docs[0];
    }

    // Check by Patient Name (case-insensitive)
    const nameQuery = await db.collection("emergency_requests")
        .where("patientName", "==", patientName)
        .get();

    console.log("📊 Name query results:", nameQuery.size);
    if (!nameQuery.empty) {
        console.log("✅ Found duplicate by patient name!");
        return nameQuery.docs[0];
    }

    console.log("❌ No duplicates found");
    return null;
};

// --- BOT LOGIC ---

// 1. Handle Contact Sharing (User Registration)
bot.on("contact", async (ctx) => {
    const contact = ctx.message.contact;
    const telegramId = ctx.from.id;
    const username = ctx.from.username || "No Username";

    // Upsert user in Firestore
    await db.collection("telegram_users").doc(String(telegramId)).set({
        telegramId: telegramId,
        phoneNumber: contact.phone_number,
        firstName: contact.first_name,
        lastName: contact.last_name || "",
        username: username,
        registeredAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    ctx.reply(`✅ Thanks ${contact.first_name}! You are now verified. You can submit blood requests now.`);
});

// 2. Handle Text Messages (The Request Flow)
bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    const telegramId = ctx.from.id;
    const userRef = db.collection("telegram_users").doc(String(telegramId));
    const userDoc = await userRef.get();

    // A. Auth Check
    if (!userDoc.exists) {
        return ctx.reply(
            "🔒 **Verification Required**\n\nTo prevent spam, we need your phone number. Please click the button below to share it validation.",
            Markup.keyboard([
                Markup.button.contactRequest("📱 Share Contact Number")
            ]).oneTime().resize()
        );
    }

    // B. Parse Text
    // Clean the text: remove markdown formatting and normalize
    const cleanText = text.replace(/\*/g, '').replace(/🦺/g, '').trim();
    console.log("🧹 Cleaned text:", cleanText);

    // Only process if it looks like a request (contains "Patient Name" with optional space before colon)
    if (!cleanText.toLowerCase().includes("patient name")) {
        // Ignore casual chat or provide help
        if (text.startsWith("/start")) {
            const template = `Welcome to LifeSavers Bot! 🩸

Paste your request in this format:

Patient Name: 
Age: 
Diagnosis: 
Blood Group: 
Component: (Whole Blood/PRBC/SDP/RDP/FFP)
Units Required: 
Hospital: 
Location: 
Email: 
Urgency: (Normal/Urgent/Critical)
Hospital Address: 
Additional Info: 
Contact Person: 
Contact Number: `;
            return ctx.reply(template);
        }
        return; // Silent fail for random text to avoid spamming
    }

    const requestData = await parseRequestText(cleanText, db);
    console.log("📝 Parsed request data:", JSON.stringify(requestData));

    const missingFields = validateRequest(requestData);
    console.log("🔍 Missing fields check:", missingFields);

    if (missingFields.length > 0) {
        console.log("❌ Validation failed, missing:", missingFields);
        return ctx.reply(`❌ **Missing details!**\n\nThe following mandatory fields are missing:\n👉 ${missingFields.join(", ")}\n\nPlease copy-paste the template and try again.`);
    }

    // Add submitter info - standardized fields
    const userData = userDoc.data();
    const createdByName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username || 'Telegram User';

    requestData.createdBy = createdByName;
    requestData.createdByName = createdByName; // Alias for compatibility
    requestData.createdByUid = `telegram_${telegramId}`;
    requestData.source = "telegram_bot";
    requestData.createdAt = admin.firestore.FieldValue.serverTimestamp();

    // Add optional fields with default/empty values to match web form structure
    // This ensures all database documents have identical field structure
    requestData.contactEmail = requestData.contactEmail || "";
    requestData.urgencyLevel = requestData.urgencyLevel || "Normal";
    requestData.hospitalAddress = requestData.hospitalAddress || "";
    requestData.additionalInfo = requestData.additionalInfo || "";

    // Initialize ALL tracking and system fields to match web form structure exactly
    // Donation Tracking Fields
    requestData.donationLogIds = [];
    requestData.allDonationLogIds = [];
    requestData.unitsFulfilled = 0;
    requestData.donorSummary = "";
    requestData.fulfilledAt = "";
    requestData.lastDonationAt = null;

    // Closure Tracking Fields
    requestData.closedAt = null;
    requestData.closedBy = "";
    requestData.closedByUid = "";
    requestData.closureReason = "";
    requestData.closureType = "";
    requestData.closureHistory = [];
    requestData.totalClosures = 0;

    // Reopen Tracking Fields
    requestData.reopenedAt = null;
    requestData.reopenCount = 0;

    // Verification Fields
    requestData.verifiedAt = null;
    requestData.verifiedByName = "";
    requestData.verifiedByUid = "";

    // Update Tracking Fields
    requestData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    requestData.updatedBy = "";
    requestData.updatedByUid = "";
    requestData.lastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    requestData.lastUpdatedByName = "";
    requestData.lastUpdatedByUid = "";

    // Store Telegram metadata separately for audit trail
    requestData.telegramUserId = telegramId;
    requestData.telegramUsername = userData.username || '';
    requestData.telegramPhone = userData.phoneNumber || '';

    console.log("✅ Validation passed, proceeding with submission...");

    try {
        // C. Duplicate Check
        const existingDoc = await checkDuplicate(requestData.patientName, requestData.contactNumber);

        if (existingDoc) {
            const existingData = existingDoc.data();
            console.log("📝 Found existing request, updating...");

            // Build update object - only include non-empty fields from new request
            const updateData = {};

            // Fields that should NEVER be updated (preserve original values)
            const preserveFields = ['createdAt', 'submittedBy', 'source', 'createdByUid', 'createdByName', 'migratedAt'];

            // Only update fields that have non-empty values
            Object.keys(requestData).forEach(key => {
                const value = requestData[key];
                // Skip if value is empty string, null, undefined, OR if it's a preserve field
                if (value !== "" && value !== null && value !== undefined && !preserveFields.includes(key)) {
                    updateData[key] = value;
                }
            });

            // Handle status change and donation tracking
            const wasClosed = existingData.status && existingData.status.toLowerCase() === "closed";
            if (wasClosed) {
                updateData.status = "Reopened";
                updateData.reopenedAt = admin.firestore.FieldValue.serverTimestamp();

                // RESET donation tracking for new cycle
                updateData.unitsFulfilled = 0;
                updateData.donorSummary = "";
                updateData.donationLogIds = [];

                // PRESERVE donation history
                // Move current donations to all-time history if they exist
                if (existingData.donationLogIds && existingData.donationLogIds.length > 0) {
                    const currentAllDonations = existingData.allDonationLogIds || [];
                    updateData.allDonationLogIds = [...currentAllDonations, ...existingData.donationLogIds];
                }

                // Track reopen count
                updateData.reopenCount = admin.firestore.FieldValue.increment(1);

                console.log("♻️ Reopening closed request - reset donation tracking, preserved history");
            }
            // If not closed, keep existing status (don't update it)

            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            console.log("📝 Updating with data:", JSON.stringify(updateData));

            try {
                // Perform the update
                await existingDoc.ref.update(updateData);
                console.log("✅ Update successful!");

                // Verify the update by reading back the document
                const verifyDoc = await existingDoc.ref.get();
                if (!verifyDoc.exists) {
                    throw new Error("Document verification failed - document not found after update");
                }
                console.log("✅ Update verified in database!");

                // Add history entry if reopened
                if (wasClosed) {
                    try {
                        const historyRef = admin.firestore()
                            .collection('emergency_requests')
                            .doc(existingDoc.id)
                            .collection('updates');

                        await historyRef.add({
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            type: 'REOPENED',
                            userName: createdByName,
                            userUid: `telegram_${telegramId}`,
                            note: `Request reopened via Telegram by ${createdByName}. Previous status: ${existingData.status}`,
                            telegramId: telegramId,
                            phoneNumber: userData.phoneNumber || ''
                        });
                        console.log("✅ History entry added for reopen");
                    } catch (historyError) {
                        console.error("⚠️ Failed to add history entry:", historyError);
                        // Don't fail the whole operation if history fails
                    }
                }

            } catch (updateError) {
                console.error("❌ Update failed:", updateError);
                const errorMsg = `❌ **Error Updating Request**\n\n` +
                    `Patient: ${requestData.patientName}\n` +
                    `Error: ${updateError.message}\n\n` +
                    `Please try again or contact support.`;
                return ctx.reply(errorMsg);
            }

            // Build list of ACTUALLY CHANGED fields with old → new values
            // Only include USER-SUBMITTED fields, not system-generated ones
            const userSubmittedFields = {
                'patientName': 'Patient Name',
                'patientAge': 'Age',
                'requiredBloodGroup': 'Blood Group',
                'unitsRequired': 'Units Required',
                'hospitalName': 'Hospital',
                'hospitalCity': 'Location',
                'patientSufferingFrom': 'Suffering From',
                'contactPerson': 'Contact Person',
                'contactNumber': 'Contact Number'
            };

            const changedFields = [];

            // Only compare fields that were actually submitted by the user (present in requestData)
            Object.keys(requestData).forEach(key => {
                // Skip if not a user-submitted field
                if (!userSubmittedFields[key]) return;

                // Check if this field exists in updateData (was actually updated)
                if (!updateData.hasOwnProperty(key)) return;

                const oldValue = existingData[key];
                const newValue = updateData[key];

                // Compare values (handle different types)
                const oldStr = String(oldValue || '').trim();
                const newStr = String(newValue || '').trim();

                if (oldStr !== newStr) {
                    const fieldLabel = userSubmittedFields[key];
                    changedFields.push(`• ${fieldLabel}: ${oldStr || '(empty)'} → ${newStr}`);
                }
            });

            // Handle different scenarios
            const currentStatus = existingData.status || 'Open';

            // CASE 1: Exact duplicate (no changes detected)
            if (changedFields.length === 0) {
                if (wasClosed) {
                    // Closed request with no changes - reopen it
                    return ctx.reply(
                        `🔄 **Request Reopened**\n\n` +
                        `✅ Database confirmed!\n` +
                        `Patient: ${requestData.patientName}\n` +
                        `Document ID: ${existingDoc.id}\n\n` +
                        `⚠️ No changes detected - reopened with same data`
                    );
                } else {
                    // Active request (Open/Verified/Reopened) with no changes
                    return ctx.reply(
                        `ℹ️ **Request Already Exists**\n\n` +
                        `Patient: ${requestData.patientName}\n` +
                        `Document ID: ${existingDoc.id}\n` +
                        `Status: ${currentStatus}\n\n` +
                        `⚠️ No changes detected - no action taken`
                    );
                }
            }

            // CASE 2: Changes detected
            const fieldsText = `\n\n📝 Updated fields:\n${changedFields.join('\n')}`;

            // Add history entry for the update
            try {
                const historyRef = admin.firestore()
                    .collection('emergency_requests')
                    .doc(existingDoc.id)
                    .collection('updates');

                // Build a readable summary of changes for the history note
                const changesSummary = changedFields
                    .map(field => field.replace('• ', ''))
                    .join(', ');

                const historyEntry = {
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: wasClosed ? 'REOPENED' : 'UPDATED',
                    userName: createdByName,
                    userUid: `telegram_${telegramId}`,
                    note: wasClosed
                        ? `Request reopened via Telegram by ${createdByName}. Changes: ${changesSummary}`
                        : `Request updated via Telegram by ${createdByName}. Changes: ${changesSummary}`,
                    changedFields: changedFields.map(field => field.replace('• ', '')),
                    telegramId: telegramId,
                    phoneNumber: userData.phoneNumber || ''
                };

                await historyRef.add(historyEntry);
                console.log(`✅ History entry added for ${wasClosed ? 'reopen' : 'update'}`);
            } catch (historyError) {
                console.error('⚠️ Failed to add history entry:', historyError);
                // Don't fail the whole operation if history fails
            }

            // Send success message ONLY after database confirmation
            if (wasClosed) {
                return ctx.reply(
                    `🔄 **Request Reopened & Saved**\n\n` +
                    `✅ Database confirmed!\n` +
                    `Patient: ${requestData.patientName}\n` +
                    `Document ID: ${existingDoc.id}${fieldsText}`
                );
            } else {
                return ctx.reply(
                    `✅ **Request Updated & Saved**\n\n` +
                    `✅ Database confirmed!\n` +
                    `Patient: ${requestData.patientName}\n` +
                    `Document ID: ${existingDoc.id}${fieldsText}`
                );
            }
        }

        // D. New Request Creation
        // 1. Save to Firestore with custom ID (matching web form format)
        requestData.status = "Open"; // Changed from "pending" to "Open" to match frontend display

        // Generate custom document ID: patientname_contactnumber_timestamp
        const generateRequestId = (patientName, contactNumber) => {
            const cleanName = (patientName || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanContact = (contactNumber || '').toString().replace(/[^0-9]/g, '');
            return `${cleanName}_${cleanContact}_${Date.now()}`;
        };

        const customDocId = generateRequestId(requestData.patientName, requestData.contactNumber);
        let newDocRef;

        try {
            // Use set() with custom ID instead of add()
            newDocRef = db.collection("emergency_requests").doc(customDocId);
            await newDocRef.set(requestData);
            console.log("✅ Document created with ID:", customDocId);

            // Verify the document was actually saved
            const verifyDoc = await newDocRef.get();
            if (!verifyDoc.exists) {
                throw new Error("Document verification failed - document not found after creation");
            }
            console.log("✅ New request verified in database!");

            // Add history entry for new request creation
            try {
                const historyRef = admin.firestore()
                    .collection('emergency_requests')
                    .doc(customDocId)
                    .collection('updates');

                await historyRef.add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'CREATED',
                    userName: createdByName,
                    userUid: `telegram_${telegramId}`,
                    note: `Request created via Telegram by ${createdByName}`,
                    telegramId: telegramId,
                    phoneNumber: userData.phoneNumber || ''
                });
                console.log("✅ History entry added for new request");
            } catch (historyError) {
                console.error("⚠️ Failed to add history entry:", historyError);
                // Don't fail the whole operation if history fails
            }

        } catch (createError) {
            console.error("❌ Failed to create request:", createError);
            const errorMsg = `❌ **Error Creating Request**\n\n` +
                `Patient: ${requestData.patientName}\n` +
                `Error: ${createError.message}\n\n` +
                `Please try again or contact support.`;
            return ctx.reply(errorMsg);
        }

        // 2. Reply to User ONLY after database confirmation
        await ctx.reply(`✅ **Request Created & Saved**\n\n✅ Database confirmed!\nPatient: ${requestData.patientName}\nHospital: ${requestData.hospitalName}\nLocation: ${requestData.hospitalCity || 'N/A'}\nDocument ID: ${customDocId}\n\nWe will notify donors immediately.`);

    } catch (error) {
        console.error("Error processing request:", error);

        // Send detailed error message to user
        const errorMessage = `❌ **Error Occurred**\n\n` +
            `Operation: ${existingDoc ? 'Update Request' : 'Create Request'}\n` +
            `Patient: ${requestData.patientName || 'Unknown'}\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again or contact support.`;

        await ctx.reply(errorMessage);
    }
});


// Existing Auth Trigger (Modified to prevent race conditions)
exports.processNewUser = functions.auth.user().onCreate(async (user) => {
    const { uid, email, phoneNumber, displayName } = user;
    try {
        // Only create user document if displayName is already set (e.g., from OAuth providers)
        // For phone auth, let the client-side code create the profile with displayName
        if (!displayName) {
            console.log(`⏭️ Skipping auto-creation for user ${uid} - waiting for client to set displayName`);
            return null;
        }

        const userRef = admin.firestore().collection("users").doc(uid);
        const usersSnapshot = await admin.firestore().collection("users").limit(1).get();
        const isFirstUser = usersSnapshot.empty;

        await userRef.set({
            uid: uid,
            displayName: displayName,
            email: email || null,
            phoneNumber: phoneNumber || null,
            status: isFirstUser ? "approved" : "pending",
            role: isFirstUser ? "superuser" : "volunteer",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`✅ User profile created for ${uid} with displayName: ${displayName}`);
        return null;
    } catch (error) {
        console.error(`❌ Error in processNewUser for ${uid}:`, error);
        return null;
    }
});

// Export the Telegram Webhook
// URL will be: https://us-central1-<YOUR-PROJECT>.cloudfunctions.net/telegramBot
exports.telegramBot = functions.https.onRequest(async (req, res) => {
    console.log("🔔 Webhook called, method:", req.method);
    console.log("📦 Request body:", JSON.stringify(req.body));

    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error("❌ Bot Handle Error:", err);
        res.status(200).send('OK'); // Still return 200 to Telegram to avoid retries
    }
});

// Export HTTP Callable Function for Web Form Twitter Posting
// This allows the web form to post blood requests to Twitter
// URL will be called via Firebase SDK: functions.httpsCallable('postRequestToTwitter')
exports.postRequestToTwitter = functions.https.onCall(async (data, context) => {
    console.log("ℹ️ postRequestToTwitter called - automated Twitter posting is disabled.");
    return {
        success: true,
        disabled: true,
        message: 'Twitter posting on blood request submission is disabled'
    };
});

// Export HTTP Callable Function for Donor Registration
exports.submitDonorRegistration = functions.https.onCall(async (data, context) => {
    try {
        console.log("📥 Donor registration request received");

        if (!data || !data.donorData) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Donor data is required'
            );
        }

        const donorData = data.donorData;

        // Validate mandatory fields
        if (!donorData.fullName || !donorData.contactNumber) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Full Name and Contact Number are required'
            );
        }

        const db = admin.firestore();
        const donorsRef = db.collection('donors');
        let existingDonor = null;
        let donorId = null;

        const searchName = (donorData.fullName || '').trim();
        const searchContact = normalizePhoneNumber(donorData.contactNumber);

        // 1. Search by Contact Number (Phone number is the unique donor identifier)
        if (searchContact) {
            const snapshot = await donorsRef.where('contactNumber', '==', searchContact).get();
            if (!snapshot.empty) {
                existingDonor = snapshot.docs[0];
                donorId = existingDonor.id;
            }
        }

        // Generate donor ID if new
        if (!donorId) {
            const cleanName = searchName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanContact = searchContact.replace(/[^0-9]/g, '');
            donorId = `${cleanName}_${cleanContact}_${Date.now()}`;
        }

        // Calculate age
        let age = 0;
        if (donorData.dateOfBirth) {
            const birthDate = new Date(donorData.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        // Track who registered
        let registeredBy = '';
        let registeredByUid = null;

        if (context.auth) {
            registeredBy = context.auth.token.name || context.auth.token.phone_number || context.auth.token.email || 'User';
            registeredByUid = context.auth.uid;
        } else {
            registeredBy = donorData.fullName;
            registeredByUid = null;
        }

        // Prepare Firestore data
        const firestoreData = {
            fullName: donorData.fullName || '',
            contactNumber: searchContact,
            bloodGroup: donorData.bloodGroup || donorData.bloodType || '',
            area: donorData.area || '',
            emergencyAvailable: donorData.emergencyAvailable || donorData.isEmergencyAvailable || 'No',
            isEmergencyAvailable: donorData.emergencyAvailable || donorData.isEmergencyAvailable || 'No',
            dateOfBirth: donorData.dateOfBirth || '',
            gender: donorData.gender || '',
            preferredContact: donorData.preferredContact || 'call',
            age: age || 0,
            weight: donorData.weight || '',
            lastDonation: donorData.lastDonation || donorData.lastDonatedAt || '',
            lastDonatedAt: donorData.lastDonation || donorData.lastDonatedAt || '',
            medicalHistory: donorData.medicalHistory || '',
            email: donorData.email || '',
            city: donorData.city || '',
            registeredBy: registeredBy,
            registeredByUid: registeredByUid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: registeredBy || 'System'
        };

        if (existingDonor) {
            const existingData = existingDonor.data();
            
            if (existingData.registeredAt) {
                firestoreData.registeredAt = existingData.registeredAt;
            } else {
                firestoreData.registeredAt = admin.firestore.FieldValue.serverTimestamp();
            }

            if (existingData.createdAt) {
                firestoreData.createdAt = existingData.createdAt;
            } else {
                firestoreData.createdAt = admin.firestore.FieldValue.serverTimestamp();
            }

            if (existingData.createdBy) {
                firestoreData.createdBy = existingData.createdBy;
            } else {
                firestoreData.createdBy = registeredBy || 'System (Public Registration)';
            }

            if (existingData.createdByUid !== undefined) {
                firestoreData.createdByUid = existingData.createdByUid;
            } else {
                firestoreData.createdByUid = registeredByUid || null;
            }

            if (existingData.source) {
                firestoreData.source = existingData.source;
            } else {
                firestoreData.source = 'public_registration';
            }
        } else {
            // New donor - set all fields
            firestoreData.registeredAt = admin.firestore.FieldValue.serverTimestamp();
            firestoreData.createdAt = admin.firestore.FieldValue.serverTimestamp();
            firestoreData.createdBy = registeredBy || 'System (Public Registration)';
            firestoreData.createdByUid = registeredByUid || null;
            firestoreData.source = donorData.source || (context.auth ? 'web_form' : 'web_form_public');
        }

        // Write to Firestore using Admin SDK
        await donorsRef.doc(donorId).set(firestoreData, { merge: true });
        console.log(`✅ Donor ${donorId} registered successfully`);

        return { success: true, donorId };

    } catch (error) {
        console.error("❌ Error in submitDonorRegistration:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to register donor'
        );
    }
});

// Export HTTP Callable Function for Emergency Request
exports.submitEmergencyBloodRequest = functions.https.onCall(async (data, context) => {
    try {
        console.log("📥 Emergency blood request received");

        if (!data || !data.requestData) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Request data is required'
            );
        }

        const requestData = data.requestData;

        // Validate required fields
        const requiredFields = ['patientName', 'contactNumber', 'bloodType', 'hospitalName'];
        const missingFields = requiredFields.filter(field => !requestData[field]);

        if (missingFields.length > 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `Missing required fields: ${missingFields.join(', ')}`
            );
        }

        // Standardize Hospital Name in Cloud Function
        if (requestData.hospitalName) {
            const matchedHospital = resolveHospital(requestData.hospitalName);
            if (matchedHospital) {
                requestData.hospitalName = matchedHospital.name;
                if (!requestData.city && !requestData.hospitalCity) {
                    requestData.city = matchedHospital.city;
                    requestData.hospitalCity = matchedHospital.city;
                }
                if (!requestData.hospitalAddress) {
                    requestData.hospitalAddress = matchedHospital.address;
                }
            } else {
                requestData.hospitalName = toTitleCase(requestData.hospitalName);
            }
        }

        const db = admin.firestore();
        const requestsRef = db.collection('emergency_requests');
        let existingDoc = null;
        let requestId = null;

        const searchName = (requestData.patientName || '').trim();
        const searchContact = normalizePhoneNumber(requestData.contactNumber);

        // 1. Search by Contact Number
        if (searchContact) {
            const snapshot = await requestsRef.where('contactNumber', '==', searchContact).get();
            if (!snapshot.empty) {
                existingDoc = snapshot.docs[0];
            }
        }

        // 2. Search by Patient Name (Fallback)
        if (!existingDoc && searchName) {
            const snapshot = await requestsRef.where('patientName', '==', searchName).get();
            if (!snapshot.empty) {
                existingDoc = snapshot.docs[0];
            }
        }

        // Track who created
        let createdByName = '';
        let createdByUid = null;
        let source = '';

        if (context.auth) {
            createdByName = context.auth.token.name || context.auth.token.phone_number || context.auth.token.email || 'User';
            createdByUid = context.auth.uid;
            source = 'web_form';
        } else {
            createdByName = requestData.patientName;
            createdByUid = null;
            source = 'web_form_public';
        }

        if (existingDoc) {
            requestId = existingDoc.id;
            const currentData = existingDoc.data();

            // Check if request is active
            if (currentData.status === 'Open' || currentData.status === 'Verified' || currentData.status === 'Reopened') {
                return { success: false, error: 'DUPLICATE_ACTIVE_REQUEST', existingRequest: { id: requestId, status: currentData.status } };
            }

            // Prepare update data for Reopen
            const updateData = {
                patientAge: requestData.patientAge || currentData.patientAge || '',
                patientSufferingFrom: requestData.diagnosis || currentData.patientSufferingFrom || '',
                requiredBloodGroup: requestData.bloodType || currentData.requiredBloodGroup || '',
                bloodComponents: requestData.bloodComponents || currentData.bloodComponents || ['Whole Blood'],
                componentBreakdown: requestData.componentBreakdown || currentData.componentBreakdown || [],
                unitsRequired: requestData.unitsRequired || currentData.unitsRequired || '',
                unitsRequiredText: requestData.unitsRequiredText || currentData.unitsRequiredText || (requestData.unitsRequired ? `${requestData.unitsRequired} units` : ''),
                unitsFulfilled: 0,
                donorSummary: '',
                donationLogIds: [],
                hospitalName: requestData.hospitalName || currentData.hospitalName || '',
                hospitalAddress: requestData.hospitalAddress || currentData.hospitalAddress || '',
                hospitalCity: requestData.city || requestData.hospitalCity || currentData.hospitalCity || '',
                contactPerson: requestData.contactPerson || currentData.contactPerson || '',
                contactNumber: searchContact || currentData.contactNumber || '',
                contactEmail: requestData.contactEmail || currentData.contactEmail || '',
                status: 'Reopened',
                urgencyLevel: requestData.urgency || requestData.urgencyLevel || currentData.urgencyLevel || 'Normal',
                additionalInfo: requestData.additionalInfo || currentData.additionalInfo || '',
                updatedBy: createdByName,
                updatedByUid: createdByUid || 'public',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdatedByName: createdByName,
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: source,
                reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
                reopenedBy: createdByName,
                reopenedByUid: createdByUid || 'public',
                reopenCount: admin.firestore.FieldValue.increment(1)
            };

            // Preserve donation history
            if (currentData.donationLogIds && currentData.donationLogIds.length > 0) {
                const currentAllDonations = currentData.allDonationLogIds || [];
                updateData.allDonationLogIds = [...currentAllDonations, ...currentData.donationLogIds];
            }

            // Update the doc
            await requestsRef.doc(requestId).update(updateData);

            // Add history entry for reopen
            const historyRef = requestsRef.doc(requestId).collection('updates');
            await historyRef.add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'REOPENED',
                userName: createdByName,
                userUid: createdByUid || 'public',
                note: context.auth 
                    ? `Request reopened by ${createdByName} via web form`
                    : `Request reopened via public form`
            });

            return { success: true, requestId, action: 'REOPENED' };
        }

        // Create new request
        const generateRequestId = (pName, cNumber) => {
            const cleanName = (pName || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanContact = (cNumber || '').toString().replace(/[^0-9]/g, '');
            return `${cleanName}_${cleanContact}_${Date.now()}`;
        };

        requestId = generateRequestId(requestData.patientName, searchContact);

        // Hybrid entity standardization for web form submissions
        let normalizedDiagnosis = requestData.diagnosis || '';
        if (normalizedDiagnosis) {
            const diagRes = await resolveDiagnosisHybrid(normalizedDiagnosis, db);
            if (diagRes && diagRes.name) {
                normalizedDiagnosis = diagRes.name;
            } else {
                normalizedDiagnosis = toTitleCase(normalizedDiagnosis);
            }
        }

        let normalizedHospital = requestData.hospitalName || '';
        let normalizedCity = requestData.city || '';
        let normalizedAddress = requestData.hospitalAddress || '';
        if (normalizedHospital) {
            const hospRes = await resolveHospitalHybrid(normalizedHospital, db);
            if (hospRes && hospRes.name) {
                normalizedHospital = hospRes.name;
                if (!normalizedCity) normalizedCity = hospRes.city || '';
                if (!normalizedAddress) normalizedAddress = hospRes.address || '';
            } else {
                normalizedHospital = toTitleCase(normalizedHospital);
            }
        }

        const firestoreData = {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            patientName: requestData.patientName || '',
            patientAge: requestData.patientAge || '',
            patientSufferingFrom: normalizedDiagnosis,
            requiredBloodGroup: requestData.bloodType || '',
            bloodComponents: requestData.bloodComponents || ['Whole Blood'],
            componentBreakdown: requestData.componentBreakdown || [],
            unitsRequired: requestData.unitsRequired || '',
            unitsRequiredText: requestData.unitsRequiredText || (requestData.unitsRequired ? `${requestData.unitsRequired} units` : ''),
            unitsFulfilled: 0,
            hospitalName: normalizedHospital,
            hospitalAddress: normalizedAddress,
            hospitalCity: normalizedCity,
            contactPerson: requestData.contactPerson || '',
            contactNumber: searchContact,
            contactEmail: requestData.contactEmail || '',
            urgencyLevel: requestData.urgency || requestData.urgencyLevel || 'Normal',
            status: 'Open',
            additionalInfo: requestData.additionalInfo || '',
            createdByName: createdByName,
            createdByUid: createdByUid || 'public',
            verifiedByName: '',
            verifiedByUid: '',
            verifiedAt: null,
            closedBy: '',
            closedByUid: '',
            closedAt: null,
            closureReason: '',
            closureType: '',
            fulfilledAt: '',
            reopenedAt: null,
            reopenCount: 0,
            donorSummary: '',
            donationLogIds: [],
            allDonationLogIds: [],
            lastDonationAt: null,
            updatedBy: '',
            updatedByUid: '',
            updatedAt: null,
            lastUpdatedByName: '',
            lastUpdatedByUid: '',
            lastUpdatedAt: null,
            closureHistory: [],
            totalClosures: 0,
            source: source
        };

        await requestsRef.doc(requestId).set(firestoreData);

        // Add history entry for creation
        const historyRef = requestsRef.doc(requestId).collection('updates');
        await historyRef.add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'CREATED',
            userName: createdByName,
            userUid: createdByUid || 'public',
            note: context.auth
                ? `Request created by ${createdByName} via web form`
                : `Request submitted via public form`
        });

        return { success: true, requestId, action: 'CREATED' };

    } catch (error) {
        console.error("❌ Error in submitEmergencyBloodRequest:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to submit emergency request'
        );
    }
});

/**
 * Callable function to normalize blood request entities (Diagnosis & Hospital) on demand
 */
exports.normalizeBloodRequestEntities = functions.https.onCall(async (data, context) => {
    const rawDiagnosis = data && data.diagnosis;
    const rawHospital = data && data.hospital;

    const result = {
        diagnosis: null,
        hospital: null
    };

    if (rawDiagnosis) {
        result.diagnosis = await resolveDiagnosisHybrid(rawDiagnosis, db);
    }
    if (rawHospital) {
        result.hospital = await resolveHospitalHybrid(rawHospital, db);
    }

    return result;
});

// --- HERO CARD TELEGRAM NOTIFICATION CONFIG ---
// Add or remove usernames, numeric chat IDs, or channel handles here.
// Users must have messaged/started the bot at least once so their telegramId is stored in telegram_users.
const HERO_CARD_RECIPIENTS = [
    'nikunjmistri'
];

// Delivery mode: 'photo' (renders full image card in chat), 'document' (sends lossless .png file), or 'both'
const HERO_CARD_DELIVERY_MODE = 'photo';

/**
 * Resolves a recipient string (username, numeric ID, or channel) to a Telegram chatId
 * @param {string} recipient - e.g. 'nikunjmistri', '@nikunjmistri', '123456789', '@channelname'
 * @returns {Promise<string|null>} - Resolved numeric or channel chatId, or null if not found
 */
const resolveTelegramChatId = async (recipient) => {
    if (!recipient) return null;
    const raw = String(recipient).trim();

    // 1. If it's a numeric ID (e.g. "123456789" or "-100123456789")
    if (/^-?\d+$/.test(raw)) {
        return raw;
    }

    const cleanUsername = raw.replace(/^@/, '').toLowerCase();

    // 2. Look up username in telegram_users collection
    try {
        const querySnap = await db.collection("telegram_users")
            .where("username", "==", cleanUsername)
            .limit(1)
            .get();

        if (!querySnap.empty) {
            const data = querySnap.docs[0].data();
            return String(data.telegramId || querySnap.docs[0].id);
        }

        // Case-insensitive fallback scan across existing registered telegram users
        const allUsersSnap = await db.collection("telegram_users").get();
        for (const doc of allUsersSnap.docs) {
            const data = doc.data();
            const u = (data.username || '').replace(/^@/, '').toLowerCase();
            if (u === cleanUsername) {
                return String(data.telegramId || doc.id);
            }
        }
    } catch (err) {
        console.warn(`⚠️ Error querying telegram_users for "${recipient}":`, err.message);
    }

    // 3. If raw starts with '@' and is a public channel/supergroup
    if (raw.startsWith('@')) {
        return raw;
    }

    return null;
};

/**
 * Callable Cloud Function to dispatch generated Hero Appreciation Cards to Telegram recipients in PNG format
 */
exports.dispatchHeroCardToTelegram = functions.https.onCall(async (data, context) => {
    try {
        if (!telegramConfig.token) {
            console.warn("⚠️ Telegram bot token is not configured in functions.config().telegram.token. Skipping dispatch.");
            return { success: false, reason: "bot_token_not_configured" };
        }

        if (!data || !data.pngBase64) {
            throw new functions.https.HttpsError("invalid-argument", "Missing required pngBase64 data.");
        }

        const donorName = (data.donorName || "Hero Donor").trim();
        const milestone = parseInt(data.milestone, 10) || 1;
        const hospitalName = (data.hospitalName || "").trim();
        const patientName = (data.patientName || "").trim();

        // Convert base64 data to binary Buffer
        const base64Content = data.pngBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Content, "base64");

        // Ordinal suffix (1st, 2nd, 3rd, 4th...)
        const getOrdinal = (n) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return s[(v - 20) % 10] || s[v] || s[0];
        };
        const suffix = getOrdinal(milestone);
        const safeName = donorName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `LifeSavers_Hero_${safeName}_${milestone}${suffix}.png`;

        // Format appreciation caption
        let caption = `🎖️ <b>Hero Appreciation Card Generated!</b>\n\n`;
        caption += `👤 <b>Donor:</b> ${donorName}\n`;
        caption += `🩸 <b>Milestone:</b> ${milestone}${suffix} Blood Donation\n`;
        if (hospitalName) caption += `🏥 <b>Hospital:</b> ${hospitalName}\n`;
        if (patientName && patientName !== 'Direct / Voluntary Camp' && patientName !== 'Not specified') {
            caption += `🎗️ <b>Cause/Patient:</b> ${patientName}\n`;
        }
        caption += `\n❤️ <i>Saved to LifeSavers Gallery & Studio</i>\n🌐 https://lifesaversunited.org`;

        const dispatchResults = [];

        for (const recipient of HERO_CARD_RECIPIENTS) {
            try {
                const chatId = await resolveTelegramChatId(recipient);
                if (!chatId) {
                    console.warn(`⚠️ Telegram user "${recipient}" could not be resolved. Ensure they have sent /start to the bot.`);
                    dispatchResults.push({ recipient, success: false, reason: "user_not_found_or_not_started" });
                    continue;
                }

                // Send via configured delivery mode
                if (HERO_CARD_DELIVERY_MODE === 'document') {
                    await bot.telegram.sendDocument(chatId, {
                        source: imageBuffer,
                        filename: filename
                    }, {
                        caption: caption,
                        parse_mode: "HTML"
                    });
                } else if (HERO_CARD_DELIVERY_MODE === 'both') {
                    await bot.telegram.sendPhoto(chatId, {
                        source: imageBuffer,
                        filename: filename
                    }, {
                        caption: caption,
                        parse_mode: "HTML"
                    });
                    await bot.telegram.sendDocument(chatId, {
                        source: imageBuffer,
                        filename: filename
                    });
                } else {
                    // Default: 'photo' (renders visual image card in chat)
                    await bot.telegram.sendPhoto(chatId, {
                        source: imageBuffer,
                        filename: filename
                    }, {
                        caption: caption,
                        parse_mode: "HTML"
                    });
                }

                console.log(`✅ Hero Card PNG dispatched to Telegram recipient: ${recipient} (${chatId})`);
                dispatchResults.push({ recipient, success: true, chatId });
            } catch (sendErr) {
                console.error(`❌ Failed sending Hero Card to "${recipient}":`, sendErr);
                dispatchResults.push({ recipient, success: false, error: sendErr.message });
            }
        }

        return {
            success: true,
            totalRecipients: HERO_CARD_RECIPIENTS.length,
            results: dispatchResults
        };

    } catch (err) {
        console.error("❌ Error in dispatchHeroCardToTelegram:", err);
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        throw new functions.https.HttpsError("internal", err.message || "Failed to dispatch hero card to Telegram");
    }
});



