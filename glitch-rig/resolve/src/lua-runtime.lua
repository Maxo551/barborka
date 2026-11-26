-- GLITCH RIG — shared Lua runtime, inlined into every generated .fuse.

local GR_PB = {}

-- Crash guard. The first runs of every risky step (a GPU kernel, fetching other
-- frames, reading a pixel) leave a marker file while they run. If Resolve dies
-- in the middle, the next start finds the marker, switches that step off for
-- good (listed in glitchrig-disabled.txt in the temp folder) and passes the clip
-- through instead, so a crash cannot repeat on every project open.
local GR_GUARD = { dir = nil, disabled = nil, runs = {} }
local function grGuardDir()
  if GR_GUARD.dir then return GR_GUARD.dir end
  local d
  pcall(function() d = os.getenv("TEMP") or os.getenv("TMPDIR") or os.getenv("TMP") end)
  if (not d or d == "") and self and self.Comp then pcall(function() d = self.Comp:MapPath("Temp:") end) end
  d = tostring(d or "."):gsub("[/\\]+$", "")
  GR_GUARD.dir = d
  return d
end
local function grGuardPath(name) return grGuardDir() .. "/glitchrig-" .. name end
local function grGuardLoad()
  if GR_GUARD.disabled then return end
  GR_GUARD.disabled = {}
  pcall(function()
    local f = io.open(grGuardPath("disabled.txt"), "r")
    if f then
      for line in f:lines() do if line ~= "" then GR_GUARD.disabled[line] = true end end
      f:close()
    end
  end)
  pcall(function()
    local f = io.open(grGuardPath("running.txt"), "r")
    if not f then return end
    local op = f:read("*l")
    f:close()
    os.remove(grGuardPath("running.txt"))
    if op and op ~= "" and not GR_GUARD.disabled[op] then
      GR_GUARD.disabled[op] = true
      local w = io.open(grGuardPath("disabled.txt"), "a")
      if w then w:write(op .. "\n") w:close() end
      print("[Glitch Rig] Resolve stopped during '" .. op .. "' last time, so it is switched off now.")
      print("[Glitch Rig] To try it again delete " .. grGuardPath("disabled.txt"))
    end
  end)
end
-- Runs fn under the guard; returns nil when the step is switched off.
local function grGuarded(op, fn)
  grGuardLoad()
  if GR_GUARD.disabled[op] then return nil end
  local n = (GR_GUARD.runs[op] or 0) + 1
  GR_GUARD.runs[op] = n
  local marked = false
  if n <= 3 then
    pcall(function()
      local f = io.open(grGuardPath("running.txt"), "w")
      if f then f:write(op) f:close() marked = true end
    end)
  end
  local r = fn()
  if marked then pcall(os.remove, grGuardPath("running.txt")) end
  return r
end

-- Create one control; a failure is printed and the other controls still get made.
local function grTry(id, fn)
  local ok, err = pcall(fn)
  if not ok then print("[Glitch Rig] control " .. id .. " not created: " .. tostring(err)) end
end
GR_DEBUG = false
local GR_CALLS = 0

-- Diagnostics printed to Workspace > Console for the first frames: the image
-- size, plus the centre pixel for clip inputs (never for GPU results).
local function grProbe(label, img, readPixel)
  if not GR_DEBUG then return end
  if not img then print("[Glitch Rig]   " .. label .. ": nil") return end
  local ok, msg = pcall(function()
    local w = img.Width or img.DataWindow:Width()
    local h = img.Height or img.DataWindow:Height()
    local out = string.format("%dx%d", w, h)
    if readPixel then
      local px = grGuarded("probe", function()
        local p = Pixel()
        img:GetPixel(math.floor(w / 2), math.floor(h / 2), p)
        return p
      end)
      if px then out = out .. string.format(" centre=(%.3f, %.3f, %.3f, %.3f)", px.R, px.G, px.B, px.A) end
    end
    return out
  end)
  print("[Glitch Rig]   " .. label .. ": " .. tostring(msg))
end

local function grOut(req, img)
  grProbe("output", img)
  OutImage:Set(req, img)
