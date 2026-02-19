# Chrome Jig

The DevTools console, from your terminal and editor.

## Why This Tool

**Evaluate JavaScript in any browser tab from the command line.** Everything runs via CDP `Runtime.evaluate` — the same mechanism as the DevTools console. This bypasses Content-Security-Policy on any page. Globals persist across calls. No script tags, no CORS issues.

**Named script injection with auto-reload.** Register scripts in `.cjig.json`, inject by name, watch files for changes, auto re-inject. The modify → re-inject → exercise loop without leaving your editor.

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

## How It Works

All evaluation uses CDP `Runtime.evaluate` in the page's **main world** — the same context as the DevTools console:

- `cjig eval` evaluates an expression via CDP. Bypasses CSP.
- `cjig inject` fetches the script URL **server-side** (in the Node.js process), then evaluates the content via CDP. Bypasses both CSP and CORS.
- `cjig eval-file` reads a local file and evaluates its contents via CDP. Bypasses CSP.

Each CLI invocation is a **fresh process**. Tab state does not persist between invocations. Use `--tab` to target a specific tab in one shot, or use `cjig repl` for a persistent session.

## CLI Commands

### Chrome Management

```bash
cjig launch                    # Launch with default profile
cjig launch --profile=testing  # Named profile
cjig status                    # Check if Chrome is running
cjig status --host=192.168.1.5 # Check remote Chrome
```

### Tab Operations

```bash
cjig tabs                          # List open tabs (index + title + URL)
cjig tab "GitHub"                  # Select by title or URL fragment
cjig tab 2                         # Select by index
cjig open https://example.com      # Open new tab
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
  "watch": {
    "paths": ["dist/harnesses/*.js"],
    "debounce": 300
  },
  "hooks": {
    "preBuild": "pnpm build:harnesses"
  }
}
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
└── profiles/             # Named config profiles

~/.local/share/cjig/
└── chrome-profiles/      # Chrome user-data dirs
    └── default/

~/.local/state/cjig/
└── last-session.json     # Session state
```

## Development

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical internals — module structure, data flow diagrams, CDP execution model, and design decisions.

## License

MIT
