/**
 * Cloudflare Pages Function: /donor-registration
 *
 * Sends two emails on successful donor registration:
 *   1. A beautiful HTML welcome email to the donor (if email provided)
 *   2. An admin notification to lifesaversunited.india@gmail.com
 *
 * Required env variable (CF Pages dashboard → Settings → Environment Variables):
 *   RESEND_API_KEY  →  your API key from resend.com (free: 3,000 emails/month)
 *
 * The sender domain (lifesaversunited.org) must be verified in Resend.
 */

const ADMIN_EMAIL = 'lifesaversunited.india@gmail.com';
const FROM        = 'LifeSavers United <noreply@lifesaversunited.org>';
const RESEND_API  = 'https://api.resend.com/emails';

// ── Helper: send one email via Resend ────────────────────────────────────────
async function sendEmail(apiKey, { to, subject, html }) {
    const res = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    return { ok: res.ok, status: res.status, body: await res.json() };
}

// ── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin':  'https://lifesaversunited.org',
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
        let data;
        try { data = await context.request.json(); }
        catch {
            return Response.json({ success: false, error: 'Invalid JSON.' }, { status: 400, headers: CORS });
        }

        const { fullName, bloodGroup, city, area, email, contactNumber,
                emergencyAvailable, preferredContact } = data;

        if (!fullName || !bloodGroup || !contactNumber) {
            return Response.json(
                { success: false, error: 'Missing required fields.' },
                { status: 422, headers: CORS }
            );
        }

        // Sanitise
        const c = (s) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 500);
        const safeName     = c(fullName);
        const safeBlood    = c(bloodGroup);
        const safeCity     = c(city);
        const safeArea     = c(area);
        const safeEmail    = c(email);
        const safePhone    = c(contactNumber);
        const safeEmerg    = c(emergencyAvailable);
        const safePref     = c(preferredContact);

        const istTime = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short',
        });

        const apiKey = context.env.RESEND_API_KEY;
        const results = [];

        // 1. Welcome email → donor (only if email provided)
        if (safeEmail && safeEmail.includes('@')) {
            const r = await sendEmail(apiKey, {
                to: [safeEmail],
                subject: `🩸 Welcome to LifeSavers United, ${safeName.split(' ')[0]}! You're Now a Registered Donor`,
                html: buildDonorEmail(safeName, safeBlood, safeCity, safeArea, safeEmerg, istTime),
            });
            results.push({ type: 'donor', ...r });
        }

        // 2. Admin notification → always
        const r2 = await sendEmail(apiKey, {
            to: [ADMIN_EMAIL],
            subject: `🩸 New Donor: ${safeName} (${safeBlood}) from ${safeCity || 'Unknown City'}`,
            html: buildAdminEmail(safeName, safeBlood, safeCity, safeArea, safeEmail, safePhone, safeEmerg, safePref, istTime),
        });
        results.push({ type: 'admin', ...r2 });

        return Response.json({ success: true, results }, { status: 200, headers: CORS });

    } catch (err) {
        console.error('[donor-registration]', err);
        return Response.json(
            { success: false, error: 'Email send failed. Your registration is still saved.' },
            { status: 500, headers: CORS }
        );
    }
}

