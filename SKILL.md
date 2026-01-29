# Chrome Debug REPL Skill

Control Chrome for debugging, testing, and script injection.

## When to Use

- User asks to debug something in Chrome
- User wants to inject and test a script/harness
- User needs to evaluate JavaScript in a live page
- User wants to test a web application

## Commands

### Check Status

```bash
chrome-debug status
```

Returns whether Chrome is running with debugging enabled.

### Launch Chrome

```bash
chrome-debug launch
chrome-debug launch --profile=testing
```

Launches Chrome with remote debugging. Uses isolated profile stored in XDG directories.

### List Tabs

```bash
chrome-debug tabs
```

Shows all open tabs with index and URL.

### Evaluate JavaScript

```bash
chrome-debug eval "document.title"
chrome-debug eval "myApi.getStatus()"
```

One-shot JavaScript evaluation in the current tab.

### Inject Script

```bash
chrome-debug inject bs                    # By name from project config
chrome-debug inject http://localhost:5173/my-script.js  # By URL
```

Inject a script into the current page. Named scripts come from `.chrome-debug.json`.

### Interactive REPL

```bash
chrome-debug repl
```

Starts an interactive REPL. Inside:
- Type JavaScript expressions to evaluate them
- Use `.tabs` to list tabs
- Use `.tab <pattern>` to switch tabs
- Use `.inject <name>` to inject scripts
- Use `.help` for all commands

## Project Configuration

If the project has `.chrome-debug.json`:

```json
{
  "scripts": {
    "baseUrl": "http://localhost:5173/harnesses/",
    "registry": {
      "bs": {
        "path": "block-segmenter-harness.js",
        "windowApi": "BlockSegmenter",
        "quickStart": "BS.overlayOn()"
      }
    }
  }
}
```

Then `chrome-debug inject bs` injects that harness.

## Workflow Example

1. Start Chrome:
   ```bash
   chrome-debug launch
   ```

2. Navigate to target page (manually or via eval):
   ```bash
   chrome-debug eval "location.href = 'http://localhost:5173'"
   ```

3. Inject harness:
   ```bash
   chrome-debug inject bs
   ```

4. Use the API:
   ```bash
   chrome-debug eval "BS.overlayOn()"
   ```

5. For iterative work, use REPL:
   ```bash
   chrome-debug repl
   > .watch on          # Auto-reinject on file changes
   > BS.highlightBlock(document.body)
   ```

## Environment Variables

Set these in shell or CI:

- `CHROME_DEBUG_PORT=9222` - CDP port
- `CHROME_DEBUG_PROFILE=default` - Profile name
- `CHROME_PATH=/path/to/chrome` - Chrome executable

## Notes

- Chrome runs with an isolated profile (not your normal browser profile)
- File watching re-injects scripts when source files change
- The `preBuild` hook can rebuild before injection
