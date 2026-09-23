/**
 * Cloudflare Pages Function: /send-eligibility-email
 *
 * Sends a Thank-You & Multi-Type Blood Donation Eligibility Roadmap email to a donor
 * when a recent donation (within 7 days) is recorded.
 *
 * Flow:
 * 1. Parse parameters: donorEmail, donorName, donationDate, donationType, hospitalName, gender
 * 2. Enforce the 7-day rule: Only send if donation date is <= 7 days old.
 * 3. Calculate exact next eligible dates for Platelets (SDP), Plasma, and Whole Blood.
 * 4. Render branded HTML template.
 * 5. Send via Free Provider Waterfall in _email-sender.js.
 */

import { sendEmail } from './_email-sender.js';
import { calculateEligibilityDates, getRequiredCooldownDays, getDonationTypeLabel } from '../scripts/donation-interval-validator.js';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
    try {
        let data;
        try {
            data = await context.request.json();
        } catch {
            return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400, headers: CORS });
        }

        const { donorEmail, donorName, donationDate, donationType, hospitalName, gender } = data;

        if (!donorEmail || !donorName) {
            return Response.json(
                { success: false, error: 'donorEmail and donorName are required.' },
                { status: 422, headers: CORS }
            );
        }

        // Parse and validate donation date
        if (!donationDate) {
            return Response.json(
                { success: false, error: 'donationDate is required.' },
                { status: 422, headers: CORS }
            );
        }

        // Validate format and calendar validity (prevent roll-over of invalid dates e.g. 2026-02-30 -> 2026-03-02)
        const dateMatch = typeof donationDate === 'string' && donationDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
        if (!dateMatch) {
            return Response.json(
                { success: false, error: 'donationDate must be a valid date in YYYY-MM-DD or ISO 8601 format.' },
                { status: 422, headers: CORS }
            );
        }

        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);

        const calendarCheck = new Date(Date.UTC(year, month - 1, day));
        if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) {
            return Response.json(
                { success: false, error: 'donationDate is not a valid calendar date.' },
                { status: 422, headers: CORS }
            );
        }

        const donDate = new Date(donationDate);
        const now = new Date();
        if (Number.isNaN(donDate.getTime()) || donDate.getTime() > now.getTime()) {
            return Response.json(
                { success: false, error: 'donationDate must be a valid past date.' },
                { status: 422, headers: CORS }
            );
        }

        const diffMs = now.getTime() - donDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // ── 7-Day Rule Check ────────────────────────────────────────────────────────
        // If the donation is older than 7 days, skip sending the email silently
        if (diffDays > 7.5) {
            return Response.json({
                success: true,
                skipped: true,
                message: 'Thank-you email skipped: donation date is older than 7 days.'
            }, { status: 200, headers: CORS });
        }

        // Clean text inputs
        const clean = (str) => String(str ?? '').replace(/[<>]/g, '').trim().slice(0, 300);
        const safeEmail = clean(donorEmail);
        const safeName = clean(donorName);
        const safeHospital = hospitalName ? clean(hospitalName) : 'Blood Donation Center';
        const safeType = clean(getDonationTypeLabel(donationType) || donationType || 'Whole Blood');

        // Calculate intervals using shared clinical interval matrix
        const eligibility = calculateEligibilityDates(donDate, donationType, gender);
        const sdpDays = getRequiredCooldownDays(donationType, 'platelets_sdp', gender);
        const plasmaDays = getRequiredCooldownDays(donationType, 'plasma', gender);
        const wbDays = getRequiredCooldownDays(donationType, 'whole_blood', gender);

        const formatD = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        const donFormatted = formatD(donDate);
        const sdpFormatted = eligibility.platelets.formattedDate || formatD(eligibility.platelets.eligibleDate);
        const plasmaFormatted = eligibility.plasma.formattedDate || formatD(eligibility.plasma.eligibleDate);
        const wbFormatted = eligibility.wholeBlood.formattedDate || formatD(eligibility.wholeBlood.eligibleDate);

        const subject = `🩸 Thank you for donating blood! Your Next Eligibility Roadmap — LifeSavers United`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px 24px; text-align: center; color: white; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 0; font-size: 15px; opacity: 0.92; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .badge { display: inline-block; background-color: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .roadmap-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    .roadmap-table th, .roadmap-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .roadmap-table th { background-color: #f1f5f9; font-weight: 600; color: #475569; }
    .roadmap-table tr:last-child td { border-bottom: none; }
    .btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 24px; text-align: center; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #dc2626; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❤️ You Are A Lifesaver!</h1>
      <p>Your blood donation has the power to save up to 3 lives.</p>
    </div>
    <div class="content">
      <div class="greeting">Dear ${safeName},</div>
      <p>On behalf of patients, families, and doctors across our network, <strong>thank you</strong> for your life-saving blood donation on <strong>${donFormatted}</strong> at <strong>${safeHospital}</strong>.</p>
      
      <div class="card">
        <strong style="color: #0f172a; font-size: 15px;">🗓️ Your Next Eligibility Roadmap</strong>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">Based on DGHS India clinical recovery guidelines, here is when you will be eligible to donate again:</p>
        
        <table class="roadmap-table">
          <thead>
            <tr>
              <th>Donation Type</th>
              <th>Interval</th>
              <th>Eligible From</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Platelets (SDP)</strong></td>
              <td>${sdpDays} Days</td>
              <td style="color: #059669; font-weight: 600;">${sdpFormatted}</td>
            </tr>
            <tr>
              <td><strong>Plasma</strong></td>
              <td>${plasmaDays} Days</td>
              <td style="color: #059669; font-weight: 600;">${plasmaFormatted}</td>
            </tr>
            <tr>
              <td><strong>Whole Blood</strong></td>
              <td>${wbDays} Days</td>
              <td style="color: #059669; font-weight: 600;">${wbFormatted}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        We will also send you a friendly reminder <strong>3 days before</strong> your next eligible date so you can prepare to save lives again!
      </p>

      <div style="text-align: center;">
        <a href="https://lifesaversunited.org/donor_portal" class="btn">View Your Donor Portal & Card</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${now.getFullYear()} LifeSavers United. India's 24/7 Emergency Blood Donation Platform.</p>
      <p>Have questions or need emergency assistance? Reach our hotline at <a href="https://wa.me/919979260393">9979260393</a>.</p>
    </div>
  </div>
</body>
</html>`;

        const result = await sendEmail(context.env, {
            to: safeEmail,
            subject,
            html,
            replyTo: 'lifesaversunited.india@gmail.com'
        });

        return Response.json({ success: true, result }, { status: 200, headers: CORS });
    } catch (err) {
        console.error('Error in /send-eligibility-email:', err);
        return Response.json({ success: false, error: err.message }, { status: 500, headers: CORS });
    }
}
