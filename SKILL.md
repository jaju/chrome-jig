# Chrome Debug REPL — Claude Skill

## Purpose

Drive harness development workflows in Chrome from the command line. This skill lets you launch isolated Chrome sessions, inject named scripts, evaluate JavaScript, and manage the full inject → exercise → modify → re-inject development loop.

## Mental Model

- **Session** = Chrome instance + profile + persisted state (cookies, localStorage, etc.)
- **Harness** = named script from the project's script registry, injected into a page
- **Lifecycle**: launch → navigate → inject → exercise → [modify → auto-reinject] → exercise

The project's `.chrome-debug.json` is the source of truth. Read it first to understand what scripts are available, what build hooks exist, and what file paths are watched.

## Speed Principle

Prefer `chrome-debug` CLI commands over Chrome DevTools MCP tools whenever possible:

- `chrome-debug eval "expr"` = direct, instant, no LLM round-trip
- MCP browser tools = each action round-trips through the LLM

**Rule**: Use `chrome-debug` for eval, inject, tabs, launch, and status.

**Fall back to Chrome DevTools MCP** only for capabilities the CLI lacks: screenshots, performance traces, network inspection, DOM snapshots, and visual page interaction.

## Session Management

- `chrome-debug status` — check if Chrome is running
- `chrome-debug launch` — start Chrome with default profile
- `chrome-debug launch --profile=testing` — start with a named profile
- Profiles are isolated from the user's normal browser
- State persists across runs in `~/.local/share/chrome-debug-repl/chrome-profiles/`
- Session metadata stored at `~/.local/state/chrome-debug-repl/`

## Harness Workflow

1. **Read project config**: check `.chrome-debug.json` in the project root for `scripts.registry`
2. **Launch Chrome** if not running: `chrome-debug launch`
3. **Navigate** to the target page: `chrome-debug eval "location.href = 'http://...'"`
4. **Inject harness** by name: `chrome-debug inject <name>`
5. **Exercise** via eval using `windowApi` or `alias` from the registry: `chrome-debug eval "BS.overlayOn()"`
6. **For iterative development**, suggest `.watch on` in the REPL for live reload on file save

## Command Reference

### Session

| Command | Description |
|---|---|
| `chrome-debug launch [--profile=NAME]` | Launch Chrome with debugging enabled |
| `chrome-debug status` | Check if Chrome is running |

### Navigation

| Command | Description |
|---|---|
| `chrome-debug tabs` | List open tabs |
| `chrome-debug tab <pattern\|index>` | Switch to a tab |
| `chrome-debug open <url>` | Open a new tab |

### Harness

| Command | Description |
|---|---|
| `chrome-debug inject <name\|url>` | Inject a script by registry name or URL |
| `chrome-debug eval <expression>` | Evaluate JavaScript in the current tab |
| `chrome-debug repl` | Start interactive REPL |

### Configuration

| Command | Description |
|---|---|
| `chrome-debug config` | Show resolved configuration |
| `chrome-debug init` | Generate project `.chrome-debug.json` |
| `chrome-debug env` | Print shell aliases and exports |
| `chrome-debug install-skill` | Symlink skill to `~/.claude/skills/` |
| `chrome-debug uninstall-skill` | Remove skill symlink |

## Reading Project Config

The `.chrome-debug.json` file defines the development environment:

```json
{
  "scripts": {
    "baseUrl": "http://localhost:5173/harnesses/",
    "registry": {
      "bs": {
        "path": "block-segmenter-harness.js",
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

Key fields:

- `scripts.registry[name].path` — script filename, resolved against `scripts.baseUrl`
- `scripts.registry[name].windowApi` — the global object the script exposes (e.g., `window.BlockSegmenter`)
- `scripts.registry[name].alias` — short name for the API (e.g., `BS`)
- `scripts.registry[name].quickStart` — example expression to try after injection
- `watch.paths` — glob patterns for auto-reinject on file change
- `hooks.preBuild` — build command run before injection

## When to Suggest REPL vs eval

- **REPL** (`chrome-debug repl`): when the user needs interactive exploration, or wants `.watch on` for live reload during development
- **eval** (`chrome-debug eval "..."`): for automated actions — fast, scriptable, one-shot
- REPL dot-commands (`.inject`, `.watch`, `.tabs`, `.build`, `.reload`) are for human interactive use

## Anti-Patterns

- Do not use Chrome DevTools MCP `evaluate_script` when `chrome-debug eval` works — it adds unnecessary LLM round-trips
- Do not suggest manual URL injection when a script is registered by name in the project config
- Do not forget to check `chrome-debug status` before attempting to connect
- Do not skip reading `.chrome-debug.json` — it tells you what harnesses exist and how to use them
