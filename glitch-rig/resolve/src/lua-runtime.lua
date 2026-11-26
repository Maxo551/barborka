-- GLITCH RIG — shared Lua runtime, inlined into every generated .fuse.

local GR_PB = {}

-- Comp frame range and rate, so effects animate from the start of the clip and
-- transitions know how far through they are.
local function grRange(tool)
  local a = tool.Comp:GetAttrs() or {}
  local rs = a.COMPN_RenderStart or a.COMPN_GlobalStart or 0
  local re = a.COMPN_RenderEnd or a.COMPN_GlobalEnd or rs + 1
  return rs, re
end

local function grFps(tool)
  return tool.Comp:GetPrefs("Comp.FrameFormat.Rate") or 24
end

local function grM(v, a, b) return a + (b - a) * v end

local function grRound(v) return math.floor((v or 0) + 0.5) end

-- An output image like `like`, optionally at another size.
local function grImage(comp, like, w, h)
  if w then
    local ok, img = pcall(function()
      return Image({
        IMG_Document = comp,
        { IMG_Channel = "Red" }, { IMG_Channel = "Green" }, { IMG_Channel = "Blue" }, { IMG_Channel = "Alpha" },
        IMG_Width = w, IMG_Height = h, IMG_XScale = like.XScale, IMG_YScale = like.YScale,
        IMG_Depth = like.Depth, IMG_DeferAlloc = true,
      })
    end)
    if ok and img then return img end
  end
  return Image({ IMG_Like = like, IMG_DeferAlloc = true })
end

local function grSize(img)
  local w = img.Width or img.DataWindow:Width()
  local h = img.Height or img.DataWindow:Height()
  return w, h
end

-- Run one DCTL kernel. setp(p) fills the parameter block; inputs is a list of
-- { kernelArgName, image }. Returns the output image (nil if it failed).
local function grRun(req, comp, kname, code, pdecl, setp, inputs, like, w, h)
  local out = grImage(comp, like, w, h)
  local node = DVIPComputeNode(req, kname, code, kname .. "Params", pdecl)
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
    print("[Glitch Rig] kernel " .. kname .. " failed")
    dump(node:GetErrorLog())
    return nil
  end
  return out
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
  local ok, img = pcall(function() return input:GetSource(time, req:GetFlags()) end)
  if ok and img then return img end
  return nil
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
    local a = blur(ex, 4 * s, 0)
    local b = blur(a, 0, 4 * s)
    a = blur(b, 8 * s, 0)
    glowT = blur(a, 0, 8 * s) or img
    if (o.streaks or 0) > 0.001 then
      local function streak(src, step)
        return grRun(req, comp, "GRStreak", GR_K.GRStreak, GR_P.GRStreak, function(p) grCommon(p, W, H, t, s); p.stepPx = step end, { { "src", src } }, img)
      end
      local st = streak(ex, 4 * s)
      st = streak(st, 16 * s)
      st = streak(st, 56 * s)
      streakT = streak(st, 160 * s) or img
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
local function grValues(req)
  local P = {}
  for id, inp in pairs(GR_IN) do
    local v = inp:GetValue(req)
    if type(v) == "table" or type(v) == "userdata" then v = v.Value end
    P[id] = v
  end
  return P
end
