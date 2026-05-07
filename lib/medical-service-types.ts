/**
 * Typy pro výkony / zdravotní úkony (medical services).
 *
 * Mapuje se na endpoint `POST /CardFileWebWS/rest/medical-service/:search`
 * a `GET /medical-service/{id}`.
 */

export interface MedicalServiceCategoryInfo {
  /** "RTG", "SONO", "MR", "CT", ... */
  id: string;
  description: string;
  /** DICOM kód modality (DX, CR, US, MR, CT) */
  mappedModality: string;
}

export interface MedicalServiceInfo {
  /** Kód výkonu — např. "09556" */
  id: string;
  /** Krátký název */
  description: string;
  /** Plný popis */
  descriptionLong: string;
  /** "RTG", "SONO", "MR", "CT" — kategorie */
  idMedicalServiceCategory: string;
  medicalServiceCategoryInfo?: MedicalServiceCategoryInfo;
}

// ─── Search request types (částečně z OpenAPI) ───────────────────────────

type Comparator =
  | "EQ"
  | "NE"
  | "IS_NULL"
  | "IS_NOT_NULL"
  | "IN"
  | "NOT_IN"
  | "BETWEEN"
  | "GT"
  | "GE"
  | "LT"
  | "LE"
  | "LIKE"
  | "NOT_LIKE"
  | "BIN_MASK"
  | "EQ_OR_IS_NULL";

interface BrowseStringFilter {
  values?: string[];
  comparator: Comparator;
}

export interface MedicalServiceBrowseFilter {
  description?: BrowseStringFilter;
  descriptionLong?: BrowseStringFilter;
  idMedicalServiceCategory?: BrowseStringFilter;
}

export interface MedicalServiceSearchRequest {
  searchFilter?: { id?: string };
  browseFilter?: MedicalServiceBrowseFilter;
  orderByFilter?: { column: string; desc?: boolean };
  limitFilter?: { first?: number; count?: number };
}

export interface MedicalServiceSearchResponse {
  totalCount?: number;
  count?: number;
  data?: MedicalServiceInfo[];
}