end

-- Runs a Process body; the first two frames print diagnostics, and an error
-- prints a traceback and passes the clip through instead of leaving black.
local function grMain(tool, req, name, body)
  GR_CALLS = GR_CALLS + 1
  GR_DEBUG = GR_CALLS <= 2
  if GR_DEBUG then print(string.format("[Glitch Rig] %s frame %s", name, tostring(req.Time))) end
  local ok, err = xpcall(body, function(e)
    local okTb, tb = pcall(debug.traceback, tostring(e), 2)
    return okTb and tb or tostring(e)
  end)
  if not ok then
    print("[Glitch Rig] " .. name .. " error: " .. tostring(err))
    for _, id in ipairs({ "Input", "Background", "Foreground" }) do
      local inp = GR_IMG and GR_IMG[id]
      if inp then
        local img = inp:GetValue(req)
        if img then OutImage:Set(req, img) return end
      end
    end
  end
end

-- In Resolve 20 GetValue() returns LuaJIT FFI objects (cdata "struct Number *"),
-- not Lua numbers, so always unwrap .Value and coerce numbers.
local function grUnwrap(v)
  if v == nil or type(v) == "number" or type(v) == "string" then return v end
  local ok, inner = pcall(function() return v.Value end)
  if ok and inner ~= nil then v = inner end
  if type(v) == "number" or type(v) == "string" then return v end
  return tonumber(v) -- a cdata double becomes a number; anything else nil
end

local function grValues(req)
  local P = {}
  for id, inp in pairs(GR_IN) do
    P[id] = grUnwrap(inp:GetValue(req))
  end
  return P
end

-- The comp's frame range, so effects animate from the start of the clip and
-- transitions know how far through they are. Resolve's Fuse API has no
-- Comp:GetAttrs(), so the templates feed the range in through expressions
-- (comp.RenderStart / comp.RenderEnd); the other sources are fallbacks.
local function grRange(tool, P)
  local rs, re
  -- both default to -1, and stay 0/0 if the expressions did not evaluate
  if P and type(P.rangeStart) == "number" and type(P.rangeEnd) == "number" and P.rangeEnd > P.rangeStart then
    rs, re = P.rangeStart, P.rangeEnd
  end
  if not rs then
    pcall(function()
      local a, b = tonumber(grUnwrap(tool.Comp.RenderStart)), tonumber(grUnwrap(tool.Comp.RenderEnd))
      if type(a) == "number" and type(b) == "number" and b > a then rs, re = a, b end
    end)
  end
  if not rs then
    pcall(function()
      local a = tool.Comp:GetAttrs()
      if a and a.COMPN_RenderEnd then rs, re = a.COMPN_RenderStart or 0, a.COMPN_RenderEnd end
    end)
  end
  if GR_DEBUG then print(string.format("[Glitch Rig]   comp range %s..%s", tostring(rs), tostring(re))) end
  rs = rs or 0
  return rs, re or rs + 100000
end

local function grFps(tool)
  return tool.Comp:GetPrefs("Comp.FrameFormat.Rate") or 24
end

local function grM(v, a, b) return a + (b - a) * v end

local function grRound(v) return math.floor((v or 0) + 0.5) end

-- An output image like `like` (always full size; small kernels just use the
-- corner they need).
local function grImage(comp, like)
  return Image({ IMG_Like = like, IMG_DeferAlloc = true })
end

local function grSize(img)
  local w = img.Width or img.DataWindow:Width()
  local h = img.Height or img.DataWindow:Height()
  return w, h
end

