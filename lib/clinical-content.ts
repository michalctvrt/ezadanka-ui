/**
 * Dekódování klinického obsahu z eŽádanky.
 *
 * Pole `zasilka.dokument[0].soubor.soubor` je Base64-encoded URL-encoded JSON.
 * Tato vrstva navíc kódování existuje historicky (viz vysvětlení v Node klientovi
 * `ezadanka-client/server/services/mzcrApi.js`). Frontend si musí klinický
 * obsah dekódovat sám — Václavův Java backend neredukuje, jen forwarduje.
 *
 * Workflow:
 *   `Soubor.soubor` (string) → atob() → URL-encoded string → decodeURIComponent()
 *   → JSON string → JSON.parse() → ClinicalContent
 *
 * Příklad odpovědi v `lib/mock-data.ts`.
 */

// ─── Sub-typy v rámci klinického obsahu ────────────────────────────────────

/** FHIR-style coded value */
export interface Coding {
  system?: string;
  code: string;
  display?: string;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface BiometrickyUdaj {
  /** Jednotka — "CM" pro výšku, "KG" pro váhu */
  kod: string;
  /** Hodnota — někdy přijde jako string, někdy jako number — sjednotíme */
  hodnota: string | number;
  /** ISO 8601 datetime, kdy byla hodnota naměřena */
  datum?: string;
}

export interface BiometrickeUdaje {
  vyska?: BiometrickyUdaj;
  vaha?: BiometrickyUdaj;
}

export interface PozadovaneVysetreni {
  /** Kód vyšetření (např. text "RTG snímek (DX) Koleno vlevo") */
  kodVysetreni?: CodeableConcept;
  nazevVysetreni?: string;
  /** Modalita podle DICOM (DX, US, MR, CT, ...) */
  metodaMereni?: CodeableConcept[];
  /** Anatomická část — koleno, břicho, hlava, ... */
  castTela?: CodeableConcept;
  /** Lateralita — vlevo, vpravo, oboustranně (SNOMED CT) */
  lateralita?: CodeableConcept;
  poznamka?: string;
  informaceProPacienta?: string;
  urgentnost?: string;
}

export interface DuvodObjednavky {
  /** Hlavní diagnóza (ICD-10 / MKN-10) */
  problem?: CodeableConcept;
  /** Volný text klinické otázky lékaře */
  klinickaOtazkaText?: string[];
  /** Volný text důvodu */
  duvodText?: string[];
}

export interface InformaceOObjednavce {
  duvodObjednavky?: DuvodObjednavky;
  detailyObjednavky?: { datumACas?: string }[];
}

/** Plný dekódovaný klinický obsah (z `dokument[].soubor.soubor`) */
export interface ClinicalContent {
  autorId?: string;
  zadatelId?: string;
  pacient?: string;
  adresatId?: string;
  dodatecnyPrijemce?: unknown[];
  typZadanky?: string;
  icp?: string;

  uhrada?: CodeableConcept;
  pozadovanaVysetreni?: PozadovaneVysetreni[];
  informaceOObjednavce?: InformaceOObjednavce;
  biometrickeUdaje?: BiometrickeUdaje;
  omezeniMobility?: CodeableConcept;
  prilohy?: unknown[];

  /** Catch-all — MZČR může přidat pole, která jsme zatím neviděli */
  [key: string]: unknown;
}

// ─── Dekódovací funkce ────────────────────────────────────────────────────

/**
 * Dekóduje obsah z `dokument.soubor.soubor` na strukturovaný objekt.
 * Vrací `null`, pokud dekódování selže (typicky když pole chybí nebo
 * je v jiném formátu než Base64-URL-JSON).
 */
export function decodeClinicalContent(
  encoded: string | undefined | null
): ClinicalContent | null {
  if (!encoded) return null;

  try {
    // Krok 1: Base64 → bytes → UTF-8 string (ten je URL-encoded)
    const urlEncoded = atob(encoded);
    // Krok 2: URL decode → JSON string
    const jsonStr = decodeURIComponent(urlEncoded);
    // Krok 3: JSON parse
    const obj = JSON.parse(jsonStr) as ClinicalContent;
    return obj;
  } catch (e) {
    // Tichá chyba — UI fallne zpět na to, co je v `Zadanka` na top-level
    console.warn(
      "[clinical-content] dekódování selhalo:",
      (e as Error).message
    );
    return null;
  }
}
