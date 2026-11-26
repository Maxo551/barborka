#!/usr/bin/env python3
"""Runs the generated Glitch Rig fuses and templates against a mock of the
Fusion Lua API (no Resolve needed). Checks, for every fuse and many control
combinations, that:
  * the Lua parses and Create()/Process() run without errors,
  * every kernel parameter set from Lua exists in its declaration, has the right
    type and none is left unset,
  * every texture a kernel takes is bound under its exact name,
and for every .setting template that the tools and controls it references
exist. Usage: python3 resolve/test/fusion_mock_test.py
"""
import glob
import os
import sys

from lupa import LuaRuntime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MOCK = r'''
CT_Tool = 1
TEX_FILTER_MODE_LINEAR, TEX_ADDRESS_MODE_CLAMP, TEX_NORMALIZED_COORDS_TRUE = 1, 2, 3
MOCK = { runs = {}, values = {}, images = {}, out = nil, attrs = { COMPN_RenderStart = 0, COMPN_RenderEnd = 30 } }
function FuRegisterClass(name, ct, attrs) MOCK.reg = name end
function dump(x) print("DUMP", x) end

local function mkimg(w, h)
  return { Width = w, Height = h, XScale = 1, YScale = 1, Depth = 4,
    DataWindow = { Width = function() return w end, Height = function() return h end },
    GetPixel = function(img, x, y, p) assert(x >= 0 and x < w and y >= 0 and y < h, "GetPixel out of range"); p.R, p.G, p.B, p.A = 0.5, 0.5, 0.5, 1 end }
end
function Pixel(t) return t or { R = 0, G = 0, B = 0, A = 0 } end
MOCK.printed = {}
local realPrint = print
function print(...) local parts = {} for i = 1, select("#", ...) do parts[#parts + 1] = tostring((select(i, ...))) end MOCK.printed[#MOCK.printed + 1] = table.concat(parts, " ") end
MOCK.mkimg = mkimg

function Image(a)
  if a.IMG_Width then return mkimg(a.IMG_Width, a.IMG_Height) end
  assert(a.IMG_Like, "Image() without IMG_Like or size")
  return mkimg(a.IMG_Like.Width, a.IMG_Like.Height)
end

self = {
  Comp = {
    RenderStart = 0, RenderEnd = 30,
    GetPrefs = function(c, k) assert(k == "Comp.FrameFormat.Rate") return 30 end,
  },
}
MOCK.inputs = {}
function self:AddInput(label, id, attrs)
  assert(attrs.INP_Default == nil or type(attrs.INP_Default) == "number", "AddInput " .. id .. ": INP_Default must be a number")
  local inp = { id = id, attrs = attrs }
  function inp:GetValue(req)
    if attrs.LINKID_DataType == "Image" then return MOCK.images[id] end
    local v = MOCK.values[id]
    if v == nil then v = attrs.INP_Default end
    -- like Resolve's cdata Number: only .Value is usable, arithmetic fails
    return setmetatable({ Value = v }, { __add = function() error("arithmetic on Number object") end,
      __sub = function() error("arithmetic on Number object") end, __mul = function() error("arithmetic on Number object") end,
      __lt = function() error("comparison on Number object") end, __le = function() error("comparison on Number object") end })
  end
  function inp:GetSource(t, flags)
    assert(attrs.LINKID_DataType == "Image", "GetSource on a control")
    return MOCK.images[id]
  end
  MOCK.inputs[id] = inp
  return inp
end
function self:AddOutput(label, id, attrs)
  return { Set = function(o, req, img) MOCK.out = img end }
end

local function parseDecl(decl)
  local f = {}
  for stmt in decl:gmatch("[^;]+") do
    local typ, name, n = stmt:match("^%s*(%a+)%s+([%w_]+)%s*%[(%d+)%]%s*$")
    if typ then f[name] = { typ = typ, n = tonumber(n) }
    else
      typ, name = stmt:match("^%s*(%a+)%s+([%w_]+)%s*$")
      if typ then f[name] = { typ = typ } end
    end
  end
  return f
end

local function newBlock(kname, fields)
  local store, arrays = {}, {}
  for name, info in pairs(fields) do
    if info.n then
      arrays[name] = setmetatable({}, { __newindex = function(t, i, v)
        assert(type(i) == "number" and i >= 0 and i < info.n, kname .. ": bad index " .. name .. "[" .. tostring(i) .. "]")
        assert(type(v) == "number", kname .. ": non-number in " .. name)
        rawset(t, i, v)
      end })
    end
  end
  return setmetatable({}, {
    __index = function(_, k) if arrays[k] then return arrays[k] end return store[k] end,
    __newindex = function(_, k, v)
      assert(fields[k] and not fields[k].n, kname .. ": unknown param " .. tostring(k))
      assert(type(v) == "number", kname .. ": param " .. k .. " = " .. tostring(v))
      assert(v == v and v ~= math.huge and v ~= -math.huge, kname .. ": param " .. k .. " is not finite")
      if fields[k].typ == "int" then assert(math.floor(v) == v, kname .. ": int param " .. k .. " = " .. v) end
      store[k] = v
    end,
    store = store, arrays = arrays,
  })
end

function DVIPComputeNode(req, kname, code, pname, pdecl)
  assert(pname == kname .. "Params", "params name " .. pname)
  local sig = code:match("__KERNEL__ void " .. kname .. "%s*(%b())")
  assert(sig, "kernel " .. kname .. " not found in its code")
  assert(sig:find(pname .. "%*"), kname .. ": signature does not use " .. pname)
  local fields = parseDecl(pdecl)
  local tex = {}
  for n in sig:gmatch("__TEXTURE2D__%s+([%w_]+)") do tex[n] = true end
  local node = { bound = {} }
  function node:GetParamBlock(d) return newBlock(kname, fields) end
  function node:SetParamBlock(p)
    local mt = getmetatable(p)
    for k, info in pairs(fields) do
      if info.n then
        for i = 0, info.n - 1 do assert(rawget(mt.arrays[k], i) ~= nil, kname .. ": " .. k .. "[" .. i .. "] not set") end
      else
        assert(mt.store[k] ~= nil, kname .. ": param " .. k .. " not set")
      end
    end
  end
  function node:AddSampler() end
  function node:AddInput(n, img)
    assert(tex[n], kname .. ": kernel has no texture argument '" .. n .. "'")
    assert(img, kname .. ": nil image bound to " .. n)
    self.bound[n] = true
  end
  function node:AddOutput(n, img) assert(n == "dst", "output must be dst") end
  function node:RunSession(req)
    for n in pairs(tex) do assert(self.bound[n], kname .. ": texture '" .. n .. "' not bound") end
    MOCK.runs[#MOCK.runs + 1] = kname
    return true
  end
  function node:GetErrorLog() return "" end
  return node
end
'''

