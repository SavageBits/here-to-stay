/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** App version from package.json, injected at build time (see vite.config.ts). */
declare const __APP_VERSION__: string
/** ISO-8601 build timestamp, injected at build time. */
declare const __BUILD_TIME__: string
