import type { NextConfig } from "next";

/**
 * Konfigurace Next.js pro samostatný eŽádanka modul.
 *
 * 🎯 Cíl: statická SPA → WAR → Václavův EAR. Žádný server-side rendering,
 * žádné API routes. `npm run build` produkuje v `out/` čisté HTML+JS+CSS.
 *
 * Dev mód:
 *   - `npm run dev` na test serveru (localhost:4002)
 *   - Browser musí být přihlášený do CFLocalSyncWeb (= má JSESSIONIDSSO cookie)
 *   - Rewrites forwardují `/CardFileWebWS/*` na localhost:8080 (Payara)
 *
 * Produkce:
 *   - `npm run build` → static export do `out/`
 *   - Zabalí se do `.war` a nasadí pod `/CardFileWebWS/michalovo/`
 *   - Same-origin s backendem, cookie sdílí automaticky, žádné rewrites
 */

const isDev = process.env.NODE_ENV === "development";
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ?? "/CardFileWebWS/michalovo";
const backendForDev =
  process.env.BACKEND_BASE_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // V produkci statický export, v dev běžný Next dev server (kvůli rewrites)
  ...(isDev ? {} : { output: "export" as const }),

  // basePath jen v produkci — v dev nás brzdí (Next dev server vždy běží na /)
  basePath: isDev ? "" : basePath,

  // POZN.: Mělo to být `true` pro produkční static export (pretty URLs),
  // ale Next dev server tím přidává `/` i ke všem fetch volání API:
  //   `PUT /medical-institution/29224012/` ← Vaškův Jersey nedeserializuje
  // Pro REST API to dělá víc škody než užitku — vypnuto.
  trailingSlash: false,

  // Static export neumí Image optimization
  images: { unoptimized: true },

  // Rewrites jen v dev — production WAR poběží same-origin, žádný proxy nepotřebuje.
  // Forwardujeme:
  //   /CardFileWebWS/* → REST API (eŽádanky, pacienti, pojišťovny)
  //   /CFLocalSyncWeb/* → stará JSF kartoteka (link "Založit vyšetření" atd.)
  ...(isDev && {
    async rewrites() {
      return [
        {
          source: "/CardFileWebWS/:path*",
          destination: `${backendForDev}/CardFileWebWS/:path*`,
        },
        {
          source: "/CFLocalSyncWeb/:path*",
          destination: `${backendForDev}/CFLocalSyncWeb/:path*`,
        },
      ];
    },
  }),
};

export default nextConfig;
