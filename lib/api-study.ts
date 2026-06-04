/**
 * API klient pro vyšetření (study) v `CardFileWebWS`.
 *
 * Poznámka: Tahle vrstva je **zatím nezapojená** do UI. Slouží jako
 * příprava pro budoucí variantu, kdy modul vytvoří vyšetření přímo
 * (POST /study) a otevře JSF na zobrazení podle ID — místo dnešního
 * stavu, kdy posíláme všechna data do JSF jako query parametry a
 * čekáme, až je Václav v JSF přebere.
 *
 * Otevřené otázky (než se zapojí do UI):
 *  - `idWorkingplace` — odkud (přihlášení / UI dropdown / hostname)?
 *  - `medicalServices` — recepční je nezadává; necháme prázdný map?
 *  - `idCatInsuranceType` — kde to vzít?
 */

import type { FlatZadankaDetail } from "./parser";
import type { PatientDataSaveInfo } from "./patient-types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

// ─── Typy ────────────────────────────────────────────────────────────────

export interface MedicalRequest {
  /** Datum žádanky (YYYY-MM-DD) */
  requestDate: string;
  /** ID poskytovatele, který žádá (ICZ doktora) */
  idMedicalInstitutionRequested: string;
  /** ICD-10 kód diagnózy */
  idMedicalDiagnosisRequested: string;
  /** Kód pojišťovny */
  idInsuranceCompany: string;
  /** Typ pojištění (kategorie) — typicky 1 */
  idCatInsuranceType: number;
  /** UUID eŽádanky pro referenci */
  ezadankaId?: string;
}

export interface StudySaveBasicInfo {
  patientData: PatientDataSaveInfo;
  studyDate?: string;
  remark?: string;
  /** ID pracoviště (Vídeňská / Lesná / Dobrovského) — TODO: kde brát? */
  idWorkingplace: string;
  flagRemoteAccessAfterCompleted: boolean;
  flagUrgent: boolean;
  /** Modalita: "RTG", "SONO", "MR", "CT" */
  idMedicalServiceCategory: string;
  /** Map kód_výkonu → počet (např. {"89117": 1}). Dnes nevyplňujeme. */
  medicalServices: Record<string, number>;
  flagSelfPay: boolean;
  medicalRequest: MedicalRequest;
}

export interface StudyInfo {
  id: number;
  uid: string;
  pid: string;
  // ... ostatní pole z OpenAPI — doplníme když bude potřeba
}

// ─── API volání ──────────────────────────────────────────────────────────

/**
 * Vytvoří nové vyšetření v naší DB. Po úspěchu vrátí StudyInfo s ID,
 * podle kterého lze otevřít JSF stránku `/study/edit.xhtml?id=...`.
 */
export async function createStudy(
  data: StudySaveBasicInfo
): Promise<StudyInfo> {
  const res = await fetch(`${API_BASE}/study`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, application/problem+json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /study selhalo HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as StudyInfo;
}

/** Načti existující vyšetření podle ID. */
export async function findStudyById(id: number): Promise<StudyInfo> {
  const res = await fetch(`${API_BASE}/study/${id}`, {
    credentials: "include",
    headers: { Accept: "application/json, application/problem+json" },
  });
  if (!res.ok) {
    throw new Error(`GET /study/${id} selhalo HTTP ${res.status}`);
  }
  return (await res.json()) as StudyInfo;
}

// ─── Helper: sestavení draft StudySaveBasicInfo z eŽádanky ───────────────

/**
 * Z eŽádanky a údajů pacienta sestaví minimum potřebné pro POST /study.
 * Výstup nemusí stačit pro skutečné uložení — chybí především
 * `idWorkingplace` a `medicalServices`. Volající doplní zbývající.
 */
export function buildStudyDraftFromEzadanka(
  ez: FlatZadankaDetail,
  patient: PatientDataSaveInfo,
  options: {
    idWorkingplace: string;
    medicalServices?: Record<string, number>;
    idCatInsuranceType?: number;
  }
): StudySaveBasicInfo {
  return {
    patientData: patient,

    idWorkingplace: options.idWorkingplace,
    medicalServices: options.medicalServices ?? {},

    idMedicalServiceCategory: mapModalitaToCategory(
      ez.vysetreni.modalitaKod ?? ez.vysetreni.modalita
    ),

    flagSelfPay: ez.pacientStav.samoplatce,
    flagUrgent:
      ez.urgentnost.toLowerCase().includes("urgent") ||
      ez.urgentnost.toLowerCase().includes("statim"),
    flagRemoteAccessAfterCompleted: false,

    studyDate: new Date().toISOString(),
    remark: ez.vysetreni.poznamka ?? undefined,

    medicalRequest: {
      requestDate: ez.datumVytvoreni
        ? ez.datumVytvoreni.split("T")[0]
        : new Date().toISOString().split("T")[0],
      idMedicalInstitutionRequested: ez.zadatel.icpZadatele || "",
      idMedicalDiagnosisRequested: ez.diagnoza.kod || "",
      idInsuranceCompany: ez.pacient.pojistovnaKod || patient.idInsuranceCompany || "",
      idCatInsuranceType: options.idCatInsuranceType ?? 1,
      ezadankaId: ez.id,
    },
  };
}

/** Mapování modality z eŽádanky na MZČR `idMedicalServiceCategory`. */
function mapModalitaToCategory(modalita: string): string {
  const m = modalita.toUpperCase();
  if (m === "DX" || m === "CR" || m === "RTG") return "RTG";
  if (m === "US" || m === "SONO") return "SONO";
  if (m === "MR" || m === "MRI") return "MR";
  if (m === "CT") return "CT";
  return modalita;
}
