# Chrome Debug REPL

A CLI tool for Chrome debugging with script injection, file watching, and Claude skill support.

## Why This Tool

chrome-debug-repl is a **harness development workflow tool**, not a generic CDP client. It manages the inject → exercise → modify → re-inject loop that no other tool handles.

| Capability | chrome-debug-repl | Chrome DevTools MCP | cdp-cli | chrome-remote-interface |
|---|---|---|---|---|
| Named script registry | Yes | No | No | No |
| File watch + auto re-inject | Yes | No | No | No |
| Project config hierarchy | Yes | No | No | No |
| Chrome profile management | Yes | No | No | No |
| Interactive REPL with dot-commands | Yes | No | No | Basic |
| One-shot eval | Yes | Via LLM loop | Yes | Yes |
| Pre-build hooks | Yes | No | No | No |
| Claude skill integration | Yes | N/A (is MCP) | No | No |
| LLM-free (direct CLI) | Yes | No (requires LLM) | Yes | Yes |

Every other CDP tool treats browser interaction as isolated commands. chrome-debug-repl treats it as a *development session* — your project config defines named scripts, your file watcher re-injects on save, your build hooks run automatically, and your Chrome profile persists state across runs.

## Installation

```bash
# From npm
npm install -g chrome-debug-repl

# Or for development
git clone https://github.com/yourname/chrome-debug-repl.git
cd chrome-debug-repl
npm install
npm link
```

## Quick Start

```bash
# Launch Chrome with debugging enabled
chrome-debug launch

# Start interactive REPL
chrome-debug repl

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
chrome-debug launch                    # Launch with default profile
chrome-debug launch --profile=testing  # Named profile
chrome-debug status                    # Check if Chrome is running
chrome-debug status --host=192.168.1.5 # Check remote Chrome
```

### Tab Operations

```bash
chrome-debug tabs              # List open tabs
chrome-debug tab example       # Select tab by URL pattern
chrome-debug tab 0             # Select tab by index
chrome-debug open https://...  # Open new tab
```

### Script Injection

```bash
chrome-debug inject my-script      # Inject by name (from config)
chrome-debug inject https://...    # Inject by URL
```

### Evaluation

```bash
chrome-debug eval "document.title"        # One-shot eval
chrome-debug eval "window.myApi.status()" # Call injected API
chrome-debug repl                         # Interactive REPL
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

### Global Config (`~/.config/chrome-debug-repl/config.json`)

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

### Project Config (`.chrome-debug.json`)

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
| `CHROME_DEBUG_PORT` | `9222` | CDP port |
| `CHROME_DEBUG_PROFILE` | `default` | Profile name |
| `CHROME_DEBUG_HOST` | `localhost` | Chrome host |
| `CHROME_PATH` | (auto-detect) | Chrome executable |

## Shell Setup

```bash
chrome-debug env >> ~/.zshrc
source ~/.zshrc
```

This adds:
- `cdr` - alias for `chrome-debug repl`
- `cdl` - alias for `chrome-debug launch`
- `cdt` - alias for `chrome-debug tabs`

## Use as Claude Skill

```bash
# Symlink to Claude skills directory
ln -s $(npm root -g)/chrome-debug-repl ~/.claude/skills/chrome-debug-repl
```

Then Claude can use it via the SKILL.md instructions.

## Directory Layout (XDG)

```
~/.config/chrome-debug-repl/
├── config.json           # Global config
└── profiles/             # Named config profiles

~/.local/share/chrome-debug-repl/
└── chrome-profiles/      # Chrome user-data dirs
    └── default/

~/.local/state/chrome-debug-repl/
└── last-session.json     # Session state
```

## Development

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical internals — module structure, data flow diagrams, CSP bypass strategy, and design decisions.

## License

MIT
