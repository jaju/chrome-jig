# Chrome Jig

The DevTools console, from your terminal and editor.

## Why This Tool

**Evaluate JavaScript in any browser tab from the command line.** Everything runs via CDP `Runtime.evaluate` — the same mechanism as the DevTools console. This bypasses Content-Security-Policy on any page. Globals persist across calls. No script tags, no CORS issues.

**Named script injection with auto-reload.** Register scripts in `.cjig.json`, inject by name, watch files for changes, auto re-inject. The modify → re-inject → exercise loop without leaving your editor.

**Chrome lifecycle management.** Launch Chrome with isolated profiles, load unpacked extensions, attach to running instances. `cjig connection-info` exports connection details so Playwright scripts (or MCP browser tools) can connect to the same Chrome.

**Editor-native via nREPL.** Evaluate ClojureScript from Neovim/Conjure buffers directly in the browser. No browser tab switching, no copy-paste.

**Independent developer workflow.** The CLI is usable without any LLM. `cjig launch && cjig inject my-script && cjig repl` is a complete development loop with no AI in the path.

## Installation

```bash
# From npm registry
pnpm add -g chrome-jig

# Or for development
git clone https://github.com/yourname/chrome-jig.git
cd chrome-jig
pnpm install
npm link          # uses nvm's bin directory
```

## Quick Start

```bash
# Launch Chrome with debugging enabled
cjig launch

# Evaluate JavaScript
cjig eval "document.title"

# Target a specific tab
cjig eval --tab "GitHub" "document.title"

# Evaluate a file (bypasses CSP on any page)
cjig eval-file bundle.js

# Start interactive REPL
cjig repl
```

## Working with MCP Tools

cjig and MCP browser tools complement each other — both connect to Chrome via CDP on the same port.

**cjig manages Chrome, MCP provides automation:**

```bash
# cjig launches Chrome with extensions and a debug port
cjig launch --extensions ./my-extension/dist

# Playwright MCP connects to the same Chrome
# In your MCP client config:
```

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--cdp-endpoint", "http://localhost:9222"]
    }
  }
}
```

**If MCP already launched Chrome**, attach to it:

```bash
cjig attach --port 9222
cjig eval "document.title"    # Now cjig commands work against MCP's Chrome
```

**Export connection info** for scripts:

```bash
cjig connection-info --json
# {"host":"localhost","port":9222,"endpoint":"http://localhost:9222","webSocketDebuggerUrl":"ws://...","source":"launched","profile":"default"}
```

## How It Works

All evaluation uses CDP `Runtime.evaluate` in the page's **main world** — the same context as the DevTools console:

- `cjig eval` evaluates an expression via CDP. Bypasses CSP.
- `cjig inject` fetches the script URL **server-side** (in the Node.js process), then evaluates the content via CDP. Bypasses both CSP and CORS.
- `cjig eval-file` reads a local file and evaluates its contents via CDP. Bypasses CSP.

Each CLI invocation is a **fresh process**. Tab state does not persist between invocations. Use `--tab` to target a specific tab in one shot, or use `cjig repl` for a persistent session.

## CLI Commands

### Chrome Management

```bash
cjig launch                           # Launch with default profile
cjig launch --profile=testing         # Named profile
cjig launch --extensions /path/to/ext # Load unpacked extension
cjig attach --port 9333               # Attach to running Chrome
cjig status                           # Check if Chrome is running
cjig connection-info                  # Show connection details
cjig connection-info --json           # JSON output for scripts
```

### Tab Operations

```bash
cjig tabs                          # List open tabs (index + title + URL)
cjig tab "GitHub"                  # Select by title or URL fragment
cjig tab 2                         # Select by index
cjig open https://example.com      # Open new tab
cjig open --timeout 60000 https://heavy-page.com  # Custom timeout
cjig open --wait-until domcontentloaded https://example.com
cjig open --no-wait https://slow-page.com          # Fire-and-forget
```

Tab selector: numbers are positional indices, strings search URL and title.

### Script Injection

```bash
cjig inject my-script              # Inject by name (from config)
cjig inject --tab "app" my-script  # Inject into specific tab
cjig inject https://...            # Inject by URL
```

### Evaluation

```bash
cjig eval "document.title"                # One-shot eval
cjig eval --tab "GitHub" "document.title" # Eval in specific tab
cjig eval "window.myApi.status()"         # Call injected API
cjig eval-file bundle.js                  # Evaluate a file
cjig eval-file --tab 2 bundle.js          # File eval in specific tab
cat script.js | cjig eval-file -          # Pipe from stdin
cjig cljs-eval "(+ 1 2)"                  # Evaluate ClojureScript
cjig repl                                 # Interactive REPL
```

### nREPL Server (Editor Integration)

```bash
cjig nrepl                         # Start server, auto-assign port
cjig nrepl --nrepl-port 7888       # Specific port
```

Starts a TCP nREPL server for native editor integration. ClojureScript forms are compiled via squint and evaluated in the browser over CDP.

Editors discover the port via `.nrepl-port` written to the current directory.

- **Conjure (Neovim)**: Connects automatically. Evaluate CLJS forms in your buffer with standard Conjure keybindings.
- **CIDER (Emacs)**: Not yet supported — CIDER's handshake expects richer metadata than we currently provide.

The REPL and nREPL share a single connection. Tab switches in the REPL (`.tab`) take effect for nREPL evaluations too — no reconnection needed.

### Profiles

```bash
cjig profiles list                                # List known profiles
cjig profiles create myext --extensions /path/ext  # Create profile with extensions
cjig launch --profile=myext                        # Launch with profile config
```

Profile configs live at `~/.config/cjig/profiles/<name>.json` and remember extensions, flags, and default URL. Login sessions persist across launches in the profile's Chrome user-data directory.

### Extension Loading

```bash
# Via CLI flag
cjig launch --extensions /path/to/unpacked-extension

