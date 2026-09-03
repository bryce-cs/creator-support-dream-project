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
// The submitted channel link rides along as a Kit custom field. That field has
// to exist in Kit first (Grow → Subscribers → custom fields) or Kit drops it
// silently and you get emails with no channel attached. KIT_CHANNEL_FIELD
// overrides the key if yours isn't named "channel_url".

import "server-only";

/** Kit custom field the channel link is written to. */
function channelField(): string {
  return process.env.KIT_CHANNEL_FIELD || "channel_url";
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export function isKitConfigured(): boolean {
  return config() !== null;
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
 * Add `email` to the configured Kit form.
 *
 * Kit treats a repeat signup as success (it just re-adds an existing subscriber
 * to the form), so the caller never has to special-case "already subscribed" —
 * though note that a second submission overwrites the channel field rather than
 * appending, so one person can only have one channel in the queue.
 */
export async function subscribeToKit(
  email: string,
  channel?: string,
): Promise<SubscribeResult> {
  const fields = channel ? { [channelField()]: channel } : undefined;

  const cfg = config();
  if (!cfg) {
    return { ok: false, status: 503, message: "Signups aren't open yet." };
  }

  const url =
    cfg.version === "v4"
      ? `https://api.kit.com/v4/forms/${cfg.formId}/subscribers`
      : `https://api.convertkit.com/v3/forms/${cfg.formId}/subscribe`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.version === "v4") headers["X-Kit-Api-Key"] = cfg.key;

  const body =
    cfg.version === "v4"
      ? { email_address: email, ...(fields ? { fields } : {}) }
      : { api_key: cfg.key, email, ...(fields ? { fields } : {}) };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (res.ok) return { ok: true };

    // Log the real reason server-side; show the visitor something generic
    // unless Kit is telling us the address itself is the problem.
    const detail = await res.text().catch(() => "");
    console.error(`Kit ${cfg.version} subscribe failed (${res.status}): ${detail.slice(0, 500)}`);

    if (res.status === 400 || res.status === 422) {
      return { ok: false, status: 400, message: "That email address didn't look right." };
    }
    return { ok: false, status: 502, message: "Something went wrong. Try again in a moment." };
  } catch (err) {
    console.error("Kit subscribe request failed:", err);
    return { ok: false, status: 502, message: "Something went wrong. Try again in a moment." };
  }
}
