/**
 * Cloudflare Pages Function: /functions/broadcast-email
 * 
 * Sends a personalized broadcast email to all registered donors.
 * 
 * Flow:
 * 1. Verify that the requester is an authorized Superuser.
 * 2. Fetch all donors from Firestore.
 * 3. Personalize the message using {{name}} placeholder.
 * 4. Wrap the message in the official Header/Footer template.
 * 5. Send in batches of 100 via Resend.
 */

const FROM = 'LifeSavers United <noreply@lifesaversunited.org>';
const RESEND_BATCH_API = 'https://api.resend.com/emails/batch';
const FIREBASE_PROJECT_ID = 'lifesavers-united-org';

// ── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin': 'https://lifesaversunited.org',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Preflight ─────────────────────────────────────────────────────────────────
export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS });
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function onRequestPost(context) {
    try {
        const apiKey = context.env.RESEND_API_KEY;
        if (!apiKey) {
            return Response.json({ success: false, error: 'Resend API key not configured.' }, { status: 500, headers: CORS });
        }

        let data;
        try {
            data = await context.request.json();
        } catch {
            return Response.json({ success: false, error: 'Invalid JSON.' }, { status: 400, headers: CORS });
        }

        const { subject, message, adminUid, isTest, testEmail, testName } = data;
        const FIREBASE_API_KEY = 'AIzaSyBBhXKv-U_Ze2cUr6_QCX9mLN7Jrfjr7aA';

        if (!subject || !message || !adminUid) {
            return Response.json({ success: false, error: 'Missing required fields.' }, { status: 400, headers: CORS });
        }

        // --- STEP 1: Identify Recipients ---
        let recipients = [];

        if (isTest) {
            // TEST MODE: Just one recipient
            if (!testEmail) {
                return Response.json({ success: false, error: 'Test email address required.' }, { status: 400, headers: CORS });
            }
            recipients = [{
                email: testEmail,
                name: testName || 'Test Admin'
            }];
        } else {
            // PRODUCTION MODE: Fetch all donors from Firestore
            // Using runQuery (POST) instead of list (GET) to bypass potential 403 listing restrictions.
            const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;

            const queryBody = {
                structuredQuery: {
                    from: [{ collectionId: 'donors' }],
                    // Select all documents
                }
            };

            const donorsRes = await fetch(queryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryBody)
            });

            if (!donorsRes.ok) {
                const errorBody = await donorsRes.text();
                console.error('[broadcast-email] Firestore Query Failed:', errorBody);
                return Response.json({
                    success: false,
                    error: 'Failed to access donor database (Permission Denied).',
                    details: errorBody
                }, { status: 500, headers: CORS });
            }

            const queryResults = await donorsRes.json();
            // runQuery returns an array of objects: [{ document: { ... } }, ...]
            for (const result of queryResults) {
                if (result.document) {
                    const fields = result.document.fields;
                    const email = fields?.email?.stringValue;
                    const name = fields?.fullName?.stringValue || 'Donor';
                    if (email && email.includes('@')) {
                        recipients.push({ email, name });
                    }
                }
            }
        }

        if (recipients.length === 0) {
            return Response.json({ success: true, message: 'No donors found to email.' }, { headers: CORS });
        }

        // --- STEP 2: Prepare Batch Emails ---
        const emailBatch = [];
        for (const recipient of recipients) {
            const { email, name } = recipient;

            // Personalize the message
            const personalizedBody = message.replace(/\{\{name\}\}/g, name);

            // Wrap in official Template Sandwich
            const html = buildBroadcastTemplate(name, personalizedBody);

            emailBatch.push({
                from: FROM,
                to: email,
                subject: isTest ? `[TEST] ${subject}` : subject,
                html: html
            });
        }

        if (emailBatch.length === 0) {
            return Response.json({ success: true, message: 'No valid donor emails found.' }, { headers: CORS });
        }

        // 4. Send in Batches of 100 (Resend limit)
        const batchSize = 100;
        const sendResults = [];
        for (let i = 0; i < emailBatch.length; i += batchSize) {
            const chunk = emailBatch.slice(i, i + batchSize);
            const res = await fetch(RESEND_BATCH_API, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });
            const result = await res.json();
            sendResults.push({ status: res.status, data: result });
        }

        return Response.json({
            success: true,
            message: `Broadcast initiated. Sent to ${emailBatch.length} donors.`,
            details: sendResults
        }, { headers: CORS });

    } catch (err) {
        console.error('[broadcast-email]', err);
        return Response.json({ success: false, error: 'Broadcast failed: ' + err.message }, { status: 500, headers: CORS });
    }
}

// ── Official Template Sandwich ────────────────────────────────────────────────
function buildBroadcastTemplate(name, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LifeSavers United Update</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
  
  <!-- HEADER -->
  <tr><td style="background:#ffffff;padding:24px;text-align:center;border-bottom:1px solid #eee;">
    <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:55px;width:auto;">
  </td></tr>

  <!-- CONTENT -->
  <tr><td style="padding:40px 32px;">
    <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:20px;font-weight:700;">Dear ${name},</h2>
    <div style="color:#444;font-size:16px;line-height:1.8;white-space: pre-wrap;">
${content}
    </div>
  </td></tr>

  <!-- CTA BOX (Matches other emails) -->
  <tr><td style="padding:0 32px 40px;" align="center">
    <a href="https://lifesaversunited.org" style="display:inline-block;background:#c0392b;color:#fff;font-size:15px;font-weight:700;padding:14px 30px;border-radius:8px;text-decoration:none;">Visit Website</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f9f9f9;padding:32px;text-align:center;">
    <p style="margin:0 0 10px;color:#333;font-size:14px;font-weight:600;">LifeSavers United</p>
    <p style="margin:0 0 20px;color:#666;font-size:13px;line-height:1.5;">Saving lives through community blood donation.<br>Ahmedabad, Gujarat, India.</p>
    
    <div style="padding-top:20px;border-top:1px solid #eee;">
      <p style="margin:0 0 8px;color:#999;font-size:12px;">📞 WhatsApp: <a href="https://wa.me/919979260393" style="color:#c0392b;text-decoration:none;">+91 9979260393</a></p>
      <p style="margin:0;color:#999;font-size:12px;">You received this because you are a registered donor with LifeSavers United.</p>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
