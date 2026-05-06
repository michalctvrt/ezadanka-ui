/**
 * Tenká vrstva nad fetch — volání eŽádanka backendu.
 *
 * Backend žije v `CardFileWebWS` (Václav). Jakmile je modul nasazený same-origin
 * pod `/CardFileWebWS/michalovo/`, sdílí JSESSIONIDSSO cookie automaticky.
 *
 * V dev běhu (npm run dev) musí Next.js dev server forwardovat
 * `/CardFileWebWS/*` na lokální Payaru (`http://localhost:8080`) přes rewrites
 * v `next.config.ts`. Browser by měl být přihlášený do staré JSF kartoteky,
 * aby měl session cookie. Pokud chodí 401, přihlas se nejdřív do
 * `/CFLocalSyncWeb/`.
 */

import { flattenDetail, flattenList } from "./parser";
import type {
  FlatZadankaDetail,
  FlatZadankaListItem,
} from "./parser";
import type {
  EzadankaError,
  NactiZadankuDto,
  VyhledejZadankuResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/CardFileWebWS/rest";

/**
 * Vyhledá aktivní eŽádanky pacienta podle RČ (PID).
 * Volá `GET /ezadanka?pid={rid}&onlyActive={onlyActive}`.
 */
export async function searchEzadankyByRid(
  rid: string,
  options: { onlyActive?: boolean } = {}
): Promise<FlatZadankaListItem[]> {
  const params = new URLSearchParams({ pid: rid });
  if (options.onlyActive !== undefined) {
    params.set("onlyActive", String(options.onlyActive));
  }

  const res = await fetch(`${API_BASE}/ezadanka?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await formatBackendError(res));

  const body = (await res.json()) as VyhledejZadankuResponse;
  return flattenList(body);
}

/**
 * Načte detail eŽádanky podle UUID.
 * Volá `GET /ezadanka/{id}`.
 */
export async function getEzadankaById(
  id: string
): Promise<FlatZadankaDetail> {
  const res = await fetch(
    `${API_BASE}/ezadanka/${encodeURIComponent(id)}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );
  if (!res.ok) throw new Error(await formatBackendError(res));

  const body = (await res.json()) as NactiZadankuDto;
  return flattenDetail(body);
}

// ─── Helpery ──────────────────────────────────────────────────────────────

async function formatBackendError(res: Response): Promise<string> {
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
