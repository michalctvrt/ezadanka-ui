/**
 * API klient pro vyhledávání zdravotních výkonů.
 *
 * Používá se v komponentě VykonyEditor — recepční hledá podle kódu nebo
 * popisu, výsledky jsou filtrované podle modality žádanky (RTG/SONO/MR/CT).
 */

import type {
  MedicalServiceInfo,
  MedicalServiceSearchRequest,
  MedicalServiceSearchResponse,
} from "./medical-service-types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

/**
 * Vyhledá výkony.
 * @param query — substring v `description` nebo `descriptionLong`. Pokud
 *                jen kód (čísla), hledá se v `description`.
 * @param category — kategorie modality ("RTG", "SONO", "MR", "CT") — když
 *                   je zadaná, filtruje výkony jen pro tuhle modalitu.
 */
export async function searchMedicalServices(
  query: string,
  category?: string,
  limit = 30
): Promise<MedicalServiceInfo[]> {
  const trimmed = query.trim();

  const browseFilter: MedicalServiceSearchRequest["browseFilter"] = {};

  // Filtr modality
  if (category) {
    browseFilter.idMedicalServiceCategory = {
      comparator: "EQ",
      values: [category],
    };
  }

  // Substring filter — buď v description (krátký název) nebo descriptionLong
  if (trimmed) {
    browseFilter.descriptionLong = {
      comparator: "LIKE",
      values: [`%${trimmed}%`],
    };
  }

  const body: MedicalServiceSearchRequest = {
    browseFilter,
    limitFilter: { first: 0, count: limit },
    orderByFilter: { column: "description", desc: false },
  };

  const res = await fetch(`${API_BASE}/medical-service/:search`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, application/problem+json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `POST /medical-service/:search selhalo HTTP ${res.status}`
    );
  }

  const data = (await res.json()) as MedicalServiceSearchResponse;
  return data.data ?? [];
}

/** Detail výkonu podle kódu — pro auto-fill (potřebujeme zobrazit název). */
export async function findMedicalServiceById(
  id: string
): Promise<MedicalServiceInfo | null> {
  const res = await fetch(
    `${API_BASE}/medical-service/${encodeURIComponent(id)}`,
    {
      credentials: "include",
      headers: { Accept: "application/json, application/problem+json" },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `GET /medical-service/${id} selhalo HTTP ${res.status}`
    );
  }
  return (await res.json()) as MedicalServiceInfo;
}
