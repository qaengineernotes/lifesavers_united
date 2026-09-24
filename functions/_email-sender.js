/**
 * _email-sender.js  — Shared Cloudflare Pages Function utility
 *
 * Implements a 3-Provider Round-Robin Rotation with Circular Fallback:
 *   Email 1 (Index 0) ──► Resend   (fallback: Brevo ──► Mailjet)
 *   Email 2 (Index 1) ──► Brevo    (fallback: Mailjet ──► Resend)
 *   Email 3 (Index 2) ──► Mailjet  (fallback: Resend ──► Brevo)
 *   Email 4 (Index 3) ──► Resend   (repeats cycle)
 *
 * Free Tier Limits:
 *   - Resend:  100 emails/day
 *   - Brevo:   300 emails/day
 *   - Mailjet: 200 emails/day
 *   Total combined capacity: ~600 emails/day at $0 cost
 *
 * Usage:
 *   import { sendEmail, sendBatch } from './_email-sender.js';
 *   const result = await sendEmail(env, { to, subject, html, text, replyTo });
 *
 * Required env variables (Cloudflare Pages → Settings → Environment Variables):
 *   RESEND_API_KEY          — from resend.com
 *   BREVO_API_KEY           — from brevo.com (formerly Sendinblue)
 *   MAILJET_API_KEY         — from mailjet.com (public key)
 *   MAILJET_SECRET_KEY      — from mailjet.com (secret key)
 *
 * The FROM address is shared across all providers:
 *   noreply@lifesaversunited.org  (verified in each provider dashboard)
 */

const FROM_NAME  = 'LifeSavers United';
const FROM_EMAIL = 'noreply@lifesaversunited.org';

const PROVIDERS = ['resend', 'brevo', 'mailjet'];

// In-memory round-robin rotation counter per worker isolate
// Seeded with a random offset so multiple edge instances don't all start on Resend
let rotationIndex = Math.floor(Math.random() * PROVIDERS.length);

// ── Rate-limit error codes per provider ──────────────────────────────────────
const RATE_LIMIT_STATUSES = new Set([429, 422, 451]);

/**
 * Attempt to send via Resend (100/day free).
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
async function trySendResend(apiKey, { to, subject, html, text, replyTo }) {
    if (!apiKey) return { tried: false, provider: 'resend', reason: 'Missing RESEND_API_KEY' };

    try {
        const body = {
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        };
        if (text)    body.text     = text;
        if (replyTo) body.reply_to = replyTo;

        const res = await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            return { tried: true, provider: 'resend', ok: true, status: res.status, data };
        }

        const isRateLimit =
            RATE_LIMIT_STATUSES.has(res.status) ||
            JSON.stringify(data).toLowerCase().includes('limit');

        return {
            tried:       true,
            provider:    'resend',
            ok:          false,
            status:      res.status,
            data,
            isRateLimit,
        };
    } catch (err) {
        return {
            tried:       true,
            provider:    'resend',
            ok:          false,
            error:       err.message,
            isRateLimit: false,
        };
    }
}

/**
 * Attempt to send via Brevo (300/day free).
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */
async function trySendBrevo(apiKey, { to, subject, html, text, replyTo }) {
    if (!apiKey) return { tried: false, provider: 'brevo', reason: 'Missing BREVO_API_KEY' };

    try {
        const recipients = (Array.isArray(to) ? to : [to]).map((addr) => {
            if (typeof addr === 'string') return { email: addr };
            return addr;
        });

        const body = {
            sender:      { name: FROM_NAME, email: FROM_EMAIL },
            to:          recipients,
            subject,
            htmlContent: html,
        };
        if (text)    body.textContent = text;
        if (replyTo) body.replyTo     = { email: replyTo };

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method:  'POST',
            headers: {
                'api-key':      apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            return { tried: true, provider: 'brevo', ok: true, status: res.status, data };
        }

        const isRateLimit =
            RATE_LIMIT_STATUSES.has(res.status) ||
            JSON.stringify(data).toLowerCase().includes('limit') ||
            JSON.stringify(data).toLowerCase().includes('quota') ||
            JSON.stringify(data).toLowerCase().includes('daily');

        return {
            tried:       true,
            provider:    'brevo',
            ok:          false,
            status:      res.status,
            data,
            isRateLimit,
        };
    } catch (err) {
        return {
            tried:       true,
            provider:    'brevo',
            ok:          false,
            error:       err.message,
            isRateLimit: false,
        };
    }
}

/**
 * Attempt to send via Mailjet (200/day free).
 * Docs: https://dev.mailjet.com/email/guides/send-api-v31/
 */
