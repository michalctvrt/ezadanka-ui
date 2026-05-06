/**
 * Tenká vrstva nad fetch — volání pacient + pojišťovny endpointů
 * v `CardFileWebWS`. Odpovídá OpenAPI spec Václavova backendu.
 */

import type {
  EzadankaError,
} from "./types";
import type {
  InsuranceCompanyInfo,
  PatientDataInfo,
  PatientDataSaveInfo,
  PatientInfo,
} from "./patient-types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

/**
 * Najít pacienta podle RČ (PID).
 * Vrací `null`, pokud pacient neexistuje (HTTP 404).
 * Hází chybu při jiných stavech (401, 500, atd.).
 */
export async function findPatientByPid(
  pid: string
): Promise<PatientInfo | null> {
  const res = await fetch(
    `${API_BASE}/patient/${encodeURIComponent(pid)}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await formatError(res));

  return (await res.json()) as PatientInfo;
}

/**
 * Uložit / aktualizovat data pacienta.
 * - Pokud pacient (podle PID) v DB neexistuje, vytvoří se nový.
 * - Pokud existuje, jeho data se aktualizují.
 */
export async function savePatientData(
  pid: string,
  data: PatientDataSaveInfo
): Promise<PatientDataInfo> {
  const res = await fetch(
    `${API_BASE}/patient/${encodeURIComponent(pid)}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) throw new Error(await formatError(res));
  return (await res.json()) as PatientDataInfo;
}

/** Seznam všech pojišťoven (číselník) — pro dropdown v kartě pacienta */
export async function listInsuranceCompanies(): Promise<
  InsuranceCompanyInfo[]
> {
  const res = await fetch(`${API_BASE}/insurance-company`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await formatError(res));
  return (await res.json()) as InsuranceCompanyInfo[];
}

// ─── Helpery ──────────────────────────────────────────────────────────────

async function formatError(res: Response): Promise<string> {
  const status = res.status;
  try {
    const body = (await res.json()) as Partial<EzadankaError>;
    if (body.errorMessage) return `Backend (${status}): ${body.errorMessage}`;
    if (body.errorCode) return `Backend (${status}): ${body.errorCode}`;
  } catch {
    // ne-JSON odpověď
  }
  if (status === 401 || status === 403) {
    return "Nepřihlášen — přihlas se nejdřív do staré kartoteky (CFLocalSyncWeb), pak obnov stránku.";
  }
  return `Backend vrátil HTTP ${status}`;
}
