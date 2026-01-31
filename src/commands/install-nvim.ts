/**
 * Install/uninstall Neovim plugin via stable symlink.
 *
 * Creates a symlink at $XDG_DATA_HOME/cjig/editors/nvim pointing to the
 * editor/nvim directory inside the installed package. Users configure
 * Neovim to use this stable path — it survives nvm switches and upgrades.
 *
 * `cjig install-nvim`   — create/update symlink, print setup snippets
 * `cjig uninstall-nvim`  — remove symlink
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getXDGPaths } from '../config/xdg.js';

/** Check if path exists as a symlink (including dangling ones). */
function symlinkExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function getEditorsDir(): string {
  return join(getXDGPaths().data, 'editors');
}

function getSymlinkPath(): string {
  return join(getEditorsDir(), 'nvim');
}

function getPluginSource(): string {
  // Go up from dist/commands to package root, then into editor/nvim
  const distCommands = dirname(import.meta.url.replace('file://', ''));
  return realpathSync(join(distCommands, '..', '..', 'editor', 'nvim'));
}

export interface InstallResult {
  success: boolean;
  message: string;
  symlinkPath?: string;
  sourcePath?: string;
}

export function installNvim(): InstallResult {
  const editorsDir = getEditorsDir();
  const symlinkPath = getSymlinkPath();
  const sourcePath = getPluginSource();

  if (!existsSync(join(sourcePath, 'lua', 'cjig', 'init.lua'))) {
    return {
      success: false,
      message: `Plugin source not found at ${sourcePath}`,
    };
  }

  // Create editors directory if needed
  if (!existsSync(editorsDir)) {
    mkdirSync(editorsDir, { recursive: true });
  }

  // Check existing symlink (including dangling)
  if (symlinkExists(symlinkPath)) {
    try {
      const target = readlinkSync(symlinkPath);
      if (target === sourcePath) {
        return {
          success: true,
          message: 'Already installed',
          symlinkPath,
          sourcePath,
        };
      }
      // Update stale symlink
      unlinkSync(symlinkPath);
    } catch {
      // Not a symlink — remove and recreate
      unlinkSync(symlinkPath);
    }
  }

  try {
    symlinkSync(sourcePath, symlinkPath);
    return {
      success: true,
      message: 'Installed',
      symlinkPath,
      sourcePath,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to create symlink: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function uninstallNvim(): InstallResult {
  const symlinkPath = getSymlinkPath();

  try {
    if (!lstatSync(symlinkPath).isSymbolicLink()) {
      return {
        success: false,
        message: `${symlinkPath} exists but is not a symlink — not removing`,
      };
    }
  } catch {
    return {
      success: true,
      message: 'Not installed',
    };
  }

  try {
    unlinkSync(symlinkPath);
    return {
      success: true,
      message: 'Uninstalled',
      symlinkPath,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to remove symlink: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Print setup instructions for the user's Neovim config. */
export function printSetupSnippets(symlinkPath: string): void {
  console.log(`\n  Add to your Neovim config (one-time):\n`);

  console.log(`  lazy.nvim — lua/plugins/cjig.lua:`);
  console.log(`    return { dir = "${symlinkPath}" }\n`);

  console.log(`  packer:`);
  console.log(`    use { "${symlinkPath}" }\n`);

  console.log(`  manual — init.lua:`);
  console.log(`    vim.opt.runtimepath:prepend("${symlinkPath}")`);
  console.log(`    require("cjig").setup()\n`);
}
