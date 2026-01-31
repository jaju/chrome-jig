--- cjig.nvim — eval-from-editor via JSON-RPC over stdio.
---
--- Commands: CjigConnect, CjigDisconnect, CjigEval, CjigEvalForm,
---           CjigTabs, CjigInject, CjigReload

local rpc = require("cjig.rpc")
local ui = require("cjig.ui")

local M = {}

-- Evaluable treesitter node types
local EVAL_NODES = {
  expression_statement = true,
  variable_declaration = true,
  lexical_declaration = true,
  function_declaration = true,
  call_expression = true,
  assignment_expression = true,
}

--- Detect language from filetype.
--- @return string "js" or "cljs"
local function detect_lang()
  if vim.bo.filetype == "clojure" then
    return "cljs"
  end
  return "js"
end

--- Get visual selection text.
--- @return string
local function get_visual_selection()
  local _, srow, scol, _ = unpack(vim.fn.getpos("'<"))
  local _, erow, ecol, _ = unpack(vim.fn.getpos("'>"))

  if srow > erow or (srow == erow and scol > ecol) then
    srow, erow = erow, srow
    scol, ecol = ecol, scol
  end

  local lines = vim.api.nvim_buf_get_lines(0, srow - 1, erow, false)
  if #lines == 0 then return "" end

  if #lines == 1 then
    lines[1] = lines[1]:sub(scol, ecol)
  else
    lines[1] = lines[1]:sub(scol)
    lines[#lines] = lines[#lines]:sub(1, ecol)
  end

  return table.concat(lines, "\n")
end

--- Walk up treesitter tree to find nearest evaluable node.
--- @return string|nil
local function get_treesitter_form()
  local ok, ts_utils = pcall(require, "nvim-treesitter.ts_utils")
  local node

  if ok then
    node = ts_utils.get_node_at_cursor()
  else
    -- Fallback: use built-in treesitter
    node = vim.treesitter.get_node()
  end

  if not node then return nil end

  -- Walk up to nearest evaluable node
  while node do
    if EVAL_NODES[node:type()] then
      local sr, sc, er, ec = node:range()
      local lines = vim.api.nvim_buf_get_text(0, sr, sc, er, ec, {})
      local text = table.concat(lines, "\n")

      -- Strip trailing semicolon from expression statements
      if node:type() == "expression_statement" then
        text = text:gsub(";%s*$", "")
      end

      return text
    end
    node = node:parent()
  end

  return nil
end

--- Eval code string in browser, show result in float.
--- @param code string
local function eval_and_show(code)
  if code == "" then
    ui.show_error("No code to evaluate")
    return
  end

  local lang = detect_lang()

  rpc.ensure_connected(function()
    vim.schedule(function()
      rpc.request("eval", { code = code, lang = lang }, function(result)
        vim.schedule(function()
          ui.show_result(result)
        end)
      end, function(err)
        vim.schedule(function()
          ui.show_error(err)
        end)
      end)
    end)
  end)
end

--- Register all user commands.
local function register_commands()
  vim.api.nvim_create_user_command("CjigConnect", function()
    rpc.connect()
  end, { desc = "Connect to Chrome via cjig serve" })

  vim.api.nvim_create_user_command("CjigDisconnect", function()
    rpc.disconnect()
  end, { desc = "Disconnect from cjig" })

  vim.api.nvim_create_user_command("CjigEval", function()
    local code = get_visual_selection()
    eval_and_show(code)
  end, { range = true, desc = "Eval visual selection in browser" })

  vim.api.nvim_create_user_command("CjigEvalForm", function()
    local code = get_treesitter_form()
    if not code then
      ui.show_error("No evaluable form at cursor")
      return
    end
    eval_and_show(code)
  end, { desc = "Eval treesitter form at cursor" })

  vim.api.nvim_create_user_command("CjigTabs", function()
    rpc.ensure_connected(function()
      vim.schedule(function()
        rpc.request("tabs", {}, function(result)
          vim.schedule(function()
            if result and result.formatted then
              ui.show_result(result.formatted)
            else
              ui.show_result(result)
            end
          end)
        end, function(err)
          vim.schedule(function()
            ui.show_error(err)
          end)
        end)
      end)
    end)
  end, { desc = "List browser tabs" })

  vim.api.nvim_create_user_command("CjigInject", function(opts)
    local ref = opts.args
    if ref == "" then
      ui.show_error("Usage: :CjigInject <name>")
      return
    end
    rpc.ensure_connected(function()
      vim.schedule(function()
        rpc.request("inject", { ref = ref }, function(result)
          vim.schedule(function()
            if result and result.formatted then
              vim.notify("cjig: " .. result.formatted, vim.log.levels.INFO)
            else
              ui.show_result(result)
            end
          end)
        end, function(err)
          vim.schedule(function()
            ui.show_error(err)
          end)
        end)
      end)
    end)
  end, { nargs = 1, desc = "Inject a harness script" })

  vim.api.nvim_create_user_command("CjigReload", function()
    rpc.ensure_connected(function()
      vim.schedule(function()
        rpc.request("reload", {}, function(_)
          vim.schedule(function()
            vim.notify("cjig: Reloaded", vim.log.levels.INFO)
          end)
        end, function(err)
          vim.schedule(function()
            ui.show_error(err)
          end)
        end)
      end)
    end)
  end, { desc = "Reload current browser tab" })
end

--- Setup the plugin with optional config.
--- @param opts? table
function M.setup(opts)
  opts = opts or {}

  register_commands()

  -- Default keymaps (disable with opts.keymaps = false)
  if opts.keymaps ~= false then
    local leader = opts.leader or "<leader>c"

    vim.keymap.set("v", leader .. "e", ":<C-u>CjigEval<CR>",
      { silent = true, desc = "cjig: eval selection" })
    vim.keymap.set("n", leader .. "f", "<cmd>CjigEvalForm<CR>",
      { silent = true, desc = "cjig: eval form" })
    vim.keymap.set("n", leader .. "t", "<cmd>CjigTabs<CR>",
      { silent = true, desc = "cjig: list tabs" })
    vim.keymap.set("n", leader .. "r", "<cmd>CjigReload<CR>",
      { silent = true, desc = "cjig: reload tab" })
    vim.keymap.set("n", leader .. "c", "<cmd>CjigConnect<CR>",
      { silent = true, desc = "cjig: connect" })
    vim.keymap.set("n", leader .. "d", "<cmd>CjigDisconnect<CR>",
      { silent = true, desc = "cjig: disconnect" })
  end
end

return M
