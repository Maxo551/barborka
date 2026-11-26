// CPU emulation of the Fusion DCTL kernel environment, for testing kernels
// outside Resolve. Mirrors only what the Glitch Rig kernels use.
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <string>
struct float2 { float x, y; };
struct float3 { float x, y, z; };
struct float4 { float x, y, z, w; };
static inline float2 to_float2(float x, float y) { return {x, y}; }
static inline float3 to_float3(float x, float y, float z) { return {x, y, z}; }
static inline float4 to_float4(float x, float y, float z, float w) { return {x, y, z, w}; }
#define __DEVICE__ static inline
#define __KERNEL__ static
#define __CONSTANTREF__ const
struct Tex { int w = 0, h = 0; std::vector<float> px; };
#define __TEXTURE2D__ const Tex*
#define __TEXTURE2D_WRITE__ Tex*
static int g_x, g_y;
#define DEFINE_KERNEL_ITERATORS_XY(a, b) int a = g_x; int b = g_y;
#define _floor floorf
#define _fabs fabsf
#define _sinf sinf
#define _cosf cosf
#define _powf powf
#define _sqrtf sqrtf
#define _expf expf
#define _atan2f atan2f
#define _fmaxf fmaxf
#define _fminf fminf
#define _fmod fmodf
static float4 _tex2DVecN(const Tex* t, float u, float v, int) {
  float x = u * t->w - 0.5f, y = v * t->h - 0.5f;
  int x0 = (int)floorf(x), y0 = (int)floorf(y);
  float fx = x - x0, fy = y - y0;
  auto at = [&](int xi, int yi, int c) {
    xi = xi < 0 ? 0 : (xi >= t->w ? t->w - 1 : xi);
    yi = yi < 0 ? 0 : (yi >= t->h ? t->h - 1 : yi);
    return t->px[((size_t)yi * t->w + xi) * 4 + c];
  };
  float o[4];
  for (int c = 0; c < 4; c++) {
    float a = at(x0, y0, c) * (1 - fx) + at(x0 + 1, y0, c) * fx;
    float b = at(x0, y0 + 1, c) * (1 - fx) + at(x0 + 1, y0 + 1, c) * fx;
    o[c] = a * (1 - fy) + b * fy;
  }
  return {o[0], o[1], o[2], o[3]};
}
static void _tex2DVec4Write(Tex* t, int x, int y, float4 c) {
  float* p = &t->px[((size_t)y * t->w + x) * 4];
  p[0] = c.x; p[1] = c.y; p[2] = c.z; p[3] = c.w;
}
static Tex newTex(int w, int h) { Tex t; t.w = w; t.h = h; t.px.assign((size_t)w * h * 4, 0.f); return t; }
// raw RGBA8, top-down file -> bottom-up float texture (Fusion/GL orientation)
static Tex loadRaw(const char* path, int w, int h) {
  Tex t = newTex(w, h);
  std::vector<unsigned char> b((size_t)w * h * 4);
  FILE* f = fopen(path, "rb");
  if (!f || fread(b.data(), 1, b.size(), f) != b.size()) { fprintf(stderr, "cannot read %s\n", path); exit(1); }
  fclose(f);
  for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) for (int c = 0; c < 4; c++)
    t.px[((size_t)(h - 1 - y) * w + x) * 4 + c] = b[((size_t)y * w + x) * 4 + c] / 255.f;
  return t;
}
static void saveRaw(const char* path, const Tex& t) {
  std::vector<unsigned char> b((size_t)t.w * t.h * 4);
  for (int y = 0; y < t.h; y++) for (int x = 0; x < t.w; x++) for (int c = 0; c < 4; c++) {
    float v = t.px[((size_t)(t.h - 1 - y) * t.w + x) * 4 + c];
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    b[((size_t)y * t.w + x) * 4 + c] = (unsigned char)(v * 255.f + 0.5f);
  }
  FILE* f = fopen(path, "wb"); fwrite(b.data(), 1, b.size(), f); fclose(f);
}
template <class F> static void runAll(int w, int h, F fn) {
  for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { g_x = x; g_y = y; fn(); }
}
