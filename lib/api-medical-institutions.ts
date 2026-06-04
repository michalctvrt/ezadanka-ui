/**
 * API klient pro číselník zdravotnických zařízení / poskytovatelů
 * (medical institutions).
 *
 * Používá se ve dvou místech v EzadankaDetail:
 *   1) Pre-check existence IČP žadatele před POST /study
 *      (`findMedicalInstitutionById`).
 *   2) Založení nového lékaře přímo z eŽádanky, když IČP v DB chybí
 *      (`saveMedicalInstitution`) — recepční nemusí přepínat do JSF.
 */

export interface MedicalSkillInfo {
  /** Kód odbornosti (např. "001" pro praktického lékaře) */
  id: string;
  /** Název odbornosti */
  name: string;
}

export interface MedicalInstitutionInfo {
  /** IČP zařízení */
  id: string;
  /** Krátký popis (typicky jméno doktora) */
  description?: string;
  /** Dlouhý popis (typicky celé jméno + adresa) */
  descriptionLong?: string;
  /** Jméno doktora */
  doctorName?: string;
  /** Kontaktní email doktora */
  doctorEmail?: string;
  /** Kód odbornosti (FK do `medical-skill`) */
  idMedicalSkill?: string;
  /** Detail odbornosti (vrací backend pro pohodlí) */
  medicalSkillInfo?: MedicalSkillInfo;
  /** Platnost záznamu do (YYYY-MM-DD) */
  dateValidTill?: string;
  /** IČZ zařízení (jiný než IČP) */
  icz?: string;
  /** ID v systému CompuGroup Medical */
  cgmId?: string;
  /** Kódy XML export definic — typicky ["CGM"], ["EZPRAVA"] nebo obojí */
  idXmlExportDefinition?: string[];
}

/**
 * Tělo požadavku PUT /medical-institution/{id}.
 * Obsahuje stejná pole jako `MedicalInstitutionInfo`, ale bez `id`
 * (to je v URL path) a bez `medicalSkillInfo` (read-only).
 */
export interface MedicalInstitutionSaveInfo {
  description: string;
  descriptionLong: string;
  doctorName: string;
  doctorEmail: string;
  idMedicalSkill: string;
  dateValidTill?: string | null;
  icz?: string | null;
  cgmId?: string | null;
  idXmlExportDefinition?: string[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

/**
 * Detail poskytovatele podle IČP.
 * Vrátí `null`, pokud poskytovatel v DB neexistuje (HTTP 404).
 */
export async function findMedicalInstitutionById(
  id: string
): Promise<MedicalInstitutionInfo | null> {
  const res = await fetch(
    `${API_BASE}/medical-institution/${encodeURIComponent(id)}`,
    {
      credentials: "include",
      headers: { Accept: "application/problem+json, application/json;q=0.9" },
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

/**
 * Vytvoří (nebo aktualizuje, pokud IČP existuje) poskytovatele.
 * Endpoint je `PUT /medical-institution/{id}` — Vašek měl v OpenAPI špatný
 * popis "Search Medical Institutions by filters", ale ve skutečnosti
 * je to save / upsert.
 */
export async function saveMedicalInstitution(
  id: string,
  data: MedicalInstitutionSaveInfo
): Promise<MedicalInstitutionInfo> {
  const res = await fetch(
    `${API_BASE}/medical-institution/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/problem+json, application/json;q=0.9",
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `PUT /medical-institution/${id} selhalo HTTP ${res.status}: ${text}`
    );
  }
  return (await res.json()) as MedicalInstitutionInfo;
}

/**
 * Číselník odborností — Vašek vystavuje jako jednoduchý
 * `GET /medical-skill` bez search/paging. Vrací celý seznam jako pole.
 * Filtrování query si dělá klient na své straně.
 *
 * @param query — substring v `id` nebo `name`. Prázdný = celý seznam.
 */
export async function searchMedicalSkills(
  query: string,
  limit = 100
): Promise<MedicalSkillInfo[]> {
  const res = await fetch(`${API_BASE}/medical-skill`, {
    credentials: "include",
    headers: { Accept: "application/problem+json, application/json;q=0.9" },
  });
  if (!res.ok) {
    throw new Error(`GET /medical-skill selhalo HTTP ${res.status}`);
  }

  const all = (await res.json()) as MedicalSkillInfo[];
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? all.filter(
        (s) =>
          s.id.toLowerCase().includes(trimmed) ||
          (s.name ?? "").toLowerCase().includes(trimmed)
      )
    : all;
  return filtered.slice(0, limit);
}
