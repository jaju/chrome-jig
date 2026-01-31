/**
 * Chrome process launcher and management
 */

import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { platform } from 'node:os';
import { getChromeProfileDir, getSessionStatePath } from '../config/xdg.js';
import { DEFAULT_CHROME_FLAGS } from '../config/schema.js';

export interface LaunchOptions {
  port: number;
  profile: string;
  chromePath?: string;
  chromeFlags?: string[];
  url?: string;
}

export interface LaunchResult {
  success: boolean;
  message: string;
  pid?: number;
  port?: number;
  profile?: string;
}

interface SessionState {
  pid?: number;
  port: number;
  profile: string;
  startedAt: string;
}

/**
 * Find Chrome executable on the system
 */
export function findChrome(): string | null {
  const os = platform();

  const candidates: string[] = [];

  if (os === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
    );
  } else if (os === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  } else if (os === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';

    candidates.push(
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Check if a profile directory is locked by another Chrome instance
 */
export function isProfileLocked(profileDir: string): boolean {

  // Check for lock files
  const lockFiles = [
    join(profileDir, 'SingletonLock'),      // Linux
    join(profileDir, 'lockfile'),            // macOS
    join(profileDir, 'Lock'),                // Windows
  ];

  // Also check for running chrome with this profile via socket
  const singletonSocket = join(profileDir, 'SingletonSocket');

  for (const lockFile of [...lockFiles, singletonSocket]) {
    if (existsSync(lockFile)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if Chrome is already running on the specified port
 */
export async function isPortInUse(port: number, host: string = 'localhost'): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Save session state for later recovery
 */
function saveSessionState(state: SessionState): void {
  const statePath = getSessionStatePath();
  const stateDir = dirname(statePath);

  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Load session state
 */
export function loadSessionState(): SessionState | null {
  const statePath = getSessionStatePath();

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return null;
  }
}

/**
 * Launch Chrome with debugging enabled
 */
export async function launchChrome(options: LaunchOptions): Promise<LaunchResult> {
  const { port, profile, chromeFlags = DEFAULT_CHROME_FLAGS, url } = options;

  // Find Chrome executable
  const chromePath = options.chromePath ?? findChrome();

  if (!chromePath) {
    return {
      success: false,
      message: 'Chrome not found. Set CHROME_PATH or configure chrome.path in config.',
    };
  }

  if (!existsSync(chromePath)) {
    return {
      success: false,
      message: `Chrome executable not found at: ${chromePath}`,
    };
  }

  // If Chrome is already running on this port, report success
  if (await isPortInUse(port)) {
    const session = loadSessionState();
    return {
      success: true,
      message: `Chrome already running on port ${port}`,
      pid: session?.pid,
      port,
      profile: session?.profile ?? profile,
    };
  }

  // Get profile directory
  const profileDir = getChromeProfileDir(profile);

  // Check if profile is locked
  if (isProfileLocked(profileDir)) {
    return {
      success: false,
      message: `Profile "${profile}" is locked by another Chrome instance.`,
    };
  }

  // Create profile directory if needed
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  // Build Chrome arguments
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...chromeFlags,
  ];

  if (url) {
    args.push(url);
  }

  // Spawn Chrome with clean environment
  const child: ChildProcess = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
    env: {
      // Minimal environment to avoid inheriting problematic vars
      HOME: process.env['HOME'],
      PATH: process.env['PATH'],
      DISPLAY: process.env['DISPLAY'], // For Linux X11
      WAYLAND_DISPLAY: process.env['WAYLAND_DISPLAY'], // For Linux Wayland
    },
  });

  // Detach from parent process
  child.unref();

  // Wait briefly for Chrome to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify Chrome is running
  const running = await isPortInUse(port);

  if (!running) {
    return {
      success: false,
      message: 'Chrome started but debugging endpoint not responding. It may need more time to start.',
    };
  }

  // Save session state
  saveSessionState({
    pid: child.pid,
    port,
    profile,
    startedAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Chrome launched on port ${port} with profile "${profile}"`,
    pid: child.pid,
    port,
    profile,
  };
}

/**
 * Get status of Chrome debugging endpoint
 */
export async function getStatus(
  host: string = 'localhost',
  port: number = 9222
): Promise<{ running: boolean; version?: Record<string, string>; session?: SessionState }> {
  const session = loadSessionState();

  try {
    const response = await fetch(`http://${host}:${port}/json/version`);
    if (!response.ok) {
      return { running: false, session: session ?? undefined };
    }

    const version = (await response.json()) as Record<string, string>;
    return { running: true, version, session: session ?? undefined };
  } catch {
    return { running: false, session: session ?? undefined };
  }
}
