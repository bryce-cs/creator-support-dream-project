// Exercises lib/typeform-map.ts against the live form's field definition and
// realistic response shapes. Run with: npm run check:typeform
//
// The form definition below mirrors https://form.typeform.com/to/MbmNRCNH as of
// Aug 2026. If the form changes, update FORM_FIELDS and re-run.

import { loadLib } from "./load-lib.mjs";

const FORM_FIELDS = [
  {
    id: "wfpgn86rG1av", ref: "name", type: "contact_info", title: "Tell us about yourself.",
    properties: { fields: [
      { id: "Li95h2cvYx2A", title: "First name", subfield_key: "first_name", type: "short_text" },
      { id: "MuJipS5xYbSE", title: "Last name", subfield_key: "last_name", type: "short_text" },
      { id: "bQPgalJY637Z", title: "Email", subfield_key: "email", type: "email" },
    ] },
  },
  { id: "50Ts7YlcexI6", ref: "7454dc4b", type: "short_text", title: "What city do you live in?" },
  { id: "5XIHb1V4yaNE", ref: "9e7691f0", type: "website", title: "Add the link to your main channel or profile." },
  { id: "mOW9yPmLtXBP", ref: "05aa819f", type: "short_text", title: "Tell us your idea in one sentence." },
  { id: "gCaC3lXkQvAh", ref: "63ddd15c", type: "short_text", title: "Mockup a title and thumbnail for your idea. Add the title here." },
  { id: "T74fNbl0XyQm", ref: "311e382a", type: "file_upload", title: "Upload the thumbnail here." },
  { id: "pqvETR6SNo56", ref: "youtube_url", type: "website", title: "Drop an unlisted YouTube link to your Big Idea pitch here." },
];

const CHANNEL = "https://www.youtube.com/@creatorsupport";
const VIDEO = "https://youtu.be/aqz-KE-bpKQ";
const UPLOAD =
  "https://api.typeform.com/forms/MbmNRCNH/responses/r1/fields/T74fNbl0XyQm/files/thumb.jpg";

const answer = (id, value, extra = {}) => ({ field: { id, ...extra }, ...value });

/** A complete submission, with the contact block split into one answer per subfield. */
const fullResponse = {
  response_id: "r1",
  submitted_at: "2026-08-16T12:00:00Z",
  answers: [
    answer("Li95h2cvYx2A", { type: "text", text: "Colin" }),
    answer("MuJipS5xYbSE", { type: "text", text: "Rosenblum" }),
    answer("bQPgalJY637Z", { type: "email", email: "bryce@colinandsamir.com" }),
    answer("50Ts7YlcexI6", { type: "text", text: "Los Angeles" }),
    answer("5XIHb1V4yaNE", { type: "url", url: CHANNEL }),
    answer("mOW9yPmLtXBP", { type: "text", text: "A show about creators funding creators." }),
    answer("gCaC3lXkQvAh", { type: "text", text: "Watch this, win $25,000." }),
    answer("T74fNbl0XyQm", { type: "file_url", file_url: UPLOAD }),
    answer("pqvETR6SNo56", { type: "url", url: VIDEO }, { ref: "youtube_url" }),
  ],
};

const withAnswers = (filter, extra = []) => ({
  ...fullResponse,
  answers: [...fullResponse.answers.filter(filter), ...extra],
});

const { resolveFields, mapAnswers, publicFileUrl, responseTags, parseHiddenTags, isHiddenResponse } =
  await loadLib(["submissions", "typeform-map"], "typeform-map");
const { applyOverride, diffOverride, parseOverride, parseOverrides } = await loadLib(
  ["submissions", "overrides"],
  "overrides",
);
const fields = resolveFields(FORM_FIELDS);

const results = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, label, actual, expected });
};

// Field resolution
check("resolves name block", fields.name, "wfpgn86rG1av");
check("resolves first name subfield", fields.nameFirst, "Li95h2cvYx2A");
check("resolves last name subfield", fields.nameLast, "MuJipS5xYbSE");
check("resolves profile (Q3)", fields.profile, "5XIHb1V4yaNE");
check("resolves title (Q5)", fields.title, "gCaC3lXkQvAh");
check("resolves thumbnail (Q6)", fields.thumbnail, "T74fNbl0XyQm");
check("resolves video (Q7)", fields.video, "pqvETR6SNo56");

// A complete response
const full = mapAnswers(fullResponse, fields);
check("name is first + last", full.name, "Colin Rosenblum");
check("title comes from Q5", full.title, "Watch this, win $25,000.");
check("profile comes from Q3", full.profileUrl, CHANNEL);
check("thumbnail comes from Q6", full.thumbnail, UPLOAD);
check("video comes from Q7", full.url, VIDEO);
check("upload is proxied", publicFileUrl(UPLOAD), `/api/typeform-file?u=${encodeURIComponent(UPLOAD)}`);
check("email never becomes the profile link", full.profileUrl.includes("@colinandsamir"), false);

// Blank last name — both name subfields are optional on the form.
const firstOnly = mapAnswers(withAnswers((a) => a.field.id !== "MuJipS5xYbSE"), fields);
check("blank last name yields first only", firstOnly.name, "Colin");

