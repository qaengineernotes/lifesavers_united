/**
 * _email-sender.js  — Shared Cloudflare Pages Function utility
 *
 * Implements a "Free Provider Waterfall" for transactional email:
 *   1. Resend      → 100 emails/day  (free tier)
 *   2. Brevo       → 300 emails/day  (free tier)
 *   3. Mailjet     → 200 emails/day  (free tier)
 *   Total potential: ~600 emails/day at $0
 *
 * Usage:
 *   import { sendEmail } from '../_email-sender.js';
 *   const result = await sendEmail(env, { to, subject, html, text, replyTo });
 *
 * Required env variables (Cloudflare Pages → Settings → Environment Variables):
 *   RESEND_API_KEY          — from resend.com
 *   BREVO_API_KEY           — from brevo.com (formerly Sendinblue)
 *   MAILJET_API_KEY         — from mailjet.com (public key)
 *   MAILJET_SECRET_KEY      — from mailjet.com (secret key)
 *
 * The FROM address is shared across all providers:
 *   noreply@lifesaversunited.org  (must be verified in each provider's dashboard)
 */

const FROM_NAME  = 'LifeSavers United';
const FROM_EMAIL = 'noreply@lifesaversunited.org';

// ── Rate-limit error codes per provider ──────────────────────────────────────
// These HTTP status codes indicate a daily limit has been reached,
// NOT a permanent auth/config error — so we should try the next provider.
const RATE_LIMIT_STATUSES = new Set([429, 422, 451]);

