// Wasm-based SVG→PNG rendering for OG images. The wasm + its JS wrapper, plus
// the .ttf font buffers, are loaded lazily so vitest (Node) doesn't try to
// resolve the wbg-bindgen / Data-module imports at module load — those are
// only valid inside Cloudflare Workers / Wrangler. resvg needs an embedded
// font or it renders shapes with no glyphs (text comes out invisible).

let initPromise: Promise<typeof import("@resvg/resvg-wasm")> | null = null;
let fontsPromise: Promise<Uint8Array[]> | null = null;

async function loadResvg() {
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import("@resvg/resvg-wasm");
      // @ts-expect-error -- no type declaration for raw wasm imports
      const wasm = (await import("@resvg/resvg-wasm/index_bg.wasm")).default;
      await mod.initWasm(wasm as WebAssembly.Module);
      return mod;
    })().catch((err) => {
      initPromise = null; // allow retry on the next request
      throw err;
    });
  }
  return initPromise;
}

async function loadFonts(): Promise<Uint8Array[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const regular = (await import("./fonts/Roboto-Regular.ttf")).default;
      const bold = (await import("./fonts/Roboto-Bold.ttf")).default;
      return [new Uint8Array(regular), new Uint8Array(bold)];
    })().catch((err) => {
      fontsPromise = null;
      throw err;
    });
  }
  return fontsPromise;
}

export async function svgToPng(svg: string): Promise<Uint8Array> {
  const { Resvg } = await loadResvg();
  const fontBuffers = await loadFonts();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      loadSystemFonts: false,
      fontBuffers,
      defaultFontFamily: "Roboto",
    },
  });
  return resvg.render().asPng();
}
