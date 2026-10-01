export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  EVENT_STARTS_AT?: string;
}

/** Fails fast at boot when required configuration is missing or invalid. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const str = (key: string) =>
    typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';

  const nodeEnv = str('NODE_ENV') || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be development, production or test');
  }

  const port = Number(str('PORT') || 4000);
  if (!Number.isInteger(port) || port <= 0)
    errors.push('PORT must be a port number');

  const databaseUrl = str('DATABASE_URL');
  if (!databaseUrl.startsWith('postgres')) {
    errors.push('DATABASE_URL must be a PostgreSQL connection string');
  }

  const jwtSecret = str('JWT_SECRET');
  if (jwtSecret.length < 32)
    errors.push('JWT_SECRET must be at least 32 characters');

  const corsOrigin = str('CORS_ORIGIN');
  if (!corsOrigin) errors.push('CORS_ORIGIN is required');
  if (corsOrigin.split(',').some((o) => o.trim() === '*')) {
    errors.push('CORS_ORIGIN must list explicit origins, not "*"');
  }

  const eventStartsAt = str('EVENT_STARTS_AT') || undefined;
  if (eventStartsAt && Number.isNaN(Date.parse(eventStartsAt))) {
    errors.push('EVENT_STARTS_AT must be an ISO 8601 date');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    CORS_ORIGIN: corsOrigin,
    EVENT_STARTS_AT: eventStartsAt,
  };
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
