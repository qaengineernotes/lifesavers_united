/**
 * Cloudflare Pages Function: /doctor-signup
 *
 * Receives doctor registration data via POST (JSON), validates it,
 * and sends two emails using Mailjet (with circular fallback):
 *   1. An admin notification email to lifesaversunited.india@gmail.com with all doctor details
 *   2. A welcome & thank you email to the Doctor (if email provided)
 *
 * Uses the Free Provider Waterfall via _email-sender.js: Mailjet → Brevo → Resend
 */

import { sendEmail } from './_email-sender.js';

const ADMIN_EMAIL = 'lifesaversunited.india@gmail.com';

export async function onRequestPost(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://lifesaversunited.org',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        let data;
        try {
            data = await context.request.json();
        } catch {
            return Response.json(
                { success: false, error: 'Invalid JSON body.' },
                { status: 400, headers: corsHeaders }
            );
        }

        const { fullName, specialty, hospital, city, phone, email, regNumber, consentAccuracy, joinWhatsApp } = data;

        // ── Server-side validation ─────────────────────────────────────────
        if (!fullName || !specialty || !hospital || !city || !phone) {
            return Response.json(
                { success: false, error: 'Missing required fields: fullName, specialty, hospital, city, phone.' },
                { status: 422, headers: corsHeaders }
            );
        }

        if (!consentAccuracy) {
            return Response.json(
                { success: false, error: 'Accuracy confirmation and consent is required.' },
                { status: 422, headers: corsHeaders }
            );
        }

        // Sanitise inputs (strip tags)
        const clean = (str) => String(str ?? '').replace(/[<>]/g, '').trim().slice(0, 300);

        const safeName        = clean(fullName);
        const safeSpecialty   = clean(specialty);
        const safeHospital    = clean(hospital);
        const safeCity        = clean(city);
        const safePhone       = clean(phone);
        const safeEmail       = clean(email);
        const safeRegNumber   = clean(regNumber);
        const safeWhatsAppOpt = joinWhatsApp ? 'Yes (Wants WhatsApp Group Invite)' : 'No (Voluntary Medical Advisory Only)';
        const displayName     = safeName.startsWith('Dr.') ? safeName : `Dr. ${safeName}`;

        // ── Build the IST timestamp ────────────────────────────────────────
        const istTime = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'full',
            timeStyle: 'short',
        });

        // ===================================================================
        // 1. ADMIN NOTIFICATION EMAIL (All Details Filled by Doctor)
        // ===================================================================
        const adminTextBody = [
            '🩺 New Doctor Application — LifeSavers United Doctors Network',
            '='.repeat(65),
            '',
            `Doctor Name       : ${displayName}`,
            `Specialty         : ${safeSpecialty}`,
            `Hospital / Clinic : ${safeHospital}`,
            `City              : ${safeCity}`,
            `Phone / WhatsApp  : +91 ${safePhone}`,
            `Email             : ${safeEmail || 'Not provided'}`,
            `Registration No.  : ${safeRegNumber || 'Not provided (Verify manually)'}`,
            `WhatsApp Opt-In   : ${safeWhatsAppOpt}`,
            `Accuracy & Consent: Confirmed`,
            '',
            '─'.repeat(65),
            `Submitted At      : ${istTime} IST`,
            `Source            : https://lifesaversunited.org/doctors-network`,
            '─'.repeat(65),
            '',
            'Action Required:',
            '1. Verify doctor credentials / Medical Council Registration number.',
            '2. If approved, send WhatsApp Group invitation link:',
            '   https://chat.whatsapp.com/LWQT65eBByFDcqF6I0XwyP',
        ].join('\r\n');

        const adminHtmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Doctor Application</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:22px 30px;text-align:center;border-bottom:1px solid #edf2f7;">
            <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:48px;width:auto;">
          </td>
        </tr>
        <!-- Hero Header -->
        <tr>
          <td style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);padding:26px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">🩺 New Doctors Network Registration</h1>
            <p style="color:#94a3b8;margin:6px 0 0;font-size:14px;">Verification Required • LifeSavers United</p>
          </td>
        </tr>
        <!-- Body Details -->
        <tr>
          <td style="padding:32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">Doctor Name</span>
                  <span style="color:#0f172a;font-size:17px;font-weight:bold;">${displayName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">Specialty / Field of Practice</span>
                  <span style="color:#dc2626;font-size:16px;font-weight:bold;">${safeSpecialty}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">Hospital / Clinic</span>
                  <span style="color:#0f172a;font-size:15px;">${safeHospital}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">City</span>
                  <span style="color:#0f172a;font-size:15px;">${safeCity}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">WhatsApp / Contact Number</span>
                  <span style="color:#0f172a;font-size:16px;font-weight:bold;"><a href="https://wa.me/91${safePhone}" style="color:#059669;text-decoration:none;">+91 ${safePhone} (Chat on WhatsApp)</a></span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">Email Address</span>
                  <span style="color:#0f172a;font-size:15px;">${safeEmail ? `<a href="mailto:${safeEmail}" style="color:#0f172a;">${safeEmail}</a>` : '<em style="color:#94a3b8;">Not provided</em>'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">Medical Registration Number</span>
                  <span style="color:#0f172a;font-size:15px;font-weight:bold;">${safeRegNumber || '<em style="color:#94a3b8;">Not provided (Verify with Hospital/Clinic)</em>'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;font-weight:bold;display:block;">WhatsApp Community Invitation Preference</span>
                  <span style="color:#0f172a;font-size:15px;font-weight:bold;">${safeWhatsAppOpt}</span>
                </td>
              </tr>
            </table>

            <!-- Next Step Action Box -->
            <div style="margin-top:24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
              <strong style="color:#166534;font-size:14px;display:block;margin-bottom:6px;">Next Verification Steps:</strong>
              <p style="color:#15803d;font-size:13px;line-height:1.5;margin:0 0 10px;">
                1. Review medical credentials / registration number.<br>
                2. If verified, send the WhatsApp group invite link to the doctor:
              </p>
              <a href="https://wa.me/91${safePhone}?text=Hello%20${encodeURIComponent(displayName)}%2C%20welcome%20to%20LifeSavers%20United%20Doctors%20Network!%20Your%20application%20is%20verified.%20Please%20join%20our%20exclusive%20group%20here%3A%20https%3A%2F%2Fchat.whatsapp.com%2FLWQT65eBByFDcqF6I0XwyP" target="_blank" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:bold;">
                Send Verified WhatsApp Invite to +91 ${safePhone} →
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #edf2f7;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Submitted on ${istTime} IST via lifesaversunited.org/doctors-network</p>
            <p style="color:#cbd5e1;font-size:11px;margin:0;">© ${new Date().getFullYear()} LifeSavers United</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        // ===================================================================
        // 2. DOCTOR WELCOME & THANK YOU EMAIL (Executive, Warm, Respectful)
        // ===================================================================
        const doctorTextBody = [
            `🩺 Welcome to LifeSavers United Doctors Network`,
            '='.repeat(65),
            '',
            `Dear ${displayName},`,
            '',
            'On behalf of the entire team at LifeSavers United, thank you for joining our Voluntary Doctors Network.',
            '',
            'Your willingness to lend your clinical expertise and medical guidance provides invaluable support to our emergency blood coordination mission across Gujarat and India.',
            '',
            '─'.repeat(65),
            'HOW WE ENGAGE WITH YOU:',
            '─'.repeat(65),
            '• Contact via Message Only:',
            '  We deeply respect your busy schedule and clinical duties. We will only reach out to you through message (WhatsApp/SMS) when there is an active emergency and we genuinely need your medical expertise and suggestions.',
            '',
            '• Contacted by Authorized Members Only:',
            '  For your safety and privacy, you will only be contacted by verified, authorized LifeSavers United members.',
            '',
            '• Complete Privacy:',
            '  Your personal contact details remain 100% confidential and will never be published publicly or shared with third parties.',
            '',
            '─'.repeat(65),
            'EXCLUSIVE DOCTORS COMMUNITY:',
            '─'.repeat(65),
            'Connect with fellow doctors and medical specialists in our voluntary advisory group:',
            'https://chat.whatsapp.com/LWQT65eBByFDcqF6I0XwyP',
            '',
            '─'.repeat(65),
            'Need to reach our medical coordination desk directly?',
            '• WhatsApp Helpline : +91 9979260393 (24/7)',
            '• Email             : lifesaversunited.india@gmail.com',
            '• Website           : https://lifesaversunited.org/doctors-network',
            '',
            'Warm regards and respect,',
            'Team LifeSavers United',
            'Every Drop Counts • Every Life Matters',
        ].join('\r\n');

        const doctorHtmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to LifeSavers United Doctors Network</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          
          <!-- Brand Logo Header -->
          <tr>
            <td style="background:#ffffff;padding:26px 36px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <a href="https://lifesaversunited.org" target="_blank" style="text-decoration:none;">
                <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png" alt="LifeSavers United" style="height:52px;width:auto;display:inline-block;" border="0">
              </a>
            </td>
          </tr>

          <!-- Hero Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);padding:36px 36px;text-align:center;">
              <div style="display:inline-block;background:rgba(220,38,38,0.15);border:1px solid rgba(239,68,68,0.3);padding:6px 14px;border-radius:20px;margin-bottom:14px;">
                <span style="color:#fca5a5;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🩺 Voluntary Medical Network</span>
              </div>
              <h1 style="color:#ffffff;margin:0 0 8px;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Welcome to LifeSavers United</h1>
              <p style="color:#94a3b8;margin:0;font-size:15px;line-height:1.5;">Thank you for standing with us to save critical lives</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h2 style="color:#0f172a;font-size:18px;margin:0 0 14px;font-weight:700;">Dear ${displayName},</h2>
              <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px;">
                On behalf of the entire team at <strong>LifeSavers United</strong> and the thousands of patients and voluntary donors we support across Gujarat and India, thank you for joining our Voluntary Doctors Network.
              </p>
              <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">
                Your willingness to lend your clinical expertise and medical guidance provides invaluable support to our emergency blood coordination mission.
              </p>

              <!-- Engagement Protocol Box -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:22px;margin:0 0 28px;">
                <h3 style="color:#0f172a;font-size:15px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px;border-left:4px solid #dc2626;padding-left:10px;">
                  How We Engage With You
                </h3>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="36" style="vertical-align:top;padding-bottom:14px;">
                      <div style="width:28px;height:28px;background:#e0f2fe;color:#0284c7;border-radius:50%;text-align:center;line-height:28px;font-size:14px;font-weight:bold;">💬</div>
                    </td>
                    <td style="vertical-align:top;padding-bottom:14px;padding-left:10px;">
                      <strong style="color:#0f172a;font-size:14px;display:block;margin-bottom:3px;">Contact via Message Only</strong>
                      <span style="color:#475569;font-size:13px;line-height:1.6;">
                        We deeply respect your busy schedule and clinical duties. We will only contact you through <strong>message</strong> (WhatsApp/SMS) when there is an active emergency and we genuinely need your medical expertise and suggestions.
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td width="36" style="vertical-align:top;padding-bottom:14px;">
                      <div style="width:28px;height:28px;background:#fef3c7;color:#d97706;border-radius:50%;text-align:center;line-height:28px;font-size:14px;font-weight:bold;">🛡️</div>
                    </td>
                    <td style="vertical-align:top;padding-bottom:14px;padding-left:10px;">
                      <strong style="color:#0f172a;font-size:14px;display:block;margin-bottom:3px;">Contacted by Authorized Members Only</strong>
                      <span style="color:#475569;font-size:13px;line-height:1.6;">
                        For your security and peace of mind, you will only be contacted by verified, authorized LifeSavers United team members.
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td width="36" style="vertical-align:top;">
                      <div style="width:28px;height:28px;background:#dcfce7;color:#16a34a;border-radius:50%;text-align:center;line-height:28px;font-size:14px;font-weight:bold;">🔒</div>
                    </td>
                    <td style="vertical-align:top;padding-left:10px;">
                      <strong style="color:#0f172a;font-size:14px;display:block;margin-bottom:3px;">100% Privacy & Confidentiality</strong>
                      <span style="color:#475569;font-size:13px;line-height:1.6;">
                        Your personal contact details and registration records remain strictly confidential and will never be published publicly or shared with third parties.
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Community Invitation CTA -->
              <div style="background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);border:1px solid #bbf7d0;border-radius:10px;padding:22px;text-align:center;margin:0 0 28px;">
                <h3 style="color:#166534;font-size:16px;margin:0 0 8px;font-weight:700;">Join Our Medical Advisory Group</h3>
                <p style="color:#15803d;font-size:13px;line-height:1.5;margin:0 0 16px;">
                  Connect directly with fellow medical professionals and specialists in our voluntary peer network:
                </p>
                <a href="https://chat.whatsapp.com/LWQT65eBByFDcqF6I0XwyP" target="_blank" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(5,150,105,0.25);">
                  Join Doctors Network on WhatsApp →
                </a>
              </div>

              <!-- Contact Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Need to reach our medical coordination desk directly?</p>
                    <p style="margin:0 0 4px;color:#0f172a;font-size:13px;">
                      📞 <strong>WhatsApp Helpline:</strong> <a href="https://wa.me/919979260393" style="color:#dc2626;text-decoration:none;font-weight:600;">+91 9979260393</a> (24/7)
                    </p>
                    <p style="margin:0;color:#0f172a;font-size:13px;">
                      📧 <strong>Email:</strong> <a href="mailto:lifesaversunited.india@gmail.com" style="color:#dc2626;text-decoration:none;">lifesaversunited.india@gmail.com</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p style="color:#64748b;font-size:14px;line-height:1.6;margin:24px 0 0;">
                Warm regards and respect,<br>
                <strong style="color:#0f172a;">Team LifeSavers United</strong><br>
                <span style="font-size:12px;color:#94a3b8;">Every Drop Counts • Every Life Matters</span>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #edf2f7;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">LifeSavers United — Voluntary Blood Coordination Platform</p>
              <p style="color:#cbd5e1;font-size:11px;margin:0;">
                <a href="https://lifesaversunited.org" style="color:#94a3b8;text-decoration:none;">lifesaversunited.org</a> • 
                <a href="https://lifesaversunited.org/privacy_policy" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        // ===================================================================
        // 3. EXECUTE EMAIL DELIVERIES VIA MAILJET (Waterfalls if needed)
        // ===================================================================

        // 3a. Admin Notification Email
        const adminResult = await sendEmail(context.env, {
            to:                [ADMIN_EMAIL],
            subject:           `🩺 New Doctor Application: ${displayName} (${safeSpecialty}, ${safeCity})`,
            html:              adminHtmlBody,
            text:              adminTextBody,
            replyTo:           safeEmail || undefined,
            preferredProvider: 'mailjet',
        });

        if (!adminResult.ok) {
            console.error('[doctor-signup] Admin notification email failed:', adminResult.allAttempts);
        }

        // 3b. Doctor Welcome & Thank You Email (if email address was provided)
        if (safeEmail && safeEmail.includes('@')) {
            const doctorResult = await sendEmail(context.env, {
                to:                [safeEmail],
                subject:           `🩺 Welcome to LifeSavers United Doctors Network, ${displayName}`,
                html:              doctorHtmlBody,
                text:              doctorTextBody,
                preferredProvider: 'mailjet',
            });

            if (!doctorResult.ok) {
                console.error('[doctor-signup] Doctor welcome email failed:', doctorResult.allAttempts);
            }
        }

        return Response.json(
            { success: true, message: 'Doctor registration received successfully.' },
            { status: 200, headers: corsHeaders }
        );

    } catch (err) {
        console.error('[doctor-signup] Error:', err);
        return Response.json(
            { success: false, error: 'Internal server error.' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://lifesaversunited.org',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
