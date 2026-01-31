# Chrome Jig - Architecture

Technical architecture documentation for the chrome-jig project.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CLI                                     │
│                         (src/cli.ts)                                │
│   Parses arguments, routes to commands, loads configuration         │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Config Loader                                  │
│                   (src/config/loader.ts)                            │
│   Discovers configs, merges with precedence, resolves scripts       │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ChromeConnection                                 │
│                (src/chrome/connection.ts)                           │
│   CDP wrapper via Playwright, page management, script injection     │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome                                       │
│                   (Chrome DevTools Protocol)                        │
│   Browser with remote debugging enabled on configured port          │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

| Module | Path | Responsibility |
|--------|------|----------------|
| CLI | `src/cli.ts` | Argument parsing via `node:util parseArgs`, command dispatch |
| Connection | `src/chrome/connection.ts` | CDP wrapper using `playwright-core` |
| Launcher | `src/chrome/launcher.ts` | Chrome process spawning, profile management |
| Config Schema | `src/config/schema.ts` | TypeScript interfaces for all config types |
| Config Loader | `src/config/loader.ts` | Discovery, loading, merging, script resolution |
| XDG Paths | `src/config/xdg.ts` | XDG Base Directory path helpers |
| REPL | `src/repl/repl.ts` | Interactive shell engine, file watching |
| REPL Commands | `src/repl/commands.ts` | Dot-command implementations |
| Completer | `src/repl/completer.ts` | Tab completion for REPL |
| Commands | `src/commands/*.ts` | Individual CLI command implementations |

## ChromeConnection Class

### Lifecycle

```
                    ┌─────────────────┐
                    │   createConnection()   │
                    │   (factory function)   │
                    └──────────┬──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ChromeConnection                                │
│                                                                      │
│  State: browser=null, context=null, currentPage=null                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ connect()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Connected State                                 │
│                                                                      │
│  browser = chromium.connectOverCDP(endpoint)                        │
│  context = browser.contexts()[0]                                    │
│  currentPage = context.pages()[0]                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ selectPage() / selectPageByIndex()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Page Selected                                   │
│                                                                      │
│  evaluate(expression)  →  CDP evaluation                            │
│  injectScript(url)     →  browser fetch + eval via CDP             │
│  reload()              →  page.reload()                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ disconnect()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Disconnected                                    │
│                                                                      │
│  CDP session detached, browser closed (not killed)                  │
│  Chrome continues running independently                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Methods

| Method | Description |
|--------|-------------|
| `isRunning()` | Ping `/json/version` endpoint |
| `connect()` | Establish CDP connection via Playwright |
| `disconnect()` | Detach session, close connection (not browser) |
| `getPages()` | List all pages in context |
| `selectPage(pattern)` | Select page by URL substring match |
| `selectPageByIndex(n)` | Select page by numeric index |
| `evaluate<T>(expr)` | Run JavaScript, return result |
| `injectScript(url)` | Fetch + eval script in browser via CDP main world |
| `getCDPSession()` | Get raw CDP session for advanced ops |

## Configuration System

### Schema Definitions

```typescript
// Global config: ~/.config/chrome-jig/config.json
interface GlobalConfig {
  defaults?: {
    port?: number;
    profile?: string;
    host?: string;
  };
  chrome?: {
    path?: string;
    flags?: string[];
  };
}

// Project config: .cjig.json
interface ProjectConfig {
  scripts?: {
    baseUrl?: string;
    registry?: Record<string, ScriptEntry>;
  };
  watch?: {
    paths?: string[];
    debounce?: number;
  };
  hooks?: {
    preBuild?: string;
    postInject?: string;
  };
}

// Merged result used at runtime
interface ResolvedConfig {
  port: number;
  profile: string;
  host: string;
  chromePath?: string;
  chromeFlags: string[];
  scripts: {
    baseUrl?: string;
    registry: Record<string, ScriptEntry>;
  };
  watch: {
    paths: string[];
    debounce: number;
  };
  hooks: {
    preBuild?: string;
    postInject?: string;
  };
}
```

### Discovery Algorithm

```
findProjectConfig(cwd):
  dir = cwd
  while dir != root:
    for name in ['.cjig.json', 'cjig.json', '.cjig.config.json']:
      if exists(dir/name):
        return dir/name
    dir = parent(dir)
  return null