// Older/grouped contact_info shape, in case Typeform returns the block as one answer.
const grouped = mapAnswers(
  withAnswers(
    (a) => !["Li95h2cvYx2A", "MuJipS5xYbSE", "bQPgalJY637Z"].includes(a.field.id),
    [answer("wfpgn86rG1av", {
      type: "contact_info",
      contact_info: { first_name: "Samir", last_name: "Chaudry", email: "s@example.com" },
    })],
  ),
  fields,
);
check("grouped contact_info still yields a full name", grouped.name, "Samir Chaudry");

// No thumbnail uploaded — the card falls back to the YouTube still.
const noThumb = mapAnswers(withAnswers((a) => a.field.id !== "T74fNbl0XyQm"), fields);
check("missing upload leaves thumbnail empty", noThumb.thumbnail, "");

// Form definition unavailable: the mapping must still find the video, and must
// not mistake the channel link for it.
const blind = mapAnswers(fullResponse, {});
check("without the form def, video still resolves", blind.url, VIDEO);
check("without the form def, channel is not the video", blind.url === CHANNEL, false);
check("without the form def, channel becomes the profile", blind.profileUrl, CHANNEL);

// A response with no video link at all is dropped.
check(
  "response without a video is skipped",
  mapAnswers(withAnswers((a) => a.field.id !== "pqvETR6SNo56"), fields),
  null,
);

// Response tags. Typeform returns these but doesn't document them, so the
// reader accepts every plausible shape and ignores anything it can't read.
const tagged = (tags) => ({ ...fullResponse, tags });
check("reads bare string tags", responseTags(tagged(["Hide", " Spam "])), ["hide", "spam"]);
check("reads {name} tags", responseTags(tagged([{ name: "Hide" }])), ["hide"]);
check("reads {label} tags", responseTags(tagged([{ label: "hide" }])), ["hide"]);
check("no tags property yields none", responseTags(fullResponse), []);
check("unreadable tag shapes are ignored", responseTags(tagged([{ id: 7 }, null, ""])), []);

const hideOnly = parseHiddenTags(undefined);
check("defaults to the 'hide' tag", [...hideOnly], ["hide"]);
check("env list is parsed and lowercased", [...parseHiddenTags(" Hide , Spam ")], ["hide", "spam"]);
check("blank env falls back to the default", [...parseHiddenTags("  ")], ["hide"]);

check("tagged hide is hidden", isHiddenResponse(tagged(["hide"]), hideOnly), true);
check("tag match ignores case", isHiddenResponse(tagged([{ name: "HIDE" }]), hideOnly), true);
check("an unrelated tag stays visible", isHiddenResponse(tagged(["favorite"]), hideOnly), false);
check("an untagged response stays visible", isHiddenResponse(fullResponse, hideOnly), false);
// Fail open: if Typeform changes the payload we show too many, never zero.
check(
  "unrecognised tag payload stays visible",
  isHiddenResponse(tagged([{ id: 1 }]), hideOnly),
  false,
);
check(
  "a second configured tag also hides",
  isHiddenResponse(tagged(["spam"]), parseHiddenTags("hide,spam")),
  true,
);

// Admin overrides. The rule that matters: an edited field wins, an untouched
// field keeps tracking Typeform.
const card = {
  id: "r1",
  title: "Watch this, win $25,000.",
  name: "Colin Rosenblum",
  youtube_url: VIDEO,
  submitted_at: "2026-08-16T12:00:00Z",
  likes: 0,
  profile_url: CHANNEL,
  thumbnail_url: "https://img.example/thumb.jpg",
};

check("no override leaves the card alone", applyOverride(card, undefined), card);
check(
  "an edited title wins",
  applyOverride(card, { title: "Corrected title" }).title,
  "Corrected title",
);
check(
  "untouched fields still track Typeform",
  applyOverride(card, { title: "Corrected title" }).name,
  card.name,
);
check(
  "an empty optional override clears the field",
  "profile_url" in applyOverride(card, { profile_url: "" }),
  false,
);
// Blanking a required field would leave the card with no title at all.
check(
  "an empty required override is ignored",
  applyOverride(card, { title: "  " }).title,
  card.title,
);
check("hidden marks the reason", applyOverride(card, { hidden: true }).hidden_reason, "admin");

// Only differences are stored, so untouched fields stay automatic.
check(
  "unchanged values are not stored",
  diffOverride(card, { title: card.title, name: card.name }),
  {},
);
check("changed values are stored", diffOverride(card, { name: "Colin R." }), { name: "Colin R." });
check(
  "clearing a field is stored as empty",
  diffOverride(card, { profile_url: "" }),
  { profile_url: "" },
);
check("hidden survives the diff", diffOverride(card, { hidden: true }), { hidden: true });

// Request bodies are untrusted.
check("unknown keys are dropped", parseOverride({ title: "ok", evil: "x" }), { title: "ok" });
check("non-string values are dropped", parseOverride({ title: 42 }), {});
check("hidden only accepts true", parseOverride({ hidden: "yes" }), {});
check("non-objects yield an empty override", parseOverride("nope"), {});
check("empty entries are dropped from the map", parseOverrides({ r1: {}, r2: { name: "A" } }), {
  r2: { name: "A" },
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`);
  if (!r.ok) console.log(`      expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.actual)}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
