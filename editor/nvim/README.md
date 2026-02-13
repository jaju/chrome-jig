# cjig.nvim

Neovim plugin for evaluating JavaScript/ClojureScript in Chrome via `cjig serve --stdio`.

Select code, eval in browser, see result in a floating window.

## Requirements

- Neovim >= 0.9
- `cjig` installed and on `$PATH`
- Chrome running with debugging enabled (`cjig launch`)

## Installation

Run once (and again after upgrading cjig or switching Node versions):

```bash
cjig install-nvim
```

This creates a stable symlink at `$XDG_DATA_HOME/cjig/editors/nvim` (default: `~/.local/share/cjig/editors/nvim`) pointing to the plugin inside the installed package. The command prints setup snippets — add the appropriate one to your Neovim config.

### lazy.nvim

Create `lua/plugins/cjig.lua`:

```lua
return { dir = "~/.local/share/cjig/editors/nvim" }
```

### packer

```lua
use { "~/.local/share/cjig/editors/nvim" }
```

### Manual (init.lua)

```lua
vim.opt.runtimepath:prepend(vim.fn.expand("~/.local/share/cjig/editors/nvim"))
require("cjig").setup()
```

### Uninstall

```bash
cjig uninstall-nvim
```

Then remove the corresponding line from your Neovim config.

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

All under `<leader>b` (configurable via `opts.leader`):

| Key | Mode | Action |
|---|---|---|
| `<leader>be` | v | Eval selection |
| `<leader>bf` | n | Eval form at cursor |
| `<leader>bt` | n | List tabs |
| `<leader>br` | n | Reload tab |
| `<leader>bc` | n | Connect |
| `<leader>bd` | n | Disconnect |

Disable with `require("cjig").setup({ keymaps = false })`.

## Options

```lua
require("cjig").setup({
  keymaps = true,       -- set false to skip default keymaps
  leader = "<leader>b", -- keymap prefix
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

## Walkthrough

```bash
# Terminal: launch Chrome and serve examples
cjig launch
pnpm serve:examples
```

In Neovim:

```
:CjigConnect                  " connects to Chrome on localhost:9222
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
