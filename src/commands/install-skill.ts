/**
 * Install/uninstall as Claude skill
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const SKILL_NAME = 'chrome-jig';

function getSkillsDir(): string {
  return join(homedir(), '.claude', 'skills');
}

function getSkillPath(): string {
  return join(getSkillsDir(), SKILL_NAME);
}

function getPackageRoot(): string {
  // Go up from dist/commands to package root
  return join(dirname(import.meta.url.replace('file://', '')), '..', '..');
}

export interface InstallResult {
  success: boolean;
  message: string;
  path?: string;
}

export function installSkill(): InstallResult {
  const skillsDir = getSkillsDir();
  const skillPath = getSkillPath();
  const packageRoot = getPackageRoot();

  // Create skills directory if needed
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  // Check if already installed
  if (existsSync(skillPath)) {
    try {
      const target = readlinkSync(skillPath);
      if (target === packageRoot) {
        return {
          success: true,
          message: 'Skill already installed',
          path: skillPath,
        };
      } else {
        return {
          success: false,
          message: `Skill exists but points to different location: ${target}`,
          path: skillPath,
        };
      }
    } catch {
      return {
        success: false,
        message: `${skillPath} exists but is not a symlink`,
      };
    }
  }

  // Create symlink
  try {
    symlinkSync(packageRoot, skillPath);
    return {
      success: true,
      message: 'Skill installed',
      path: skillPath,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to create symlink: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function uninstallSkill(): InstallResult {
  const skillPath = getSkillPath();

  if (!existsSync(skillPath)) {
    return {
      success: true,
      message: 'Skill not installed',
    };
  }

  try {
    unlinkSync(skillPath);
    return {
      success: true,
      message: 'Skill uninstalled',
      path: skillPath,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to remove symlink: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
