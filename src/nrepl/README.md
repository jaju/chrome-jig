# nREPL Server for Editor Integration

## Purpose

A minimal nREPL server that lets Conjure (Neovim) and CIDER (Emacs) evaluate ClojureScript in a live browser session. Forms typed in the editor compile through squint-cljs, evaluate in the browser via CDP, and return results to the editor — the same `evaluateCljs()` path used by `cjig cljs-eval`.

## Why a custom server

As of January 2026, no existing nREPL server supports pluggable eval. Our requirement — compile via squint, then evaluate remotely in a browser over CDP — cannot be satisfied by hooking into an existing server:

- **squint-cljs** (`squint-cljs/nrepl-server`): Provides `startServer()` with hardcoded eval (`compile → js/eval` in the local Node process). Accepts only `port`, `host`, `log_level`. No hook point for custom evaluation.

- **nbb** (babashka for Node): Uses SCI (Small Clojure Interpreter), a different compilation model. Its nREPL server similarly bakes in eval with no extension point.

- **npm ecosystem**: No pure-JS nREPL server library exists with pluggable eval. The only candidate (`nrepl-cljs-sci`) is abandoned.

The nREPL protocol itself is simple — TCP transport, bencode framing, a handful of ops. The server is ~120 lines of logic. Building it was less work than fighting an abstraction that doesn't want to be extended.

## Architecture

```
Editor ──TCP/bencode──▷ nREPL server ──▷ evaluateCljs() ──▷ browser (CDP)
                          (server.ts)     (cljs-eval.ts)
```

The entire interaction surface with cjig core is one function call: `evaluateCljs(connection, code)`.

Bencode codec provided by the `bencode` npm package (WebTorrent ecosystem).

## Supported ops

| Op | Behavior |
|---|---|
| `clone` | Creates a new session (UUID) |
| `close` | Removes a session |
| `describe` | Returns server capabilities |
| `eval` | Compiles CLJS via squint, evaluates in browser, returns result |

## Known limitations

- **CIDER compatibility**: CIDER's connection handshake expects richer metadata (Clojure version, classpath, etc.) and may refuse to connect. Conjure connects without issue.
- **No `out` capture**: stdout/console output from browser eval is not streamed back. Would require CDP `Runtime.consoleAPICalled` subscription.
- **No completions**: `complete`, `info`, and `lookup` ops are not implemented.
- **Single eval**: Concurrent evaluations are not serialized or queued.
- **Session state**: Sessions are ID-only — no per-session namespace or binding state.

## References

- [nREPL protocol specification](https://nrepl.org/nrepl/building_servers.html)
- [squint-cljs](https://github.com/squint-cljs/squint) — ClojureScript-to-JS compiler used for compilation
- [nbb](https://github.com/babashka/nbb) — Babashka for Node, architectural inspiration for nREPL-over-JS
- [bencode](https://github.com/webtorrent/bencode) — Bencode codec (WebTorrent ecosystem)
