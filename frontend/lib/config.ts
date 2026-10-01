/** Public, build-time configuration. Never put secrets in NEXT_PUBLIC_* variables. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? API_URL).replace(/\/$/, "");
export const EVENT_NAME = process.env.NEXT_PUBLIC_EVENT_NAME ?? "MineTech";
export const CLUB_NAME = process.env.NEXT_PUBLIC_CLUB_NAME ?? "";
