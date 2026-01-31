# cjig.nvim

Neovim plugin for evaluating JavaScript/ClojureScript in Chrome via `cjig serve --stdio`.

Select code, eval in browser, see result in a floating window.

## Requirements

- Neovim >= 0.9
- `cjig` installed and on `$PATH` (`pnpm link --global` from chrome-debug-repl)
- Chrome running with debugging enabled (`cjig launch`)

## Setup

### Development (from repo checkout)

Add to your Neovim config (init.lua):

```lua
vim.opt.runtimepath:prepend("/path/to/chrome-debug-repl/editor/nvim")
require("cjig").setup()
```

### lazy.nvim

```lua
{
  dir = "/path/to/chrome-debug-repl/editor/nvim",
  config = function()
    require("cjig").setup()
  end,
}
```

## Commands

| Command | Mode | Description |
|---|---|---|
| `:CjigConnect` | n | Spawn `cjig serve --stdio` subprocess |
| `:CjigDisconnect` | n | Kill the subprocess |
| `:CjigEval` | v | Eval visual selection in browser |
| `:CjigEvalForm` | n | Eval treesitter form at cursor |
| `:CjigTabs` | n | List open browser tabs |
| `:CjigInject <name>` | n | Inject a harness script by name |
| `:CjigReload` | n | Reload current browser tab |

## Default Keymaps

All under `<leader>c` (configurable via `opts.leader`):

| Key | Mode | Action |
|---|---|---|
| `<leader>ce` | v | Eval selection |
| `<leader>cf` | n | Eval form at cursor |
| `<leader>ct` | n | List tabs |
| `<leader>cr` | n | Reload tab |
| `<leader>cc` | n | Connect |
| `<leader>cd` | n | Disconnect |

Disable with `require("cjig").setup({ keymaps = false })`.

## Options

```lua
require("cjig").setup({
  keymaps = true,       -- set false to skip default keymaps
  leader = "<leader>c", -- keymap prefix
})
```

## Auto-connect

`:CjigEval` and `:CjigEvalForm` auto-connect on first use.
Explicit `:CjigConnect` is optional.

## Language Detection

- `clojure` filetype -> sends `lang: "cljs"` (compiled via squint-cljs)
- Everything else -> `lang: "js"`

## Treesitter Form Selection

`:CjigEvalForm` walks up the treesitter tree from the cursor to find the nearest evaluable node:

- `expression_statement` (trailing `;` stripped)
- `variable_declaration` / `lexical_declaration`
- `function_declaration`
- `call_expression`
- `assignment_expression`

## Dogfooding Walkthrough

```bash
# Terminal 1: launch Chrome
cjig launch

# Terminal 2: serve examples (if using harness scripts)
pnpm serve:examples
```

In Neovim:

```
:CjigConnect                  " stderr shows "Connected to localhost:9222"
:CjigTabs                     " floating window lists tabs

" Open a scratch .js file, type:
"   document.title
" Visual select the line, then:
:'<,'>CjigEval                " floating window shows page title

" Type: FX.burst(50)
" Place cursor on it:
:CjigEvalForm                 " particles appear in browser

:CjigInject fancy-demo        " injects harness
:CjigReload                   " reloads tab
:CjigDisconnect               " kills subprocess
```
