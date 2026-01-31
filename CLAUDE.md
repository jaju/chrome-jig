# Chrome Jig - Agent Context

A CLI tool for Chrome debugging with CDP (Chrome DevTools Protocol), script injection, file watching, and Claude skill support.

## Project Identity

- **Name**: chrome-jig
- **Purpose**: Enable browser debugging, script injection, and live JavaScript evaluation from the command line
- **Origin**: Extracted from KlipCeeper to serve as a standalone development tool for testing harnesses in browser contexts

## Quick Start

```bash
# Build
npm run build

# Test locally (after npm link)
cjig launch           # Start Chrome with debugging
cjig tabs             # List open tabs
cjig eval "document.title"  # One-shot JavaScript evaluation
cjig repl             # Interactive REPL

# Development
npm run dev -- <command>      # Run without building (via tsx)
npm run typecheck             # TypeScript validation
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
| Config | `~/.config/cjig/` | `config.json`, named profiles |
| Data | `~/.local/share/cjig/` | Chrome user-data directories |
| State | `~/.local/state/cjig/` | Session state (PID, port, profile) |

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
npm run build                 # Compile TypeScript
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
cjig install-skill    # Create symlink to ~/.claude/skills/
cjig uninstall-skill  # Remove symlink
```

The skill provides Claude with commands for browser debugging. See `SKILL.md` for usage instructions Claude sees.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CJIG_PORT` | `9222` | CDP port |
| `CJIG_HOST` | `localhost` | Chrome host |
| `CJIG_PROFILE` | `default` | Profile name |
| `CHROME_PATH` | (auto-detect) | Chrome executable |
| `CJIG_SCRIPTS_BASE` | (from config) | Script base URL |

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
# Beads Workflow Context

> **Context Recovery**: Run `bd prime` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when .beads/ detected

# 🚨 SESSION CLOSE PROTOCOL 🚨

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

```
[ ] bd sync --flush-only    (export beads to JSONL only)
```

**Note:** No git remote configured. Issues are saved locally only.

## Core Rules
- Track strategic work in beads (multi-session, dependencies, discovered work)
- Use `bd create` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer bd—persistence you don't need beats lost context
- Git workflow: local-only (no git remote)
- Session management: check `bd ready` for available work

## Essential Commands

### Finding Work
- `bd ready` - Show issues ready to work (no blockers)
- `bd list --status=open` - All open issues
- `bd list --status=in_progress` - Your active work
- `bd show <id>` - Detailed issue view with dependencies

### Creating & Updating
- `bd create --title="..." --type=task|bug|feature --priority=2` - New issue
  - Priority: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog). NOT "high"/"medium"/"low"
- `bd update <id> --status=in_progress` - Claim work
- `bd update <id> --assignee=username` - Assign to someone
- `bd update <id> --title/--description/--notes/--design` - Update fields inline
- `bd close <id>` - Mark complete
- `bd close <id1> <id2> ...` - Close multiple issues at once (more efficient)
- `bd close <id> --reason="explanation"` - Close with reason
- **Tip**: When creating multiple issues/tasks/epics, use parallel subagents for efficiency
- **WARNING**: Do NOT use `bd edit` - it opens $EDITOR (vim/nano) which blocks agents

### Dependencies & Blocking
- `bd dep add <issue> <depends-on>` - Add dependency (issue depends on depends-on)
- `bd blocked` - Show all blocked issues
- `bd show <id>` - See what's blocking/blocked by this issue

### Sync & Collaboration
- `bd sync --flush-only` - Export to JSONL

### Project Health
- `bd stats` - Project statistics (open/closed/blocked counts)
- `bd doctor` - Check for issues (sync problems, missing hooks)

## Common Workflows

**Starting work:**
```bash
bd ready           # Find available work
bd show <id>       # Review issue details
bd update <id> --status=in_progress  # Claim it
```

**Completing work:**
```bash
bd close <id1> <id2> ...    # Close all completed issues at once
bd sync --flush-only        # Export to JSONL
```

**Creating dependent work:**
```bash
# Run bd create commands in parallel (use subagents for many items)
bd create --title="Implement feature X" --type=feature
bd create --title="Write tests for X" --type=task
bd dep add beads-yyy beads-xxx  # Tests depend on Feature (Feature blocks tests)
```
