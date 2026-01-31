# REPL Guide

Chrome Jig offers three ways to evaluate code in the browser: an interactive REPL, one-shot JavaScript evaluation, and one-shot ClojureScript evaluation.

All modes require a running Chrome instance with debugging enabled:

```bash
cjig launch
```

---

## Interactive REPL

A persistent session connected to a browser tab. Type JavaScript directly; use dot-commands for tooling.

```bash
cjig repl
```

### JavaScript evaluation

Everything that isn't a dot-command is sent to the browser as JavaScript:

```
> document.title
"My Page"

> document.querySelectorAll('a').length
42

> JSON.parse(localStorage.getItem('settings'))
{
  "theme": "dark",
  "lang": "en"
}

> fetch('/api/health').then(r => r.json())
{ "status": "ok" }
```

### Dot-commands

| Command | Aliases | Description |
|---|---|---|
| `.help` | `.h`, `.?` | Show available commands |
| `.tabs` | `.t`, `.pages` | List open tabs |
| `.tab <pattern\|index>` | `.select` | Switch to a tab |
| `.open <url>` | `.o`, `.goto` | Open a new tab |
| `.inject <name\|url>` | `.i`, `.load` | Inject a script |
| `.reload` | `.r` | Reload the current tab |
| `.watch [on\|off]` | `.w` | Toggle file watching |
| `.build` | `.b` | Run the preBuild hook |
| `.config` | `.cfg` | Show resolved config |
| `.clear` | `.cls` | Clear the console |
| `.exit` | `.quit`, `.q` | Exit the REPL |

### Tab management

```
> .tabs
  [0] Google
       https://www.google.com

→ [1] My App
       http://localhost:5173

> .tab 0
Switched to: Google

> .tab localhost
Switched to: My App
```

### Script injection

Inject named scripts from your `.cjig.json` registry or by URL:

```
> .inject bs
Injected: http://localhost:5173/harnesses/block-segmenter-harness.js
API available as: window.BlockSegmenter
Try: BS.overlayOn()

> .inject https://example.com/some-script.js
Injected: https://example.com/some-script.js
```

Run `.inject` with no arguments to list available scripts.

### File watching

When configured with watch paths in `.cjig.json`, the REPL can auto-re-inject scripts on file changes:

```
> .inject bs
Injected: http://localhost:5173/harnesses/block-segmenter-harness.js

> .watch on
File watching enabled
Watching: src/harnesses

[watch] File changed: src/harnesses/block-segmenter-harness.js
[watch] Re-injected: bs
```

### Exiting

Use `.exit`, `.quit`, `.q`, or `Ctrl+D`.

---

## One-shot JavaScript eval

Evaluate a single expression and exit. Useful in scripts and pipelines.

```bash
cjig eval "document.title"
# "My Page"

cjig eval "document.querySelectorAll('img').length"
# 7

cjig eval "performance.timing.loadEventEnd - performance.timing.navigationStart"
# 342
```

### JSON output

The `--json` flag wraps the result in a structured envelope:

```bash
cjig eval --json "document.title"
# {"success":true,"value":"My Page"}

cjig eval --json "nonexistent.property"
# {"success":false,"error":"ReferenceError: nonexistent is not defined"}
```

This is useful for piping into `jq` or consuming from other tools:

```bash
cjig eval --json "navigator.userAgent" | jq -r '.value'
```

### Multi-word expressions

Arguments after the command are joined, so quoting is flexible:

```bash
cjig eval "1 + 2"
# 3

cjig eval 1 + 2
# 3
```

---

## One-shot ClojureScript eval

Compile ClojureScript to JavaScript via [squint-cljs](https://github.com/squint-cljs/squint), then evaluate in the browser. Stateless — no state persists between invocations.

```bash
cjig cljs-eval "(+ 1 2)"
# 3
```

### Arithmetic and data

```bash
cjig cljs-eval "(* 6 7)"
# 42

cjig cljs-eval "(str \"hello\" \" \" \"world\")"
# "hello world"

cjig cljs-eval "(map inc [1 2 3])"
```

### Core functions

Squint's core runtime (238 functions) is injected automatically before each evaluation. All standard ClojureScript functions work:

```bash
cjig cljs-eval "(reduce + (range 10))"
# 45

cjig cljs-eval "(filter odd? (range 20))"
# (1 3 5 7 9 11 13 15 17 19)

cjig cljs-eval "(map inc [1 2 3])"
# (2 3 4)

cjig cljs-eval "(let [a (atom 0)] (swap! a inc) @a)"
# 1
```

### DOM access via JS interop

```bash
cjig cljs-eval "(.-title js/document)"
# "My Page"

cjig cljs-eval "(-> js/document (.querySelectorAll \"a\") .-length)"

cjig cljs-eval "(js/console.log \"ping from cljs\")"
```

### JSON output

Same `--json` flag as `eval`:

```bash
cjig cljs-eval --json "(+ 1 2)"
# {"success":true,"value":3}

cjig cljs-eval --json "(+ 1"
# {"success":false,"error":"..."}
```

### Compilation errors

If the ClojureScript source has a syntax error, you get an error without hitting the browser:

```bash
cjig cljs-eval "(+ 1"
# Error: ...

cjig cljs-eval --json "(def"
# {"success":false,"error":"..."}
```

### How it works

```
cjig cljs-eval "(+ 1 2)"
  → squint compiles to JS:  "1 + 2"
  → CDP evaluates in browser: 3
  → result printed
```

The compilation happens in Node.js. Only the resulting JavaScript is sent to Chrome.
