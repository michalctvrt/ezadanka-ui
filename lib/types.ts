/**
 * TypeScript typy pro eŽádanka API.
 *
 * Odvozeno z OpenAPI spec Václavova `CardFileWebWS/openapi` + ověřeno
 * proti reálné odpovědi `GET /CardFileWebWS/rest/ezadanka/{id}` (žádanka
 * YXQWNAGG, 2026-05-06).
 *
 * Endpointy:
 *   GET /ezadanka/{id}              → NactiZadankuDto (detail podle UUID)
 *   GET /ezadanka?pid={rid}&...     → VyhledejZadankuDto[] (seznam podle RČ)
 *
 * 🔴 Důležité — co Václav VRACÍ vs. co OpenAPI deklaruje:
 *
 * OpenAPI ukazuje, že odpověď obsahuje `zadankaZ` / `zadankaFt` / `zadankaK`
 * s rozparsovaným klinickým obsahem (biometrie, vyšetření, lateralita).
 * V REÁLNÉ odpovědi tahle pole chybí. Klinický obsah je stále zabalený
 * v `zasilka.dokument[0].soubor.soubor` jako Base64 + URL-encoded JSON
 * (stejně jako vrací MZČR API). Musíme ho dekódovat na FE — viz
 * `lib/clinical-content.ts`.
 */

// ─── Sdílené ──────────────────────────────────────────────────────────────

/** Položka číselníku (stav, urgentnost, modalita, jazyk, ...) */
export interface PolozkaCiselnikuDto {
  ciselnikKod?: string;
  kod?: string;
  verze?: string;
  nazev?: string;
  popis?: string;
}

/** Osoba — pacient / lékař / zdravotnický pracovník */
export interface Osoba {
  jmeno?: string;
  prijmeni?: string;
  titulPred?: string;
  datumNarozeni?: string; // YYYY-MM-DD
  preferovanyJazyk?: string;
  kodPojisteni?: string;

  // ─ Rozšířené pole MZČR (přidáno do API v červnu 2026) ──────────────────
  /** Skutečné RČ pacienta (10 cifer bez lomítka) — bývá ≠ rid (test PID) */
  cisloPojistence?: string;
  /** RID = test PID (pro non-rezidenty / cizince) */
  rid?: string;
  /** Kontaktní email pacienta z eŽádanky */
  kontaktniEmail?: string;
  /** Adresa pacienta jako jeden řádek ("město, ulice, číslo") */
  adresaCela?: string;
  /** RÚIAN ID adresy */
  ruianId?: string;
  /** IČO (u poskytovatelů) */
  ico?: string;
  /** Název (u poskytovatelů) */
  nazev?: string;
  /** krzpId zdravotnického pracovníka */
  krzpId?: string;
}

// ─── Hlavní entity ────────────────────────────────────────────────────────

/** Žádanka — administrativní obálka (bez klinického obsahu) */
export interface Zadanka {
  id: string; // UUID
  verzeRadku: string; // Base64 token pro concurrency control
  stav: PolozkaCiselnikuDto;
  kod: string; // alfanumerický, např. "YXQWNAGG"
  urgentnost: PolozkaCiselnikuDto;

  samoplatce: boolean;
  prilozenVzorek: boolean;
  omezeniMobility: boolean;
  popisOmezeniMobility: string;
  instrukceProPacienta: string;
  pacientImplantat: boolean;

  zpusobVyrizeni?: PolozkaCiselnikuDto;
  zpusobVyrizeniUpresneni?: string;

  nadrizenaZadankaId?: string;
  zasilkaVysledekId?: string;

  // Datumy v životním cyklu
  datumStorna?: string;
  datumZaznaceniNeproveditelnosti?: string;
  datumPoslednihoVraceniDoObehu?: string;
  datumPoslednihoPrijeti?: string;
  datumRozdeleni?: string;
  datumVyrizeni?: string;
  datumExpirace?: string;
  datumPlanovanehoVysetreni?: string;
  datumSkutecneRealizaceVysetreni?: string;

  pacientPojistovna?: PolozkaCiselnikuDto;
  icpZadatele: string;

  vzorekData: unknown[];
  zasilka: Zasilka;
  dodatecnyPrijemce: unknown[];
  metodaData: PolozkaCiselnikuDto[];
}

/** Zásilka — obálka kolem dokumentů (FHIR Bundle ekvivalent) */
export interface Zasilka {
  id: string;
  verzeRadku: string;
  nazev?: string;
  popis?: string;

  stav?: PolozkaCiselnikuDto;
  typ?: PolozkaCiselnikuDto;
  klasifikace?: PolozkaCiselnikuDto;
  odbornost?: PolozkaCiselnikuDto;

  datumOd?: string;
  datumDo?: string;
  datumVytvoreni?: string;

  // Lidé
  autor?: string;
  autorData?: Osoba;
  zdravotnickyPracovnik?: string;
  zdravotnickyPracovnikData?: Osoba;
  poskytovatel?: string; // IČO
  poskytovatelData?: Osoba | Record<string, never>; // může být {}
  pacient?: string; // RID = rodné číslo bez lomítka
  pacientData?: Osoba;

  ispzs?: string;
  adresat?: string;
  adresatData?: Osoba;
  adresatTyp?: PolozkaCiselnikuDto;
  dostupnost?: boolean;
  rodic?: string;
  udalost?: PolozkaCiselnikuDto;
  datumUkonceniPublikovani?: string;

  /** Dokumenty — typicky 1× klinický obsah (FHIR JSON v Base64) */
  dokument: Dokument[];
}

/** Dokument uvnitř zásilky */
export interface Dokument {
  id: string;
  verzeRadku: string;
  nazev?: string;
  popis?: string;
  jazyk?: PolozkaCiselnikuDto;
  typ?: PolozkaCiselnikuDto;
  klasifikace?: PolozkaCiselnikuDto;
  kod?: string;

  autor?: string;
  autorData?: Osoba;
  poskytovatel?: string;
  poskytovatelData?: Osoba | Record<string, never>;
  pacient?: string;
  pacientData?: Osoba;

  dostupnost?: boolean;
  duvernost?: PolozkaCiselnikuDto;
  format?: PolozkaCiselnikuDto;
  mime?: PolozkaCiselnikuDto;
  hash?: string;
  velikost?: number;
  vazanyDokument?: string;

  /** Vlastní obsah — Base64 + URL-encoded JSON */
  soubor?: Soubor;
  slozka?: unknown;
}

export interface Soubor {
  id: string;
  /** Base64-encoded URL-encoded JSON s klinickým obsahem */
  soubor: string;
  cesta?: string;
}

// ─── Endpoint odpovědi ────────────────────────────────────────────────────

/** GET /ezadanka/{id} — detail jedné žádanky */
export interface NactiZadankuDto {
  zadanka: Zadanka;
  /** OpenAPI deklaruje, ale Václav reálně nevrací (vždy undefined) */
  zadankaZ?: unknown;
  zadankaFt?: unknown;
  zadankaK?: unknown;
  vysledkyZadanky: Zasilka[];
  podrizeneZadanky: Zadanka[];
}

/** GET /ezadanka?pid=... — položka v seznamu */
export interface VyhledejZadankuDto {
  zadanka: Zadanka;
  zadankaZ?: unknown;
  zadankaFt?: unknown;
  zadankaK?: unknown;
}

/** GET /ezadanka?pid=... → Array<VyhledejZadankuDto> */
export type VyhledejZadankuResponse = VyhledejZadankuDto[];

// ─── Chyba ────────────────────────────────────────────────────────────────

export interface EzadankaError {
  errorCode: string;
  errorMessage: string;
}
