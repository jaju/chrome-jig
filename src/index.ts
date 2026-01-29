/**
 * Chrome Debug REPL - Library exports
 */

// Configuration
export { loadConfig, loadGlobalConfig, loadProjectConfig, findProjectConfig, resolveScriptUrl, getScriptEntry } from './config/loader.js';
export { getXDGPaths, getConfigPath, getChromeProfileDir, getSessionStatePath } from './config/xdg.js';
export type { GlobalConfig, ProjectConfig, ScriptEntry, ResolvedConfig } from './config/schema.js';

// Chrome
export { ChromeConnection, createConnection } from './chrome/connection.js';
export type { ChromeTarget, ConnectionOptions } from './chrome/connection.js';
export { launchChrome, findChrome, isProfileLocked, isPortInUse, getStatus, loadSessionState } from './chrome/launcher.js';
export type { LaunchOptions, LaunchResult } from './chrome/launcher.js';

// Commands
export { launch } from './commands/launch.js';
export { status } from './commands/status.js';
export { listTabs, selectTab } from './commands/tabs.js';
export { inject } from './commands/inject.js';
export { evaluate, formatValue } from './commands/eval.js';

// REPL
export { Repl } from './repl/repl.js';
export type { ReplOptions } from './repl/repl.js';

// Init & Skill
export { installSkill, uninstallSkill } from './commands/install-skill.js';
export { generateConfig, writeConfig, interactiveInit } from './commands/init.js';
