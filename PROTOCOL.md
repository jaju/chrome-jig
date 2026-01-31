# Chrome Jig JSON-RPC Protocol

Machine-readable interface for editors, scripts, and plugins.

## Transport

Newline-delimited JSON-RPC 2.0 over stdio.

```
stdin  → one JSON-RPC request per line
stdout ← one JSON-RPC response per line
stderr ← status messages (not JSON)
```

Start the server:

```bash
cjig serve --stdio
```

## Methods

### `eval`

Evaluate code in the current browser tab.

| Param  | Type   | Default | Description                        |
|--------|--------|---------|------------------------------------|
| `code` | string | —       | **Required.** Code to evaluate     |
| `lang` | string | `"js"`  | Language: `"js"` or `"cljs"`       |

JavaScript (default):

```json
{"jsonrpc":"2.0","id":1,"method":"eval","params":{"code":"document.title"}}
```

```json
{"jsonrpc":"2.0","id":1,"result":"My Page Title"}
```

ClojureScript (compiled via squint-cljs):

```json
{"jsonrpc":"2.0","id":2,"method":"eval","params":{"code":"(+ 1 2)","lang":"cljs"}}
```

```json
{"jsonrpc":"2.0","id":2,"result":3}
```

### `cljs-eval`

Alias for `eval` with `lang: "cljs"`. Kept for backward compatibility.

```json
{"jsonrpc":"2.0","id":3,"method":"cljs-eval","params":{"code":"(str \"hello\" \" world\")"}}
```

```json
{"jsonrpc":"2.0","id":3,"result":"hello world"}
```

### `tabs`

List open browser tabs.

```json
{"jsonrpc":"2.0","id":3,"method":"tabs"}
```

```json
{"jsonrpc":"2.0","id":3,"result":{"tabs":[{"index":0,"title":"Example","url":"https://example.com","isCurrent":true}],"formatted":"..."}}
```

### `selectTab`

Switch to a tab by index or URL pattern.

```json
{"jsonrpc":"2.0","id":4,"method":"selectTab","params":{"pattern":"0"}}
```

```json
{"jsonrpc":"2.0","id":4,"result":{"tab":{"index":0,"title":"Example","url":"https://example.com","isCurrent":true},"formatted":"Switched to: Example\n  https://example.com"}}
```

### `inject`

Inject a script by registry name or URL.

```json
{"jsonrpc":"2.0","id":5,"method":"inject","params":{"ref":"bs"}}
```

```json
{"jsonrpc":"2.0","id":5,"result":{"success":true,"url":"http://localhost:5173/harnesses/block-segmenter-harness.js","formatted":"Injected: ..."}}
```

### `reload`

Reload the current tab.

```json
{"jsonrpc":"2.0","id":6,"method":"reload"}
```

```json
{"jsonrpc":"2.0","id":6,"result":{"formatted":"Reloaded"}}
```

## Error Codes

Standard JSON-RPC 2.0 error codes:

| Code | Meaning |
|---|---|
| -32700 | Parse error — invalid JSON |
| -32600 | Invalid request — missing `jsonrpc` or `method` |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error — handler threw |

Example error response:

```json
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

## Future Extensions

- **nREPL adapter**: A bencode-over-TCP protocol adapter sharing the same session core, enabling Conjure and CIDER integration.
