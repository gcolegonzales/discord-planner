import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config';

const validEnv = {
  DISCORD_TOKEN: 'test-token-abc123',
  DISCORD_CLIENT_ID: 'client-id-456',
  DEFAULT_TIMEZONE: 'America/New_York',
};

describe('loadConfig', () => {
  it('succeeds with all required vars and valid timezone', () => {
    const config = loadConfig({ ...validEnv });
    expect(config.discordToken).toBe('test-token-abc123');
    expect(config.discordClientId).toBe('client-id-456');
    expect(config.defaultTimezone).toBe('America/New_York');
  });

  it('throws naming DISCORD_TOKEN when it is missing', () => {
    const env = { ...validEnv };
    delete (env as Partial<typeof env>).DISCORD_TOKEN;
    expect(() => loadConfig(env)).toThrowError(/DISCORD_TOKEN/);
  });

  it('throws naming DISCORD_CLIENT_ID when it is missing', () => {
    const env = { ...validEnv };
    delete (env as Partial<typeof env>).DISCORD_CLIENT_ID;
    expect(() => loadConfig(env)).toThrowError(/DISCORD_CLIENT_ID/);
  });

  it('throws naming DEFAULT_TIMEZONE when it is missing', () => {
    const env = { ...validEnv };
    delete (env as Partial<typeof env>).DEFAULT_TIMEZONE;
    expect(() => loadConfig(env)).toThrowError(/DEFAULT_TIMEZONE/);
  });

  it('throws naming DEFAULT_TIMEZONE for an invalid IANA zone', () => {
    expect(() => loadConfig({ ...validEnv, DEFAULT_TIMEZONE: 'Not/AZone' })).toThrowError(
      /DEFAULT_TIMEZONE/,
    );
  });

  it('throws naming DEFAULT_TIMEZONE for a clearly invalid value', () => {
    expect(() => loadConfig({ ...validEnv, DEFAULT_TIMEZONE: 'garbage-value' })).toThrowError(
      /DEFAULT_TIMEZONE/,
    );
  });

  it('applies default DATABASE_PATH when not provided', () => {
    const config = loadConfig({ ...validEnv });
    expect(config.databasePath).toBe('./data/scheduler.sqlite');
  });

  it('uses provided DATABASE_PATH', () => {
    const config = loadConfig({ ...validEnv, DATABASE_PATH: '/custom/path.sqlite' });
    expect(config.databasePath).toBe('/custom/path.sqlite');
  });

  it('applies default MAX_EVENT_DAYS of 31', () => {
    const config = loadConfig({ ...validEnv });
    expect(config.maxEventDays).toBe(31);
  });

  it('applies default MAX_RESULT_WINDOWS of 5', () => {
    const config = loadConfig({ ...validEnv });
    expect(config.maxResultWindows).toBe(5);
  });

  it('parses custom MAX_EVENT_DAYS', () => {
    const config = loadConfig({ ...validEnv, MAX_EVENT_DAYS: '14' });
    expect(config.maxEventDays).toBe(14);
  });

  it('throws naming MAX_EVENT_DAYS for non-numeric value', () => {
    expect(() => loadConfig({ ...validEnv, MAX_EVENT_DAYS: 'abc' })).toThrowError(/MAX_EVENT_DAYS/);
  });

  it('throws naming MAX_RESULT_WINDOWS for non-numeric value', () => {
    expect(() => loadConfig({ ...validEnv, MAX_RESULT_WINDOWS: 'xyz' })).toThrowError(
      /MAX_RESULT_WINDOWS/,
    );
  });

  it('devGuildId is undefined when DEV_GUILD_ID not set', () => {
    const config = loadConfig({ ...validEnv });
    expect(config.devGuildId).toBeUndefined();
  });

  it('devGuildId is populated when DEV_GUILD_ID is set', () => {
    const config = loadConfig({ ...validEnv, DEV_GUILD_ID: '987654321' });
    expect(config.devGuildId).toBe('987654321');
  });

  it('accepts UTC as a valid IANA timezone', () => {
    const config = loadConfig({ ...validEnv, DEFAULT_TIMEZONE: 'UTC' });
    expect(config.defaultTimezone).toBe('UTC');
  });

  it('accepts Europe/London as a valid IANA timezone', () => {
    const config = loadConfig({ ...validEnv, DEFAULT_TIMEZONE: 'Europe/London' });
    expect(config.defaultTimezone).toBe('Europe/London');
  });
});
