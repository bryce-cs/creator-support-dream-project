// External destinations shared across pages.

/**
 * Entry form. Still linked from /live, which runs its own signup flow. The
 * homepage stopped pointing at it when applications closed.
 */
export const TYPEFORM_URL = "https://form.typeform.com/to/MbmNRCNH";

/** Colin & Samir's site — footer link on every page. */
export const COLIN_AND_SAMIR_URL = "https://www.colinandsamir.com";

/**
 * Adobe Creator Incubator sign-up. Behind Later's OAuth, so the whole query
 * string matters — trimming it drops the campaign id and lands on a generic page.
 */
export const ADOBE_INCUBATOR_URL =
  "https://auth.later.com/auth/realms/later-production/protocol/openid-connect/auth?client_id=later&redirect_uri=https%3A%2F%2Fapp.later.com%2Fusers%2Fauth%2Fkeycloak%2Fcallback%3Fcampaign_id%3D72367&response_type=code&scope=email+profile+openid&state=6053d7e83b5a1705b6bb006491ccf7bf6165139f72a902ed";

// ---- Winner announcement ----------------------------------------------------

/** Jackson's winning pitch. Embedded on the homepage. */
export const PITCH_VIDEO_ID = "4SDoluXWVWQ";

/** Jackson and David's channel. */
export const STORIES_MADE_WITH_LOVE_URL = "https://www.youtube.com/@StoriesMadeWithLove";

/** The Pinkertons episode their pitch builds on, cued to the part referenced. */
export const PINKERTONS_VIDEO_URL = "https://www.youtube.com/watch?v=fYIPsRmMldk&t=258s";