# control combinations to sweep per fuse: id -> values
SWEEPS = {
    'GR_DotMatrix': [('mode', range(6)), ('chars', range(9)), ('pmode', range(6)), ('rain', [0, 1]), ('streaks', [0, 1]), ('glow', [0, 1])],
    'GR_Grade': [('mode', range(12)), ('hasHud', [0, 1]), ('glitch', [0, 1])],
    'GR_Trip': [('variant', range(4)), ('colours', range(4)), ('patternColours', range(3))],
    'GR_Echo': [('variant', range(2)), ('blend', range(4)), ('tint', range(5)), ('matte', range(3))],
    'GR_Transition': [('mode', range(14)), ('direction', range(4)), ('colour', range(7)), ('autoProgress', [0, 1])],
    'GR_Datamosh': [('variant', range(4)), ('frames', range(3)), ('motion', range(3)), ('blockSize', range(3))],
    'GR_Title': [('style', range(10)), ('colour', range(8))],
}
INPUTS = {'GR_Transition': ['Background', 'Foreground'], 'GR_Datamosh': ['Background', 'Foreground']}


def run_fuse(path):
    name = os.path.basename(path)[:-5]
    lua = LuaRuntime(unpack_returned_tuples=True)
    lua.execute(MOCK)
    lua.execute(open(path, encoding='utf-8').read())
    lua.globals().Create()
    G = lua.globals()
    ids = set(G.MOCK.inputs.keys())
    for img_id in INPUTS.get(name, ['Input']):
        G.MOCK.images[img_id] = G.MOCK.mkimg(1920, 1080)
    runs = 0
    # the range the templates feed in through comp.RenderStart / comp.RenderEnd expressions
    G.MOCK.values = lua.table_from({'rangeStart': 0, 'rangeEnd': 24})
    req = lua.table_from({'Time': 12}); req.GetFlags = lua.eval('function(self) return 0 end')
    G.Process(req)
    assert any('comp range 0..24' in l for l in G.MOCK.printed.values()), f'{name}: template range not used'
    for key, values in SWEEPS[name]:
        assert key in ids, f'{name}: no control {key}'
        for v in values:
            vals = {key: v}
            if name in ('GR_Transition', 'GR_Datamosh') and key == 'autoProgress' and v == 0:
                vals['progress'] = 0.4
            G.MOCK.values = lua.table_from(vals)
            for t in ([0, 1, 2, 3, 7, 15, 29, 30] if name in ('GR_Transition', 'GR_Datamosh') else [0, 12]):
                G.MOCK.out = None
                req = lua.table_from({'Time': t})
                req.GetFlags = lua.eval('function(self) return 0 end')
                G.Process(req)
                assert G.MOCK.out is not None, f'{name}: no output at t={t} {key}={v}'
                runs += 1
    errors = [l for l in G.MOCK.printed.values() if ' error: ' in l or 'failed' in l or 'unavailable' in l or 'not created' in l]
    assert not errors, f'{name}: ' + errors[0]
    diag = [l for l in G.MOCK.printed.values() if l.startswith('[Glitch Rig]')]
    assert diag, f'{name}: no diagnostics printed'
    kernels = sorted(set(G.MOCK.runs.values()))
    return name, ids, runs, kernels


