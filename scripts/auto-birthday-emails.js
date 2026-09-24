/**
 * Automated Birthday Email Script for LifeSavers United
 *
 * This script:
 * 1. Connects to Firebase Firestore
 * 2. Finds donors whose birthday is today (MM-DD)
 * 3. Sends a beautiful birthday greeting via Resend.com
 *
 * To be run daily via GitHub Actions.
 */

const admin = require('firebase-admin');
const axios = require('axios');

// Helper to pause execution to respect API rate limits
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Check for required environment variables
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT environment variable');
    process.exit(1);
}
if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY && !process.env.MAILJET_API_KEY) {
    console.error('❌ Missing email API keys. Provide at least one of RESEND_API_KEY, BREVO_API_KEY, or MAILJET_API_KEY');
    process.exit(1);
}

const FROM_NAME  = 'LifeSavers United';
const FROM_EMAIL = 'noreply@lifesaversunited.org';
const PROVIDERS  = ['resend', 'brevo', 'mailjet'];
let rotationCounter = 0;

// Initialize Firebase
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
} catch (err) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
    process.exit(1);
}

const db = admin.firestore();

async function run() {
    const today = new Date();
    // Get MM-DD in India Time (IST is UTC+5:30)
    const istDate = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
    const targetMonth = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const targetDay   = String(istDate.getUTCDate()).padStart(2, '0');
    const targetMMDD  = `${targetMonth}-${targetDay}`;

    // CHECK FOR TEST MODE
    if (process.env.TEST_EMAIL) {
        console.log(`🧪 TEST MODE: Sending a test card to ${process.env.TEST_EMAIL}`);
        const result = await sendBirthdayEmail({
            fullName: 'Test Donor',
            email: process.env.TEST_EMAIL,
            bloodGroup: 'O+'
        }, rotationCounter++);
        console.log(`✅ Test email completed (via ${result?.provider || 'unknown'}). Skipping database check.`);
        return;
    }

    console.log(`📅 Checking for birthdays matching: ${targetMMDD} (IST)`);

    try {
        const donorsRef = db.collection('donors');
        const snapshot = await donorsRef.where('dateOfBirth', '!=', '').get();

        if (snapshot.empty) {
            console.log('📭 No donors found with a registered date of birth.');
            return;
        }

        const birthdayDonors = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dob = data.dateOfBirth; // Expected format: YYYY-MM-DD
            if (dob && dob.length >= 10) {
                const parts = dob.split('-');
                if (parts.length === 3) {
                    const donorMMDD = `${parts[1]}-${parts[2]}`;
                    if (donorMMDD === targetMMDD) {
                        birthdayDonors.push({
                            id: doc.id,
                            fullName: data.fullName,
                            email: data.email,
                            bloodGroup: data.bloodGroup
                        });
                    }
                }
            }
        });

        console.log(`🎉 Found ${birthdayDonors.length} donors celebrating today!`);

        const sentList = [];
        for (const donor of birthdayDonors) {
            if (!donor.email || !donor.email.includes('@')) {
                console.log(`⚠️ Skipping ${donor.fullName} (No email provided)`);
                continue;
            }

            console.log(`✉️ Sending birthday email to ${donor.fullName} (${donor.email})...`);
            const sendResult = await sendBirthdayEmail(donor, rotationCounter++);
            if (sendResult?.success) {
                sentList.push({
                    ...donor,
                    provider: sendResult.provider
                });
            }
            
            // Respect API rate limits
            await delay(1200);
        }

        // SEND SUMMARY TO ADMIN (only if emails were sent)
        if (sentList.length > 0) {
            await delay(1000);
            await sendAdminSummary(sentList);
        }

        console.log('✅ Birthday automation task completed.');

    } catch (error) {
        console.error('❌ Automation failed:', error);
        process.exit(1);
    }
}

/**
 * 3-Provider Rotator sending helper
 */