-- Run one DCTL kernel. setp(p) fills the parameter block; inputs is a list of
-- { kernelArgName, image }. Returns the output image (nil if it failed).
local function grRun(req, comp, kname, code, pdecl, setp, inputs, like)
  return grGuarded("kernel " .. kname, function()
    local out = grImage(comp, like)
    local okNode, node = pcall(DVIPComputeNode, req, kname, code, kname .. "Params", pdecl)
    if not okNode or not node then
      print("[Glitch Rig] GPU kernels unavailable (DVIPComputeNode): " .. tostring(node))
      return nil
    end
    local p = GR_PB[kname]
    if not (p and pcall(function() setp(p); node:SetParamBlock(p) end)) then
      p = node:GetParamBlock(pdecl)
      setp(p)
      node:SetParamBlock(p)
      GR_PB[kname] = p
    end
    node:AddSampler("RowSampler", TEX_FILTER_MODE_LINEAR, TEX_ADDRESS_MODE_CLAMP, TEX_NORMALIZED_COORDS_TRUE)
    for i = 1, #inputs do node:AddInput(inputs[i][1], inputs[i][2]) end
    node:AddOutput("dst", out)
    if not node:RunSession(req) then
      print("[Glitch Rig] kernel " .. kname .. " failed:")
      local okLog, log = pcall(function() return node:GetErrorLog() end)
      print(tostring(okLog and log or "(no error log)"))
      return nil
    end
    grProbe(kname, out)
    return out
  end)
end

local function grCommon(p, w, h, t, scale)
  p.width = w
  p.height = h
  p.compOrder = 15
  p.iTime = t
  p.scale = scale
end

-- The input image at another frame (history for trails), or nil.
local function grAt(input, req, time)
  return grGuarded("history", function()
    local ok, img = pcall(function() return input:GetSource(time, req:GetFlags()) end)
    if ok and img then return img end
    return nil
  end)
end

-- Glow, light streaks, RGB split, scanlines, grain, vignette, flicker, grade.
local function grFinish(req, comp, img, t, o)
  if not img then return nil end
  local W, H = grSize(img)
  local s = H / 540
  local wantGlow = (o.glow or 0) > 0.001 or (o.streaks or 0) > 0.001
  local glowT, streakT = img, img
  if wantGlow then
    local ex = grRun(req, comp, "GRExtract", GR_K.GRExtract, GR_P.GRExtract, function(p) grCommon(p, W, H, t, s); p.thresh = o.thresh or 0.55 end, { { "src", img } }, img)
    local function blur(src, dx, dy)
      return grRun(req, comp, "GRBlur", GR_K.GRBlur, GR_P.GRBlur, function(p) grCommon(p, W, H, t, s); p.dx = dx; p.dy = dy end, { { "src", src } }, img)
    end
    local a = ex and blur(ex, 4 * s, 0)
    local b = a and blur(a, 0, 4 * s)
    a = b and blur(b, 8 * s, 0)
    glowT = (a and blur(a, 0, 8 * s)) or img
    if ex and (o.streaks or 0) > 0.001 then
      local function streak(src, step)
        return grRun(req, comp, "GRStreak", GR_K.GRStreak, GR_P.GRStreak, function(p) grCommon(p, W, H, t, s); p.stepPx = step end, { { "src", src } }, img)
      end
      local st = streak(ex, 4 * s)
      st = st and streak(st, 16 * s)
      st = st and streak(st, 56 * s)
      streakT = (st and streak(st, 160 * s)) or img
    end
  end
  local tint = o.streakTint or { 0.75, 0.9, 1.0 }
  return grRun(req, comp, "GRComposite", GR_K.GRComposite, GR_P.GRComposite, function(p)
    grCommon(p, W, H, t, s)
    p.glow = o.glow or 0
    p.streaks = o.streaks or 0
    p.rgb = o.rgb or 0
    p.scanlines = o.scanlines or 0
    p.scanline = o.scanline or 0
    p.grain = o.grain or 0
    p.vignette = o.vignette or 0
    p.flicker = o.flicker or 0
    p.bright = o.bright or 1
    p.contrast = o.contrast or 1
    p.satur = o.satur or 1
    p.hue = o.hue or 0
    p.streakTint[0] = tint[1]
    p.streakTint[1] = tint[2]
    p.streakTint[2] = tint[3]
    p.useGlow = wantGlow and 1 or 0
  end, { { "src", img }, { "glowT", glowT }, { "streakT", streakT } }, img)
end

-- Read every registered control into a plain table: P.size, P.chars ...

