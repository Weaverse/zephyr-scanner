// Wasm-based SVG→PNG rendering for OG images. The wasm + its JS wrapper are
// loaded lazily so vitest (Node) doesn't try to resolve the wbg-bindgen imports
// at module load — that's only valid inside Cloudflare Workers / Wrangler.

let initPromise: Promise<typeof import("@resvg/resvg-wasm")> | null = null;

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

export async function svgToPng(svg: string): Promise<Uint8Array> {
  const { Resvg } = await loadResvg();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}
