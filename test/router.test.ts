import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerCommand,
  registerButton,
  registerModal,
  routeInteraction,
  _resetRegistry,
} from '../src/interactions/router';
import type { CommandModule, ButtonModule, ModalModule } from '../src/interactions/router';
import {
  InteractionType,
  SlashCommandBuilder,
  ComponentType,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Interaction,
} from 'discord.js';

// ---------------------------------------------------------------------------
// Minimal interaction stubs
// ---------------------------------------------------------------------------

function makeChatInputInteraction(commandName: string): Interaction {
  return {
    type: InteractionType.ApplicationCommand,
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName,
  } as unknown as Interaction;
}

function makeButtonInteraction(customId: string): Interaction {
  return {
    type: InteractionType.MessageComponent,
    isChatInputCommand: () => false,
    isButton: () => true,
    componentType: ComponentType.Button,
    customId,
  } as unknown as Interaction;
}

function makeModalInteraction(customId: string): Interaction {
  return {
    type: InteractionType.ModalSubmit,
    isChatInputCommand: () => false,
    isButton: () => false,
    customId,
  } as unknown as Interaction;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetRegistry();
});

describe('registerCommand / routeInteraction', () => {
  it('routes a chat-input command to the registered handler', async () => {
    let called = false;
    const mod: CommandModule = {
      data: new SlashCommandBuilder().setName('ping').setDescription('Ping'),
      execute: (_interaction: ChatInputCommandInteraction): Promise<void> => {
        called = true;
        return Promise.resolve();
      },
    };
    registerCommand(mod);

    await routeInteraction(makeChatInputInteraction('ping'));
    expect(called).toBe(true);
  });

  it('ignores a command that has no registered handler', async () => {
    // No handler registered — should not throw
    await expect(routeInteraction(makeChatInputInteraction('unknown'))).resolves.toBeUndefined();
  });
});

describe('registerButton / routeInteraction (prefix matching)', () => {
  it('routes a button whose customId matches the registered prefix', async () => {
    let capturedId: string | undefined;
    const mod: ButtonModule = {
      prefix: 'accept:',
      execute: (interaction: ButtonInteraction): Promise<void> => {
        capturedId = interaction.customId;
        return Promise.resolve();
      },
    };
    registerButton(mod);

    await routeInteraction(makeButtonInteraction('accept:event-42'));
    expect(capturedId).toBe('accept:event-42');
  });

  it('routes a button whose customId is an exact match of the prefix', async () => {
    let called = false;
    const mod: ButtonModule = {
      prefix: 'exactmatch',
      execute: (_interaction: ButtonInteraction): Promise<void> => {
        called = true;
        return Promise.resolve();
      },
    };
    registerButton(mod);

    await routeInteraction(makeButtonInteraction('exactmatch'));
    expect(called).toBe(true);
  });

  it('does NOT route a button whose customId does not match any prefix', async () => {
    let called = false;
    const mod: ButtonModule = {
      prefix: 'accept:',
      execute: (_interaction: ButtonInteraction): Promise<void> => {
        called = true;
        return Promise.resolve();
      },
    };
    registerButton(mod);

    await routeInteraction(makeButtonInteraction('decline:event-42'));
    expect(called).toBe(false);
  });

  it('routes to the correct handler when multiple prefixes are registered', async () => {
    const hits: string[] = [];
    const modA: ButtonModule = {
      prefix: 'accept:',
      execute: (_i: ButtonInteraction): Promise<void> => { hits.push('accept'); return Promise.resolve(); },
    };
    const modB: ButtonModule = {
      prefix: 'decline:',
      execute: (_i: ButtonInteraction): Promise<void> => { hits.push('decline'); return Promise.resolve(); },
    };
    registerButton(modA);
    registerButton(modB);

    await routeInteraction(makeButtonInteraction('decline:event-99'));
    expect(hits).toEqual(['decline']);
  });
});

describe('registerModal / routeInteraction (prefix matching)', () => {
  it('routes a modal whose customId starts with the registered prefix', async () => {
    let called = false;
    const mod: ModalModule = {
      prefix: 'busy-modal:',
      execute: (_interaction: ModalSubmitInteraction): Promise<void> => {
        called = true;
        return Promise.resolve();
      },
    };
    registerModal(mod);

    await routeInteraction(makeModalInteraction('busy-modal:event-7'));
    expect(called).toBe(true);
  });

  it('does NOT route a modal with a non-matching customId', async () => {
    let called = false;
    const mod: ModalModule = {
      prefix: 'busy-modal:',
      execute: (_interaction: ModalSubmitInteraction): Promise<void> => {
        called = true;
        return Promise.resolve();
      },
    };
    registerModal(mod);

    await routeInteraction(makeModalInteraction('other-modal:event-7'));
    expect(called).toBe(false);
  });
});

describe('routeInteraction — error isolation', () => {
  it('catches errors thrown by handlers without propagating', async () => {
    const mod: CommandModule = {
      data: new SlashCommandBuilder().setName('boom').setDescription('Throws'),
      execute: (_interaction: ChatInputCommandInteraction): Promise<void> => {
        return Promise.reject(new Error('handler exploded'));
      },
    };
    registerCommand(mod);

    // Should resolve, not reject
    await expect(routeInteraction(makeChatInputInteraction('boom'))).resolves.toBeUndefined();
  });
});
