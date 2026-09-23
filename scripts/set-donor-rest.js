/**
 * Set or Cancel Donor Rest Mode in Firestore via Firebase Admin SDK
 * Usage: node scripts/set-donor-rest.js '{"donorId":"...", "contactNumber":"...", "temporaryRest":{...}, "isEmergencyAvailable":"no"}'
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../lifesavers-united-org-firebase-adminsdk-fbsvc-8c58d66d9e.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

function normalizePhoneNumber(phone) {
    if (!phone) return '';
    let norm = String(phone).replace(/\D/g, '');
    if (norm.startsWith('91') && norm.length > 10) norm = norm.substring(2);
    if (norm.length > 10) norm = norm.slice(-10);
    return norm;
}

async function getPayload() {
    if (process.argv[2]) {
        return JSON.parse(process.argv[2]);
    }
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(e);
            }
        });
        process.stdin.on('error', reject);
    });
}

async function handleRestMode() {
    try {
        const payload = await getPayload();
        const { donorId, contactNumber, temporaryRest, isEmergencyAvailable } = payload;

        let targetDocId = donorId;
        const cleanPhone = normalizePhoneNumber(contactNumber);

        // Find doc in Firestore if donorId is missing or is mock test prefix
        if (!targetDocId || targetDocId.startsWith('test_donor_')) {
            if (cleanPhone) {
                const snap = await db.collection('donors').where('contactNumber', 'in', [
                    cleanPhone,
                    '+91' + cleanPhone,
                    Number(cleanPhone)
                ]).get();
                if (!snap.empty) {
                    targetDocId = snap.docs[0].id;
                }
            }
        }

        if (!targetDocId) {
            console.log(JSON.stringify({ success: false, error: 'Donor document not found in Firestore' }));
            process.exit(0);
        }

        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (temporaryRest && temporaryRest.until) {
            let untilDate = new Date(temporaryRest.until);
            if (isNaN(untilDate.getTime())) {
                untilDate = new Date();
                untilDate.setDate(untilDate.getDate() + 30);
            }
            updateData.temporaryRest = {
                reason: temporaryRest.reason || 'Medical Recovery',
                until: admin.firestore.Timestamp.fromDate(untilDate),
                activatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            updateData.isEmergencyAvailable = 'No';
            updateData.emergencyAvailable = 'No';
        } else {
            // Cancel rest mode
            updateData.temporaryRest = admin.firestore.FieldValue.delete();
            const avail = (isEmergencyAvailable && String(isEmergencyAvailable).toLowerCase() === 'yes') ? 'Yes' : 'No';
            updateData.isEmergencyAvailable = avail;
            updateData.emergencyAvailable = avail;
        }

        await db.collection('donors').doc(targetDocId).update(updateData);

        console.log(JSON.stringify({
            success: true,
            donorId: targetDocId,
            message: temporaryRest ? 'Rest mode activated' : 'Rest mode cancelled'
        }));
    } catch (err) {
        console.error(JSON.stringify({ success: false, error: err.message }));
        process.exit(1);
    }
}

handleRestMode();
