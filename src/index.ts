import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config';
import { routeInteraction } from './interactions';

// Load and validate config eagerly — exits with a clear error if misconfigured
let config;
try {
  config = loadConfig();
} catch (err) {
  console.error('Configuration error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on('interactionCreate', (interaction) => {
  void routeInteraction(interaction);
});

void client.login(config.discordToken);
