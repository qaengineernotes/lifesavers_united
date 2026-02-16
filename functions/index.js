const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Telegraf, Markup } = require("telegraf");
const { TwitterApi } = require("twitter-api-v2");

admin.initializeApp();

const db = admin.firestore();

// Initialize Bot and Twitter Client (lazily or global if config available)
// We rely on functions.config() for secrets
// Run: firebase functions:config:set telegram.token="YOUR_TOKEN" twitter.api_key="KEY" ...
const bot = new Telegraf(functions.config().telegram.token);

// Twitter Client Setup
const twitterClient = new TwitterApi({
    appKey: functions.config().twitter.api_key,
    appSecret: functions.config().twitter.api_secret,
    accessToken: functions.config().twitter.access_token,
    accessSecret: functions.config().twitter.access_secret,
});

// --- SHARED TWITTER POSTING FUNCTION ---

/**
 * Post a blood request to Twitter
 * @param {Object} requestData - The blood request data
 * @returns {Object} - { success: boolean, tweetLink?: string, error?: string }
 */
const postBloodRequestToTwitter = async (requestData) => {
    try {
        // Format: URGENT: [Name], [Age], needs [Units] units [Blood Group] blood RIGHT NOW...
        const tweetText = `URGENT: ${requestData.patientName}, ${requestData.patientAge || 'N/A'}, needs ${requestData.unitsRequired} units ${requestData.requiredBloodGroup} blood RIGHT NOW at ${requestData.hospitalName}, ${requestData.hospitalCity || 'N/A'}!
Your donation can save a life today. Please come forward!
Call: ${requestData.contactNumber}
https://lifesaversunited.org
#LifeSaversUnited #BloodDonation #SaveLives #${requestData.hospitalCity?.replace(/\s/g, "") || "India"} #Emergency`;

        console.log("📤 Posting to Twitter...");
        const { data: tweet } = await twitterClient.v2.tweet(tweetText);
        const tweetLink = `https://twitter.com/user/status/${tweet.id}`;

        console.log("✅ Tweet posted successfully:", tweetLink);
        return { success: true, tweetLink };

    } catch (error) {
        console.error("❌ Twitter posting failed:", error);
        return {
            success: false,
            error: error.message || "Unknown error",
            tweetLink: "(Twitter posting failed - check logs)"
        };
    }
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

// Parse the "One-Shot" Text
const parseRequestText = (text) => {
    // Map Telegram field names to Firestore database field names
    const mapping = {
        "patient name": "patientName",
        "age": "patientAge",
        "blood group": "requiredBloodGroup",
        "units required": "unitsRequired",
        "hospital": "hospitalName",
        "location": "hospitalCity",
        "suffering from": "patientSufferingFrom",
        "contact person": "contactPerson",
        "contact number": "contactNumber"
    };

    const lines = text.split("\n");
    const data = {};

    lines.forEach(line => {
        if (!line.includes(":")) return;
        const [key, ...values] = line.split(":");
        const cleanKey = key.trim().toLowerCase();
        const cleanValue = values.join(":").trim(); // Rejoin in case value has :

        if (mapping[cleanKey]) {
            data[mapping[cleanKey]] = cleanValue;
        }
    });

    // Normalize contact number if present
    if (data.contactNumber) {
        data.contactNumber = normalizePhoneNumber(data.contactNumber);
    }

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
            return ctx.reply("Welcome to LifeSavers Bot! \nPaste your request in the format:\n\nPatient Name: ...\nBlood Group: ...\n...");
        }
        return; // Silent fail for random text to avoid spamming
    }

    const requestData = parseRequestText(cleanText);
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

        // 2. Post to Twitter (only after database confirmation)
        const twitterResult = await postBloodRequestToTwitter(requestData);
        const tweetLink = twitterResult.tweetLink || "N/A";

        // 3. Reply to User ONLY after database confirmation
        await ctx.reply(`✅ **Request Created & Saved**\n\n✅ Database confirmed!\nPatient: ${requestData.patientName}\nDocument ID: ${customDocId}\nTweet: ${tweetLink}\n\nWe will notify donors immediately.`);

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
    try {
        console.log("📥 Web form Twitter posting request received");

        // Validate request data
        if (!data || !data.requestData) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Request data is required'
            );
        }

        const requestData = data.requestData;

        // Validate required fields
        const requiredFields = ['patientName', 'requiredBloodGroup', 'unitsRequired', 'hospitalName', 'contactNumber'];
        const missingFields = requiredFields.filter(field => !requestData[field]);

        if (missingFields.length > 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `Missing required fields: ${missingFields.join(', ')}`
            );
        }

        // Post to Twitter using shared function
        const result = await postBloodRequestToTwitter(requestData);

        console.log("📤 Twitter posting result:", result.success ? "Success" : "Failed");

        return result;

    } catch (error) {
        console.error("❌ Error in postRequestToTwitter:", error);

        // If it's already an HttpsError, rethrow it
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        // Otherwise, wrap it in an HttpsError
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to post to Twitter'
        );
    }
});
