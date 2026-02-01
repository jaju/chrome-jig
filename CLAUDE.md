# Chrome Jig - Agent Context

A CLI tool for Chrome debugging with CDP (Chrome DevTools Protocol), script injection, file watching, and Claude skill support.

## Project Identity

- **Name**: chrome-jig
- **Purpose**: Enable browser debugging, script injection, and live JavaScript evaluation from the command line
- **Origin**: Extracted from KlipCeeper to serve as a standalone development tool for testing harnesses in browser contexts

## Quick Start

```bash
# Build
pnpm build

# Test locally (after pnpm link --global)
cjig launch           # Start Chrome with debugging
cjig tabs             # List open tabs
cjig eval "document.title"  # One-shot JavaScript evaluation
cjig repl             # Interactive REPL
cjig serve --stdio    # JSON-RPC 2.0 server over stdio
cjig nrepl            # nREPL server for editor integration

# Development
pnpm dev -- <command>         # Run without building (via tsx)
pnpm typecheck                # TypeScript validation
```

## Project Structure

```
chrome-jig/
├── bin/
│   └── cjig.js               # CLI entry shim (loads dist/cli.js)
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
│   │   ├── cljs-eval.ts      # ClojureScript evaluation (compile + eval)
│   │   ├── inject.ts         # Script injection
│   │   ├── init.ts           # Project config generation
│   │   ├── install-skill.ts  # Claude skill installation
│   │   ├── launch.ts         # Chrome launcher command
│   │   ├── nrepl.ts          # nREPL server command
│   │   ├── serve.ts          # JSON-RPC serve command
│   │   ├── status.ts         # Chrome status check
│   │   └── tabs.ts           # Tab listing/selection
│   ├── cljs/
│   │   ├── compiler.ts       # squint-cljs compilation
│   │   └── runtime.ts        # Squint core runtime injection
│   ├── session/
│   │   ├── protocol.ts       # Protocol interface & types
│   │   ├── session.ts        # Shared session core (method dispatch)
│   │   ├── repl-protocol.ts  # REPL protocol adapter
│   │   └── jsonrpc-protocol.ts # JSON-RPC 2.0 adapter
│   ├── nrepl/
│   │   ├── types.ts          # nREPL protocol types
│   │   ├── ops.ts            # Op handlers (clone, close, describe, eval)
│   │   ├── server.ts         # TCP server with bencode framing
│   │   └── README.md         # Rationale, research context, limitations
│   ├── repl/
│   │   ├── repl.ts           # Interactive REPL (thin shell over Session)
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
- CDP session management for `Runtime.evaluate`
- Robust error handling

The `ChromeConnection` class (`src/chrome/connection.ts`) wraps Playwright's `chromium.connectOverCDP()`.

### XDG Directory Layout

Follows XDG Base Directory Specification for clean file organization:

| Purpose | Path                   | Contents                           |
| ------- | ---------------------- | ---------------------------------- |
| Config  | `~/.config/cjig/`      | `config.json`, named profiles      |
| Data    | `~/.local/share/cjig/` | Chrome user-data directories       |
| State   | `~/.local/state/cjig/` | Session state (PID, port, profile) |

### Configuration Hierarchy

Priority (highest to lowest):

1. CLI flags (`--port`, `--host`, `--profile`)
2. Environment variables (`CJIG_PORT`, etc.)
3. Project config (`.cjig.json` in cwd or parents)
4. Global config (`~/.config/cjig/config.json`)
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

Inject by name: `cjig inject bs`

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
pnpm build                    # Compile TypeScript
cjig status                   # Test the command
cjig repl                     # Interactive testing
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

### Package Manager

- This project uses **pnpm** for dependency management and scripts. Do not use `npm install` or `npm run`.
- Exception: use `npm link` for global CLI registration (pnpm's global bin doesn't respect nvm).

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

### nREPL for Editor Integration

`cjig nrepl` starts a TCP nREPL server (bencode over TCP) so editors like Conjure (Neovim) can evaluate ClojureScript in the browser natively. The server is a thin adapter — its only interaction with cjig core is calling `evaluateCljs()`. See [`src/nrepl/README.md`](src/nrepl/README.md) for design rationale, research context, and known limitations.

### Claude Skill Installation

```bash
cjig install-skill    # Create symlink to ~/.claude/skills/
cjig uninstall-skill  # Remove symlink
```

The skill provides Claude with commands for browser debugging. See `SKILL.md` for usage instructions Claude sees.

## Environment Variables

| Variable            | Default       | Description       |
| ------------------- | ------------- | ----------------- |
| `CJIG_PORT`         | `9222`        | CDP port          |
| `CJIG_HOST`         | `localhost`   | Chrome host       |
| `CJIG_PROFILE`      | `default`     | Profile name      |
| `CHROME_PATH`       | (auto-detect) | Chrome executable |
| `CJIG_SCRIPTS_BASE` | (from config) | Script base URL   |

## Verification Commands

```bash
# Check Chrome status
cjig status

# List tabs
cjig tabs

# Evaluate JavaScript
cjig eval "document.title"

# Check skill symlink
ls -la ~/.claude/skills/chrome-jig
```

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.
**Quick reference:**

- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)  
  For full workflow details: `bd prime`
