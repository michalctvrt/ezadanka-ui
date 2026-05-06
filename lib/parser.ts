/**
 * Parser — z raw eŽádanka API odpovědi vyrobí ploché objekty pro UI.
 *
 * Toto je **jediné místo**, kde se řeší rozdíl mezi raw Václavova/MZČR
 * struktury a tím, co UI komponenty chtějí konzumovat. Když Václav něco
 * změní v API, opravíme jen tento soubor.
 *
 * Vstupy:
 *   - `Zadanka` z `NactiZadankuDto` nebo z `VyhledejZadankuDto`
 *   - Volitelně dekódovaný `ClinicalContent` (z `dokument.soubor.soubor`)
 *
 * Výstupy:
 *   - `FlatZadankaListItem` — pro tabulku (krátké, jen pro přehled)
 *   - `FlatZadankaDetail` — pro detail (vše, co UI ukazuje)
 */

import { decodeClinicalContent, type ClinicalContent } from "./clinical-content";
import type { NactiZadankuDto, VyhledejZadankuDto, Zadanka } from "./types";

// ─── Mapování modalit ─────────────────────────────────────────────────────

/**
 * Modalita zobrazovacího vyšetření odvozená z DICOM kódu.
 * MZČR posílá DICOM kódy: DX (digital RTG), CR (computed RTG), US (sono),
 * MR (magnetická rezonance), CT (CT). My UI sjednocujeme do 5 kategorií.
 */
export type Modalita = "RTG" | "SONO" | "MR" | "CT" | "OTHER";

const DICOM_TO_MODALITA: Record<string, Modalita> = {
  DX: "RTG",
  CR: "RTG",
  RG: "RTG",
  US: "SONO",
  MR: "MR",
  MRI: "MR",
  CT: "CT",
};

function mapModalita(dicom?: string): Modalita {
  if (!dicom) return "OTHER";
  return DICOM_TO_MODALITA[dicom.toUpperCase()] ?? "OTHER";
}

// ─── Plochý formát pro UI ─────────────────────────────────────────────────

export interface FlatZadankaListItem {
  /** UUID — pro načtení detailu */
  id: string;
  /** Alfanumerický kód, např. "YXQWNAGG" */
  kod: string;
  /** Stav — "Nová", "Přijatá", "Vyřízená", ... */
  stav: string;
  /** "rutinní" / "urgentní" / "statim" */
  urgentnost: string;
  /** RTG / SONO / MR / CT / OTHER */
  modalita: Modalita;
  /** Lidský popis vyšetření */
  vysetreniNazev: string;
  /** ISO datetime, kdy byla žádanka vystavena */
  datumVytvoreni: string | null;
  /** Pacient — jen pro přehled v seznamu */
  pacient: {
    rid: string;
    jmeno: string;
    prijmeni: string;
    /** Datum narození ze MZČR API (YYYY-MM-DD) — pro hlavičku pacienta nad seznamem */
    datumNarozeni: string | null;
  };
  /** Žadatel — kdo žádanku napsal */
  zadatel: string;
}

export interface FlatPacient {
  rid: string;
  jmeno: string;
  prijmeni: string;
  datumNarozeni: string | null;
  /** ICD-10 kód pojišťovny ("207", "111", ...) */
  pojistovnaKod: string | null;
  pojistovnaNazev: string | null;
}

export interface FlatZadatel {
  jmeno: string;
  /** Datum narození — jen u FO */
  datumNarozeni: string | null;
  /** IČO poskytovatele */
  poskytovatelIco: string;
  /** ICP — identifikátor pracoviště */
  icpZadatele: string;
}

export interface FlatVysetreni {
  /** Plný popis — "RTG snímek (DX) Koleno vlevo" */
  nazev: string;
  /** Modalita */
  modalita: Modalita;
  /** Modalita raw kód (DX, US, MR, ...) */
  modalitaKod: string | null;
  /** Anatomická část */
  castTela: string | null;
  /** Lateralita — "vlevo", "vpravo", "oboustranně" */
  lateralita: string | null;
  /** SNOMED kód laterality (240280007 = vlevo) */
  lateralitaKod: string | null;
  poznamka: string | null;
  informaceProPacienta: string | null;
}

