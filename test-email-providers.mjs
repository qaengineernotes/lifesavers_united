/**
 * test-email-providers.mjs
 *
 * Run from project root:
 *   node test-email-providers.mjs
 *
 * Sends one test email via Resend AND one via Brevo independently,
 * so you can verify both arrive from noreply@lifesaversunited.org
 *
 * Reads API keys from .env file in the same directory.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env manually (no external deps needed) ──────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
try {
    const envFile = readFileSync(join(__dir, '.env'), 'utf8');
    for (const line of envFile.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
} catch {
    // .env file is optional — keys can also be set in the shell environment
}

// ── Config ────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BREVO_API_KEY  = process.env.BREVO_API_KEY;

const FROM_NAME  = 'LifeSavers United';
const FROM_EMAIL = 'noreply@lifesaversunited.org';

// ⬇️  Change this to your email address to receive the test mails
const TEST_RECIPIENT = process.env.TEST_EMAIL || 'lifesaversunited.india@gmail.com';

// ── Helper: coloured console output ──────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

// ── Email HTML template ───────────────────────────────────────────────────────
function buildTestEmail(provider) {
    const now = new Date().toLocaleString('en-IN', {
        timeZone:  'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short',
    });
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>LifeSavers United — Test Email</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#fff;border-radius:12px;
              overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;">
    <img src="https://lifesaversunited.org/imgs/Life-saver-united-logo.png"
         alt="LifeSavers United" style="height:55px;width:auto;">
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:linear-gradient(135deg,#c0392b,#e74c3c);padding:32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">✅ Email Provider Test</h1>
    <p style="color:#f5b7b1;margin:10px 0 0;font-size:15px;">This is a test email from the waterfall system</p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:36px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Provider Used</span><br>
        <span style="color:#c0392b;font-size:20px;font-weight:800;">${provider.toUpperCase()}</span>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Sent From</span><br>
        <span style="color:#222;font-size:15px;font-weight:600;">${FROM_NAME} &lt;${FROM_EMAIL}&gt;</span>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Sent At</span><br>
        <span style="color:#222;font-size:15px;font-weight:600;">${now} IST</span>
      </td></tr>
      <tr><td style="padding:12px 0;">
        <span style="color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Purpose</span><br>
        <span style="color:#444;font-size:14px;line-height:1.7;">
          Confirming the email waterfall is working.<br>
          Both Resend and Brevo should deliver from the same sender address.
        </span>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">
      LifeSavers United — lifesaversunited.org<br>
      This is an automated test. No action required.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Test: Resend ──────────────────────────────────────────────────────────────
async function testResend() {
    console.log(bold('\n📨  Testing RESEND...'));

    if (!RESEND_API_KEY) {
        console.log(yellow('  ⚠️  RESEND_API_KEY not set in .env — skipping'));
        return { skipped: true };
    }

    const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify({
            from:    `${FROM_NAME} <${FROM_EMAIL}>`,
            to:      [TEST_RECIPIENT],
            subject: '🩸 [Resend Test] LifeSavers United Email Waterfall',
            html:    buildTestEmail('Resend'),
        }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
        console.log(green(`  ✅  SUCCESS  (HTTP ${res.status})`));
        console.log(`      Email ID : ${data.id || 'n/a'}`);
        console.log(`      To       : ${TEST_RECIPIENT}`);
        console.log(`      From     : ${FROM_NAME} <${FROM_EMAIL}>`);
        return { ok: true, data };
    } else {
        console.log(red(`  ❌  FAILED   (HTTP ${res.status})`));
        console.log('      Response :', JSON.stringify(data, null, 6).replace(/^/gm, '      '));
        return { ok: false, data };
    }
}

// ── Test: Brevo ───────────────────────────────────────────────────────────────
async function testBrevo() {
    console.log(bold('\n📨  Testing BREVO...'));

    if (!BREVO_API_KEY) {
        console.log(yellow('  ⚠️  BREVO_API_KEY not set in .env — skipping'));
        return { skipped: true };
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: {
            'api-key':      BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sender:      { name: FROM_NAME, email: FROM_EMAIL },
            to:          [{ email: TEST_RECIPIENT }],
            subject:     '🩸 [Brevo Test] LifeSavers United Email Waterfall',
            htmlContent: buildTestEmail('Brevo'),
        }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
        console.log(green(`  ✅  SUCCESS  (HTTP ${res.status})`));
        console.log(`      Message ID : ${data.messageId || 'n/a'}`);
        console.log(`      To         : ${TEST_RECIPIENT}`);
        console.log(`      From       : ${FROM_NAME} <${FROM_EMAIL}>`);
        return { ok: true, data };
    } else {
        console.log(red(`  ❌  FAILED   (HTTP ${res.status})`));
        console.log('      Response   :', JSON.stringify(data, null, 6).replace(/^/gm, '      '));
        return { ok: false, data };
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(bold('═══════════════════════════════════════════════'));
console.log(bold('  LifeSavers United — Email Provider Test'));
console.log(bold('═══════════════════════════════════════════════'));
console.log(`  Recipient : ${TEST_RECIPIENT}`);
console.log(`  Sender    : ${FROM_NAME} <${FROM_EMAIL}>`);

const resendResult = await testResend();
const brevoResult  = await testBrevo();

console.log(bold('\n─── Summary ──────────────────────────────────'));

const resendStatus = resendResult.skipped ? yellow('SKIPPED') : resendResult.ok ? green('✅ PASS') : red('❌ FAIL');
const brevoStatus  = brevoResult.skipped  ? yellow('SKIPPED') : brevoResult.ok  ? green('✅ PASS') : red('❌ FAIL');

console.log(`  Resend : ${resendStatus}`);
console.log(`  Brevo  : ${brevoStatus}`);
console.log('');

if ((resendResult.ok || resendResult.skipped) && (brevoResult.ok || brevoResult.skipped)) {
    console.log(green('  Check your inbox at: ' + TEST_RECIPIENT));
    console.log(green('  Both emails should show noreply@lifesaversunited.org as sender.\n'));
} else {
    console.log(red('  One or more providers failed. Check the error above.\n'));
}
