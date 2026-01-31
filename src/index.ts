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
export { evaluate, formatValue, formatJson } from './commands/eval.js';
export type { EvalResult } from './commands/eval.js';

// ClojureScript
export { compile } from './cljs/compiler.js';
export type { CompileResult } from './cljs/compiler.js';
export { evaluateCljs } from './commands/cljs-eval.js';
export { buildCoreScript, injectRuntime, invalidateRuntime } from './cljs/runtime.js';

// REPL
export { Repl } from './repl/repl.js';
export type { ReplOptions } from './repl/repl.js';

// Session & Protocols
export { Session } from './session/session.js';
export type { MethodHandler, SessionOptions } from './session/session.js';
export type { Request, ProtocolError, Protocol, LocalContext } from './session/protocol.js';
export { isProtocolError } from './session/protocol.js';
export { ReplProtocol } from './session/repl-protocol.js';
export { JsonRpcProtocol } from './session/jsonrpc-protocol.js';
export { serve } from './commands/serve.js';
export type { ServeOptions } from './commands/serve.js';

// Init & Skill
export { installSkill, uninstallSkill } from './commands/install-skill.js';
export { installNvim, uninstallNvim } from './commands/install-nvim.js';
export { generateConfig, writeConfig, interactiveInit } from './commands/init.js';