export interface FlatDiagnoza {
  /** ICD-10 kód */
  kod: string | null;
  /** Slovní název diagnózy */
  nazev: string | null;
  /** Volný text klinické otázky */
  klinickaOtazka: string | null;
}

export interface FlatPacientStav {
  /** "chodící", "ležící", "vozíčkář", ... */
  omezeniMobility: string | null;
  /** Volný text k mobilitě */
  popisOmezeniMobility: string | null;
  /** Výška jako lidský string s jednotkou — "191 CM" */
  vyska: string | null;
  /** Váha — "112 KG" */
  vaha: string | null;
  /** Implantát v těle (pro MR důležité) */
  implantat: boolean;
  /** Samoplátce */
  samoplatce: boolean;
}

export interface FlatZadankaDetail {
  /** UUID */
  id: string;
  /** Alfanumerický kód, např. "YXQWNAGG" */
  kod: string;
  /** Concurrency token — uložit při edit operacích */
  verzeRadku: string;
  stav: string;
  urgentnost: string;
  datumVytvoreni: string | null;

  pacient: FlatPacient;
  zadatel: FlatZadatel;
  vysetreni: FlatVysetreni;
  diagnoza: FlatDiagnoza;
  pacientStav: FlatPacientStav;

  /** "samoplátce" / "zdravotní pojištění" */
  uhrada: string | null;

  /** Volné instrukce pro pacienta z Zadanka */
  instrukceProPacienta: string | null;

  /** Ze žádanky vystavený lékař (autor) */
  autor: {
    jmeno: string;
    datumNarozeni: string | null;
  } | null;
}

// ─── Hlavní funkce ────────────────────────────────────────────────────────

/**
 * Z raw `Zadanka` (volitelně + dekódovaný klinický obsah) vyrobí
 * krátkou položku pro tabulkový seznam.
 */
export function flattenListItem(
  raw: Zadanka,
  klinicky?: ClinicalContent | null
): FlatZadankaListItem {
  const modalitaKod = raw.metodaData?.[0]?.kod;
  const vysetreni = klinicky?.pozadovanaVysetreni?.[0];
  const vysetreniModality = vysetreni?.metodaMereni?.[0]?.coding?.[0]?.code;

  return {
    id: raw.id,
    kod: raw.kod,
    stav: raw.stav?.nazev ?? "Neznámý",
    urgentnost: raw.urgentnost?.nazev ?? "—",
    modalita: mapModalita(vysetreniModality ?? modalitaKod),
    vysetreniNazev:
      vysetreni?.nazevVysetreni ??
      raw.metodaData?.[0]?.nazev ??
      raw.zasilka?.nazev ??
      "—",
    datumVytvoreni: raw.zasilka?.datumVytvoreni ?? null,
    pacient: {
      rid: raw.zasilka?.pacient ?? "",
      jmeno: raw.zasilka?.pacientData?.jmeno ?? "",
      prijmeni: raw.zasilka?.pacientData?.prijmeni ?? "",
      datumNarozeni: raw.zasilka?.pacientData?.datumNarozeni ?? null,
    },
    zadatel: composePersonName(raw.zasilka?.autorData) || "—",
  };
}

/**
 * Z `NactiZadankuDto` vyrobí plochý detail. Dekóduje klinický obsah
 * z prvního dokumentu sám.
 */
