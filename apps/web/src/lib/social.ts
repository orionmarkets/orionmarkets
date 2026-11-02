// Single source of truth for the project's social links.
export const X_HANDLE = (process.env.NEXT_PUBLIC_X_HANDLE || "UseOrionMarkets").replace(/^@/, "").trim();
export const HAS_X = /^[A-Za-z0-9_]{1,15}$/.test(X_HANDLE);
export const X_URL = HAS_X ? `https://x.com/${X_HANDLE}` : "";
export const X_LABEL = "Follow ORIONMARKETS on X";
export const X_TITLE = HAS_X ? `Follow ORIONMARKETS on X (@${X_HANDLE})` : X_LABEL;
