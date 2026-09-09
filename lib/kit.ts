// Subscribe an email to a Kit (formerly ConvertKit) form.
//
// The signup form on /live posts to our own /api/subscribe rather than to Kit
// directly, so the API key stays on the server and we control the error copy.
//
// Two ways to configure it — whichever you have keys for:
//
//   1. KIT_API_KEY + KIT_FORM_ID  → Kit v4 API (api.kit.com). Preferred.
//      Key:     Kit → Settings → Advanced → API → "API Key" (v4).
//      Form ID: open the form in Kit; it's the number in the editor URL
//               (app.kit.com/forms/designers/<id>/edit).
//
//   2. CONVERTKIT_API_KEY + CONVERTKIT_FORM_ID → legacy v3 API.
//      Used only if the v4 pair is unset. The v3 "API Key" is the public one.
//
// With neither set, /api/subscribe answers 503 and the form says signup isn't
// open yet — the page still renders.
//
// The channel link and the "biggest challenge" answer ride along as Kit custom
// fields. Those fields have to exist in Kit first (Subscribers → custom fields)
// or Kit drops the values silently and you get emails with nothing attached —
// though it does report the ignored keys back, which we log. KIT_CHANNEL_FIELD
// and KIT_PROBLEM_FIELD override the keys when yours aren't named "channel_url"
// and "creator_problem". GET /api/admin/kit lists the real keys.

import "server-only";

/** The answers we collect, and the Kit custom field each is written to. */
export type Answers = { channel?: string; problem?: string };

function fieldKeys(): Record<keyof Answers, string> {
  return {
    channel: process.env.KIT_CHANNEL_FIELD || "channel_url",
    // "yt_problem" is the key behind the field Kit's form builder labels
    // "Creator Problem" — confirmed against the account via /api/admin/kit,
    // since Kit's key doesn't have to match the label shown anywhere.
    problem: process.env.KIT_PROBLEM_FIELD || "yt_problem",
  };
}