/**
 * Attempt to send via Resend (100/day free).
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
async function trySendResend(apiKey, { to, subject, html, text, replyTo }) {
    if (!apiKey) return { tried: false, provider: 'resend' };

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

    // Check if it's a rate-limit / quota error specifically
    const isRateLimit =
        RATE_LIMIT_STATUSES.has(res.status) ||
        JSON.stringify(data).toLowerCase().includes('limit');

    return {
        tried:       true,
        provider:    'resend',
        ok:          false,
        status:      res.status,
        data,
        isRateLimit, // true → try next provider; false → real config error
    };
}

/**
 * Attempt to send via Brevo (300/day free).
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */
async function trySendBrevo(apiKey, { to, subject, html, text, replyTo }) {
    if (!apiKey) return { tried: false, provider: 'brevo' };

    const recipients = (Array.isArray(to) ? to : [to]).map((addr) => {
        if (typeof addr === 'string') return { email: addr };
        return addr; // already { email, name } shape
    });

    const body = {
        sender:   { name: FROM_NAME, email: FROM_EMAIL },
        to:       recipients,
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

    return { tried: true, provider: 'brevo', ok: false, status: res.status, data, isRateLimit };
}

/**
 * Attempt to send via Mailjet (200/day free).
 * Docs: https://dev.mailjet.com/email/guides/send-api-v31/
 */
async function trySendMailjet(apiKey, secretKey, { to, subject, html, text, replyTo }) {
    if (!apiKey || !secretKey) return { tried: false, provider: 'mailjet' };

    const recipients = (Array.isArray(to) ? to : [to]).map((addr) => {
        if (typeof addr === 'string') return { Email: addr };
        return { Email: addr.email, Name: addr.name }; // normalise
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

    return { tried: true, provider: 'mailjet', ok: false, status: res.status, data, isRateLimit };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * sendEmail — Try Resend → Brevo → Mailjet in order.
 *
 * @param {object} env        - Cloudflare Pages `context.env`
 * @param {object} options
 * @param {string|string[]} options.to      - Recipient(s)
 * @param {string}          options.subject - Email subject
 * @param {string}          options.html    - HTML body
 * @param {string}          [options.text]  - Plain-text body (optional)
 * @param {string}          [options.replyTo] - Reply-To address (optional)
 *
 * @returns {{ ok: boolean, provider: string, attempt: object, allAttempts: object[] }}
 */
export async function sendEmail(env, { to, subject, html, text, replyTo }) {
    const allAttempts = [];

    // ── 1. Try Resend ─────────────────────────────────────────────────────────
    const resendResult = await trySendResend(
        env.RESEND_API_KEY,
        { to, subject, html, text, replyTo }
    );
    if (resendResult.tried) allAttempts.push(resendResult);
    if (resendResult.ok) {
        return { ok: true, provider: 'resend', attempt: resendResult, allAttempts };
    }
    // Only fall through if it was a rate-limit. Hard errors stop here.
    if (resendResult.tried && !resendResult.isRateLimit) {
        console.error('[email-waterfall] Resend hard error — not a rate limit, stopping.', resendResult);
        return { ok: false, provider: 'resend', attempt: resendResult, allAttempts };
    }

    console.warn('[email-waterfall] Resend limit/unavailable — trying Brevo…');

    // ── 2. Try Brevo ──────────────────────────────────────────────────────────
    const brevoResult = await trySendBrevo(
        env.BREVO_API_KEY,
        { to, subject, html, text, replyTo }
    );
    if (brevoResult.tried) allAttempts.push(brevoResult);
    if (brevoResult.ok) {
        return { ok: true, provider: 'brevo', attempt: brevoResult, allAttempts };
    }
    if (brevoResult.tried && !brevoResult.isRateLimit) {
        console.error('[email-waterfall] Brevo hard error — not a rate limit, stopping.', brevoResult);
        return { ok: false, provider: 'brevo', attempt: brevoResult, allAttempts };
    }

    console.warn('[email-waterfall] Brevo limit/unavailable — trying Mailjet…');

    // ── 3. Try Mailjet ────────────────────────────────────────────────────────
    const mailjetResult = await trySendMailjet(
        env.MAILJET_API_KEY,
        env.MAILJET_SECRET_KEY,
        { to, subject, html, text, replyTo }
    );
    if (mailjetResult.tried) allAttempts.push(mailjetResult);
    if (mailjetResult.ok) {
        return { ok: true, provider: 'mailjet', attempt: mailjetResult, allAttempts };
    }

    // All three providers exhausted
    console.error('[email-waterfall] All providers exhausted.', allAttempts);
    return { ok: false, provider: 'none', attempt: mailjetResult, allAttempts };
}

/**
 * sendBatch — Send a batch of emails with waterfall fallback per batch chunk.
 * Mirrors the old Resend batch API logic but uses the waterfall for each chunk.
 *
 * NOTE: Resend's batch API sends 100 at once. Brevo/Mailjet don't have a
 * true "batch" endpoint, so we loop. Adjust chunkSize based on your volume.
 *
 * @param {object}   env        - Cloudflare Pages `context.env`
 * @param {object[]} emailList  - Array of { to, subject, html, text, replyTo }
 * @returns {{ ok: boolean, sent: number, failed: number, results: object[] }}
 */
export async function sendBatch(env, emailList) {
    const results = [];
    let sent   = 0;
    let failed = 0;

    // First, try Resend batch (most efficient, 100 per call)
    const resendApiKey = env.RESEND_API_KEY;
    if (resendApiKey && emailList.length > 0) {
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < emailList.length; i += CHUNK_SIZE) {
            chunks.push(emailList.slice(i, i + CHUNK_SIZE));
        }

        const remainingEmails = []; // emails that failed due to rate limit
        let resendHitLimit = false;

        for (const chunk of chunks) {
            if (resendHitLimit) {
                // Already hit the limit, queue the rest for fallback
                remainingEmails.push(...chunk);
                continue;
            }

            const batchPayload = chunk.map(({ to, subject, html, text, replyTo }) => {
                const msg = {
                    from:    `${FROM_NAME} <${FROM_EMAIL}>`,
                    to:      Array.isArray(to) ? to : [to],
                    subject,
                    html,
                };
                if (text)    msg.text     = text;
                if (replyTo) msg.reply_to = replyTo;
                return msg;
            });

            const res = await fetch('https://api.resend.com/emails/batch', {
                method:  'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify(batchPayload),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                sent += chunk.length;
                results.push({ provider: 'resend', ok: true, count: chunk.length, data });
            } else {
                const isRateLimit =
                    RATE_LIMIT_STATUSES.has(res.status) ||
                    JSON.stringify(data).toLowerCase().includes('limit');

                if (isRateLimit) {
                    resendHitLimit = true;
                    remainingEmails.push(...chunk);
                    results.push({ provider: 'resend', ok: false, isRateLimit: true, count: chunk.length, data });
                } else {
                    // Hard error — mark all as failed, don't try fallback for this chunk
                    failed += chunk.length;
                    results.push({ provider: 'resend', ok: false, isRateLimit: false, count: chunk.length, data });
                }
            }
        }

        // Send remaining (rate-limited) emails via waterfall
        if (remainingEmails.length > 0) {
            console.warn(`[email-waterfall] ${remainingEmails.length} emails exceeded Resend quota, falling back to Brevo/Mailjet…`);
            for (const email of remainingEmails) {
                // Skip Resend for these (already hit the limit)
                const brevoResult = await trySendBrevo(env.BREVO_API_KEY, email);
                if (brevoResult.ok) {
                    sent++;
                    results.push({ provider: 'brevo', ok: true, data: brevoResult.data });
                    continue;
                }

                if (brevoResult.tried && !brevoResult.isRateLimit) {
                    failed++;
                    results.push({ provider: 'brevo', ok: false, data: brevoResult.data });
                    continue;
                }

                const mailjetResult = await trySendMailjet(env.MAILJET_API_KEY, env.MAILJET_SECRET_KEY, email);
                if (mailjetResult.ok) {
                    sent++;
                    results.push({ provider: 'mailjet', ok: true, data: mailjetResult.data });
                } else {
                    failed++;
                    results.push({ provider: 'mailjet', ok: false, data: mailjetResult.data });
                }
            }
        }
    } else {
        // No Resend key — go straight to Brevo/Mailjet for each email
        for (const email of emailList) {
            const result = await sendEmail(env, email);
            if (result.ok) sent++;
            else           failed++;
            results.push(result);
        }
    }

    return { ok: failed === 0, sent, failed, results };
}