async function trySendMailjet(apiKey, secretKey, { to, subject, html, text, replyTo }) {
    if (!apiKey || !secretKey) {
        return { tried: false, provider: 'mailjet', reason: 'Missing MAILJET_API_KEY or MAILJET_SECRET_KEY' };
    }

    try {
        const recipients = (Array.isArray(to) ? to : [to]).map((addr) => {
            if (typeof addr === 'string') return { Email: addr };
            return { Email: addr.email, Name: addr.name };
        });

        const message = {
            From:     { Email: FROM_EMAIL, Name: FROM_NAME },
            To:       recipients,
            Subject:  subject,
            HTMLPart: html,
        };
        if (text)    message.TextPart = text;
        if (replyTo) message.ReplyTo  = { Email: replyTo };

        const credentials = btoa(`${apiKey}:${secretKey}`);

        const res = await fetch('https://api.mailjet.com/v3.1/send', {
            method:  'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ Messages: [message] }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            return { tried: true, provider: 'mailjet', ok: true, status: res.status, data };
        }

        const isRateLimit =
            RATE_LIMIT_STATUSES.has(res.status) ||
            JSON.stringify(data).toLowerCase().includes('limit') ||
            JSON.stringify(data).toLowerCase().includes('quota') ||
            JSON.stringify(data).toLowerCase().includes('daily');

        return {
            tried:       true,
            provider:    'mailjet',
            ok:          false,
            status:      res.status,
            data,
            isRateLimit,
        };
    } catch (err) {
        return {
            tried:       true,
            provider:    'mailjet',
            ok:          false,
            error:       err.message,
            isRateLimit: false,
        };
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * sendEmail — Sends an email using the 3-provider round-robin rotator with circular fallback:
 *   1st call ──► Resend  (fallback to Brevo, then Mailjet)
 *   2nd call ──► Brevo   (fallback to Mailjet, then Resend)
 *   3rd call ──► Mailjet (fallback to Resend, then Brevo)
 *   4th call ──► Resend  (repeats cycle)
 *
 * @param {object} env        - Cloudflare Pages `context.env`
 * @param {object} options
 * @param {string|string[]} options.to      - Recipient(s)
 * @param {string}          options.subject - Email subject
 * @param {string}          options.html    - HTML body
 * @param {string}          [options.text]  - Plain-text body (optional)
 * @param {string}          [options.replyTo] - Reply-To address (optional)
 * @param {string}          [options.preferredProvider] - Force starting provider ('resend'|'brevo'|'mailjet')
 *
 * @returns {{ ok: boolean, provider: string, attempt: object, allAttempts: object[] }}
 */
export async function sendEmail(env, { to, subject, html, text, replyTo, preferredProvider }) {
    const allAttempts = [];

    // Determine starting index for round-robin rotation
    let startIndex;
    if (preferredProvider && PROVIDERS.includes(preferredProvider.toLowerCase())) {
        startIndex = PROVIDERS.indexOf(preferredProvider.toLowerCase());
    } else {
        startIndex = (rotationIndex++) % PROVIDERS.length;
    }

    // Build circular fallback chain for this specific email
    const chain = [
        PROVIDERS[startIndex],
        PROVIDERS[(startIndex + 1) % PROVIDERS.length],
        PROVIDERS[(startIndex + 2) % PROVIDERS.length],
    ];

    for (const provider of chain) {
        let result;
        if (provider === 'resend') {
            result = await trySendResend(env.RESEND_API_KEY, { to, subject, html, text, replyTo });
        } else if (provider === 'brevo') {
            result = await trySendBrevo(env.BREVO_API_KEY, { to, subject, html, text, replyTo });
        } else if (provider === 'mailjet') {
            result = await trySendMailjet(env.MAILJET_API_KEY, env.MAILJET_SECRET_KEY, { to, subject, html, text, replyTo });
        }

        if (result && result.tried) {
            allAttempts.push(result);
        }

        if (result && result.ok) {
            console.log(`[email-rotator] ✅ Delivered via ${provider.toUpperCase()} to ${Array.isArray(to) ? to.join(', ') : to}`);
            return { ok: true, provider, attempt: result, allAttempts };
        }

        const reason = result?.error || (result?.status ? `HTTP ${result.status}` : 'missing key / not configured');
        console.warn(`[email-rotator] ⚠️ ${provider.toUpperCase()} failed (${reason}) — falling back to next provider in chain...`);
    }

    // All three providers failed or were unconfigured
    console.error('[email-rotator] ❌ All 3 providers exhausted or unavailable.', allAttempts);
    return {
        ok: false,
        provider: 'none',
        attempt: allAttempts[allAttempts.length - 1] || null,
        allAttempts,
    };
}

/**
 * sendBatch — Send a batch of emails rotating round-robin across all 3 providers.
 *
 * Each email alternates Resend ──► Brevo ──► Mailjet with circular fallback.
 * Uses a small 150ms delay between sends to respect provider burst rates.
 *
 * @param {object}   env        - Cloudflare Pages `context.env`
 * @param {object[]} emailList  - Array of { to, subject, html, text, replyTo }
 * @returns {{ ok: boolean, sent: number, failed: number, results: object[] }}
 */
export async function sendBatch(env, emailList) {
    const results = [];
    let sent   = 0;
    let failed = 0;

    for (let i = 0; i < emailList.length; i++) {
        const email = emailList[i];
        const result = await sendEmail(env, email);

        if (result.ok) {
            sent++;
        } else {
            failed++;
        }

        results.push({
            to:       email.to,
            provider: result.provider,
            ok:       result.ok,
            count:    1,
            data:     result.attempt?.data,
            attempts: result.allAttempts,
        });

        // Small 150ms delay between emails to respect provider burst limits
        if (i < emailList.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
    }

    return { ok: failed === 0, sent, failed, results };
}

