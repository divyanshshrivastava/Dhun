// Environment variable validator and startup safety checker for Dhun
// Enforces strict production requirements:
// - DATABASE_URL must be present and valid (PGlite fallback is forbidden in production)
// - DHUN_SERVER_SECRET must be explicitly set and secure (default test secrets forbidden)

export interface EnvironmentConfig {
  nodeEnv: string;
  isProduction: boolean;
  databaseUrl: string;
  serverSecret: string;
  storageProvider: 'local' | 'r2' | 'supabase';
  rateLimiterProvider: 'memory' | 'upstash';
}

export function validateEnvStartup(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // 1. Validate DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  if (isProduction && !databaseUrl) {
    throw new Error(
      '[FATAL] Missing required environment variable: DATABASE_URL in production. PGlite fallback is strictly forbidden outside dev/test.'
    );
  }

  // 2. Validate DHUN_SERVER_SECRET
  const serverSecret = process.env.DHUN_SERVER_SECRET?.trim() || '';
  if (isProduction) {
    if (!serverSecret) {
      throw new Error(
        '[FATAL] Missing required environment variable: DHUN_SERVER_SECRET in production. Default signing secret is strictly forbidden outside dev/test.'
      );
    }
    if (serverSecret.length < 16 || serverSecret.includes('fallback') || serverSecret.includes('test')) {
      throw new Error(
        '[FATAL] DHUN_SERVER_SECRET must be at least 16 characters long and cannot contain placeholder terms in production.'
      );
    }
  }

  // 3. Storage Provider resolution
  let storageProvider: 'local' | 'r2' | 'supabase' = 'local';
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    storageProvider = 'r2';
  } else if (
    (process.env.SUPABASE_STORAGE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  ) {
    storageProvider = 'supabase';
  }

  // 4. Rate Limiter Provider resolution
  let rateLimiterProvider: 'memory' | 'upstash' = 'memory';
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    rateLimiterProvider = 'upstash';
  }

  return {
    nodeEnv,
    isProduction,
    databaseUrl,
    serverSecret: serverSecret || 'dhun_dev_test_secret_salt_2026',
    storageProvider,
    rateLimiterProvider,
  };
}

// Global accessor for server secret
export function getServerSecret(): string {
  return validateEnvStartup().serverSecret;
}
