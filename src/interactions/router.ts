/**
 * Interaction Router — Module Contract
 * =====================================
 *
 * COMMAND MODULE  (src/interactions/commands/<name>.ts)
 *   export const command: CommandModule = {
 *     data: SlashCommandBuilder | RESTPostAPIChatInputApplicationCommandsJSONBody,
 *     execute(interaction: ChatInputCommandInteraction): Promise<void>,
 *   };
 *   Registered under data.name. The router dispatches chat-input commands by commandName.
 *
 * BUTTON MODULE  (src/interactions/buttons/<name>.ts)
 *   export const button: ButtonModule = {
 *     prefix: string,                // matched via customId.startsWith(prefix)
 *     execute(interaction: ButtonInteraction): Promise<void>,
 *   };
 *
 * MODAL MODULE  (src/interactions/modals/<name>.ts)  [optional]
 *   export const modal: ModalModule = {
 *     prefix: string,                // matched via customId.startsWith(prefix)
 *     execute(interaction: ModalSubmitInteraction): Promise<void>,
 *   };
 *
 * Adding a new handler requires ONLY dropping the file in the right folder with
 * the correct export shape — no edits to router.ts / index.ts / deploy-commands.ts.
 */

import type {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { InteractionType, SlashCommandBuilder } from 'discord.js';

// ---------------------------------------------------------------------------
// Public module-type definitions (imported by handler files and later tasks)
// ---------------------------------------------------------------------------

export interface CommandModule {
  data: SlashCommandBuilder | RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface ButtonModule {
  prefix: string;
  execute(interaction: ButtonInteraction): Promise<void>;
}

export interface ModalModule {
  prefix: string;
  execute(interaction: ModalSubmitInteraction): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

interface HandlerRegistry {
  commands: Map<string, (interaction: ChatInputCommandInteraction) => Promise<void>>;
  buttons: Map<string, (interaction: ButtonInteraction) => Promise<void>>;
  modals: Map<string, (interaction: ModalSubmitInteraction) => Promise<void>>;
}

const registry: HandlerRegistry = {
  commands: new Map(),
  buttons: new Map(),
  modals: new Map(),
};

// ---------------------------------------------------------------------------
// Registration helpers (called by the loader)
// ---------------------------------------------------------------------------

export function registerCommand(mod: CommandModule): void {
  const name =
    mod.data instanceof SlashCommandBuilder ? mod.data.name : (mod.data as { name: string }).name;
  registry.commands.set(name, (i) => mod.execute(i));
}

export function registerButton(mod: ButtonModule): void {
  registry.buttons.set(mod.prefix, (i) => mod.execute(i));
}

export function registerModal(mod: ModalModule): void {
  registry.modals.set(mod.prefix, (i) => mod.execute(i));
}

/**
 * Reset the registry (used in tests to start with a clean state).
 */
export function _resetRegistry(): void {
  registry.commands.clear();
  registry.buttons.clear();
  registry.modals.clear();
}

// ---------------------------------------------------------------------------
// Prefix-match lookup
// ---------------------------------------------------------------------------

function findPrefixHandler<T>(
  map: Map<string, (interaction: T) => Promise<void>>,
  customId: string,
): ((interaction: T) => Promise<void>) | undefined {
  if (map.has(customId)) return map.get(customId);
  for (const [prefix, handler] of map) {
    if (customId.startsWith(prefix)) return handler;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function routeInteraction(interaction: Interaction): Promise<void> {
  try {
    if (
      interaction.type === InteractionType.ApplicationCommand &&
      interaction.isChatInputCommand()
    ) {
      const handler = registry.commands.get(interaction.commandName);
      if (handler) await handler(interaction);
      return;
    }

    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      const handler = findPrefixHandler(registry.buttons, interaction.customId);
      if (handler) await handler(interaction);
      return;
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      const handler = findPrefixHandler(registry.modals, interaction.customId);
      if (handler) await handler(interaction);
      return;
    }

    // Unknown or unregistered interaction — ignore silently
  } catch (err) {
    console.error('Error handling interaction:', err);
  }
}