```

### Merge Strategy

```
loadConfig(cliOptions):
  global  = loadJsonFile(~/.config/chrome-jig/config.json)
  project = findProjectConfig() → loadJsonFile()
  env     = resolveEnvConfig()

  return {
    port:        cliOptions.port    ?? env.port           // CLI > env
    profile:     cliOptions.profile ?? env.profile        // CLI > env
    host:        cliOptions.host    ?? env.host           // CLI > env
    chromePath:  env.chromePath     ?? global.chrome.path // env > global
    chromeFlags: global.chrome.flags ?? DEFAULT_FLAGS     // global > defaults
    scripts:     project.scripts    ?? { registry: {} }   // project only
    watch:       project.watch      ?? { paths: [] }      // project only
    hooks:       project.hooks      ?? {}                 // project only
  }
```

### Script URL Resolution

```
resolveScriptUrl(ref, config):
  if ref starts with 'http://' or 'https://' or 'file://':
    return ref  // Already a URL

  entry = registry[ref] ?? findByAlias(ref)
  if !entry:
    return null

  if entry.path is URL:
    return entry.path

  if config.scripts.baseUrl:
    return baseUrl + entry.path

  return entry.path  // Relative to cwd
```

## REPL Architecture

### Command Routing

```
handleLine(line):
  if line starts with '.':
    cmdName = extract command name
    args    = extract arguments

    command = findCommand(cmdName)  // by name or alias
    if command:
      command.execute(args, context)
    else:
      print "Unknown command"
  else:
    evaluateJs(line)  // Send to browser
```

### CommandContext Interface

```typescript
interface CommandContext {
  connection: ChromeConnection;    // CDP connection
  config: ResolvedConfig;          // Current configuration
  print: (msg: string) => void;    // Output function
  setWatching: (on: boolean) => void;  // Toggle file watcher
  isWatching: () => boolean;       // Query watcher state
  runPreBuild: () => Promise<void>; // Execute preBuild hook
  exit: () => void;                // Terminate REPL
}
```

### File Watching Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REPL                                         │
│                                                                      │
│  lastInjectRef = "bs"    ◄── Set by .inject command                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  │ .watch on
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Chokidar                                      │
│                                                                      │
│  watch(config.watch.paths)                                          │
│  ignoreInitial: true                                                │
│  awaitWriteFinish: { stabilityThreshold: debounce }                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  │ 'change' event
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   handleFileChange(path)                            │
│                                                                      │
│  if lastInjectRef && path matches:                                  │
│    url = resolveScriptUrl(lastInjectRef)                            │
│    connection.injectScript(url)                                     │
│    print "[watch] Re-injected: ..."                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## XDG Directory Layout

```
~/.config/chrome-jig/          # XDG_CONFIG_HOME/chrome-jig
├── config.json                       # Global configuration
└── profiles/                         # Named config profiles (future)

~/.local/share/chrome-jig/     # XDG_DATA_HOME/chrome-jig
└── chrome-profiles/                  # Chrome user-data directories
    ├── default/                      # Default profile
    └── testing/                      # Named profiles

~/.local/state/chrome-jig/     # XDG_STATE_HOME/chrome-jig
└── last-session.json                 # Session state (PID, port, profile)
```

### Purpose of Each Directory

| Directory | XDG Type | Contents | Persistence |
|-----------|----------|----------|-------------|
| config | CONFIG_HOME | User settings, defaults | Long-term |
| data | DATA_HOME | Chrome profiles, browsing data | Long-term |
| state | STATE_HOME | Session info, last-used values | Ephemeral |
| cache | CACHE_HOME | (unused) | Disposable |

## Skill Installation Mechanism

### Directory Structure

```
~/.claude/
└── skills/
    └── chrome-jig → /path/to/package  (symlink)
        ├── SKILL.md      # Instructions Claude reads
        ├── README.md     # Additional context
        └── package.json  # Package metadata
```

### Installation Flow

```
installSkill():
  skillsDir = ~/.claude/skills
  skillPath = skillsDir/chrome-jig
  packageRoot = path to package (from import.meta.url)

  if !exists(skillsDir):
    mkdir -p skillsDir

  if exists(skillPath):
    if isSymlink(skillPath) && readlink(skillPath) == packageRoot:
      return "already installed"
    else:
      return "exists but different"

  symlink(packageRoot → skillPath)
  return "installed"
