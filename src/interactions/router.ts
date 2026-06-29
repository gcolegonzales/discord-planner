import type { Interaction } from 'discord.js';
import { InteractionType } from 'discord.js';

export type CommandHandler = (interaction: Interaction) => Promise<void>;

interface HandlerRegistry {
  commands: Map<string, CommandHandler>;
  buttons: Map<string, CommandHandler>;
  modals: Map<string, CommandHandler>;
}

const registry: HandlerRegistry = {
  commands: new Map(),
  buttons: new Map(),
  modals: new Map(),
};

export function registerCommand(name: string, handler: CommandHandler): void {
  registry.commands.set(name, handler);
}

export function registerButton(customIdPrefix: string, handler: CommandHandler): void {
  registry.buttons.set(customIdPrefix, handler);
}

export function registerModal(customIdPrefix: string, handler: CommandHandler): void {
  registry.modals.set(customIdPrefix, handler);
}

function findPrefixHandler(
  map: Map<string, CommandHandler>,
  customId: string,
): CommandHandler | undefined {
  // Try exact match first
  if (map.has(customId)) {
    return map.get(customId);
  }
  // Try prefix match
  for (const [prefix, handler] of map) {
    if (customId.startsWith(prefix)) {
      return handler;
    }
  }
  return undefined;
}

export async function routeInteraction(interaction: Interaction): Promise<void> {
  try {
    if (
      interaction.type === InteractionType.ApplicationCommand &&
      interaction.isChatInputCommand()
    ) {
      const handler = registry.commands.get(interaction.commandName);
      if (handler) {
        await handler(interaction);
      }
      return;
    }

    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      const handler = findPrefixHandler(registry.buttons, interaction.customId);
      if (handler) {
        await handler(interaction);
      }
      return;
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      const handler = findPrefixHandler(registry.modals, interaction.customId);
      if (handler) {
        await handler(interaction);
      }
      return;
    }

    // Unknown or unregistered interaction — ignore silently
  } catch (err) {
    console.error('Error handling interaction:', err);
  }
}