// ── Donor Welcome Email ───────────────────────────────────────────────────────
function buildDonorEmail(name, blood, city, area, emergency, time) {
    const first = name.split(' ')[0];
    const bloodColors = {
        'A+': '#e74c3c','A-': '#c0392b','B+': '#e74c3c','B-': '#c0392b',
        'AB+': '#8e44ad','AB-': '#7d3c98','O+': '#e74c3c','O-': '#c0392b',
    };
    const bColor = bloodColors[blood] || '#c0392b';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to LifeSavers United</title></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);">

  <!-- HEADER -->
  <tr><td style="background:#ffffff;padding:32px 32px 24px;text-align:center;">
    <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:70px;width:auto;">
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:linear-gradient(135deg,#c0392b 0%,#e74c3c 100%);padding:40px 32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:30px;font-weight:800;letter-spacing:-0.5px;">You're a LifeSaver!</h1>
    <p style="color:#f5b7b1;margin:10px 0 0;font-size:16px;">Registration Confirmed — Thank You, ${first}!</p>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:40px 32px 24px;">
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;font-weight:700;">Dear ${name},</h2>
    <p style="margin:0 0 14px;color:#444;font-size:15px;line-height:1.8;">
      Thank you for registering as a blood donor with <strong>LifeSavers United</strong>. You have just taken one of the most meaningful steps a person can take — the decision to save a life.
    </p>
    <p style="margin:0;color:#444;font-size:15px;line-height:1.8;">
      A single donation of yours can save up to <strong style="color:#c0392b;">3 lives</strong>. We are truly honoured to have you in our community.
    </p>
  </td></tr>

  <!-- BLOOD GROUP CARD -->
  <tr><td style="padding:0 32px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff9f9;border:2px solid #fdd;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:28px;" align="center">
        <div style="display:inline-block;background:${bColor};color:#fff;font-size:42px;font-weight:900;padding:18px 36px;border-radius:14px;letter-spacing:3px;line-height:1;">${blood}</div>
        <p style="margin:10px 0 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Your Blood Group</p>
      </td></tr>
      <tr><td style="padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${city ? `<tr><td style="padding:10px 0;border-top:1px solid #f0e0e0;">
            <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">📍 Location</span><br>
            <span style="color:#222;font-size:15px;font-weight:600;">${city}${area ? ', ' + area : ''}</span>
          </td></tr>` : ''}
          <tr><td style="padding:10px 0;border-top:1px solid #f0e0e0;">
            <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">🚨 Emergency Availability</span><br>
            <span style="color:#222;font-size:15px;font-weight:600;">${emergency === 'Yes' ? '✅ Available for Emergency' : '⏸ Not Available for Emergency'}</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-top:1px solid #f0e0e0;">
            <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">📅 Registered On</span><br>
            <span style="color:#222;font-size:15px;font-weight:600;">${time} IST</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- WHAT HAPPENS NEXT -->
  <tr><td style="padding:0 32px 32px;">
    <h3 style="margin:0 0 20px;color:#c0392b;font-size:18px;font-weight:700;border-left:4px solid #c0392b;padding-left:12px;">What Happens Next?</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:14px 0;border-bottom:1px solid #f5f5f5;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td width="48" style="vertical-align:top;">
            <div style="width:42px;height:42px;background:#fef2f2;border-radius:50%;text-align:center;line-height:42px;font-size:20px;">📋</div>
          </td>
          <td style="padding-left:14px;vertical-align:top;">
            <strong style="color:#1a1a1a;font-size:15px;display:block;margin-bottom:4px;">1. Profile Activation</strong>
            <span style="color:#666;font-size:13px;line-height:1.7;">Your profile is now active in our donor database, ensuring we can match you with those in need.</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #f5f5f5;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td width="48" style="vertical-align:top;">
            <div style="width:42px;height:42px;background:#fef2f2;border-radius:50%;text-align:center;line-height:42px;font-size:20px;">📞</div>
          </td>
          <td style="padding-left:14px;vertical-align:top;">
            <strong style="color:#1a1a1a;font-size:15px;display:block;margin-bottom:4px;">2. We'll Contact You</strong>
            <span style="color:#666;font-size:13px;line-height:1.7;">When someone near you needs <strong>${blood}</strong> blood, we'll reach out via your preferred method.</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td width="48" style="vertical-align:top;">
            <div style="width:42px;height:42px;background:#fef2f2;border-radius:50%;text-align:center;line-height:42px;font-size:20px;">❤️</div>
          </td>
          <td style="padding-left:14px;vertical-align:top;">
            <strong style="color:#1a1a1a;font-size:15px;display:block;margin-bottom:4px;">3. Donate & Save Lives</strong>
            <span style="color:#666;font-size:13px;line-height:1.7;">Visit the donation centre, donate, and know your act of kindness saves up to 3 lives.</span>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- STATS BANNER -->
  <tr><td style="padding:0 32px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#c0392b,#e74c3c);border-radius:12px;">
      <tr><td style="padding:28px 24px;" align="center">
        <p style="margin:0;color:#f5b7b1;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Did You Know?</p>
        <p style="margin:10px 0 0;color:#fff;font-size:16px;font-weight:600;line-height:1.6;">
          Every <strong>2 seconds</strong> someone in India needs blood.<br>
          Your donation can save up to <span style="font-size:28px;font-weight:900;">3 lives</span>.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 32px 32px;" align="center">
    <a href="https://lifesaversunited.org/emergency_request_system"
       style="display:inline-block;background:#c0392b;color:#fff;font-size:15px;font-weight:700;padding:16px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
      View Active Blood Requests →
    </a>
  </td></tr>

  <!-- CONTACT -->
  <tr><td style="padding:0 32px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:10px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Need Help?</p>
        <p style="margin:0 0 6px;color:#333;font-size:14px;">📞 <a href="https://wa.me/919979260393" style="color:#c0392b;font-weight:600;text-decoration:none;">+91 9979260393</a> (WhatsApp — 24/7)</p>
        <p style="margin:0;color:#333;font-size:14px;">📧 <a href="mailto:lifesaversunited.india@gmail.com" style="color:#c0392b;text-decoration:none;">lifesaversunited.india@gmail.com</a></p>
      </td></tr>
    </table>
  </td></tr>

  <!-- SOCIAL -->
  <tr><td style="padding:0 32px 32px;" align="center">
    <p style="margin:0 0 12px;color:#888;font-size:13px;">Spread the word — help us save more lives 🙏</p>
    <a href="https://www.instagram.com/lifesavers_blooddonors" style="color:#c0392b;text-decoration:none;font-size:13px;font-weight:600;margin:0 8px;">Instagram</a>
    <span style="color:#ccc;">•</span>
    <a href="https://x.com/lifesaversunit" style="color:#c0392b;text-decoration:none;font-size:13px;font-weight:600;margin:0 8px;">X (Twitter)</a>
    <span style="color:#ccc;">•</span>
    <a href="https://chat.whatsapp.com/HRP2oqTxwbfKRHyH9BxtPw" style="color:#c0392b;text-decoration:none;font-size:13px;font-weight:600;margin:0 8px;">WhatsApp Group</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1a1a1a;padding:24px 32px;text-align:center;">
    <p style="margin:0 0 6px;color:#888;font-size:13px;">© ${new Date().getFullYear()} LifeSavers United | Made with ❤️ for India</p>
    <p style="margin:0 0 8px;">
      <a href="https://lifesaversunited.org" style="color:#666;text-decoration:none;font-size:12px;">lifesaversunited.org</a>
      <span style="color:#444;margin:0 6px;">•</span>
      <a href="https://lifesaversunited.org/privacy_policy" style="color:#666;text-decoration:none;font-size:12px;">Privacy Policy</a>
    </p>
    <p style="margin:0;color:#555;font-size:11px;">You received this because you registered as a donor on LifeSavers United.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Admin Notification Email ──────────────────────────────────────────────────
function buildAdminEmail(name, blood, city, area, email, phone, emergency, preferred, time) {
    const row = (label, value) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1px;display:block;">${label}</span>
        <span style="color:#222;font-size:15px;font-weight:600;">${value || '<em style="color:#bbb;">Not provided</em>'}</span>
      </td></tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Donor Registration</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <!-- HEADER -->
  <tr><td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0;">
    <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:50px;width:auto;">
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:#c0392b;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">🩸 New Donor Registration</h1>
    <p style="color:#f5b7b1;margin:6px 0 0;font-size:14px;">LifeSavers United — lifesaversunited.org</p>
  </td></tr>

  <!-- BLOOD GROUP HIGHLIGHT -->
  <tr><td style="padding:24px 32px 0;" align="center">
    <div style="display:inline-block;background:#c0392b;color:#fff;font-size:32px;font-weight:900;padding:12px 28px;border-radius:10px;letter-spacing:2px;">${blood}</div>
  </td></tr>

  <!-- DETAILS -->
  <tr><td style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Full Name', `<strong>${name}</strong>`)}
      ${row('Phone Number', phone)}
      ${row('Email Address', email ? `<a href="mailto:${email}" style="color:#c0392b;">${email}</a>` : '')}
      ${row('City / Area', city ? `${city}${area ? ', ' + area : ''}` : '')}
      ${row('Emergency Available', emergency)}
      ${row('Preferred Contact', preferred)}
      ${row('Submitted At', `${time} IST`)}
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#fafafa;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
    <p style="color:#aaa;font-size:12px;margin:0;">Submitted via lifesaversunited.org/donor_registration</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
