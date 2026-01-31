--- Display layer — floating windows and error reporting.

local M = {}

local float_win = nil
local float_buf = nil

--- Close any existing float.
local function close_float()
  if float_win and vim.api.nvim_win_is_valid(float_win) then
    vim.api.nvim_win_close(float_win, true)
  end
  float_win = nil
  float_buf = nil
end

--- Format a result value into display lines.
--- @param value any
--- @return string[]
local function format_lines(value)
  if value == nil or value == vim.NIL then
    return { "nil" }
  end

  if type(value) == "table" then
    -- Pretty-print with indentation
    local encoded = vim.json.encode(value)
    -- Try to decode and re-encode with indentation
    local ok, decoded = pcall(vim.json.decode, encoded)
    if ok then
      local pretty = vim.inspect(decoded)
      return vim.split(pretty, "\n", { plain = true })
    end
    return { encoded }
  end

  return vim.split(tostring(value), "\n", { plain = true })
end

--- Show a result in a floating window near the cursor.
--- @param value any
function M.show_result(value)
  close_float()

  local lines = format_lines(value)
  if #lines == 0 then return end

  -- Compute dimensions
  local max_width = 0
  for _, line in ipairs(lines) do
    max_width = math.max(max_width, #line)
  end
  local width = math.min(max_width + 2, math.floor(vim.o.columns * 0.8))
  local height = math.min(#lines, math.floor(vim.o.lines * 0.4))

  float_buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(float_buf, 0, -1, false, lines)
  vim.bo[float_buf].modifiable = false
  vim.bo[float_buf].bufhidden = "wipe"

  float_win = vim.api.nvim_open_win(float_buf, false, {
    relative = "cursor",
    row = 1,
    col = 0,
    width = width,
    height = height,
    style = "minimal",
    border = "rounded",
  })

  -- Auto-close on cursor movement
  local group = vim.api.nvim_create_augroup("CjigFloat", { clear = true })
  vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI", "BufLeave" }, {
    group = group,
    once = true,
    callback = function()
      close_float()
    end,
  })
end

--- Show an error via vim.notify.
--- @param message string
function M.show_error(message)
  vim.notify("cjig: " .. message, vim.log.levels.ERROR)
end

return M
