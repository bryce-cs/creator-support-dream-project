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
 *   curl -s -b "cs_admin=<cookie>" https://<host>/api/admin/kit | jq
 */
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

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

  const [forms, fields] = await Promise.all([
    kitGet("forms?per_page=500"),
    kitGet("custom_fields?per_page=500"),
  ]);

  const formList = list(forms.body, "forms").map((f) => ({
    id: String(f.id),
    name: f.name,
  }));
  const fieldKeys = list(fields.body, "custom_fields").map((f) => String(f.key));

  const authOk = forms.status === 200;
  const formFound = formList.some((f) => f.id === String(config.formId));
  const fieldFound = fieldKeys.includes(config.channelField);

  return NextResponse.json({
    flow: KIT_FLOW,
    config,
    checks: {
      apiKeyAccepted: authOk ? "yes" : `no (GET /v4/forms returned ${forms.status})`,
      formIdFound: authOk ? (formFound ? "yes" : "NO — see forms below") : "unknown",
      customFieldFound: authOk ? (fieldFound ? "yes" : "NO — see fields below") : "unknown",
    },
    diagnosis: diagnose({ authOk, formFound, fieldFound, config }),
    forms: authOk ? formList : forms.body,
    customFieldKeys: fieldKeys,
  });
}

interface KitRow {
  id?: unknown;
  name?: unknown;
  key?: unknown;
}

/** v4 list responses wrap rows under the resource name. */
function list(body: unknown, key: string): KitRow[] {
  const rows = (body as Record<string, unknown>)?.[key];
  return Array.isArray(rows) ? (rows as KitRow[]) : [];
}

function diagnose({
  authOk,
  formFound,
  fieldFound,
  config,
}: {
  authOk: boolean;
  formFound: boolean;
  fieldFound: boolean;
  config: { keyLooksLikeV4: boolean; formId: string; channelField: string };
}): string {
  if (!authOk) {
    return config.keyLooksLikeV4
      ? "Kit rejected the API key. Check for a stray quote or trailing space in the variable."
      : "The key doesn't start with `kit_`, so it's probably a v3 key in the v4 slot. Create a v4 key under Settings → Advanced → API.";
  }
  if (!formFound) {
    return `Form ${config.formId} isn't in this account's forms. Use the numeric id from the editor URL, not the form's uid — the list below has the real ones.`;
  }
  if (!fieldFound) {
    return `No custom field with key "${config.channelField}". Signups will succeed but the channel link is dropped. Create the field in Kit, or set KIT_CHANNEL_FIELD to one of the keys listed below.`;
  }
  return "Everything checks out. If submissions still don't appear, confirm this deploy is running the flow named above.";
}