```

### What Claude Sees

1. **SKILL.md**: Primary instructions with commands and examples
2. **README.md**: Additional context about the tool
3. Package exports (not directly used, but available)

## Data Flow Diagrams

### Launch Flow

```
CLI: cjig launch --profile=testing
           │
           ▼
    ┌──────────────┐
    │ loadConfig() │
    └──────┬───────┘
           │ profile="testing", port=9222
           ▼
    ┌──────────────────────────┐
    │ launch(config, options)  │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ findChrome()                         │
    │ isPortInUse(9222) → false            │
    │ isProfileLocked(profile) → false     │
    └──────────┬───────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ spawn(chrome, [                      │
    │   --remote-debugging-port=9222,      │
    │   --user-data-dir=...profiles/testing│
    │ ])                                   │
    └──────────┬───────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ saveSessionState({                   │
    │   pid, port, profile, startedAt      │
    │ })                                   │
    └──────────┬───────────────────────────┘
               │
               ▼
           Output: ✓ Chrome launched on port 9222
```

### Eval Flow

```
CLI: cjig eval "document.title"
           │
           ▼
    ┌──────────────┐
    │ loadConfig() │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ createConnection({ host, port })     │
    │ connection.connect()                 │
    └──────────┬───────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ evaluate(connection, expression)     │
    │   ↓                                  │
    │ connection.evaluate(expression)      │
    │   ↓                                  │
    │ page.evaluate(wrappedExpression)     │
    │   ↓                                  │
    │ CDP Runtime.evaluate                 │
    └──────────┬───────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ formatValue(result)                  │
    │ connection.disconnect()              │
    └──────────┬───────────────────────────┘
               │
               ▼
           Output: "Page Title"
```

### Inject Flow

```
CLI: cjig inject bs
           │
           ▼
    ┌──────────────┐
    │ loadConfig() │ → scripts.registry["bs"]
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ resolveScriptUrl("bs", config)       │
    │                                      │
    │ baseUrl + entry.path                 │
    │ → http://localhost:5173/harnesses/   │
    │   block-segmenter-harness.js         │
    └──────────┬───────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ connection.injectScript(url)         │
    │   ↓                                  │
    │ CDP Runtime.evaluate:                │
    │   fetch(url) → text → (0,eval)(text) │
    └──────────┬───────────────────────────┘
               │
               ▼
           Output: ✓ Injected: http://...
                   API: window.BlockSegmenter
                   Try: BS.overlayOn()
```

### Watch Flow (REPL)

```
REPL: .inject bs
REPL: .watch on
           │
           ▼
    ┌──────────────────────────────────────┐
    │ lastInjectRef = "bs"                 │
    │ setWatching(true)                    │
    │   ↓                                  │
    │ chokidar.watch(config.watch.paths)   │
    └──────────┬───────────────────────────┘
               │
               │ File change detected
               ▼
    ┌──────────────────────────────────────┐
    │ handleFileChange(path)               │
    │   ↓                                  │
    │ if path includes "bs":               │
    │   url = resolveScriptUrl("bs")       │
    │   connection.injectScript(url)       │
    └──────────┬───────────────────────────┘
               │
               ▼
           Output: [watch] File changed: dist/...
                   [watch] Re-injected: bs
