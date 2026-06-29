import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { loadConfig } from './config';
import { loadHandlers } from './interactions';

async function deploy(): Promise<void> {
  const config = loadConfig();

  // Collect all command data via the same directory-scan loader used at runtime.
  // No hand-maintained array — drop a file in src/interactions/commands/ and it
  // is picked up automatically.
  const { commands: commandCount } = await loadHandlers();
  // The loader already registered handlers into the router; we need the raw data
  // for REST registration.  Re-scan to collect data objects without side-effects
  // from the router registrations (which are harmless but we need the JSON).
  // Import the loader internals directly for data collection.
  const commandData = await collectCommandData();

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  let route: `/${string}`;
  if (config.devGuildId) {
    route = Routes.applicationGuildCommands(config.discordClientId, config.devGuildId);
    console.log(
      `Deploying ${commandCount} command(s) to guild ${config.devGuildId} (instant)...`,
    );
  } else {
    route = Routes.applicationCommands(config.discordClientId);
    console.log(`Deploying ${commandCount} command(s) globally (may take up to 1h)...`);
  }

  const result = await rest.put(route, { body: commandData });
  console.log('Commands registered:', JSON.stringify(result, null, 2));
}

/**
 * Collect raw command JSON bodies from all command modules without touching
 * the interaction router.  Uses the same file-discovery logic as the loader.
 */
async function collectCommandData(): Promise<RESTPostAPIChatInputApplicationCommandsJSONBody[]> {
  const fs = await import('fs');
  const path = await import('path');

  const commandsDir = path.join(__dirname, 'interactions', 'commands');
  if (!fs.existsSync(commandsDir)) return [];

  const files = fs
    .readdirSync(commandsDir)
    .filter(
      (f: string) =>
        (f.endsWith('.ts') || f.endsWith('.js')) &&
        f !== 'index.ts' &&
        f !== 'index.js' &&
        !f.endsWith('.d.ts') &&
        !f.endsWith('.js.map') &&
        f !== '.gitkeep',
    );

  const data: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
  for (const file of files) {
    const fullPath = path.join(commandsDir, file);
    const mod = (await import(fullPath)) as Record<string, unknown>;
    const cmd = mod['command'] as
      | { data: SlashCommandBuilder | RESTPostAPIChatInputApplicationCommandsJSONBody }
      | undefined;
    if (cmd?.data) {
      const json =
        cmd.data instanceof SlashCommandBuilder ? cmd.data.toJSON() : cmd.data;
      data.push(json);
    }
  }
  return data;
}

deploy().catch((err: unknown) => {
  console.error('Deploy failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
