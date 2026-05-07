/**
 * Pravidla pro automatické předvyplnění výkonů podle modality a věku pacienta.
 *
 * Pravidla jsou byznys-specifická pro DC Flipper. Pokud se mění (přibyde
 * pravidlo, jiný kód, jiná věková rozpětí), edituj jen tady.
 *
 * Každé pravidlo má:
 *   - kdy platí (modalita, věkové rozpětí, případně další podmínky)
 *   - co přidat (kód výkonu)
 *
 * VykonyEditor pak při mountu kódy přefiltruje a předvybere ve své tabulce.
 */

import type { Modalita } from "./parser";

export interface AutoFillRule {
  /** Kód výkonu (např. "09556") */
  code: string;
  /** Default počet — typicky 1 */
  count: number;
  /** Komentář pro uživatele — proč se to přidalo */
  reason: string;
}

interface RuleConditions {
  /** Modalita vyšetření (RTG/SONO/MR/CT) */
  modalita: Modalita;
  /** Věk pacienta v letech, nebo null pokud nelze vypočítat */
  age: number | null;
}

/**
 * Vrátí seznam výkonů, které mají být automaticky předvyplněné.
 * Volá se při otevření modalu (a/nebo otevření VykonyEditoru).
 */
export function getAutoFillServices(
  conditions: RuleConditions
): AutoFillRule[] {
  const out: AutoFillRule[] = [];

  // RTG: dítě 6 ≤ věk < 12 → kód 09556
  if (
    conditions.modalita === "RTG" &&
    conditions.age !== null &&
    conditions.age >= 6 &&
    conditions.age < 12
  ) {
    out.push({
      code: "09556",
      count: 1,
      reason: "RTG dítě 6–12 let",
    });
  }

  // TODO: další pravidla pro SONO, MR, CT podle DC Flipper účtování.
  // Až se budou přidávat, doplnit sem nebo do externí konfigurace.

  return out;
}
