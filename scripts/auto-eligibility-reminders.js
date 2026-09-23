/**
 * LifeSavers United - Automated 3-Day Upcoming Blood Donation Eligibility Reminders
 * 
 * This script runs daily via GitHub Actions:
 * 1. Connects to Firestore.
 * 2. Finds donors with an email and recorded donations.
 * 3. Identifies if the donor is exactly 3 days away from becoming eligible for:
 *    - Single Donor Platelets (SDP) (Day 11 of 14-day cycle)
 *    - Plasma (Day 25 of 28-day cycle)
 *    - Whole Blood (Day 87 of 90-day cycle for men, Day 117 for women)
 * 4. Dispatches a proactive reminder email and records a deduplication flag.
 */

const admin = require('firebase-admin');
const axios = require('axios');

// Helper to pause execution to respect API rate limits
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT environment variable');
    process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
    console.error('❌ Missing RESEND_API_KEY environment variable');
    process.exit(1);
}

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

async function sendReminderEmail({ email, fullName, bloodGroup, donationType, eligibleDateFormatted }) {
    const typeLabel = donationType === 'platelets_sdp' ? 'Platelets (SDP)' : 
                      donationType === 'plasma' ? 'Plasma' : 'Whole Blood';

    const subject = `🩸 You will be eligible to donate ${typeLabel} in 3 days! — LifeSavers United`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px 24px; text-align: center; color: white; }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 700; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .highlight-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px; margin-top: 20px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏳ Get Ready to Save Lives Again!</h1>
      <p>Your generosity keeps critical patients alive.</p>
    </div>
    <div class="content">
      <p>Dear <strong>${fullName}</strong> (${bloodGroup || 'Hero'}),</p>
      
      <div class="highlight-card">
        <strong style="color: #991b1b; font-size: 16px;">🗓️ In Just 3 Days: ${eligibleDateFormatted}</strong>
        <p style="margin: 6px 0 0 0; color: #334155;">
          You will complete your mandatory rest interval and become fully eligible to donate <strong>${typeLabel}</strong>!
        </p>
      </div>

      <p>
        Your body has replenished its vital cells, and hospitals across our emergency network in Ahmedabad and Gujarat are always in urgent need of ready donors like you.
      </p>

      <div style="text-align: center;">
        <a href="https://lifesaversunited.org/donor_portal" class="btn">View Your Donor Portal & Availability</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} LifeSavers United. India's 24/7 Emergency Blood Donation Platform.</p>
      <p>Emergency Hotline: <a href="https://wa.me/919979260393" style="color: #dc2626; text-decoration: none;">9979260393</a></p>
    </div>
  </div>
