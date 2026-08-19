// Confirms that response tags added in the Typeform inbox actually reach us,
// and prints their exact shape. Run with:
//
//   TYPEFORM_TOKEN=tfp_xxx npm run check:tags
//
// Why this exists: the Responses API returns tags but does NOT document them,
// so the payload shape isn't guaranteed. lib/typeform-map reads several
// plausible shapes and fails open. This script shows what your form really
// sends, so a "hide" tag that silently does nothing is easy to spot.

import { loadLib } from "./load-lib.mjs";

const token = process.env.TYPEFORM_TOKEN;
const formId = process.env.TYPEFORM_FORM_ID || "MbmNRCNH";

if (!token) {
  console.error("TYPEFORM_TOKEN is not set.\n");
  console.error("Get a Personal Access Token from Typeform (Settings -> Personal tokens), then:");
  console.error("  TYPEFORM_TOKEN=tfp_xxx npm run check:tags");
  process.exit(1);
}

const { responseTags, parseHiddenTags, isHiddenResponse } = await loadLib(
  ["submissions", "typeform-map"],
  "typeform-map",
);
const hiddenTags = parseHiddenTags(process.env.TYPEFORM_HIDDEN_TAGS);

const res = await fetch(
  `https://api.typeform.com/forms/${formId}/responses?page_size=200&completed=true`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!res.ok) {
  console.error(`Typeform responded ${res.status} ${res.statusText}`);
  process.exit(1);
}

const items = (await res.json()).items ?? [];
console.log(`Form ${formId}: ${items.length} completed response(s)`);
console.log(`Hiding responses tagged: [${[...hiddenTags].join(", ")}]\n`);

let withTags = 0;
let hidden = 0;

for (const item of items) {
  const raw = item.tags;
  const parsed = responseTags(item);
  const isHidden = isHiddenResponse(item, hiddenTags);
  if (raw !== undefined) withTags++;
  if (isHidden) hidden++;

  const mark = isHidden ? "HIDDEN " : "shown  ";
  const rawStr = raw === undefined ? "(no tags property)" : JSON.stringify(raw);
  console.log(`${mark} ${item.response_id}  raw=${rawStr}  parsed=${JSON.stringify(parsed)}`);
}

console.log(`\n${hidden} hidden, ${items.length - hidden} shown`);

if (withTags === 0) {
  console.log(
    "\nNo response carried a `tags` property.\n" +
      "If you HAVE tagged a response in the Typeform inbox, then this plan\n" +
      "(tag -> hidden) does not work on your account, and hiding needs a\n" +
      "different mechanism. If you have not tagged anything yet, tag one\n" +
      "response 'hide' in Typeform and re-run this.",
  );
} else if (hidden === 0) {
  console.log(
    "\nTags came through, but none matched the hidden list.\n" +
      "Check the exact spelling above against the tag you applied.",
  );
}
