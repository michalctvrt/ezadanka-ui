/**
 * Pomocné funkce pro práci s českým rodným číslem (RČ).
 *
 * Z RČ jde odvodit:
 *   - datum narození (YYYY-MM-DD)
 *   - pohlaví (MALE/FEMALE)
 *
 * Pravidla:
 *   - 9 cifer: pacienti narození před 1.1.1954 (bez kontrolní cifry)
 *   - 10 cifer: novější RČ s kontrolní cifrou (modulo 11)
 *   - Měsíc + 50 = žena
 *   - Měsíc + 20 / +70 = překlopený rok od r. 2004
 */

import type { Gender } from "./patient-types";

export interface RcParseResult {
  /** Vstupní RČ po normalizaci (bez lomítka) */
  normalized: string;
  validFormat: boolean;
  validChecksum: boolean;
  /** Datum narození (YYYY-MM-DD) — jen když validFormat */
  birthDate: string | null;
  gender: Gender | null;
  error: string | null;
}

export function normalizeRc(input: string): string {
  return input.trim().replace(/\s+/g, "").replace("/", "");
}

export function parseRc(input: string): RcParseResult {
  const rc = normalizeRc(input);

  if (!/^\d{9,10}$/.test(rc)) {
    return {
      normalized: rc,
      validFormat: false,
      validChecksum: false,
      birthDate: null,
      gender: null,
      error: "Rodné číslo musí mít 9 nebo 10 cifer.",
    };
  }

  const yy = parseInt(rc.substring(0, 2), 10);
  let mm = parseInt(rc.substring(2, 4), 10);
  const dd = parseInt(rc.substring(4, 6), 10);

  let gender: Gender;
  if (mm > 50 && mm <= 62) {
    gender = "FEMALE";
    mm -= 50;
  } else if (mm > 70 && mm <= 82) {
    gender = "FEMALE";
    mm -= 70;
  } else if (mm > 20 && mm <= 32) {
    gender = "MALE";
    mm -= 20;
  } else if (mm >= 1 && mm <= 12) {
    gender = "MALE";
  } else {
    return {
      normalized: rc,
      validFormat: false,
      validChecksum: false,
      birthDate: null,
      gender: null,
      error: "Rodné číslo má neplatný měsíc.",
    };
  }

  // 9cif → vždy 1900+yy. 10cif → yy <= 53 → 2000+yy, jinak 1900+yy
  const fullYear =
    rc.length === 9 ? 1900 + yy : yy <= 53 ? 2000 + yy : 1900 + yy;

  const date = new Date(Date.UTC(fullYear, mm - 1, dd));
  const isValidDate =
    date.getUTCFullYear() === fullYear &&
    date.getUTCMonth() === mm - 1 &&
    date.getUTCDate() === dd;

  if (!isValidDate) {
    return {
      normalized: rc,
      validFormat: false,
      validChecksum: false,
      birthDate: null,
      gender: null,
      error: "Rodné číslo obsahuje neplatné datum narození.",
    };
  }

  const birthDate = `${fullYear}-${String(mm).padStart(2, "0")}-${String(
    dd
  ).padStart(2, "0")}`;

  let validChecksum = true;
  if (rc.length === 10) {
    const num = parseInt(rc, 10);
    const mod = num % 11;
    const checkDigit = parseInt(rc[9], 10);
    validChecksum = mod === 10 ? checkDigit === 0 : mod === 0;
  }

  return {
    normalized: rc,
    validFormat: true,
    validChecksum,
    birthDate,
    gender,
    error: validChecksum ? null : "Kontrolní cifra rodného čísla nesedí.",
  };
}

/** Formátuje RČ pro zobrazení (s lomítkem za 6 ciframi). */
export function formatRc(rc: string): string {
  if (!rc || rc.length <= 6) return rc ?? "";
  return `${rc.substring(0, 6)}/${rc.substring(6)}`;
}
