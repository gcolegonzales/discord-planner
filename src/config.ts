import * as dotenv from 'dotenv';
import { IANAZone } from 'luxon';

dotenv.config();

export interface AppConfig {
  discordToken: string;
  discordClientId: string;
  defaultTimezone: string;
  devGuildId: string | undefined;
  databasePath: string;
  maxEventDays: number;
  maxResultWindows: number;
}

function requireEnv(env: Record<string, string | undefined>, key: string): string {
  const val = env[key];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val.trim();
}

function validateIanaTimezone(zone: string): void {
  if (!IANAZone.isValidZone(zone)) {
    throw new Error(
      `Invalid IANA timezone for DEFAULT_TIMEZONE: "${zone}". Example: "America/New_York"`,
    );
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const discordToken = requireEnv(env, 'DISCORD_TOKEN');
  const discordClientId = requireEnv(env, 'DISCORD_CLIENT_ID');
  const defaultTimezone = requireEnv(env, 'DEFAULT_TIMEZONE');

  validateIanaTimezone(defaultTimezone);

  const devGuildId = env['DEV_GUILD_ID']?.trim() || undefined;
  const databasePath = env['DATABASE_PATH']?.trim() || './data/scheduler.sqlite';

  const maxEventDaysRaw = env['MAX_EVENT_DAYS']?.trim();
  const maxEventDays = maxEventDaysRaw ? parseInt(maxEventDaysRaw, 10) : 31;
  if (isNaN(maxEventDays) || maxEventDays <= 0) {
    throw new Error(
      `Invalid value for MAX_EVENT_DAYS: "${maxEventDaysRaw ?? ''}". Must be a positive integer.`,
    );
  }

  const maxResultWindowsRaw = env['MAX_RESULT_WINDOWS']?.trim();
  const maxResultWindows = maxResultWindowsRaw ? parseInt(maxResultWindowsRaw, 10) : 5;
  if (isNaN(maxResultWindows) || maxResultWindows <= 0) {
    throw new Error(
      `Invalid value for MAX_RESULT_WINDOWS: "${maxResultWindowsRaw ?? ''}". Must be a positive integer.`,
    );
  }

  return {
    discordToken,
    discordClientId,
    defaultTimezone,
    devGuildId,
    databasePath,
    maxEventDays,
    maxResultWindows,
  };
}
