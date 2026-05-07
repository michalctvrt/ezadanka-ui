/**
 * API klient pro číselník zdravotnických zařízení / poskytovatelů
 * (medical institutions).
 *
 * Používá se v EzadankaDetail — před POST /study si ověřujeme, jestli
 * IČP žadatele z eŽádanky existuje v naší DB. Pokud ne, recepční
 * dostane varování, aby ho nejdřív založila v JSF kartoteře — backend
 * by jinak vrátil 422 ("MedicalInstitution ID xxx not found").
 *
 * TODO ověřit s Václavem: existuje GET /medical-institution/{id}?
 * Pokud ne, použijeme search endpoint.
 */

export interface MedicalInstitutionInfo {
  /** IČP / ICZ zařízení */
  id: string;
  /** Krátký název */
  description?: string;
  /** Plný název / popis */
  descriptionLong?: string;
  /** IČO */
  ico?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

/**
 * Detail poskytovatele podle IČP.
 * Vrátí `null`, pokud poskytovatel v DB neexistuje (HTTP 404).
 * Hodí ostatní HTTP chyby — volající si je má zachytit a graceful-fallback.
 */
export async function findMedicalInstitutionById(
  id: string
): Promise<MedicalInstitutionInfo | null> {
  const res = await fetch(
    `${API_BASE}/medical-institution/${encodeURIComponent(id)}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `GET /medical-institution/${id} selhalo HTTP ${res.status}`
    );
  }
  return (await res.json()) as MedicalInstitutionInfo;
}