def check_setting(path, fuse_ids):
    lua = LuaRuntime()
    lua.execute(r'''
      function ordered() return function(t) return t end end
      local function ctor(kind) return function(t) t.__kind = kind return t end end
      MacroOperator, InstanceInput, InstanceOutput, Input = ctor("Macro"), ctor("InstanceInput"), ctor("InstanceOutput"), ctor("Input")
      GroupInfo, OperatorInfo, TextPlus = ctor("GroupInfo"), ctor("OperatorInfo"), ctor("TextPlus")
      Fuse = setmetatable({}, { __index = function(_, k) return function(t) t.__kind = "Fuse"; t.__fuse = k return t end end })
    ''')
    data = lua.execute('return ' + open(path, encoding='utf-8').read())
    tools = data.Tools
    macro_name = data.ActiveTool
    macro = tools[macro_name]
    assert macro is not None and macro.__kind == 'Macro', f'{path}: ActiveTool missing'
    inner = macro.Tools
    names = set(inner.keys())
    glitch = inner.Glitch
    assert glitch is not None and glitch.__kind == 'Fuse', f'{path}: no Glitch fuse tool'
    ids = fuse_ids[glitch.__fuse]
    for k in glitch.Inputs.keys():
        assert k in ids or k == 'Input', f'{path}: tool input {k} not in {glitch.__fuse}'
    text_ids = {'StyledText', 'Font', 'Style', 'Size'}
    for k, inst in macro.Inputs.items():
        assert inst.SourceOp in names, f'{path}: {k} -> unknown tool {inst.SourceOp}'
        if inst.SourceOp == 'Glitch':
            assert inst.Source in ids or inst.Source in ('Input', 'Background', 'Foreground'), f'{path}: {k} -> unknown control {inst.Source}'
        else:
            assert inst.Source in text_ids, f'{path}: {k} -> Text+ control {inst.Source}'
    out = macro.Outputs.MainOutput1
    assert out.SourceOp == 'Glitch' and out.Source == 'Output'
    return len(list(macro.Inputs.keys()))


def main():
    fuse_ids = {}
    for path in sorted(glob.glob(os.path.join(ROOT, 'Fuses', 'GlitchRig', '*.fuse'))):
        name, ids, runs, kernels = run_fuse(path)
        fuse_ids[name] = ids
        print(f'{name:14s} ok  {runs:4d} Process() calls  kernels: {", ".join(kernels)}')
    n = 0
    for path in sorted(glob.glob(os.path.join(ROOT, 'Templates', 'Edit', '*', 'Glitch Rig', '*.setting'))):
        check_setting(path, fuse_ids)
        n += 1
    print(f'templates ok: {n}')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # make failures readable
        print('FAILED:', e)
        sys.exit(1)
