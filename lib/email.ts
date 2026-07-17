import "server-only";
/**
 * Transactional email — used to send off-campus candidate invite links (§4.5).
 *
 * Provider: Resend (https://resend.com) via its REST API, so there's NO new npm
 * dependency. It is OPT-IN: nothing is sent unless `RESEND_API_KEY` is set, so
 * the app works out of the box (the recruiter copies links) and "just works"
 * the moment a key is added — no code change. Set `EMAIL_FROM` to a sender on a
 * domain you've verified in Resend.
 */
import { logger } from "@/lib/logger";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function inviteHtml(opts: { name: string; link: string; role?: string }): string {
  const roleLine = opts.role ? ` for the <strong>${opts.role}</strong> opportunity` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#fff;border:1px solid #e6e8ec;border-radius:16px;padding:32px;">
        <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0057FF;margin:0 0 12px;">Taledge</p>
        <h1 style="font-size:22px;color:#081A3A;margin:0 0 12px;">Hi ${opts.name}, you're invited</h1>
        <p style="font-size:15px;line-height:1.6;color:#475467;margin:0 0 24px;">
          You've been invited to complete a short Taledge assessment${roleLine}. It takes you through a profile, a DNLA behavioural assessment, and an AI interview, then produces your Fit Score.
        </p>
        <a href="${opts.link}" style="display:inline-block;background:#081A3A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px;">Start my assessment →</a>
        <p style="font-size:12px;color:#98a2b3;margin:24px 0 0;word-break:break-all;">Or paste this link: ${opts.link}</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#98a2b3;margin:16px 0 0;">Sent by a recruiter via Taledge.</p>
    </div></body></html>`;
}

/** Send one invite email. Returns true on success, false if not configured or on
 *  any failure (never throws — the caller falls back to copy-and-send). */
export async function sendInviteEmail(opts: { to: string; name: string; link: string; role?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || "Taledge <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `You're invited to complete your Taledge assessment${opts.role ? ` · ${opts.role}` : ""}`,
        html: inviteHtml(opts),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.error("[email] invite send failed", { status: res.status, detail: (await res.text()).slice(0, 200) });
      return false;
    }
    return true;
  } catch (e) {
    logger.error("[email] invite send error", { err: String(e) });
    return false;
  }
}

function shareHtml(opts: { instituteName: string; link: string; count: number }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#fff;border:1px solid #e6e8ec;border-radius:16px;padding:32px;">
        <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0057FF;margin:0 0 12px;">Taledge</p>
        <h1 style="font-size:22px;color:#081A3A;margin:0 0 12px;">${opts.instituteName} shared a shortlist with you</h1>
        <p style="font-size:15px;line-height:1.6;color:#475467;margin:0 0 24px;">
          ${opts.instituteName} has shared <strong>${opts.count} consented candidate${opts.count === 1 ? "" : "s"}</strong> with you on Taledge. Each has a Fit Score, interview summary, and competency signals. The link is scoped to just these profiles and expires automatically.
        </p>
        <a href="${opts.link}" style="display:inline-block;background:#081A3A;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px;">View shortlisted candidates →</a>
        <p style="font-size:12px;color:#98a2b3;margin:24px 0 0;word-break:break-all;">Or paste this link: ${opts.link}</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#98a2b3;margin:16px 0 0;">You'll be asked to sign in to a recruiter account to view the profiles.</p>
    </div></body></html>`;
}

/** Email a scoped recruiter shortlist link. Returns true on success, false if not
 *  configured or on any failure (never throws — caller falls back to copy-link). */
export async function sendRecruiterShareEmail(opts: {
  to: string;
  instituteName: string;
  link: string;
  count: number;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || "Taledge <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `${opts.instituteName} shared ${opts.count} candidate${opts.count === 1 ? "" : "s"} with you on Taledge`,
        html: shareHtml(opts),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.error("[email] share send failed", { status: res.status, detail: (await res.text()).slice(0, 200) });
      return false;
    }
    return true;
  } catch (e) {
    logger.error("[email] share send error", { err: String(e) });
    return false;
  }
}

/** Send a batch of invite emails in parallel (best-effort). Returns the count
 *  actually accepted by the provider. Capped to keep one request bounded. */
export async function sendInviteEmails(
  invites: { email: string; name: string; link: string }[],
  role?: string
): Promise<number> {
  if (!isEmailConfigured() || invites.length === 0) return 0;
  // Cap inline sends so a single request can't run away; a production system
  // would hand a large batch to a queue/worker instead.
  const batch = invites.slice(0, 100);
  const results = await Promise.allSettled(
    batch.map((i) => sendInviteEmail({ to: i.email, name: i.name, link: i.link, role }))
  );
  return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
}
