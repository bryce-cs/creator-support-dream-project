import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { KIT_FLOW, kitConfigSummary, kitGet } from "@/lib/kit";

export const dynamic = "force-dynamic";

/**
 * Kit configuration check, for when a signup reports success and nothing shows
 * up in Kit. Asks Kit itself the three questions that can't be answered from
 * this side: is the key accepted, does the form ID exist, does the custom field
 * exist. Admin-only, and it never returns the API key.
 *
 * Pass ?email=someone@example.com to look one submitter up instead. That query
 * uses status=all, because Kit's default listing — and its subscriber screen —
 * hides anyone still unconfirmed, which is the usual reason a signup that
 * genuinely worked looks like it vanished.
 *
 *   curl -s -b "cs_admin=<cookie>" https://<host>/api/admin/kit | jq
 */
export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const email = new URL(request.url).searchParams.get("email");
  const config = kitConfigSummary();
  if (!config.configured) {
    return NextResponse.json({
      flow: KIT_FLOW,
      config,
      diagnosis: "No Kit credentials are set on this deploy. Check the service variables.",
    });
  }

  if (config.version !== "v4") {
    return NextResponse.json({
      flow: KIT_FLOW,
      config,
      diagnosis: "Running the legacy v3 path; these checks only cover v4.",
    });
  }

  if (email) return NextResponse.json(await lookup(email, config));

  const [forms, fields] = await Promise.all([
    kitGet("forms?per_page=500"),
    kitGet("custom_fields?per_page=500"),
  ]);

  const formList = list(forms.body, "forms").map((f) => ({
    id: String(f.id),
    name: f.name,
  }));
  // Label and key together, because Kit's key isn't always the slugged label —
  // which is exactly the trap when wiring a newly added field to this form.
  const fieldList = list(fields.body, "custom_fields").map((f) => ({
    key: String(f.key),
    label: f.label,
  }));
  const fieldKeys = fieldList.map((f) => f.key);

  const authOk = forms.status === 200;
  const formFound = formList.some((f) => f.id === String(config.formId));
  const missingFields = [config.channel, config.problem].filter(
    (key) => !fieldKeys.includes(key),
  );

  return NextResponse.json({
    flow: KIT_FLOW,
    config,
    checks: {
      apiKeyAccepted: authOk ? "yes" : `no (GET /v4/forms returned ${forms.status})`,
      formIdFound: authOk ? (formFound ? "yes" : "NO — see forms below") : "unknown",
      customFieldsFound: authOk
        ? missingFields.length === 0
          ? "yes"
          : `NO — missing ${missingFields.join(", ")}; see fields below`
        : "unknown",
    },
    diagnosis: diagnose({ authOk, formFound, missingFields, config }),
    forms: authOk ? formList : forms.body,
    customFields: fieldList,
  });
}

/** What Kit holds for one address, unconfirmed subscribers included. */
async function lookup(email: string, keys: { channel: string; problem: string }) {
  const res = await kitGet(
    `subscribers?status=all&email_address=${encodeURIComponent(email)}`,
  );
  const rows = list(res.body, "subscribers") as Array<KitRow & {
    state?: unknown;
    created_at?: unknown;
    fields?: Record<string, unknown>;
  }>;

  if (res.status !== 200) {
    return { email, error: `Kit returned ${res.status}`, body: res.body };
  }
  if (rows.length === 0) {
    return {
      email,
      found: false,
      diagnosis:
        "Kit has no subscriber at this address in any state, so the signup never reached Kit. Check the Railway log for a `Kit v4 subscribe` line from that submission.",
    };
  }

  const row = rows[0];
  const channel = row.fields?.[keys.channel] ?? null;
  const problem = row.fields?.[keys.problem] ?? null;
  const empty = [
    !channel ? keys.channel : null,
    !problem ? keys.problem : null,
  ].filter(Boolean);

  return {
    email,
    found: true,
    id: row.id,
    state: row.state,
    createdAt: row.created_at,
    answers: { [keys.channel]: channel, [keys.problem]: problem },
    diagnosis:
      row.state === "inactive"
        ? "The subscriber exists but is unconfirmed, which is why Kit's subscriber screen doesn't show them. Turn off double opt-in on the form, or have them click the confirmation email."
        : empty.length === 0
          ? "Subscriber and both answers landed. This one worked."
          : `Subscriber landed but ${empty.join(" and ")} came through empty — either this signup predates the field, the submitter left it blank, or the key doesn't match one in customFields.`,
  };
}

interface KitRow {
  id?: unknown;
  name?: unknown;
  key?: unknown;
  label?: unknown;
}

/** v4 list responses wrap rows under the resource name. */
function list(body: unknown, key: string): KitRow[] {
  const rows = (body as Record<string, unknown>)?.[key];
  return Array.isArray(rows) ? (rows as KitRow[]) : [];
}

function diagnose({
  authOk,
  formFound,
  missingFields,
  config,
}: {
  authOk: boolean;
  formFound: boolean;
  missingFields: string[];
  config: { keyLooksLikeV4: boolean; formId: string };
}): string {
  if (!authOk) {
    return config.keyLooksLikeV4
      ? "Kit rejected the API key. Check for a stray quote or trailing space in the variable."
      : "The key doesn't start with `kit_`, so it's probably a v3 key in the v4 slot. Create a v4 key under Settings → Advanced → API.";
  }
  if (!formFound) {
    return `Form ${config.formId} isn't in this account's forms. Use the numeric id from the editor URL, not the form's uid — the list below has the real ones.`;
  }
  if (missingFields.length > 0) {
    return `No custom field with key ${missingFields.map((k) => `"${k}"`).join(" or ")}. Signups will succeed but those answers are dropped. Create the field in Kit, or point KIT_CHANNEL_FIELD / KIT_PROBLEM_FIELD at the real keys in customFields below.`;
  }
  return "Everything checks out. If submissions still don't appear, confirm this deploy is running the flow named above.";
}
