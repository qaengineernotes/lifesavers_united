/**
 * Cloudflare Pages Function: /volunteer-signup
 *
 * Receives volunteer form data via POST (JSON), validates it,
 * and sends a notification email using the Free Provider Waterfall.
 *
 * Uses the Free Provider Waterfall: Resend → Brevo → Mailjet
 * Required env variables (CF Pages → Settings → Environment Variables):
 *   RESEND_API_KEY     — resend.com        (100 emails/day free)
 *   BREVO_API_KEY      — brevo.com         (300 emails/day free)
 *   MAILJET_API_KEY    — mailjet.com       (200 emails/day free)
 *   MAILJET_SECRET_KEY — mailjet.com secret
 *
 * The sender domain (lifesaversunited.org) must be verified in each provider.
 */

import { sendEmail } from './_email-sender.js';

export async function onRequestPost(context) {
    // ── CORS headers (allow your own domain only) ──────────────────────────
    const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://lifesaversunited.org',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        // ── Parse incoming JSON body ───────────────────────────────────────
        let data;
        try {
            data = await context.request.json();
        } catch {
            return Response.json(
                { success: false, error: 'Invalid JSON body.' },
                { status: 400, headers: corsHeaders }
            );
        }

        const { name, phone, email, city, profession, message } = data;

        // ── Server-side validation ─────────────────────────────────────────
        if (!name || !phone || !city || !profession) {
            return Response.json(
                { success: false, error: 'Missing required fields: name, phone, city, profession.' },
                { status: 422, headers: corsHeaders }
            );
        }

        // Sanitise inputs (strip tags)
        const clean = (str) => String(str ?? '').replace(/[<>]/g, '').trim().slice(0, 500);

        const safeName       = clean(name);
        const safePhone      = clean(phone);
        const safeEmail      = clean(email);
        const safeCity       = clean(city);
        const safeProfession = clean(profession);
        const safeMessage    = clean(message);

        // ── Build the IST timestamp ────────────────────────────────────────
        const istTime = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'full',
            timeStyle: 'short',
        });

        // ── Compose plain-text email body ──────────────────────────────────
        const textBody = [
            '🩸 New Volunteer Application — Lifesavers United',
            '='.repeat(50),
            '',
            `Full Name   : ${safeName}`,
            `Phone       : ${safePhone}`,
            `Email       : ${safeEmail || '(not provided)'}`,
            `City        : ${safeCity}`,
            `Profession  : ${safeProfession}`,
            '',
            'Why they want to volunteer:',
            safeMessage || '(not provided)',
            '',
            '─'.repeat(50),
            `Submitted   : ${istTime} IST`,
            `Source      : https://lifesaversunited.org/volunteers`,
            '─'.repeat(50),
            '',
            'Reply to this email or contact the applicant directly.',
        ].join('\r\n');

        // ── Compose HTML email body ────────────────────────────────────────
        const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Volunteer Application</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0;">
            <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:50px;width:auto;">
          </td>
        </tr>
        <!-- Hero -->
        <tr>
          <td style="background:#c0392b;padding:24px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">🩸 New Volunteer Application</h1>
            <p style="color:#f5b7b1;margin:6px 0 0;font-size:14px;">Lifesavers United — lifesaversunited.org</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;display:block;">Full Name</span>
                  <span style="color:#222;font-size:16px;font-weight:bold;">${safeName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;display:block;">Phone Number</span>
                  <span style="color:#222;font-size:16px;">${safePhone}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;display:block;">Email Address</span>
                  <span style="color:#222;font-size:16px;">${safeEmail ? `<a href="mailto:${safeEmail}" style="color:#c0392b;">${safeEmail}</a>` : '<em style="color:#aaa;">Not provided</em>'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;display:block;">City</span>
                  <span style="color:#222;font-size:16px;">${safeCity}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;display:block;">Profession</span>
                  <span style="color:#222;font-size:16px;">${safeProfession}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="color:#888;font-size:13px;display:block;">Why they want to volunteer</span>
                  <span style="color:#444;font-size:15px;line-height:1.6;">${safeMessage || '<em style="color:#aaa;">Not provided</em>'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
            <p style="color:#aaa;font-size:12px;margin:0 0 4px;">Submitted on ${istTime} IST via lifesaversunited.org/volunteers</p>
            <p style="color:#bbb;font-size:11px;margin:0;">© ${new Date().getFullYear()} LifeSavers United</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const firstName = safeName.split(' ')[0] || safeName;

        const results = [];

        // ── 1. Send Volunteer Welcome Email via Mailjet (if email provided) ───
        if (safeEmail && safeEmail.includes('@')) {
            const welcomeHtml = buildVolunteerWelcomeTemplate(safeName, firstName);
            const welcomeText = buildVolunteerWelcomeText(safeName, firstName);

            const volunteerResult = await sendEmail(context.env, {
                to:                [safeEmail],
                subject:           `🩸 Welcome to the LifeSavers United Team, ${firstName}! 🤝❤️`,
                html:              welcomeHtml,
                text:              welcomeText,
                preferredProvider: 'mailjet',
            });

            results.push({ type: 'volunteer', provider: volunteerResult.provider, ok: volunteerResult.ok });
            if (!volunteerResult.ok) {
                console.warn('[volunteer-signup] Volunteer welcome email failed across providers:', volunteerResult.allAttempts);
            } else {
                console.log(`[volunteer-signup] Volunteer welcome email sent via ${volunteerResult.provider}`);
            }
        }

        // ── 2. Send Admin Notification via Resend (fallback: Brevo) ────────
        const adminResult = await sendEmail(context.env, {
            to:                ['lifesaversunited.india@gmail.com'],
            subject:           `🩸 New Volunteer: ${safeName} from ${safeCity}`,
            html:              htmlBody,
            text:              textBody,
            replyTo:           safeEmail || undefined,
            preferredProvider: 'resend',
        });

        results.push({ type: 'admin', provider: adminResult.provider, ok: adminResult.ok });

        if (!adminResult.ok) {
            console.error('[volunteer-signup] Admin notification failed across all providers:', adminResult.allAttempts);
            throw new Error('Email delivery failed.');
        }

        console.log(`[volunteer-signup] Admin notification sent via ${adminResult.provider}`);

        return Response.json(
            { success: true, message: 'Application received! We\'ll reach out shortly.', results },
            { status: 200, headers: corsHeaders }
        );

    } catch (err) {
        console.error('[volunteer-signup] Error:', err);
        return Response.json(
            { success: false, error: err.message || 'Failed to send application.' },
            { status: 500, headers: corsHeaders }
        );
    }
}

// ── Volunteer Welcome Email Template ─────────────────────────────────────────
function buildVolunteerWelcomeTemplate(fullName, firstName) {
    const currentYear = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Welcome to LifeSavers United!</title>
</head>
<body style="margin:0;padding:0;background-color:#fff5f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff5f5;padding:40px 10px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(192,57,43,0.1);">
                    
                    <!-- HEADER / LOGO -->
                    <tr>
                        <td style="padding:40px 40px 20px;text-align:center;">
                            <a href="https://lifesaversunited.org" target="_blank" style="text-decoration:none;">
                                <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:60px;width:auto;display:inline-block;" border="0">
                            </a>
                        </td>
                    </tr>

                    <!-- HERO IMAGE / ICON -->
                    <tr>
                        <td style="padding:0 40px;text-align:center;">
                            <div style="font-size:72px;line-height:1;margin-bottom:10px;">🤝❤️</div>
                        </td>
                    </tr>

                    <!-- MAIN CONTENT -->
                    <tr>
                        <td style="padding:20px 40px 30px;text-align:left;">
                            <h1 style="color:#c0392b;margin:0 0 20px;font-size:28px;font-weight:800;letter-spacing:-0.5px;text-align:center;">
                                Welcome to the Family, ${firstName}!
                            </h1>
                            <p style="color:#1a1a1a;font-size:16px;line-height:1.8;margin:0 0 16px;font-weight:600;">
                                Dear ${fullName},
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 16px;">
                                Words fall short of how grateful we are to have you with us. Thank you for stepping forward to volunteer with <strong>LifeSavers United</strong>! 🙏
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 24px;">
                                In a country where someone needs blood every 2 seconds, emergency blood coordination is a true race against time. By joining our volunteer family, you are choosing to be the bridge between a critical patient in need and a voluntary donor who can save their life.
                            </p>

                            <!-- WHAT HAPPENS NEXT BOX -->
                            <div style="background-color:#fff9f9;border:1px solid #fcdada;border-radius:16px;padding:22px 24px;margin:0 0 28px;">
                                <h3 style="color:#c0392b;margin:0 0 10px;font-size:17px;font-weight:700;">
                                    🌟 What Happens Next?
                                </h3>
                                <p style="color:#444;font-size:15px;line-height:1.7;margin:0;">
                                    One of our team members will contact you shortly through call or message and guide you further.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- QUOTE BOX -->
                    <tr>
                        <td style="padding:0 40px 35px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);border-radius:20px;color:#ffffff;text-align:center;">
                                <tr>
                                    <td style="padding:32px 28px;">
                                        <h2 style="margin:0;font-size:20px;font-weight:700;line-height:1.5;font-style:italic;">
                                            "Volunteers do not necessarily have the time; they just have the heart. Thank you for choosing to save lives with us."
                                        </h2>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CLOSING -->
                    <tr>
                        <td style="padding:0 40px 30px;text-align:center;">
                            <p style="color:#1a1a1a;font-size:16px;font-weight:700;margin:0 0 5px;">
                                With heartfelt gratitude,
                            </p>
                            <p style="color:#c0392b;font-size:18px;font-weight:800;margin:0;">
                                LifeSavers United
                            </p>
                        </td>
                    </tr>

                    <!-- CTA BUTTONS -->
                    <tr>
                        <td style="padding:0 40px 45px;text-align:center;">
                            <div style="margin-bottom:14px;">
                                <a href="https://lifesaversunited.org/emergency_request_system" style="display:inline-block;background-color:#c0392b;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 4px 15px rgba(192,57,43,0.3);">
                                    View Active Emergency Blood Requests →
                                </a>
                            </div>
                            <div>
                                <a href="https://wa.me/919979260393" style="display:inline-block;background-color:#25d366;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(37,211,102,0.25);">
                                    💬 Chat with Our Coordinator on WhatsApp
                                </a>
                            </div>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color:#f9f9f9;padding:30px 40px;text-align:center;border-top:1px solid #f0f0f0;">
                            <div style="margin-bottom:16px;">
                                <a href="mailto:lifesaversunited.india@gmail.com" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Email Us</a>
                                <span style="color:#ddd;">|</span>
                                <a href="https://www.instagram.com/lifesaversunited_blooddonors/" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Instagram</a>
                                <span style="color:#ddd;">|</span>
                                <a href="https://x.com/lifesaversunit" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Twitter (X)</a>
                            </div>
                            <p style="color:#999;font-size:12px;line-height:1.6;margin:0;">
                                &copy; ${currentYear} LifeSavers United. All rights reserved.<br>
                                You received this because you applied to volunteer with LifeSavers United.
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

// ── Volunteer Welcome Plain Text ─────────────────────────────────────────────
function buildVolunteerWelcomeText(fullName, firstName) {
    return [
        `🩸 Welcome to the LifeSavers United Team, ${firstName}! 🤝❤️`,
        '='.repeat(50),
        '',
        `Dear ${fullName},`,
        '',
        'Words fall short of how grateful we are to have you with us. Thank you for stepping forward to volunteer with LifeSavers United! 🙏',
        '',
        'In a country where someone needs blood every 2 seconds, emergency blood coordination is a true race against time. By joining our volunteer family, you are choosing to be the bridge between a critical patient in need and a voluntary donor who can save their life.',
        '',
        'What Happens Next?',
        'One of our team members will contact you shortly through call or message and guide you further.',
        '',
        '❝ Volunteers do not necessarily have the time; they just have the heart. Thank you for choosing to save lives with us. ❞',
        '',
        'With heartfelt gratitude,',
        'LifeSavers United',
        '',
        '─'.repeat(50),
        '• View Active Emergency Blood Requests : https://lifesaversunited.org/emergency_request_system',
        '• Chat with Coordinator on WhatsApp     : https://wa.me/919979260393',
        '• Email                                 : lifesaversunited.india@gmail.com',
        '• Instagram                             : https://www.instagram.com/lifesaversunited_blooddonors/',
        '• Twitter (X)                           : https://x.com/lifesaversunit',
        '─'.repeat(50),
    ].join('\r\n');
}

// ── Handle CORS preflight ──────────────────────────────────────────────────
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*', // Adjusted for flexibility during testing
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

