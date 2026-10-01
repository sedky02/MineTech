import { parseCorsOrigins, validateEnv } from './env.validation.js';

const valid = {
  NODE_ENV: 'production',
  PORT: '10000',
  DATABASE_URL: 'postgresql://u:p@host:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGIN: 'https://minetech.vercel.app',
};

describe('validateEnv', () => {
  it('accepts a complete production config', () => {
    expect(validateEnv(valid)).toMatchObject({
      PORT: 10000,
      NODE_ENV: 'production',
    });
  });

  it.each([
    ['a wildcard CORS origin', { CORS_ORIGIN: '*' }],
    ['a wildcard among origins', { CORS_ORIGIN: 'https://a.app, *' }],
    ['a short JWT secret', { JWT_SECRET: 'short' }],
    ['a non-Postgres database', { DATABASE_URL: 'mysql://x' }],
    ['an invalid event start', { EVENT_STARTS_AT: 'tomorrow-ish' }],
  ])('rejects %s', (_label, override) => {
    expect(() => validateEnv({ ...valid, ...override })).toThrow(
      'Invalid environment',
    );
  });

  it('treats an empty EVENT_STARTS_AT as unset', () => {
    expect(
      validateEnv({ ...valid, EVENT_STARTS_AT: '' }).EVENT_STARTS_AT,
    ).toBeUndefined();
  });
});

describe('parseCorsOrigins', () => {
  it('splits and trims a comma-separated list', () => {
    expect(parseCorsOrigins('https://a.app, https://b.app ,')).toEqual([
      'https://a.app',
      'https://b.app',
    ]);
  });
});
