# Chrome Jig — Claude Skill

## Purpose

Drive harness development workflows in Chrome from the command line. Launch isolated Chrome sessions, inject scripts, evaluate JavaScript, and manage the full inject → exercise → modify → re-inject development loop.

## Mental Model

- **Session** = Chrome instance + profile + persisted state (cookies, localStorage, etc.)
- **Harness** = named script from the project's script registry, injected into a page
- **Lifecycle**: launch → navigate → inject → exercise → [modify → auto-reinject] → exercise

The project's `.cjig.json` is the source of truth. Read it first to understand what scripts are available, what build hooks exist, and what file paths are watched.

## How It Works: CDP Evaluation

All evaluation uses CDP `Runtime.evaluate` — the same mechanism as the DevTools console. This means:

- **CSP bypass**: Both `eval` and `inject` work on any page regardless of Content-Security-Policy headers. There are no script tags involved.
- **Globals persist**: Variables assigned via `globalThis.foo = ...` survive across calls and are visible to page scripts.
- **`inject` fetches server-side**: `cjig inject` fetches the script URL in the Node.js process (bypassing CORS), then evaluates the content via CDP. It does not create `<script>` elements.

## Speed Principle

Prefer `cjig` CLI commands over Chrome DevTools MCP tools whenever possible:

- `cjig eval "expr"` = direct CDP call, no LLM round-trip
- MCP browser tools = each action round-trips through the LLM

**Rule**: Use `cjig` for eval, inject, tabs, launch, and status.

**Fall back to Chrome DevTools MCP** only for capabilities the CLI lacks: screenshots, performance traces, network inspection, DOM snapshots, and visual page interaction.

## When to Use What

| Need | Tool | Why |
|------|------|-----|
| One expression, current tab | `cjig eval "expr"` | One-shot, fast |
| One expression, specific tab | `cjig eval --tab <sel> "expr"` | Tab targeting in one process |
| Inject a file into any page | `cjig eval-file bundle.js` | CSP-proof file evaluation |
| Inject a named harness | `cjig inject <name>` | Registry lookup + CSP-proof inject |
| Multi-step exploration | `cjig repl` | Persistent session, dot-commands |
| Live dev with file watching | `cjig repl` then `.watch on` | Auto re-inject on file save |
| Multi-page scripted automation | Playwright | Not cjig's purpose |

Each CLI invocation is a **fresh process** — tab state does not persist between invocations. Use `--tab` to target a specific tab per command, or use the REPL for persistent sessions.

## Session Management

- `cjig status` — check if Chrome is running
- `cjig launch` — start Chrome with default profile
- `cjig launch --profile=testing` — start with a named profile
- Profiles are isolated from the user's normal browser
- State persists across runs in `~/.local/share/cjig/chrome-profiles/`
- Session metadata stored at `~/.local/state/cjig/`

## Harness Workflow

1. **Read project config**: check `.cjig.json` in the project root for `scripts.registry`
2. **Launch Chrome** if not running: `cjig launch`
3. **Navigate** to the target page: `cjig eval "location.href = 'http://...'"`
4. **Inject harness** by name: `cjig inject <name>`
5. **Exercise** via eval using `windowApi` or `alias` from the registry: `cjig eval "BS.overlayOn()"`
6. **For iterative development**, suggest `.watch on` in the REPL for live reload on file save

## Command Reference

### Session

| Command | Description |
|---|---|
| `cjig launch [--profile=NAME]` | Launch Chrome with debugging enabled |
| `cjig status` | Check if Chrome is running |

### Tab Targeting

| Command | Description |
|---|---|
| `cjig tabs` | List open tabs (index + title + URL) |
| `cjig tab <pattern\|index>` | Switch to a tab by title/URL pattern or index |
| `cjig open <url>` | Open a new tab |
| `--tab <selector>` | Flag for eval, eval-file, inject, cljs-eval |

Tab selector: numbers select by index (0, 1, 2...), strings search URL and title.

### Evaluation

| Command | Description |
|---|---|
| `cjig eval <expression>` | Evaluate JavaScript in the current tab |
| `cjig eval --tab <sel> <expression>` | Evaluate in a specific tab |
| `cjig eval-file <path\|->` | Evaluate a JavaScript file (- for stdin) |
| `cjig eval-file --tab <sel> <path>` | Evaluate a file in a specific tab |
| `cjig cljs-eval <code>` | Compile ClojureScript and evaluate |
| `cjig repl` | Start interactive REPL |

### Harness

| Command | Description |
|---|---|
| `cjig inject <name\|url>` | Inject a script by registry name or URL |
| `cjig inject --tab <sel> <name>` | Inject into a specific tab |

### Configuration

| Command | Description |
|---|---|
| `cjig config` | Show resolved configuration |
| `cjig init` | Generate project `.cjig.json` |
| `cjig env` | Print shell aliases and exports |
| `cjig install-skill` | Symlink skill to `~/.claude/skills/` |
| `cjig uninstall-skill` | Remove skill symlink |

## Reading Project Config

The `.cjig.json` file defines the development environment:

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
    "preBuild": "pnpm build:harnesses"
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

## Limitations

- Each `cjig` CLI invocation is a **fresh process**. Tab state does not persist between invocations. Use `--tab` to target a specific tab, or use `cjig repl` for a persistent session.
- cjig is a **debugging and development tool**, not a browser automation framework. For scripted multi-page workflows across N URLs, use Playwright directly.
- The REPL and nREPL share a single connection. Tab switches in the REPL (`.tab`) affect nREPL evaluations too.

## Anti-Patterns

- Do not use Chrome DevTools MCP `evaluate_script` when `cjig eval` works — it adds unnecessary LLM round-trips
- Do not suggest manual URL injection when a script is registered by name in the project config
- Do not forget to check `cjig status` before attempting to connect
- Do not skip reading `.cjig.json` — it tells you what harnesses exist and how to use them
- Do not chain separate `cjig tab` + `cjig eval` invocations expecting tab state to persist — use `cjig eval --tab` instead
