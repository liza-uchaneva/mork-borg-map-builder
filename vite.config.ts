import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/mork-borg-map-builder/" : "/mork-borg-map-builder/",
}));
