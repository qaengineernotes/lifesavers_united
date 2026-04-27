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

// Check for required environment variables
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT environment variable');
    process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
    console.error('❌ Missing RESEND_API_KEY environment variable');
    process.exit(1);
}

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
        await sendBirthdayEmail({
            fullName: 'Test Donor',
            email: process.env.TEST_EMAIL,
            bloodGroup: 'O+'
        });
        console.log('✅ Test email sent. Skipping database check.');
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
            const success = await sendBirthdayEmail(donor);
            if (success) sentList.push(donor);
        }

        // SEND SUMMARY TO ADMIN (only if emails were sent)
        if (sentList.length > 0) {
            await sendAdminSummary(sentList);
        }

        console.log('✅ Birthday automation task completed.');

    } catch (error) {
        console.error('❌ Automation failed:', error);
        process.exit(1);
    }
}

async function sendBirthdayEmail(donor) {
    const firstName = donor.fullName.split(' ')[0];
    const bloodGroup = donor.bloodGroup || 'Hero';
    
    const subject = `🎂 Happy Birthday, ${firstName}! You're a True LifeSaver 🩸`;
    const html = buildBirthdayTemplate(donor.fullName, bloodGroup);

    try {
        const response = await axios.post('https://api.resend.com/emails', {
            from: 'LifeSavers United <noreply@lifesaversunited.org>',
            to: [donor.email],
            subject: subject,
            html: html,
            tags: [{ name: 'category', value: 'birthday' }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200 || response.status === 201) {
            console.log(`✅ Success! Email sent to ${donor.fullName}`);
            return true;
        } else {
            console.error(`❌ Unexpected status ${response.status} for ${donor.email}`);
            return false;
        }
    } catch (err) {
        console.error(`❌ Error sending to ${donor.email}:`, err.response?.data || err.message);
        return false;
    }
}

async function sendAdminSummary(sentList) {
    const ADMIN_EMAIL = 'lifesaversunited.india@gmail.com';
    const names = sentList.map(d => `<li><strong>${d.fullName}</strong> (${d.email}) - Blood: ${d.bloodGroup}</li>`).join('');
    
    const html = `
        <div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#c0392b;">🩸 Daily Birthday Report</h2>
            <p>Hello Admin,</p>
            <p>Today, we successfully sent <strong>${sentList.length}</strong> birthday greeting(s) to our donors:</p>
            <ul>${names}</ul>
            <p style="color:#777;font-size:12px;margin-top:20px;border-top:1px solid #eee;padding-top:10px;">
                This is an automated report from LifeSavers United.
            </p>
        </div>
    `;

    try {
        await axios.post('https://api.resend.com/emails', {
            from: 'LifeSavers United <noreply@lifesaversunited.org>',
            to: [ADMIN_EMAIL],
            subject: `🎂 Birthday Report: ${sentList.length} Emails Sent Today`,
            html: html
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('📊 Admin summary sent to lifesaversunited.india@gmail.com');
    } catch (err) {
        console.error('❌ Failed to send admin summary:', err.message);
    }
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
                                <a href="https://www.instagram.com/lifesavers_blooddonors" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Instagram</a>
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
