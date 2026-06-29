import { REST, Routes } from 'discord.js';
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { loadConfig } from './config';

// Commands to register — populated by later tasks
const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

async function deploy(): Promise<void> {
  const config = loadConfig();
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  let route: `/${string}`;
  if (config.devGuildId) {
    route = Routes.applicationGuildCommands(config.discordClientId, config.devGuildId);
    console.log(`Deploying ${commands.length} commands to guild ${config.devGuildId} (instant)...`);
  } else {
    route = Routes.applicationCommands(config.discordClientId);
    console.log(`Deploying ${commands.length} commands globally (may take up to 1h)...`);
  }

  const result = await rest.put(route, { body: commands });
  console.log('Commands registered:', JSON.stringify(result, null, 2));
}

deploy().catch((err: unknown) => {
  console.error('Deploy failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