```

## Extension Points

### Adding CLI Commands

1. Create `src/commands/your-command.ts`:
   ```typescript
   import { ResolvedConfig } from '../config/schema.js';

   export interface YourResult {
     success: boolean;
     message: string;
   }

   export async function yourCommand(config: ResolvedConfig): Promise<YourResult> {
     // Implementation
   }
   ```

2. Add to CLI routing in `src/cli.ts`:
   ```typescript
   import { yourCommand } from './commands/your-command.js';

   // In switch statement:
   case 'your-command': {
     const result = await yourCommand(config);
     // Handle result
     break;
   }
   ```

3. Export from `src/index.ts` if needed for library use.

### Adding REPL Commands

Add to `commands` array in `src/repl/commands.ts`:

```typescript
{
  name: 'yourcommand',
  aliases: ['yc'],
  description: 'Does something useful',
  usage: '<arg>',
  async execute(args, ctx) {
    const arg = args.trim();
    // Use ctx.connection, ctx.config, ctx.print(), etc.
  },
}
```

### Adding Config Adapters

For integration with external registries (like KlipCeeper harness-registry):

1. Create `src/config/adapters/your-adapter.ts`
2. Export a function that returns `ProjectConfig`
3. Integrate in `loadConfig()` if needed

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `playwright-core` | ^1.58.0 | CDP client without browser downloads |
| `chokidar` | ^5.0.0 | File watching with debounce |

### Why playwright-core

- **Not raw WebSocket**: Handles connection lifecycle, reconnection, protocol details
- **Not full Playwright**: No browser downloads (450MB+ avoided)
- **Stable API**: Well-maintained, version-locked to Chrome CDP protocol
- **Page abstractions**: Natural mapping to tabs, contexts

### Why chokidar

- **Not fs.watch**: Cross-platform, handles edge cases
- **awaitWriteFinish**: Debounces rapid file system events
- **Glob support**: Watches patterns like `dist/*.js`

## Chrome Flags

Default flags for debugging sessions:

```typescript
const DEFAULT_CHROME_FLAGS = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];
```

These prevent Chrome from throttling JavaScript execution when tabs are backgrounded, which is essential for debugging.

## Development Notes

### CDP Execution Model and Script Injection

Scripts are injected via CDP `Runtime.evaluate`. Understanding why requires knowing how CDP, Playwright, and CSP interact.

**CDP `Runtime.evaluate`** runs JavaScript directly in a page's V8 context via the debugger. Its `allowUnsafeEvalBlockedByCSP` parameter defaults to `true`, so CSP's `unsafe-eval` restriction does not apply. This is true for any CDP client — our CLI, Chrome MCP, Puppeteer, or a raw WebSocket connection. There is no special capability here.

**Why `addScriptTag` fails under CSP**: Playwright's `page.addScriptTag({ url })` and `page.addScriptTag({ content })` create DOM `<script>` elements. CSP's `script-src` directive governs DOM script elements, so pages that restrict `script-src` (including `chrome://` pages) block these injections. This is a Playwright API choice — it uses the DOM path rather than CDP evaluation.

**Why `page.evaluate()` loses globals**: Playwright runs `page.evaluate()` in an isolated world, similar to a browser extension's content script. Variables assigned there are invisible to the page's main world. Our `evaluateInMainWorld` helper uses a raw CDPSession to call `Runtime.evaluate` directly, which executes in the page's main world where `window.*` assignments are visible to page scripts and the DevTools console.

**MCP equivalence**: Chrome MCP's `evaluate_script` tool uses CDP `Runtime.evaluate` in the main world. It has the same capabilities as our `evaluateInMainWorld`. The difference between this CLI and Chrome MCP is operational — bundled workflows (registry lookup + fetch + inject as one command, file watch + auto re-inject) versus individual primitives — not in what the underlying protocol can do.

**In-browser fetch**: `injectScript(url)` fetches the script URL inside the browser via a CDP-evaluated `fetch()` call, then executes the content with indirect eval `(0, eval)(t)` to ensure globals land in the page's main world scope rather than the callback's closure scope.

### Idempotent Launch

`cjig launch` checks whether Chrome is already listening on the configured port. If so, it returns success and reuses the existing instance rather than failing with a "port in use" error. This makes `launch` safe to call unconditionally — scripts and workflows don't need to check `status` first.

### Dogfooding Setup

The `examples/` directory and `.cjig.json` at the project root provide a self-contained loop for exercising the full workflow:

```bash
# Terminal 1: serve example scripts over HTTP
npm run serve:examples        # npx serve examples -p 3333 -C

# Terminal 2: the development loop
cjig launch
cjig inject fancy-demo
cjig eval "FX.burst(50)"
```

The `fancy-demo` harness is a particle-system overlay chosen because visual changes (colors, sizes, speeds) are immediately obvious — ideal for demonstrating the re-inject feedback loop. The script is idempotent: on re-injection it tears down the previous instance before rebuilding.

### Build vs Source

The global `cjig` command (installed via `npm link`) loads `dist/cli.js`. You must run `npm run build` after source changes for the global command to pick them up. Use `npm run dev -- <cmd>` during development to run directly from TypeScript source via `tsx`.
