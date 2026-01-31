--- JSON-RPC 2.0 transport over stdio to `cjig serve`.
---
--- States: disconnected -> connecting -> connected (or error).
--- Auto-buffers partial lines from stdout.
--- Detects "Connected to" on stderr to confirm readiness.

local M = {}

-- State
local state = "disconnected"
local job_id = nil
local next_id = 1
local pending = {} -- id -> { on_result, on_error }
local queued = {} -- callbacks waiting for connected state
local stdout_buf = "" -- partial line buffer

--- Send a JSON-RPC 2.0 request.
--- @param method string
--- @param params table
--- @param on_result function(result)
--- @param on_error function(message)
function M.request(method, params, on_result, on_error)
  if state ~= "connected" then
    on_error("Not connected")
    return
  end

  local id = next_id
  next_id = next_id + 1
  pending[id] = { on_result = on_result, on_error = on_error }

  local payload = vim.json.encode({
    jsonrpc = "2.0",
    id = id,
    method = method,
    params = params or {},
  })

  vim.fn.chansend(job_id, payload .. "\n")
end

--- Handle stdout data from the cjig process.
local function on_stdout(_, data, _)
  for i, chunk in ipairs(data) do
    if i == 1 then
      stdout_buf = stdout_buf .. chunk
    else
      -- Previous buffer is a complete line
      local line = stdout_buf
      stdout_buf = chunk

      if line ~= "" then
        vim.schedule(function()
          local ok, decoded = pcall(vim.json.decode, line)
          if not ok then return end

          local id = decoded.id
          if id == nil then return end

          local cb = pending[id]
          if not cb then return end
          pending[id] = nil

          if decoded.error then
            cb.on_error(decoded.error.message or "Unknown error")
          else
            cb.on_result(decoded.result)
          end
        end)
      end
    end
  end
end

--- Handle stderr data from the cjig process.
local function on_stderr(_, data, _)
  for _, line in ipairs(data) do
    if line == "" then goto continue end

    if line:find("Connected to") then
      vim.schedule(function()
        state = "connected"
        vim.notify("cjig: " .. line, vim.log.levels.INFO)
        -- Flush queued callbacks
        local q = queued
        queued = {}
        for _, cb in ipairs(q) do
          cb()
        end
      end)
    else
      vim.schedule(function()
        vim.notify("cjig: " .. line, vim.log.levels.DEBUG)
      end)
    end

    ::continue::
  end
end

--- Handle process exit.
local function on_exit(_, exit_code, _)
  vim.schedule(function()
    job_id = nil
    state = "disconnected"
    pending = {}
    stdout_buf = ""
    if exit_code ~= 0 then
      vim.notify("cjig exited with code " .. exit_code, vim.log.levels.WARN)
    end
    -- Reject queued callbacks
    local q = queued
    queued = {}
    for _, cb in ipairs(q) do
      cb() -- they'll see state ~= "connected" if they check
    end
  end)
end

--- Start the cjig serve process.
function M.connect()
  if state ~= "disconnected" then
    vim.notify("cjig: already " .. state, vim.log.levels.WARN)
    return
  end

  state = "connecting"
  stdout_buf = ""

  job_id = vim.fn.jobstart({ "cjig", "serve", "--stdio" }, {
    on_stdout = on_stdout,
    on_stderr = on_stderr,
    on_exit = on_exit,
    stdout_buffered = false,
    stderr_buffered = false,
  })

  if job_id <= 0 then
    state = "disconnected"
    vim.notify("cjig: failed to start (is cjig installed?)", vim.log.levels.ERROR)
  end
end

--- Stop the cjig serve process.
function M.disconnect()
  if job_id then
    vim.fn.jobstop(job_id)
  end
  state = "disconnected"
  job_id = nil
  pending = {}
  queued = {}
  stdout_buf = ""
end

--- Auto-connect on first use, then invoke callback when ready.
--- @param callback function
function M.ensure_connected(callback)
  if state == "connected" then
    callback()
    return
  end

  if state == "disconnected" then
    M.connect()
  end

  -- Queue callback for when "Connected to" arrives
  table.insert(queued, callback)
end

--- @return boolean
function M.is_connected()
  return state == "connected"
end

return M