# Via project config (.cjig.json)
{
  "extensions": ["/path/to/unpacked-extension"]
}

# Via profile config
cjig profiles create dev --extensions /path/to/ext
cjig launch --profile=dev
```

Extensions from CLI flags, project config, profile config, and global config are merged (deduplicated by path).

## Connecting from Playwright Scripts

```js
import { getConnectionInfo } from 'chrome-jig';
import { chromium } from 'playwright';

const { info } = await getConnectionInfo('localhost', 9222);
const browser = await chromium.connectOverCDP(info.endpoint);
// Now use Playwright's full API against cjig-managed Chrome
```

## REPL Commands

```
> expression              Evaluate JavaScript in browser

.help                     Show available commands
.tabs                     List open tabs
.tab <pattern|index>      Switch to tab
.open <url>               Open new tab
.inject <name|url>        Inject script
.reload                   Reload current tab
.watch [on|off]           Toggle file watching
.build                    Run preBuild hook
.config                   Show current config
.clear                    Clear console
.exit                     Exit REPL
```

## Configuration

### Global Config (`~/.config/cjig/config.json`)

```json
{
  "defaults": {
    "port": 9222,
    "profile": "default"
  },
  "chrome": {
    "path": "/path/to/chrome",
    "flags": ["--disable-background-timer-throttling"]
  },
  "extensions": ["/path/to/global-extension"],
  "connection": {
    "retries": 3,
    "retryDelayMs": 500,
    "fallbackHosts": ["127.0.0.1"]
  }
}
```

### Project Config (`.cjig.json`)

```json
{
  "scripts": {
    "baseUrl": "http://localhost:5173/harnesses/",
    "registry": {
      "bs": {
        "path": "block-segmenter-harness.js",
        "label": "Block Segmenter",
        "windowApi": "BlockSegmenter",
        "alias": "BS",
        "quickStart": "BS.overlayOn()"
      }
    }
  },
  "extensions": ["/path/to/project-extension"],
  "watch": {
    "paths": ["dist/harnesses/*.js"],
    "debounce": 300
  },
  "hooks": {
    "preBuild": "pnpm build:harnesses"
  }
}
```

### Profile Config (`~/.config/cjig/profiles/<name>.json`)

```json
{
  "extensions": ["/path/to/extension"],
  "flags": ["--auto-open-devtools-for-tabs"],
  "url": "http://localhost:3000"
}
```

Extension merge priority: CLI flags > project config > profile config > global config.

### Connection Settings

Connection resilience settings can be configured at any level (global, project, or CLI flags):

```json
{
  "connection": {
    "retries": 3,
    "retryDelayMs": 500,
    "timeout": 30000,
    "waitUntil": "domcontentloaded",
    "fallbackHosts": ["127.0.0.1"]
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `retries` | `3` | Number of connection retry attempts |
| `retryDelayMs` | `500` | Initial delay between retries (doubles each attempt) |
| `timeout` | (Playwright default) | Navigation timeout in ms for `open` |
| `waitUntil` | `load` | Navigation strategy: `load`, `domcontentloaded`, `networkidle` |
| `fallbackHosts` | `[]` | Additional hosts to try on connect failure (e.g. `["127.0.0.1"]` for IPv6/IPv4 issues) |

CLI flags `--retries`, `--retry-delay`, `--timeout`, `--wait-until`, and `--no-wait` override config values.

## Error Handling

cjig uses typed exit codes for machine-parseable error handling:

| Exit Code | Category | Retryable | Meaning |
|-----------|----------|-----------|---------|
| 0 | — | — | Success |
| 1 | — | — | Unknown error |
| 2 | `connection` | yes | Cannot connect to Chrome |
| 3 | `timeout` | yes | Navigation timed out |
| 4 | `no-page` | no | No page/tab available |
| 5 | `evaluation` | no | JavaScript evaluation error |

With `--json`, errors are emitted as structured JSON on stderr:

```bash
cjig eval --json --port 9999 "1+1"
# stderr: {"error":"Failed to connect...","category":"connection","retryable":true,"exitCode":2}
```

## Environment Variables

| Variable       | Default       | Description       |
| -------------- | ------------- | ----------------- |
| `CJIG_PORT`    | `9222`        | CDP port          |
| `CJIG_PROFILE` | `default`     | Profile name      |
| `CJIG_HOST`    | `localhost`   | Chrome host       |
| `CHROME_PATH`  | (auto-detect) | Chrome executable |

## Shell Setup

```bash
cjig env >> ~/.zshrc
source ~/.zshrc
```

This adds:

- `cjr` - alias for `cjig repl`
- `cjl` - alias for `cjig launch`
- `cjt` - alias for `cjig tabs`

## Use as Claude Skill

```bash
cjig install-skill    # Symlinks this package to ~/.claude/skills/chrome-jig
cjig uninstall-skill  # Removes the symlink
```

Then Claude can use it via the SKILL.md instructions.

## Directory Layout (XDG)

```
~/.config/cjig/
├── config.json           # Global config
└── profiles/             # Named profile configs
    └── myext.json

~/.local/share/cjig/
└── chrome-profiles/      # Chrome user-data dirs
    ├── default/
    └── myext/

~/.local/state/cjig/
└── last-session.json     # Session state
```

## Development

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical internals — module structure, data flow diagrams, CDP execution model, and design decisions.

## License

MIT
