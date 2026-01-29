# Chrome Debug REPL - Agent Context

A CLI tool for Chrome debugging with CDP (Chrome DevTools Protocol), script injection, file watching, and Claude skill support.

## Project Identity

- **Name**: chrome-debug-repl
- **Purpose**: Enable browser debugging, script injection, and live JavaScript evaluation from the command line
- **Origin**: Extracted from KlipCeeper to serve as a standalone development tool for testing harnesses in browser contexts
- **Location**: `~/github/chrome-debug-repl`

## Quick Start

```bash
# Build
npm run build

# Test locally (after npm link)
chrome-debug launch           # Start Chrome with debugging
chrome-debug tabs             # List open tabs
chrome-debug eval "document.title"  # One-shot JavaScript evaluation
chrome-debug repl             # Interactive REPL

# Development
npm run dev -- <command>      # Run without building (via tsx)
npm run typecheck             # TypeScript validation
```

## Project Structure

```
chrome-debug-repl/
├── bin/
│   └── chrome-debug.js       # CLI entry shim (loads dist/cli.js)
├── src/
│   ├── cli.ts                # Command-line argument parsing & routing
│   ├── index.ts              # Library exports for programmatic use
│   ├── chrome/
│   │   ├── connection.ts     # CDP wrapper via Playwright
│   │   └── launcher.ts       # Chrome process management
│   ├── config/
│   │   ├── loader.ts         # Config discovery & merging
│   │   ├── schema.ts         # TypeScript type definitions
│   │   └── xdg.ts            # XDG Base Directory paths
│   ├── commands/
│   │   ├── eval.ts           # JavaScript evaluation
│   │   ├── inject.ts         # Script injection
│   │   ├── init.ts           # Project config generation
│   │   ├── install-skill.ts  # Claude skill installation
│   │   ├── launch.ts         # Chrome launcher command
│   │   ├── status.ts         # Chrome status check
│   │   └── tabs.ts           # Tab listing/selection
│   ├── repl/
│   │   ├── repl.ts           # Interactive REPL engine
│   │   ├── commands.ts       # Dot-command implementations
│   │   └── completer.ts      # Tab completion
│   └── utils/
│       └── env.ts            # Environment variable handling
├── dist/                     # Build output (gitignored)
├── SKILL.md                  # Claude skill instructions
├── README.md                 # User documentation
└── package.json
```

## Core Concepts

### CDP Connection via Playwright

Uses `playwright-core` (not the full Playwright) as a high-level CDP client. This provides:
- Stable WebSocket connection management
- Page/context abstractions
- Script injection via `addScriptTag`
- Robust error handling

The `ChromeConnection` class (`src/chrome/connection.ts`) wraps Playwright's `chromium.connectOverCDP()`.

### XDG Directory Layout

Follows XDG Base Directory Specification for clean file organization:

| Purpose | Path | Contents |
|---------|------|----------|
| Config | `~/.config/chrome-debug-repl/` | `config.json`, named profiles |
| Data | `~/.local/share/chrome-debug-repl/` | Chrome user-data directories |
| State | `~/.local/state/chrome-debug-repl/` | Session state (PID, port, profile) |

### Configuration Hierarchy

Priority (highest to lowest):
1. CLI flags (`--port`, `--host`, `--profile`)
2. Environment variables (`CHROME_DEBUG_PORT`, etc.)
3. Project config (`.chrome-debug.json` in cwd or parents)
4. Global config (`~/.config/chrome-debug-repl/config.json`)
5. Built-in defaults

### Script Registry

Project config defines injectable scripts:

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
  }
}
```

Inject by name: `chrome-debug inject bs`

### REPL Dot Commands

The REPL uses dot-prefix for commands (`.tabs`, `.inject`, `.watch`) and evaluates everything else as JavaScript in the browser.

## Development Workflow

### Adding a CLI Command

1. Create `src/commands/your-command.ts`
2. Export the command function
3. Add case to switch in `src/cli.ts`
4. Re-export from `src/index.ts` if needed for library use

### Adding a REPL Command

1. Add command object to `commands` array in `src/repl/commands.ts`
2. Define `name`, `aliases`, `description`, `usage`, and `execute` function
3. Update completer if command takes arguments (`src/repl/completer.ts`)

### Testing Changes

```bash
npm run build                 # Compile TypeScript
chrome-debug status           # Test the command
chrome-debug repl             # Interactive testing
```

## Key Design Decisions

### Why Playwright-Core

- Provides stable, well-tested CDP abstractions
- Handles WebSocket connection lifecycle
- Page/context model maps naturally to Chrome tabs
- Minimal dependency (no browser downloads)

### Why XDG Paths

- Standard Linux convention that works on macOS too
- Separates config (editable), data (persistent), state (ephemeral)
- Chrome profiles isolated from user's normal browser

### Why Symlink for Skill

Claude skills are discovered from `~/.claude/skills/`. A symlink allows:
- Development iteration without reinstalling
- Multiple Claude instances share the same skill
- `SKILL.md` and `README.md` are always current

### Script Registry Pattern

Named scripts allow:
- Short commands (`inject bs` vs full URL)
- Metadata (windowApi, quickStart hints)
- File watching knows what to re-inject

## Conventions & Rules

### TypeScript

- Strict mode enabled
- ESM modules only (`"type": "module"` in package.json)
- Node.js built-ins via `node:` prefix (`node:fs`, `node:path`)
- Types exported from `src/index.ts` for library consumers

### Output Formatting

- Success: `✓ message`
- Failure: `✗ message`
- Structured output uses consistent indentation
- REPL prompt: `> `

### Error Handling

- Commands return result objects with `success` boolean
- CLI exits with code 1 on failure
- REPL catches errors and continues

## Integration Points

### KlipCeeper Harness Registry

When used with KlipCeeper, project config typically points to harness URLs:

```json
{
  "scripts": {
    "baseUrl": "http://localhost:5173/harnesses/",
    "registry": { ... }
  }
}
```

### Claude Skill Installation

```bash
chrome-debug install-skill    # Create symlink to ~/.claude/skills/
chrome-debug uninstall-skill  # Remove symlink
```

The skill provides Claude with commands for browser debugging. See `SKILL.md` for usage instructions Claude sees.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHROME_DEBUG_PORT` | `9222` | CDP port |
| `CHROME_DEBUG_HOST` | `localhost` | Chrome host |
| `CHROME_DEBUG_PROFILE` | `default` | Profile name |
| `CHROME_PATH` | (auto-detect) | Chrome executable |
| `CHROME_SCRIPTS_BASE` | (from config) | Script base URL |

## Verification Commands

```bash
# Check Chrome status
chrome-debug status

# List tabs
chrome-debug tabs

# Evaluate JavaScript
chrome-debug eval "document.title"

# Check skill symlink
ls -la ~/.claude/skills/chrome-debug-repl
```
