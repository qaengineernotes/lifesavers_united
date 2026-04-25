/**
 * Cloudflare Pages Function: /volunteer-signup
 *
 * Receives volunteer form data via POST (JSON), validates it,
 * and sends a notification email using Cloudflare Email Routing.
 *
 * Required binding (set in CF Pages dashboard):
 *   - Email binding named: EMAIL
 *   - Sender address:      noreply@lifesaversunited.org
 *   - Destination:         lifesaversunited.india@gmail.com
 */

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
          <td style="background:#c0392b;padding:24px 32px;text-align:center;">
            <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo-white.png" alt="LifeSavers United" style="height:60px;width:auto;margin-bottom:10px;">
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

        // ── Send via Resend API ──────────────────────────────────────────────
        const resendApiKey = context.env.RESEND_API_KEY;

        if (!resendApiKey) {
            console.error('[volunteer-signup] Missing RESEND_API_KEY');
            throw new Error('Email service not configured.');
        }

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Lifesavers United <noreply@lifesaversunited.org>',
                to: ['lifesaversunited.india@gmail.com'],
                subject: `🩸 New Volunteer: ${safeName} from ${safeCity}`,
                html: htmlBody,
                text: textBody,
                reply_to: safeEmail || undefined,
            }),
        });

        if (!resendResponse.ok) {
            const errorData = await resendResponse.json();
            console.error('[volunteer-signup] Resend Error:', errorData);
            throw new Error('Email delivery failed.');
        }

        return Response.json(
            { success: true, message: 'Application received! We\'ll reach out within 24 hours.' },
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

