# Chrome Jig

A CLI tool for Chrome debugging with script injection, file watching, and Claude skill support.

## Why This Tool

chrome-jig is a CLI for Chrome debugging workflows: launch, inject scripts, evaluate JavaScript, watch files, and re-inject on change. It uses CDP (Chrome DevTools Protocol) underneath — the same protocol that Chrome MCP, Puppeteer, and other tools use.

**Where it helps over generic CDP tools**: Compound operations that would otherwise require multiple manual steps. A named script registry resolves short names to URLs via project config (`.cjig.json`). File watching detects changes and re-injects automatically. Idempotent launch reuses an existing Chrome instance instead of failing on port conflicts. These are workflow-level conveniences — they compose CDP primitives, they don't extend them.

**Where it doesn't help**: Single evaluations, screenshots, DOM inspection, network traces. Any CDP client can do these equally well. Chrome MCP's `evaluate_script` and this tool's `eval` both call `Runtime.evaluate` in the end.

**Independent developer workflow**: The CLI is usable without any LLM. `cjig launch && cjig inject my-script && cjig repl` is a complete development loop with no AI in the path.

## Installation

```bash
# From npm
npm install -g chrome-jig

# Or for development
git clone https://github.com/yourname/chrome-jig.git
cd chrome-jig
npm install
npm link
```

## Quick Start

```bash
# Launch Chrome with debugging enabled
cjig launch

# Start interactive REPL
cjig repl

# In REPL:
> document.title
"My Page"

> .tabs
→ [0] My Page
      https://example.com

> .inject my-harness
Injected: http://localhost:5173/harnesses/my-harness.js
```

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
cjig tabs              # List open tabs
cjig tab example       # Select tab by URL pattern
cjig tab 0             # Select tab by index
cjig open https://...  # Open new tab
```

### Script Injection

```bash
cjig inject my-script      # Inject by name (from config)
cjig inject https://...    # Inject by URL
```

### Evaluation

```bash
cjig eval "document.title"        # One-shot eval
cjig eval "window.myApi.status()" # Call injected API
cjig repl                         # Interactive REPL
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
    "preBuild": "npm run build:harnesses"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CJIG_PORT` | `9222` | CDP port |
| `CJIG_PROFILE` | `default` | Profile name |
| `CJIG_HOST` | `localhost` | Chrome host |
| `CHROME_PATH` | (auto-detect) | Chrome executable |

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
