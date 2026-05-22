import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://isyourstoreagentready.com",
  output: "hybrid",
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [tailwind({ applyBaseStyles: false }), react()],
  vite: {
    server: {
      port: 4321,
    },
  },
});
