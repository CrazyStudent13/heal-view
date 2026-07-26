const requiredVariables = [
  'MYSQL_HOST',
  'MYSQL_USERNAME',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'JWT_ACCESS_SECRET',
] as const;

function parseNumber(value: unknown, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('Boolean environment variables must be true or false');
}

export function validateEnvironment(config: Record<string, unknown>) {
  for (const name of requiredVariables) {
    if (typeof config[name] !== 'string' || config[name].trim() === '') {
      throw new Error(`${name} is required`);
    }
  }

  return {
    ...config,
    PORT: parseNumber(config.PORT, 3000, 'PORT'),
    WEB_ORIGIN:
      typeof config.WEB_ORIGIN === 'string'
        ? config.WEB_ORIGIN
        : 'http://localhost:5173',
    MYSQL_PORT: parseNumber(config.MYSQL_PORT, 3306, 'MYSQL_PORT'),
    MYSQL_SSL_ENABLED: parseBoolean(config.MYSQL_SSL_ENABLED, false),
    JWT_ACCESS_TTL_SECONDS: parseNumber(
      config.JWT_ACCESS_TTL_SECONDS,
      900,
      'JWT_ACCESS_TTL_SECONDS',
    ),
    SESSION_TTL_DAYS: parseNumber(
      config.SESSION_TTL_DAYS,
      30,
      'SESSION_TTL_DAYS',
    ),
  };
}