async function sendViaProvider(provider, { to, subject, html }) {
    if (provider === 'resend') {
        if (!process.env.RESEND_API_KEY) return { ok: false, error: 'No RESEND_API_KEY' };
        const response = await axios.post('https://api.resend.com/emails', {
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [to],
            subject: subject,
            html: html,
            tags: [{ name: 'category', value: 'birthday' }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        return { ok: response.status === 200 || response.status === 201, data: response.data };
    }

    if (provider === 'brevo') {
        if (!process.env.BREVO_API_KEY) return { ok: false, error: 'No BREVO_API_KEY' };
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: FROM_NAME, email: FROM_EMAIL },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html
        }, {
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        return { ok: response.status >= 200 && response.status < 300, data: response.data };
    }

    if (provider === 'mailjet') {
        if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
            return { ok: false, error: 'No MAILJET credentials' };
        }
        const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`).toString('base64');
        const response = await axios.post('https://api.mailjet.com/v3.1/send', {
            Messages: [{
                From: { Email: FROM_EMAIL, Name: FROM_NAME },
                To: [{ Email: to }],
                Subject: subject,
                HTMLPart: html
            }]
        }, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        return { ok: response.status >= 200 && response.status < 300, data: response.data };
    }

    return { ok: false, error: 'Unknown provider' };
}

async function sendBirthdayEmail(donor, index = 0) {
    const firstName = donor.fullName.split(' ')[0];
    const bloodGroup = donor.bloodGroup || 'Hero';
    
    const subject = `🎂 Happy Birthday, ${firstName}! You're a True LifeSaver 🩸`;
    const html = buildBirthdayTemplate(donor.fullName, bloodGroup);

    // Build circular fallback chain starting from index % 3
    const startIdx = Math.abs(index) % PROVIDERS.length;
    const chain = [
        PROVIDERS[startIdx],
        PROVIDERS[(startIdx + 1) % PROVIDERS.length],
        PROVIDERS[(startIdx + 2) % PROVIDERS.length]
    ];

    for (const provider of chain) {
        try {
            const res = await sendViaProvider(provider, { to: donor.email, subject, html });
            if (res.ok) {
                console.log(`✅ Success! Birthday email sent to ${donor.fullName} via ${provider.toUpperCase()}`);
                return { success: true, provider };
            }
            console.warn(`⚠️ Provider ${provider.toUpperCase()} failed: ${res.error || 'bad status'} — trying next provider...`);
        } catch (err) {
            console.warn(`⚠️ Provider ${provider.toUpperCase()} error: ${err.response?.data?.message || err.message} — trying next provider...`);
        }
    }

    console.error(`❌ Failed to send birthday email to ${donor.email} after trying all providers.`);
    return { success: false, provider: 'none' };
}

async function sendAdminSummary(sentList) {
    const ADMIN_EMAIL = 'lifesaversunited.india@gmail.com';
    const names = sentList.map(d => `<li><strong>${d.fullName}</strong> (${d.email}) - Blood: ${d.bloodGroup} [Sent via: <em>${(d.provider || 'unknown').toUpperCase()}</em>]</li>`).join('');
    
    const html = `
        <div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#c0392b;">🩸 Daily Birthday Report (Round-Robin Multi-Provider)</h2>
            <p>Hello Admin,</p>
            <p>Today, we successfully sent <strong>${sentList.length}</strong> birthday greeting(s) across our active provider rotation:</p>
            <ul>${names}</ul>
            <p style="color:#777;font-size:12px;margin-top:20px;border-top:1px solid #eee;padding-top:10px;">
                Automated multi-provider report from LifeSavers United.
            </p>
        </div>
    `;

    // Try sending summary via any available provider
    for (const provider of PROVIDERS) {
        try {
            const res = await sendViaProvider(provider, {
                to: ADMIN_EMAIL,
                subject: `🎂 Birthday Report: ${sentList.length} Emails Sent Today`,
                html
            });
            if (res.ok) {
                console.log(`📊 Admin summary sent to ${ADMIN_EMAIL} via ${provider.toUpperCase()}`);
                return;
            }
        } catch (err) {
            // try next provider
        }
    }
    console.error('❌ Failed to send admin summary via all providers.');
}

function buildBirthdayTemplate(name, blood) {
    const first = name.split(' ')[0];
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Happy Birthday!</title>
</head>
<body style="margin:0;padding:0;background-color:#fff5f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff5f5;padding:40px 10px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(192,57,43,0.1);">
                    
                    <!-- HEADER / LOGO -->
                    <tr>
                        <td style="padding:40px 40px 20px;text-align:center;">
                            <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:60px;width:auto;">
                        </td>
                    </tr>

                    <!-- HERO IMAGE / ICON -->
                    <tr>
                        <td style="padding:0 40px;text-align:center;">
                            <div style="font-size:80px;line-height:1;">🎂</div>
                        </td>
                    </tr>

                    <!-- MAIN CONTENT -->
                    <tr>
                        <td style="padding:30px 40px;text-align:center;">
                            <h1 style="color:#c0392b;margin:0;font-size:32px;font-weight:800;letter-spacing:-0.5px;">Happy Birthday, ${first}!</h1>
                            <p style="color:#555;font-size:18px;line-height:1.6;margin:20px 0 0;">
                                On your special day, the team at <strong>LifeSavers United</strong> wants to thank you for being a hero in our community.
                            </p>
                            <p style="color:#555;font-size:18px;line-height:1.6;margin:15px 0 0;">
                                Your commitment as a <strong style="color:#c0392b;">${blood}</strong> donor is a gift that keeps on giving. You don't just celebrate another year; you give others the chance to celebrate theirs.
                            </p>
                        </td>
                    </tr>

                    <!-- GIFT CARD / QUOTE -->
                    <tr>
                        <td style="padding:0 40px 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);border-radius:20px;color:#ffffff;text-align:center;">
                                <tr>
                                    <td style="padding:35px 30px;">
                                        <p style="margin:0;font-size:14px;text-transform:uppercase;letter-spacing:2px;opacity:0.8;">A Lifesaver's Wish</p>
                                        <h2 style="margin:10px 0 0;font-size:24px;font-weight:700;line-height:1.4;">
                                            "The greatest gift you can give is the gift of life. Thank you for being that gift."
                                        </h2>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- PERSONAL NOTE -->
                    <tr>
                        <td style="padding:0 40px 40px;text-align:center;">
                            <p style="color:#777;font-size:15px;line-height:1.6;margin:0;">
                                We hope your day is filled with as much joy and kindness as you have shared with the world. Stay healthy, stay blessed!
                            </p>
                        </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                        <td style="padding:0 40px 50px;text-align:center;">
                            <a href="https://lifesaversunited.org" style="display:inline-block;background-color:#c0392b;color:#ffffff;text-decoration:none;padding:18px 40px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 15px rgba(192,57,43,0.3);">
                                Visit Our Community
                            </a>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color:#f9f9f9;padding:30px 40px;text-align:center;">
                            <div style="margin-bottom:20px;">
                                <a href="https://www.instagram.com/lifesaversunited_blooddonors/" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Instagram</a>
                                <span style="color:#ddd;">|</span>
                                <a href="https://x.com/lifesaversunit" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Twitter</a>
                                <span style="color:#ddd;">|</span>
                                <a href="https://lifesaversunited.org" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Website</a>
                            </div>
                            <p style="color:#999;font-size:12px;margin:0;">
                                &copy; ${new Date().getFullYear()} LifeSavers United. All rights reserved.<br>
                                You received this because you are a registered blood donor.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

run();
