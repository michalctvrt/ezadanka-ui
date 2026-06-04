/**
 * API klient pro systémové konfigurace.
 *
 * Vašek tu drží číselníky, které se nemění často, ale jsou potřeba na
 * správné nastavení dalších entit (např. `xmlExportDefinitions` pro
 * formulář zakládání lékaře — recepční vybírá, přes který XML export
 * systém je daný lékař napojen).
 */

export interface XmlExportDefinitionInfo {
  /** Krátký identifikátor (např. "CGM", "EZPRAVA") */
  id: string;
  /** Lidský název pro UI (např. "CGM XML Export") */
  name: string;
  /** Cesta k adresáři, kam se exportuje (jen pro admin) */
  exportDir: string;
  /** Sub-adresář (jen pro admin) */
  exportSubdir: string;
  /** XSLT transformace (jen pro admin) */
  xslt: string;
  /** Zapnutý záznam */
  flagEnabled: boolean;
  /** Vždy exportovat, i bez explicitního flagu */
  flagAlwaysExport: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

/**
 * Seznam všech XML export definic — pro LekarFormModal checkbox group.
 * Vrátí všechny (i disabled), ale UI by mělo respektovat `flagEnabled`.
 */
export async function listXmlExportDefinitions(): Promise<
  XmlExportDefinitionInfo[]
> {
  const res = await fetch(`${API_BASE}/configuration/xmlExportDefinitions`, {
    credentials: "include",
    headers: { Accept: "application/json, application/problem+json" },
  });
  if (!res.ok) {
    throw new Error(
      `GET /configuration/xmlExportDefinitions selhalo HTTP ${res.status}`
    );
  }
  return (await res.json()) as XmlExportDefinitionInfo[];
}
