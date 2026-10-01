export const ROLES_KEY = 'roles';

export const AUTH_COOKIE = 'mt_auth';
export const PARTICIPANT_COOKIE = 'mt_sid';

/** Internal sessions cover one event day. */
export const AUTH_TTL_SECONDS = 12 * 60 * 60;
export const PARTICIPANT_COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Per-session submission limits (SPEC §8). */
export const SUBMISSION_COOLDOWN_MS = 12_000;
export const SUBMISSION_WINDOW_MS = 30 * 60 * 1000;
export const SUBMISSION_WINDOW_MAX = 5;

/**
 * Per-IP ceiling for POST /questions. Deliberately generous: a whole campus
 * can sit behind one NAT address, so the session limits do the real work.
 */
export const SUBMISSION_IP_LIMIT = { limit: 60, ttl: 60_000 };
export const LOGIN_IP_LIMIT = { limit: 10, ttl: 60_000 };
export const DEFAULT_IP_LIMIT = { limit: 300, ttl: 60_000 };
