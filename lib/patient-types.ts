/**
 * TypeScript typy pro pacienta v naší DB.
 *
 * Odvozeno ze stejného OpenAPI spec Václavova `CardFileWebWS` jako eŽádanka:
 *   GET    /patient/{pid}     → PatientInfo (nebo 404)
 *   POST   /patient/{pid}     → PatientDataInfo (upsert přes PatientDataSaveInfo)
 *   GET    /insurance-company → InsuranceCompanyInfo[]
 */

export type Gender = "MALE" | "FEMALE";

/** Detailní data pacienta v naší DB */
export interface PatientDataInfo {
  id: number;
  patientInfo?: PatientInfo;
  idInsuranceCompany: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender | string;
  firstName: string;
  middleName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  weight: number;
  height: number;
  whoCr?: string;
  dateCr?: string;
  whoEdit?: string;
  dateEdit?: string;
}

/** Pacient v naší DB — id + pid + odkaz na patientDataInfo */
export interface PatientInfo {
  id: number;
  pid: string;
  idPatientData?: number;
  patientDataInfo: PatientDataInfo;
}

/**
 * Tělo POST `/patient/{pid}` — vytvoření nebo update pacienta.
 *
 * POZN.: `pid` **NENÍ** v body — je v URL path. Vašek to refaktoroval
 * v květnu 2026, vyhodil ho z body, protože byl redundantní s URL.
 * Náš API klient (`api-patient.ts`) ho proto v body neposílá.
 */
export interface PatientDataSaveInfo {
  idInsuranceCompany?: string | null;
  birthDate?: string;
  gender?: Gender;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  weight?: number | null;
  height?: number | null;
}

/** Pojišťovna (číselník MZČR) */
export interface InsuranceCompanyInfo {
  id: string; // např. "207"
  description: string; // krátký název, např. "OZP"
  descriptionLong: string; // dlouhý, např. "Oborová zdravotní pojišťovna..."
}
