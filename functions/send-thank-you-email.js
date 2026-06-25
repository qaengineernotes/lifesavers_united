/**
 * Cloudflare Pages Function: /send-thank-you-email
 *
 * Sends a personalized thank-you email to a donor after a blood donation is logged.
 *
 * Flow:
 * 1. Parse parameters: donorEmail, donorName, donationDate, patientName, hospitalName
 * 2. Validate required inputs.
 * 3. Render a beautiful HTML template matching LifeSavers United branding.
 * 4. Send via the Free Provider Waterfall: Resend → Brevo → Mailjet
 *
 * Required env variables:
 *   RESEND_API_KEY     — resend.com
 *   BREVO_API_KEY      — brevo.com
 *   MAILJET_API_KEY    — mailjet.com
 *   MAILJET_SECRET_KEY — mailjet.com secret
 */

import { sendEmail } from './_email-sender.js';

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
        try {
            data = await context.request.json();
        } catch {
            return Response.json({ success: false, error: 'Invalid JSON.' }, { status: 400, headers: CORS });
        }

        const { donorEmail, donorName, donationDate, patientName, hospitalName } = data;

        if (!donorEmail || !donorName || !patientName || !hospitalName) {
            return Response.json(
                { success: false, error: 'Missing required fields: donorEmail, donorName, patientName, hospitalName.' },
                { status: 422, headers: CORS }
            );
        }

        // Sanitise inputs (strip tags)
        const clean = (str) => String(str ?? '').replace(/[<>]/g, '').trim().slice(0, 500);
        const safeEmail        = clean(donorEmail);
        const safeDonorName    = clean(donorName);
        const safePatientName  = clean(patientName);
        const safeHospitalName = clean(hospitalName);
        const safeDate         = donationDate ? clean(donationDate) : new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' });

        const donorFirstName = safeDonorName.split(' ')[0];

        // ── Compose HTML thank-you body ──────────────────────────────────────
        const htmlBody = buildThankYouTemplate(safeDonorName, donorFirstName, safeDate, safePatientName, safeHospitalName);

        // ── Compose Plain Text thank-you body ────────────────────────────────
        const textBody = [
            `🩸 Thank You for Saving a Life, ${donorFirstName}! ❤️`,
            '='.repeat(50),
            '',
            `Dear ${safeDonorName},`,
            '',
            'Words fall short, but we have to try — Thank You. 🙏',
            '',
            `On ${safeDate}, you donated blood for ${safePatientName} at ${safeHospitalName}. In that one selfless act, you gave someone's family the most precious gift in the world — hope, and a fighting chance at life.`,
            '',
            `Because of you, ${safePatientName} gets another day. And that means everything.`,
            '',
            'We at LifeSavers United are deeply proud and honoured to have you in our family. You are not just a donor — you are a true LifeSaver. 🦺❤️',
            '',
            'Thank you for showing up. Thank you for caring. Thank you for being you.',
            '',
            '❝ The greatest gift you can give is the gift of life. Thank you for being that gift. ❞',
            '',
            'With heartfelt gratitude,',
            'LifeSavers United',
            '',
            '─'.repeat(50),
            '📧 lifesaversunited.india@gmail.com',
            '📸 Instagram: https://www.instagram.com/lifesavers_blooddonors',
            '🐦 X (Twitter): https://x.com/lifesaversunit',
            '─'.repeat(50),
        ].join('\r\n');

        // ── Send via Waterfall (Resend → Brevo → Mailjet) ────────────────────
        const result = await sendEmail(context.env, {
            to:      [safeEmail],
            subject: `🩸 Thank You for Saving a Life, ${donorFirstName}! ❤️`,
            html:    htmlBody,
            text:    textBody,
        });

        if (!result.ok) {
            console.error('[send-thank-you-email] All providers failed:', result.allAttempts);
            throw new Error('Email delivery failed.');
        }

        console.log(`[send-thank-you-email] Email sent successfully via ${result.provider}`);

        return Response.json(
            { success: true, message: `Thank you email sent via ${result.provider}.` },
            { status: 200, headers: CORS }
        );

    } catch (err) {
        console.error('[send-thank-you-email] Error:', err);
        return Response.json(
            { success: false, error: err.message || 'Failed to send thank-you email.' },
            { status: 500, headers: CORS }
        );
    }
}

// ── Thank-You Email Template ────────────────────────────────────────────────
function buildThankYouTemplate(donorName, firstName, date, patientName, hospitalName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Thank You for Saving a Life!</title>
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
                            <div style="font-size:80px;line-height:1;margin-bottom:10px;">🩸</div>
                        </td>
                    </tr>

                    <!-- MAIN CONTENT -->
                    <tr>
                        <td style="padding:30px 40px;text-align:left;">
                            <h1 style="color:#c0392b;margin:0 0 20px;font-size:28px;font-weight:800;letter-spacing:-0.5px;text-align:center;">
                                Thank You, ${firstName}!
                            </h1>
                            <p style="color:#1a1a1a;font-size:16px;line-height:1.8;margin:0 0 16px;font-weight:600;">
                                Dear ${donorName},
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 16px;">
                                Words fall short, but we have to try — Thank You. 🙏
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 16px;">
                                On <strong>${date}</strong>, you donated blood for <strong>${patientName}</strong> at <strong>${hospitalName}</strong>. In that one selfless act, you gave someone's family the most precious gift in the world — hope, and a fighting chance at life.
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 16px;">
                                Because of you, <strong>${patientName}</strong> gets another day. And that means everything.
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 24px;">
                                We at LifeSavers United are deeply proud and honoured to have you in our family. You are not just a donor — you are a true LifeSaver. 🦺❤️
                            </p>
                            <p style="color:#444;font-size:16px;line-height:1.8;margin:0 0 24px;">
                                Thank you for showing up. Thank you for caring. Thank you for being you.
                            </p>
                        </td>
                    </tr>

                    <!-- QUOTE BOX -->
                    <tr>
                        <td style="padding:0 40px 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);border-radius:20px;color:#ffffff;text-align:center;">
                                <tr>
                                    <td style="padding:35px 30px;">
                                        <h2 style="margin:0;font-size:22px;font-weight:700;line-height:1.4;font-style:italic;">
                                            "The greatest gift you can give is the gift of life. Thank you for being that gift."
                                        </h2>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- PERSONAL NOTE / CLOSING -->
                    <tr>
                        <td style="padding:0 40px 40px;text-align:center;">
                            <p style="color:#1a1a1a;font-size:16px;font-weight:700;margin:0 0 5px;">
                                With heartfelt gratitude,
                            </p>
                            <p style="color:#c0392b;font-size:18px;font-weight:800;margin:0;">
                                LifeSavers United
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
                                <a href="mailto:lifesaversunited.india@gmail.com" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Email Us</a>
                                <span style="color:#ddd;">|</span>
                                <a href="https://www.instagram.com/lifesavers_blooddonors" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Instagram</a>
                                <span style="color:#ddd;">|</span>
                                <a href="https://x.com/lifesaversunit" style="color:#c0392b;text-decoration:none;margin:0 10px;font-size:13px;font-weight:600;">Twitter (X)</a>
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
