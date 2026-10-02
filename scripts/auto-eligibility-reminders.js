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
if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY && !process.env.MAILJET_API_KEY) {
    console.error('❌ Missing email API keys. Provide at least one of RESEND_API_KEY, BREVO_API_KEY, or MAILJET_API_KEY');
    process.exit(1);
}

const FROM_NAME  = 'LifeSavers United';
const FROM_EMAIL = 'noreply@lifesaversunited.org';
const PROVIDERS  = ['resend', 'brevo', 'mailjet'];
let rotationCounter = 0;

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

/**
 * 3-Provider Rotator sending helper
 */
async function sendViaProvider(provider, { to, subject, html, replyTo }) {
    if (provider === 'resend') {
        if (!process.env.RESEND_API_KEY) return { ok: false, error: 'No RESEND_API_KEY' };
        const response = await axios.post('https://api.resend.com/emails', {
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [to],
            subject: subject,
            html: html,
            reply_to: replyTo || 'lifesaversunited.india@gmail.com'
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
            htmlContent: html,
            replyTo: { email: replyTo || 'lifesaversunited.india@gmail.com' }
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
                HTMLPart: html,
                ReplyTo: { Email: replyTo || 'lifesaversunited.india@gmail.com' }
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

function getDonationTypeLabel(type) {
    if (type === 'platelets_sdp') return 'Platelets (SDP)';
    if (type === 'plasma') return 'Plasma';
    if (type === 'whole_blood') return 'Whole Blood';
    return type;
}

function renderDonationOptions(types) {
    let cardsHtml = '';

    if (types.includes('platelets_sdp')) {
        cardsHtml += `
        <div class="option-card" style="border: 1px solid #fed7aa; border-left: 4px solid #ea580c; background: #fffaf5;">
          <strong style="color: #9a3412; font-size: 15px;">🧪 Option: Single Donor Platelets (SDP)</strong>
          <p style="margin: 6px 0 0 0; color: #334155; font-size: 13.5px; line-height: 1.5;">
            <strong>Who it helps:</strong> Cancer patients undergoing chemotherapy, dengue patients with critically low counts, and major surgical emergencies.<br>
            <strong>Why it's vital:</strong> Platelets have a short shelf life of only 5 days, making on-demand emergency donors constantly in critical need.
          </p>
        </div>`;
    }

    if (types.includes('plasma')) {
        cardsHtml += `
        <div class="option-card" style="border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; background: #f8faff;">
          <strong style="color: #1e40af; font-size: 15px;">💧 Option: Plasma Donation</strong>
          <p style="margin: 6px 0 0 0; color: #334155; font-size: 13.5px; line-height: 1.5;">
            <strong>Who it helps:</strong> Severe burn victims, trauma/accident resuscitation, and patients with critical clotting or liver disorders.<br>
            <strong>Why it's vital:</strong> Plasma restores blood volume and provides vital proteins and antibodies needed for intensive recovery.
          </p>
        </div>`;
    }

    if (types.includes('whole_blood')) {
        cardsHtml += `
        <div class="option-card" style="border: 1px solid #fecaca; border-left: 4px solid #dc2626; background: #fff5f5;">
          <strong style="color: #991b1b; font-size: 15px;">🩸 Option: Whole Blood Donation</strong>
          <p style="margin: 6px 0 0 0; color: #334155; font-size: 13.5px; line-height: 1.5;">
            <strong>Who it helps:</strong> Accident victims, anemia treatments, thalassemia patients, and major surgical operations.<br>
            <strong>Why it's vital:</strong> One unit of whole blood can be separated into red cells, plasma, and platelets to save up to 3 distinct lives.
          </p>
        </div>`;
    }

    let noteHtml = '';
    if (types.length > 1) {
        noteHtml = `
        <p style="background: #f1f5f9; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #475569; margin: 16px 0; line-height: 1.5;">
          💡 <strong>Coordinator Tip:</strong> Because both donation pathways open on the same date, you don't need to choose in advance! When an urgent emergency request arises in Ahmedabad or your area, you can respond to whichever is in greatest need.
        </p>`;
    }

    return `
      <div style="margin: 18px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">Your Eligible Donation Options:</p>
        ${cardsHtml}
        ${noteHtml}
      </div>
    `;
}

async function sendReminderEmail({ email, fullName, bloodGroup, donationTypes, donationType, eligibleDateFormatted }, index = 0) {
    const types = Array.isArray(donationTypes) && donationTypes.length > 0
        ? donationTypes
        : [donationType || 'whole_blood'];

    let typesLabel = '';
    if (types.length === 1) {
        typesLabel = getDonationTypeLabel(types[0]);
    } else if (types.length === 2) {
        typesLabel = `${getDonationTypeLabel(types[0])} & ${getDonationTypeLabel(types[1])}`;
    } else {
        typesLabel = types.map(t => getDonationTypeLabel(t)).join(', ');
    }

    const subject = `🩸 You will be eligible to donate ${typesLabel} in 3 days! — LifeSavers United`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px 24px; text-align: center; color: white; }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #ffffff; }
    .header p { margin: 0; font-size: 14px; opacity: 0.92; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; color: #334155; }
    .highlight-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .option-card { background: #ffffff; border-radius: 8px; padding: 14px 16px; margin: 12px 0; }
    .btn-primary { display: block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 13px 20px; border-radius: 8px; font-weight: 700; font-size: 14.5px; text-align: center; margin: 10px 0; }
    .btn-secondary { display: block; background-color: #1e293b; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; margin: 10px 0; }
    .btn-whatsapp { display: block; background-color: #059669; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; margin: 10px 0; }
    .footer { background: #f8fafc; padding: 22px 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏳ Get Ready to Save Lives Again!</h1>
      <p>Your body has replenished its vital cells and will soon be ready to answer the call.</p>
    </div>
    <div class="content">
      <p>Dear <strong>${fullName}</strong> (Blood Group: <strong>${bloodGroup || 'Hero'}</strong>),</p>
      
      <p>
        Thank you for your continued dedication as a registered hero in the <strong>LifeSavers United</strong> emergency blood network. Your selfless contributions bring critical patients back from the brink of danger.
      </p>

      <div class="highlight-card">
        <strong style="color: #991b1b; font-size: 16px;">🗓️ Milestone in 3 Days: ${eligibleDateFormatted}</strong>
        <p style="margin: 6px 0 0 0; color: #334155; font-size: 14.5px;">
          You will complete your mandatory rest interval and become <strong>fully eligible to donate ${types.length > 1 ? `both ${typesLabel}` : typesLabel}!</strong>
        </p>
      </div>

      ${renderDonationOptions(types)}

      <p style="margin-top: 24px; font-weight: 600; color: #0f172a; text-align: center;">
        Take Action Before Your Eligibility Date:
      </p>

      <div style="margin: 16px 0;">
        <a href="https://lifesaversunited.org/emergency_request_system" class="btn-primary">🚨 View Live Emergency Requests</a>
        <a href="https://lifesaversunited.org/donor_portal" class="btn-secondary">👤 Update Availability on Donor Portal</a>
        <a href="https://wa.me/919979260393" class="btn-whatsapp">💬 Chat with Emergency Coordinator on WhatsApp</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>LifeSavers United</strong> — India's 24/7 Voluntary Blood & Platelet Donor Network</p>
      <p style="margin: 0 0 6px 0;">24/7 Emergency Helpline: <a href="https://wa.me/919979260393" style="color: #dc2626; text-decoration: none; font-weight: 600;">+91 99792 60393</a> | Official Site: <a href="https://lifesaversunited.org" style="color: #dc2626; text-decoration: none;">lifesaversunited.org</a></p>
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} LifeSavers United. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    // Send Eligibility reminders via Resend (fallback: Brevo, then Mailjet)
    const chain = ['resend', 'brevo'];
    if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
        chain.push('mailjet');
    }

    for (const provider of chain) {
        try {
            const res = await sendViaProvider(provider, {
                to: email,
                subject,
                html,
                replyTo: 'lifesaversunited.india@gmail.com'
            });
            if (res.ok) {
                console.log(`✅ Success! Eligibility reminder sent to ${email} via ${provider.toUpperCase()}`);
                return { success: true, provider };
            }
            console.warn(`⚠️ Provider ${provider.toUpperCase()} failed: ${res.error || 'bad status'} — trying next provider...`);
        } catch (err) {
            console.warn(`⚠️ Provider ${provider.toUpperCase()} error: ${err.response?.data?.message || err.message} — trying next provider...`);
        }
    }

    throw new Error(`All providers failed to send reminder to ${email}`);
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
        console.log(`🧪 TEST MODE: Sending combined test reminder to ${process.env.TEST_EMAIL}`);
        await sendReminderEmail({
            email: process.env.TEST_EMAIL,
            fullName: 'Test Donor',
            bloodGroup: 'O+',
            donationTypes: ['platelets_sdp', 'plasma'],
            eligibleDateFormatted: '5 Oct 2026'
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

        // Collect all targets for this donor reaching the 3-day reminder threshold today
        const eligibleDueTargets = [];
        let eligibleDateFormatted = '';

        for (const target of targets) {
            const eligibleMidnight = new Date(lastDateMidnight.getTime() + (target.gapDays * 24 * 60 * 60 * 1000));

            // Difference in days between eligible date and today (both in Asia/Kolkata calendar days)
            const diffDays = Math.round((eligibleMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

            // TRIGGER: Exactly 3 days before eligible date
            if (diffDays === 3) {
                const reminderKey = `${lastDateKey}_${target.type}_3days`;
                if (!remindersSent[reminderKey]) {
                    eligibleDueTargets.push(target);
                    if (!eligibleDateFormatted) {
                        eligibleDateFormatted = formatKolkataDate(eligibleMidnight);
                    }
                }
            }
        }

        if (eligibleDueTargets.length > 0) {
            const types = eligibleDueTargets.map(t => t.type);
            const typesLabel = types.map(t => getDonationTypeLabel(t)).join(' & ');

            console.log(`📨 Sending 3-day reminder for [${typesLabel}] to ${donor.fullName} (${donor.email})`);

            try {
                const sendRes = await sendReminderEmail({
                    email: donor.email,
                    fullName: donor.fullName || 'Donor',
                    bloodGroup: donor.bloodGroup || '',
                    donationTypes: types,
                    eligibleDateFormatted
                }, rotationCounter++);

                // Mark reminder keys as sent for all bundled types in Firestore
                const updateFields = {};
                for (const t of eligibleDueTargets) {
                    const reminderKey = `${lastDateKey}_${t.type}_3days`;
                    updateFields[`remindersSent.${reminderKey}`] = admin.firestore.FieldValue.serverTimestamp();
                }
                await donorDoc.ref.update(updateFields);

                sentList.push({
                    fullName: donor.fullName || 'Donor',
                    email: donor.email,
                    bloodGroup: donor.bloodGroup || 'N/A',
                    donationTypeLabel: typesLabel,
                    eligibleDate: eligibleDateFormatted,
                    provider: sendRes?.provider || 'unknown'
                });

                // Wait 1.2 seconds to respect provider burst limits
                await delay(1200);
            } catch (err) {
                console.error(`❌ Failed to send reminder to ${donor.email}:`, err.response?.data || err.message);
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
    const items = sentList.map(d => `<li><strong>${d.fullName}</strong> (${d.email}) - Blood: ${d.bloodGroup} | Eligible For: <strong>${d.donationTypeLabel || d.donationType}</strong> on <strong>${d.eligibleDate}</strong> [via <em>${(d.provider || 'unknown').toUpperCase()}</em>]</li>`).join('');

    const html = `
        <div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#dc2626;">🩸 Daily Eligibility Reminder Report (Multi-Provider Rotation)</h2>
            <p>Hello Admin,</p>
            <p>Today, we successfully sent <strong>${sentList.length}</strong> upcoming 3-day donation eligibility reminder(s) across our active provider rotation:</p>
            <ul>${items}</ul>
            <p style="color:#777;font-size:12px;margin-top:20px;border-top:1px solid #eee;padding-top:10px;">
                Automated multi-provider report from LifeSavers United.
            </p>
        </div>
    `;

    // Admin report sent via Resend (fallback to Brevo)
    const adminChain = ['resend', 'brevo'];
    if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
        adminChain.push('mailjet');
    }

    for (const provider of adminChain) {
        try {
            const res = await sendViaProvider(provider, {
                to: ADMIN_EMAIL,
                subject: `🩸 Eligibility Reminder Report: ${sentList.length} Reminders Sent Today`,
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

run().catch(err => {
    console.error('Fatal error in daily eligibility check:', err);
    process.exit(1);
});

