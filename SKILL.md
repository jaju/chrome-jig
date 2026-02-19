# Chrome Jig — Claude Skill

## What Chrome Jig Is

CSP-proof JavaScript evaluation and injection CLI. Interactive browser debugging. Chrome lifecycle manager (profiles, extensions, sessions).

## What Chrome Jig Is NOT

Not a browser automation framework. Not a Playwright replacement. For scripted navigation, screenshots, DOM assertions, multi-page workflows — use Playwright directly.

## The Handoff Model

- cjig manages Chrome (launch, profiles, extensions, attach)
- cjig provides CSP-proof eval/injection (Runtime.evaluate via CDP)
- Playwright provides automation (connectOverCDP to cjig's Chrome)
- `cjig connection-info` bridges the two

## When to Use cjig vs Playwright

| Task | Use | Why |
|------|-----|-----|
| Eval JS on a page you don't own (CSP) | `cjig eval` | CDP Runtime.evaluate bypasses CSP |
| Inject a library into a live page | `cjig inject` | Server-side fetch + CDP eval, bypasses CSP and CORS |
| Evaluate a file on any page | `cjig eval-file` | CSP-proof file evaluation |
| Interactive browser debugging | `cjig repl` | Persistent session, dot-commands |
| Launch Chrome with extensions | `cjig launch --extensions` | Managed profiles, separate user-data-dir |
| Connect to MCP browser Chrome | `cjig attach` | Records session state for other cjig commands |
| Get connection details for Playwright | `cjig connection-info` | JSON output with endpoint and wsUrl |
| Scripted multi-page automation | Playwright directly | Not cjig's purpose |
| Screenshots, assertions, DOM queries | Playwright directly | Playwright's native strengths |
| Extension service worker testing | Playwright `launchPersistentContext` | Requires Target.attachToTarget |

## Before Using cjig for Automation

If your task involves scripted navigation, clicking, form filling, or multi-step browser automation: skip cjig and use Playwright directly. cjig's value is in what Playwright can't easily do from the outside (CSP bypass, script registry, interactive REPL).

## How It Works: CDP Evaluation

All evaluation uses CDP `Runtime.evaluate` in the page's **main world** — the same context as the DevTools console:

- **CSP bypass**: Both `eval` and `inject` work on any page regardless of Content-Security-Policy headers. No script tags involved.
- **Globals persist**: Variables assigned via `globalThis.foo = ...` survive across calls and are visible to page scripts.
- **`inject` fetches server-side**: `cjig inject` fetches the script URL in the Node.js process (bypassing CORS), then evaluates the content via CDP.

## Speed Principle

Prefer `cjig` CLI commands over Chrome DevTools MCP tools whenever possible:

- `cjig eval "expr"` = direct CDP call, no LLM round-trip
- MCP browser tools = each action round-trips through the LLM

**Rule**: Use `cjig` for eval, inject, tabs, launch, and status.

**Fall back to Chrome DevTools MCP** only for capabilities the CLI lacks: screenshots, performance traces, network inspection, DOM snapshots, and visual page interaction.

## Session Management

| Command | Description |
|---|---|
| `cjig launch` | Launch Chrome with default profile |
| `cjig launch --profile=NAME` | Launch with named profile |
| `cjig launch --extensions /path/to/ext` | Launch with unpacked extension |
| `cjig attach --port 9333` | Attach to already-running Chrome |
| `cjig status` | Check if Chrome is running |
| `cjig connection-info` | Export connection info as JSON |
| `cjig connection-info --json` | Machine-readable JSON output |

## Tab Targeting

| Command | Description |
|---|---|
| `cjig tabs` | List open tabs (index + title + URL) |
| `cjig tab <pattern\|index>` | Switch to a tab by title/URL pattern or index |
| `cjig open <url>` | Open a new tab |
| `--tab <selector>` | Flag for eval, eval-file, inject, cljs-eval |

Tab selector: numbers select by index (0, 1, 2...), strings search URL and title.

## Evaluation

| Command | Description |
|---|---|
| `cjig eval <expression>` | Evaluate JavaScript in the current tab |
| `cjig eval --tab <sel> <expression>` | Evaluate in a specific tab |
| `cjig eval-file <path\|->` | Evaluate a JavaScript file (- for stdin) |
| `cjig eval-file --tab <sel> <path>` | Evaluate a file in a specific tab |
| `cjig cljs-eval <code>` | Compile ClojureScript and evaluate |
| `cjig repl` | Start interactive REPL |

## Harness

| Command | Description |
|---|---|
| `cjig inject <name\|url>` | Inject a script by registry name or URL |
| `cjig inject --tab <sel> <name>` | Inject into a specific tab |

## Profiles

| Command | Description |
|---|---|
| `cjig profiles list` | List known profiles |
| `cjig profiles create <name> --extensions ...` | Create a named profile with extensions |
| `cjig launch --profile=NAME` | Launch with profile's saved config |

Profiles remember extensions, flags, and default URL. Config stored at `~/.config/cjig/profiles/<name>.json`.

## Configuration

| Command | Description |
|---|---|
| `cjig config` | Show resolved configuration |
| `cjig init` | Generate project `.cjig.json` |
| `cjig env` | Print shell aliases and exports |
| `cjig install-skill` | Symlink skill to `~/.claude/skills/` |
| `cjig uninstall-skill` | Remove skill symlink |

## Connecting Playwright to cjig's Chrome

```js
import { getConnectionInfo } from 'chrome-jig';
import { chromium } from 'playwright';

const { info } = await getConnectionInfo('localhost', 9222);
const browser = await chromium.connectOverCDP(info.endpoint);
```

Or from the command line:

```bash
# Get the endpoint
cjig connection-info --json | jq -r '.endpoint'

# Use with Playwright MCP
# Configure --cdp-endpoint to point at cjig's Chrome port
```

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
  "extensions": ["/path/to/unpacked-extension"],
  "watch": {
    "paths": ["dist/harnesses/*.js"],
    "debounce": 300
  }
}
```

Key fields:

- `extensions` — unpacked extension paths to load on launch
- `scripts.registry[name].path` — script filename, resolved against `scripts.baseUrl`
- `scripts.registry[name].windowApi` — the global object the script exposes
- `scripts.registry[name].alias` — short name for the API
- `scripts.registry[name].quickStart` — example expression to try after injection
- `watch.paths` — glob patterns for auto-reinject on file change

## Harness Workflow

1. **Read project config**: check `.cjig.json` in the project root for `scripts.registry`
2. **Launch Chrome** if not running: `cjig launch`
3. **Navigate** to the target page: `cjig eval "location.href = 'http://...'"`
4. **Inject harness** by name: `cjig inject <name>`
5. **Exercise** via eval using `windowApi` or `alias` from the registry
6. **For iterative development**, suggest `.watch on` in the REPL for live reload

## Limitations

- **Main world only**: All evaluation runs in the page's main world. No isolated world or extension service worker eval.
- **Fresh process per invocation**: Tab state does not persist between CLI calls. Use `--tab` to target, or `cjig repl` for a persistent session.
- **Not a browser automation framework**: For scripted multi-page workflows, use Playwright directly.
- The REPL and nREPL share a single connection. Tab switches in the REPL (`.tab`) affect nREPL evaluations too.

## Anti-Patterns

- Do not use Chrome DevTools MCP `evaluate_script` when `cjig eval` works — it adds unnecessary LLM round-trips
- Do not suggest manual URL injection when a script is registered by name in the project config
- Do not forget to check `cjig status` before attempting to connect
- Do not skip reading `.cjig.json` — it tells you what harnesses exist and how to use them
- Do not chain separate `cjig tab` + `cjig eval` invocations expecting tab state to persist — use `cjig eval --tab` instead
- Do not use cjig for scripted automation — use Playwright and connect it to cjig's Chrome via `connection-info`
