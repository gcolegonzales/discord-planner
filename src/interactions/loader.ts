/**
 * Directory-scan loader for interaction handler modules.
 *
 * Scans src/interactions/commands/, buttons/, and modals/ at startup and
 * registers every handler it finds. Works under both `tsx` (dev, .ts files)
 * and `node dist/` (prod, .js files) by deriving the directory from
 * __dirname (the compiled module's location).
 *
 * Rules:
 * - Skips index files, .d.ts files, .map files, and .gitkeep.
 * - Tolerates empty directories without crashing.
 * - Each file must export `command`, `button`, or `modal` with the shape
 *   documented in router.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerCommand, registerButton, registerModal } from './router';
import type { CommandModule, ButtonModule, ModalModule } from './router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the list of handler file base-names in a directory (tolerates missing dir). */
function listHandlerFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => {
    // Skip non-files (subdirs, etc.)
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) return false;
    // Skip index, type-only, declaration, map, and gitkeep files
    if (file === 'index.ts' || file === 'index.js') return false;
    if (file.endsWith('.d.ts') || file.endsWith('.d.js')) return false;
    if (file.endsWith('.js.map') || file.endsWith('.ts.map')) return false;
    if (file === '.gitkeep') return false;
    // Only pick up .ts and .js files
    return file.endsWith('.ts') || file.endsWith('.js');
  });
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isCommandModule(val: unknown): val is { command: CommandModule } {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  const cmd = obj['command'];
  if (typeof cmd !== 'object' || cmd === null) return false;
  const c = cmd as Record<string, unknown>;
  return typeof c['data'] !== 'undefined' && typeof c['execute'] === 'function';
}

function isButtonModule(val: unknown): val is { button: ButtonModule } {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  const btn = obj['button'];
  if (typeof btn !== 'object' || btn === null) return false;
  const b = btn as Record<string, unknown>;
  return typeof b['prefix'] === 'string' && typeof b['execute'] === 'function';
}

function isModalModule(val: unknown): val is { modal: ModalModule } {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  const mod = obj['modal'];
  if (typeof mod !== 'object' || mod === null) return false;
  const m = mod as Record<string, unknown>;
  return typeof m['prefix'] === 'string' && typeof m['execute'] === 'function';
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load all handler modules from the commands/, buttons/, and modals/
 * sub-directories relative to `baseDir` (default: __dirname of loader.ts).
 *
 * Returns counts so callers can log what was found.
 */
export async function loadHandlers(
  baseDir: string = __dirname,
): Promise<{ commands: number; buttons: number; modals: number }> {
  const counts = { commands: 0, buttons: 0, modals: 0 };

  // --- commands ---
  const commandsDir = path.join(baseDir, 'commands');
  for (const file of listHandlerFiles(commandsDir)) {
    const fullPath = path.join(commandsDir, file);
    const mod: unknown = await import(fullPath);
    if (isCommandModule(mod)) {
      registerCommand(mod.command);
      counts.commands++;
    } else {
      console.warn(`[loader] ${file} in commands/ does not export a valid CommandModule — skipped`);
    }
  }

  // --- buttons ---
  const buttonsDir = path.join(baseDir, 'buttons');
  for (const file of listHandlerFiles(buttonsDir)) {
    const fullPath = path.join(buttonsDir, file);
    const mod: unknown = await import(fullPath);
    if (isButtonModule(mod)) {
      registerButton(mod.button);
      counts.buttons++;
    } else {
      console.warn(`[loader] ${file} in buttons/ does not export a valid ButtonModule — skipped`);
    }
  }

  // --- modals ---
  const modalsDir = path.join(baseDir, 'modals');
  for (const file of listHandlerFiles(modalsDir)) {
    const fullPath = path.join(modalsDir, file);
    const mod: unknown = await import(fullPath);
    if (isModalModule(mod)) {
      registerModal(mod.modal);
      counts.modals++;
    } else {
      console.warn(`[loader] ${file} in modals/ does not export a valid ModalModule — skipped`);
    }
  }

  return counts;
}