/** Drop blanks, so an unanswered optional question doesn't clear a stored value. */
function toFields(answers: Answers): Record<string, string> | undefined {
  const keys = fieldKeys();
  const fields: Record<string, string> = {};
  for (const [name, key] of Object.entries(keys) as [keyof Answers, string][]) {
    const value = answers[name];
    if (value) fields[key] = value;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export function isKitConfigured(): boolean {
  return config() !== null;
}

export const KIT_FLOW = "v4 two-step (create subscriber, then add to form)";

/**
 * What is configured, safe to show an admin. The key itself never leaves this
 * module — only its prefix and length, which is enough to spot a v3 key in the
 * v4 slot or a stray quote from a copy-paste.
 */
export function kitConfigSummary() {
  const cfg = config();
  if (!cfg) return { configured: false as const, ...fieldKeys() };
  return {
    configured: true as const,
    version: cfg.version,
    formId: cfg.formId,
    ...fieldKeys(),
    keyPrefix: cfg.key.slice(0, 4),
    keyLength: cfg.key.length,
    keyLooksLikeV4: cfg.key.startsWith("kit_"),
  };
}

/** Authenticated GET against the v4 API, for the admin diagnostic. */
export async function kitGet(path: string): Promise<{ status: number; body: unknown }> {
  const cfg = config();
  if (!cfg || cfg.version !== "v4") return { status: 0, body: "v4 not configured" };
  const res = await fetch(`https://api.kit.com/v4/${path}`, {
    headers: { "X-Kit-Api-Key": cfg.key },
    cache: "no-store",
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

type Config =
  | { version: "v4"; key: string; formId: string }
  | { version: "v3"; key: string; formId: string };

function config(): Config | null {
  const v4Key = process.env.KIT_API_KEY;
  const v4Form = process.env.KIT_FORM_ID;
  if (v4Key && v4Form) return { version: "v4", key: v4Key, formId: v4Form };

  const v3Key = process.env.CONVERTKIT_API_KEY;
  const v3Form = process.env.CONVERTKIT_FORM_ID;
  if (v3Key && v3Form) return { version: "v3", key: v3Key, formId: v3Form };

  return null;
}

/**
 * Add `email` to the configured Kit form, with the custom-field answers attached.
 *
 * v4 needs two calls, and the order matters. POST /v4/subscribers is the only
 * one that creates a subscriber and the only one that accepts custom fields;
 * POST /v4/forms/{id}/subscribers takes an email_address and nothing else, and
 * Kit's docs are explicit that "the subscriber being added to the form must
 * already exist". Calling just the form endpoint for a new address is why a
 * submission could report success and leave nothing behind in Kit.
 *
 * Both calls are idempotent: creating an existing subscriber returns 200 and
 * updates their fields, and re-adding them to the form returns 200. Note the
 * field is overwritten rather than appended, so one person can only have one
 * channel in the queue.
 *
 * v3 needs only its one call — that endpoint does create subscribers and does
 * accept fields.
 */
export async function subscribeToKit(
  email: string,
  answers: Answers = {},
): Promise<SubscribeResult> {
  const cfg = config();
  if (!cfg) {
    return { ok: false, status: 503, message: "Signups aren't open yet." };
  }

  const fields = toFields(answers);

  try {
    if (cfg.version === "v3") {
      const res = await post(
        `https://api.convertkit.com/v3/forms/${cfg.formId}/subscribe`,
        { api_key: cfg.key, email, ...(fields ? { fields } : {}) },
      );
      return res.ok ? { ok: true } : await failure(res, "v3 subscribe");
    }

    const headers = { "X-Kit-Api-Key": cfg.key };

    // 1. Create or update the subscriber. Custom fields can only be set here.
    const created = await post(
      "https://api.kit.com/v4/subscribers",
      { email_address: email, ...(fields ? { fields } : {}) },
      headers,
    );
    if (!created.ok) return await failure(created, "v4 create subscriber");

    // Kit ignores unknown field keys instead of failing, and says so here. That
    // is the only warning you get that the channel link went nowhere because
    // the custom field doesn't exist in Kit yet.
    await warnAboutIgnoredFields(created);

    // 2. Attach them to the form, which is what triggers Kit's automations.
    const added = await post(
      `https://api.kit.com/v4/forms/${cfg.formId}/subscribers`,
      { email_address: email },
      headers,
    );
    if (!added.ok) return await failure(added, "v4 add to form");

    // Log every success too. Without this, "nothing in the logs" can't
    // distinguish a working signup from code that never ran.
    const id = await subscriberId(created);
    console.log(
      `Kit v4 subscribe ok: form=${cfg.formId} subscriber=${id} ` +
        `create=${created.status} addToForm=${added.status} ` +
        `fields=${fields ? Object.keys(fields).join(",") : "none"}`,
    );
    return { ok: true };
  } catch (err) {
    console.error("Kit subscribe request failed:", err);
    return { ok: false, status: 502, message: "Something went wrong. Try again in a moment." };
  }
}

function post(url: string, body: unknown, extraHeaders?: Record<string, string>) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

/** Log the real reason server-side; show the visitor something generic. */
async function failure(res: Response, step: string): Promise<SubscribeResult> {
  const detail = await res.text().catch(() => "");
  console.error(`Kit ${step} failed (${res.status}): ${detail.slice(0, 500)}`);

  if (res.status === 422) {
    return { ok: false, status: 400, message: "That email address didn't look right." };
  }
  return { ok: false, status: 502, message: "Something went wrong. Try again in a moment." };
}

async function subscriberId(res: Response): Promise<string> {
  try {
    return String((await res.clone().json())?.subscriber?.id ?? "?");
  } catch {
    return "?";
  }
}

async function warnAboutIgnoredFields(res: Response): Promise<void> {
  try {
    const warnings = (await res.clone().json())?.warnings;
    if (Array.isArray(warnings) && warnings.length > 0) {
      console.warn(
        `Kit ignored unknown custom field(s): ${JSON.stringify(warnings)}. ` +
          `Create the field in Kit, or set KIT_CHANNEL_FIELD to its key.`,
      );
    }
  } catch {
    // A warning about warnings is not worth failing a signup over.
  }
}
