import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnvStartup, getServerSecret } from '@/config/env';

describe('Environment Validator & Production Safety', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows development defaults when NODE_ENV is development or test', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    delete process.env.DHUN_SERVER_SECRET;

    const config = validateEnvStartup();
    expect(config.isProduction).toBe(false);
    expect(config.serverSecret).toBeDefined();
    expect(getServerSecret()).toBeDefined();
  });

  it('throws in production if DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    process.env.DHUN_SERVER_SECRET = 'a_very_secure_secret_production_key_12345';

    expect(() => validateEnvStartup()).toThrowError(/DATABASE_URL/);
  });

  it('throws in production if DHUN_SERVER_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@ep-cool-db.us-east-2.aws.neon.tech/dhun_db?sslmode=require';
    delete process.env.DHUN_SERVER_SECRET;

    expect(() => validateEnvStartup()).toThrowError(/DHUN_SERVER_SECRET/);
  });

  it('throws in production if DHUN_SERVER_SECRET is insecure or placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@ep-cool-db.us-east-2.aws.neon.tech/dhun_db?sslmode=require';
    process.env.DHUN_SERVER_SECRET = 'short_test_key';

    expect(() => validateEnvStartup()).toThrowError(/DHUN_SERVER_SECRET/);
  });

  it('succeeds in production when valid DATABASE_URL and DHUN_SERVER_SECRET are configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@ep-cool-db.us-east-2.aws.neon.tech/dhun_db?sslmode=require';
    process.env.DHUN_SERVER_SECRET = 'prod_secret_production_random_token_987654321';

    const config = validateEnvStartup();
    expect(config.isProduction).toBe(true);
    expect(config.serverSecret).toBe('prod_secret_production_random_token_987654321');
    expect(getServerSecret()).toBe('prod_secret_production_random_token_987654321');
  });
});