</body>
</html>`;

    const response = await axios.post(
        'https://api.resend.com/emails',
        {
            from: 'LifeSavers United <noreply@lifesaversunited.org>',
            to: [email],
            subject: subject,
            html: html,
            reply_to: 'lifesaversunited.india@gmail.com'
        },
        {
            timeout: 15000,
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data;
}

/**
 * Asia/Kolkata (IST) Calendar Date Helpers
 */
function getKolkataDateParts(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.format(date).split('-');
    return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
        dateStr: formatter.format(date)
    };
}

function toKolkataMidnight(date) {
    const { year, month, day } = getKolkataDateParts(date);
    return new Date(Date.UTC(year, month - 1, day));
}

function formatKolkataDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

async function run() {
    console.log('🚀 Starting daily eligibility reminder check...');

    if (process.env.TEST_EMAIL) {
        console.log(`🧪 TEST MODE: Sending test reminder to ${process.env.TEST_EMAIL}`);
        await sendReminderEmail({
            email: process.env.TEST_EMAIL,
            fullName: 'Test Donor',
            bloodGroup: 'O+',
            donationType: 'whole_blood',
            eligibleDateFormatted: '25 Sep 2026'
        });
        console.log('✅ Test reminder sent.');
        return;
    }

    const todayMidnight = toKolkataMidnight(new Date());

    const donorsSnap = await db.collection('donors').get();
    console.log(`📊 Found ${donorsSnap.size} donors to evaluate.`);

    let sentList = [];

    for (const donorDoc of donorsSnap.docs) {
        const donor = donorDoc.data();
        if (!donor.email || !donor.lastDonatedAt) continue;

        // Skip if donor is currently in active temporary rest mode
        if (donor.temporaryRest && donor.temporaryRest.until) {
            let restDate = null;
            if (typeof donor.temporaryRest.until.toDate === 'function') {
                restDate = donor.temporaryRest.until.toDate();
            } else if (donor.temporaryRest.until.seconds) {
                restDate = new Date(donor.temporaryRest.until.seconds * 1000);
            } else {
                restDate = new Date(donor.temporaryRest.until);
            }
            if (restDate && !isNaN(restDate.getTime()) && toKolkataMidnight(restDate).getTime() > todayMidnight.getTime()) {
                console.log(`⏩ Skipping donor ${donor.fullName || donor.email}: Temporary Rest active until ${restDate.toDateString()}`);
                continue; // Resting, do not send reminder
            }
        }

        const lastDate = donor.lastDonatedAt.toDate ? donor.lastDonatedAt.toDate() : new Date(donor.lastDonatedAt);
        if (isNaN(lastDate.getTime())) continue;

        const isFemale = String(donor.gender || '').toLowerCase().startsWith('f');
        const lastDonationType = String(donor.lastDonationType || 'whole_blood').toLowerCase();
        const sdpGapDays = (lastDonationType.includes('whole') || lastDonationType.includes('prbc')) ? 28 : 14;

        // Targets and gaps
        const targets = [
            { type: 'platelets_sdp', gapDays: sdpGapDays },
            { type: 'plasma', gapDays: 28 },
            { type: 'whole_blood', gapDays: isFemale ? 120 : 90 }
        ];

        const remindersSent = donor.remindersSent || {};
        const lastDateParts = getKolkataDateParts(lastDate);
        const lastDateKey = lastDateParts.dateStr;
        const lastDateMidnight = toKolkataMidnight(lastDate);

        for (const target of targets) {
            const eligibleMidnight = new Date(lastDateMidnight.getTime() + (target.gapDays * 24 * 60 * 60 * 1000));

            // Difference in days between eligible date and today (both in Asia/Kolkata calendar days)
            const diffDays = Math.round((eligibleMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

            // TRIGGER: Exactly 3 days before eligible date
            if (diffDays === 3) {
                const reminderKey = `${lastDateKey}_${target.type}_3days`;
                if (remindersSent[reminderKey]) {
                    continue; // Already sent for this donation cycle
                }

                console.log(`📨 Sending 3-day reminder for ${target.type} to ${donor.fullName} (${donor.email})`);
                const formattedDate = formatKolkataDate(eligibleMidnight);

                try {
                    await sendReminderEmail({
                        email: donor.email,
                        fullName: donor.fullName || 'Donor',
                        bloodGroup: donor.bloodGroup || '',
                        donationType: target.type,
                        eligibleDateFormatted: formattedDate
                    });

                    // Mark reminder as sent
                    await donorDoc.ref.update({
                        [`remindersSent.${reminderKey}`]: admin.firestore.FieldValue.serverTimestamp()
                    });

                    sentList.push({
                        fullName: donor.fullName || 'Donor',
                        email: donor.email,
                        bloodGroup: donor.bloodGroup || 'N/A',
                        donationType: target.type,
                        eligibleDate: formattedDate
                    });

                    // Wait 1.5 seconds to respect Resend's rate limit of 2 requests per second
                    await delay(1500);
                } catch (err) {
                    console.error(`❌ Failed to send reminder to ${donor.email}:`, err.response?.data || err.message);
                }
            }
        }
    }

    if (sentList.length > 0) {
        await delay(1000);
        await sendAdminSummary(sentList);
    }

    console.log(`🎉 Daily eligibility check complete. Sent ${sentList.length} reminders.`);
}

async function sendAdminSummary(sentList) {
    const ADMIN_EMAIL = 'lifesaversunited.india@gmail.com';
    const items = sentList.map(d => `<li><strong>${d.fullName}</strong> (${d.email}) - Blood: ${d.bloodGroup} | Type: <em>${d.donationType}</em> | Eligible: <strong>${d.eligibleDate}</strong></li>`).join('');

    const html = `
        <div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#dc2626;">🩸 Daily Eligibility Reminder Report</h2>
            <p>Hello Admin,</p>
            <p>Today, we successfully sent <strong>${sentList.length}</strong> upcoming 3-day donation eligibility reminder(s) via Resend:</p>
            <ul>${items}</ul>
            <p style="color:#777;font-size:12px;margin-top:20px;border-top:1px solid #eee;padding-top:10px;">
                This is an automated report from LifeSavers United.
            </p>
        </div>
    `;

    try {
        await axios.post('https://api.resend.com/emails', {
            from: 'LifeSavers United <noreply@lifesaversunited.org>',
            to: [ADMIN_EMAIL],
            subject: `🩸 Eligibility Reminder Report: ${sentList.length} Reminders Sent Today`,
            html: html
        }, {
            timeout: 15000,
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

run().catch(err => {
    console.error('Fatal error in daily eligibility check:', err);
    process.exit(1);
});

