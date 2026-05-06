# ezadanka-ui

Samostatný React modul pro zobrazení eŽádanek pacienta. Build produkuje statickou SPA, která se zabalí do `.war` a přidává se do **CardFile-ear-2.0** (Václavův EAR pro distribuci kartoteky).

## Co modul dělá

- Vstup: rodné číslo pacienta (PID).
- Volá `GET /CardFileWebWS/rest/ezadanka?pid={rc}&onlyActive=true` → zobrazí seznam aktivních žádanek.
- Klik na žádanku → modal s detailem (volá `GET /CardFileWebWS/rest/ezadanka/{id}`).
- Klinický obsah (biometrie, vyšetření, lateralita, diagnóza) dekóduje z Base64-encoded JSON v `dokument[].soubor.soubor`.

## Stack

- Next.js 16 (App Router) — buildí statickou SPA
- React 19, TypeScript (strict)
- Tailwind CSS 3
- Radix UI (Dialog) + lucide-react (ikony)
- Žádný server-side rendering, žádné API routes — výstup je čistě HTML+JS+CSS

## Adresářová struktura

```
ezadanka-ui/
├── app/
│   ├── layout.tsx          root layout
│   ├── page.tsx            demo / showcase stránka
│   └── globals.css         Tailwind imports
├── components/
│   ├── ui/                 shadcn-style primitivy (Card, Button, Dialog)
│   ├── EzadankyList.tsx    tabulka aktivních eŽádanek pacienta
│   └── EzadankaDetail.tsx  modal s detailem
├── lib/
│   ├── types.ts            TS typy odvozené z OpenAPI Václavova backendu
│   ├── clinical-content.ts Base64 → JSON dekódér klinického obsahu
│   ├── parser.ts           raw API → ploché objekty pro UI
│   ├── api.ts              fetch wrapper kolem /CardFileWebWS/rest/ezadanka
│   └── utils.ts            cn() helper
├── next.config.ts          static export config + dev rewrites
└── package.json
```

## Lokální vývoj

Předpoklad: Václavův backend (`CardFileWebWS`) běží na `http://localhost:8080`. V dev módu (`npm run dev`) Next.js dev server forwarduje requesty `/CardFileWebWS/*` tam přes rewrites.

```bash
# Instalace
npm install

# Spuštění dev serveru (port 4002)
npm run dev
```

Aplikaci otevři na `http://localhost:4002`. Předtím se přihlaš v jiné záložce do staré kartoteky `http://<host>/CFLocalSyncWeb/`, aby browser měl `JSESSIONIDSSO` cookie. Bez ní backend vrátí 401.

Pokud běžíš na test serveru a backend je na jiné adrese, přepiš v `.env.local`:

```
BACKEND_BASE_URL=http://nejaky-host:8080
```

## Produkční build

```bash
npm run build
```

Vygeneruje statické soubory v `out/`. Default `basePath` je `/CardFileWebWS/michalovo/` — všechny linky a assety se generují s tímto prefixem. Pokud chceš nasadit jinam, přepiš:

```bash
NEXT_PUBLIC_BASE_PATH=/jine/umisteni npm run build
```

## Balení do WAR (pro Václava)

Statický `out/` adresář je vše, co je třeba dostat do `.war`. Minimální struktura:

```
ezadanka-ui-2.0.war
├── index.html
├── _next/                    JS, CSS, fonts
├── (další statické assety)
└── WEB-INF/
    └── web.xml               (volitelné, ale doporučené)
```

### `WEB-INF/web.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
                             http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0">
    <display-name>eZadanka UI</display-name>

    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
    </welcome-file-list>

    <!-- SPA fallback: všechny "neexistující" cesty vrátí index.html
         (jen pokud bude potřeba klientský router) -->
    <error-page>
        <error-code>404</error-code>
        <location>/index.html</location>
    </error-page>
</web-app>
```

### Přidání do `application.xml` v EAR

Do existujícího `CardFile-ear-2.0/META-INF/application.xml` přidej nový module:

```xml
<module>
    <web>
        <web-uri>ezadanka-ui-2.0.war</web-uri>
        <context-root>/CardFileWebWS/michalovo</context-root>
    </web>
</module>
```

Pozor — `context-root` musí odpovídat `basePath` v `next.config.ts` (default `/CardFileWebWS/michalovo`). Pokud změníš jedno, musíš i druhé.

## API kontrakt

Modul používá tyto endpointy (Václav je nasadil v `CardFile-webws`):

| Metoda | URL | Účel |
|---|---|---|
| GET | `/CardFileWebWS/rest/ezadanka?pid={rc}&onlyActive=true` | Seznam aktivních eŽádanek pacienta |
| GET | `/CardFileWebWS/rest/ezadanka/{uuid}` | Detail jedné žádanky |

Auth: FORM-based, sdílená session cookie `JSESSIONIDSSO` (path=`/`). Realm `cardfileRealm`, role `ASSIST`/`DOCTOR`/`ADMIN`.

## Poznámky

- **Klinický obsah** přichází zabalený jako Base64-encoded URL-encoded JSON v `dokument[].soubor.soubor`. Frontend si ho dekóduje sám (viz `lib/clinical-content.ts`). Důvod: MZČR API to tak vrací a Václav forwarduje raw data dál (žádný unwrap na backend straně).
- **Žádný vlastní backend** — tento modul je pouze UI. Veškeré volání MZČR API + mTLS + JWT je v Java vrstvě (`CardFile-webws`).
- **Coexistence se starou JSF kartotékou**: v JSF menu bude tlačítko "eŽádanky pacienta" linkovat na URL tohoto modulu. Sdílí session přes JSESSIONIDSSO, takže přihlášení proběhne jen jednou v JSF.
