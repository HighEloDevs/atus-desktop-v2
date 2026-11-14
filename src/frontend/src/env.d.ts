/// <reference types="vite/client" />

/** The application version, injected at build time from `package.json` (see `vite.config.ts`). */
declare const __APP_VERSION__: string;

/** The changelog embedded in the build (`vite-plugin-changelog.ts`); validate it before use. */
declare module "virtual:changelog" {
  const changelog: unknown;
  export default changelog;
}

/** The release scripts are plain JavaScript; the Vite plugin only needs their functions. */
declare module "*.mjs";
