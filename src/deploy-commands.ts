import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { loadConfig } from './config';

async function deploy(): Promise<void> {
  const config = loadConfig();

  // Collect command JSON by scanning src/interactions/commands/ — drop a file
  // there and it is picked up automatically (no hand-maintained array).
  const commandData = await collectCommandData();
  const commandCount = commandData.length;

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
  const { pathToFileURL } = await import('url');

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
    const mod = (await import(pathToFileURL(fullPath).href)) as Record<string, unknown>;
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