export function flattenDetail(dto: NactiZadankuDto): FlatZadankaDetail {
  const raw = dto.zadanka;
  const dok = raw.zasilka?.dokument?.[0];
  const klinicky = decodeClinicalContent(dok?.soubor?.soubor);

  const vysetreni = klinicky?.pozadovanaVysetreni?.[0];
  const modalitaKod =
    vysetreni?.metodaMereni?.[0]?.coding?.[0]?.code ??
    raw.metodaData?.[0]?.kod ??
    null;

  const lateralitaCoding = vysetreni?.lateralita?.coding?.[0];
  const diagnozaCoding =
    klinicky?.informaceOObjednavce?.duvodObjednavky?.problem?.coding?.[0];

  return {
    id: raw.id,
    kod: raw.kod,
    verzeRadku: raw.verzeRadku,
    stav: raw.stav?.nazev ?? "Neznámý",
    urgentnost: raw.urgentnost?.nazev ?? "—",
    datumVytvoreni: raw.zasilka?.datumVytvoreni ?? null,

    pacient: {
      rid: raw.zasilka?.pacient ?? "",
      jmeno: raw.zasilka?.pacientData?.jmeno ?? "",
      prijmeni: raw.zasilka?.pacientData?.prijmeni ?? "",
      datumNarozeni: raw.zasilka?.pacientData?.datumNarozeni ?? null,
      pojistovnaKod: raw.pacientPojistovna?.kod ?? null,
      pojistovnaNazev: raw.pacientPojistovna?.nazev ?? null,
    },

    zadatel: {
      jmeno:
        composePersonName(raw.zasilka?.autorData) ||
        composePersonName(raw.zasilka?.zdravotnickyPracovnikData) ||
        "—",
      datumNarozeni:
        raw.zasilka?.autorData?.datumNarozeni ??
        raw.zasilka?.zdravotnickyPracovnikData?.datumNarozeni ??
        null,
      poskytovatelIco: raw.zasilka?.poskytovatel ?? "",
      icpZadatele: raw.icpZadatele ?? "",
    },

    vysetreni: {
      nazev:
        vysetreni?.nazevVysetreni ??
        vysetreni?.kodVysetreni?.text ??
        raw.metodaData?.[0]?.nazev ??
        raw.zasilka?.nazev ??
        "—",
      modalita: mapModalita(modalitaKod ?? undefined),
      modalitaKod,
      castTela: vysetreni?.castTela?.text ?? null,
      lateralita: lateralitaCoding?.display ?? null,
      lateralitaKod: lateralitaCoding?.code ?? null,
      poznamka: nullIfEmpty(vysetreni?.poznamka),
      informaceProPacienta: nullIfEmpty(vysetreni?.informaceProPacienta),
    },

    diagnoza: {
      kod: diagnozaCoding?.code ?? null,
      nazev: diagnozaCoding?.display ?? null,
      klinickaOtazka:
        klinicky?.informaceOObjednavce?.duvodObjednavky?.klinickaOtazkaText
          ?.filter((s) => s && s.trim() !== "")
          .join("; ") || null,
    },

    pacientStav: {
      omezeniMobility:
        klinicky?.omezeniMobility?.coding?.[0]?.display ??
        (raw.popisOmezeniMobility || null),
      popisOmezeniMobility: nullIfEmpty(raw.popisOmezeniMobility),
      vyska: formatBiometricValue(klinicky?.biometrickeUdaje?.vyska),
      vaha: formatBiometricValue(klinicky?.biometrickeUdaje?.vaha),
      implantat: raw.pacientImplantat ?? false,
      samoplatce: raw.samoplatce ?? false,
    },

    uhrada:
      klinicky?.uhrada?.coding?.[0]?.display ??
      (raw.samoplatce ? "samoplátce" : null),

    instrukceProPacienta: nullIfEmpty(raw.instrukceProPacienta),

    autor: raw.zasilka?.autorData
      ? {
          jmeno: composePersonName(raw.zasilka.autorData),
          datumNarozeni: raw.zasilka.autorData.datumNarozeni ?? null,
        }
      : null,
  };
}

/**
 * Z odpovědi `GET /ezadanka?pid=...` (pole VyhledejZadankuDto) vyrobí
 * pole položek pro tabulku. Pokud je v záznamu klinický dokument,
 * dekóduje ho — ne všechny seznamy ho ale obsahují.
 */
export function flattenList(
  items: VyhledejZadankuDto[]
): FlatZadankaListItem[] {
  return items.map((it) => {
    const klinicky = decodeClinicalContent(
      it.zadanka.zasilka?.dokument?.[0]?.soubor?.soubor
    );
    return flattenListItem(it.zadanka, klinicky);
  });
}

// ─── Helpery ──────────────────────────────────────────────────────────────

function composePersonName(o?: { jmeno?: string; prijmeni?: string }): string {
  if (!o) return "";
  return [o.jmeno, o.prijmeni].filter(Boolean).join(" ").trim();
}

function nullIfEmpty(s: string | undefined | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed === "" ? null : trimmed;
}

function formatBiometricValue(b?: {
  hodnota: string | number;
  kod: string;
}): string | null {
  if (!b || b.hodnota === undefined || b.hodnota === null) return null;
  return `${b.hodnota} ${b.kod}`;
}
