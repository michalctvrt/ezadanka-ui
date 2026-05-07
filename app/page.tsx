"use client";

/**
 * Hlavní stránka modulu — workflow přijetí pacienta.
 *
 * Recepční má v ruce papírovou eŽádanku s **kódem** (8 alfanumerických znaků,
 * např. "YXQWNAGG"). Kód je primární cesta vyhledání. Sekundárně lze zadat
 * **rodné číslo** pacienta (9–10 cifer).
 *
 * Detekce typu vstupu:
 *   - 8 znaků [A-Z 0-9]                → kód žádanky
 *   - 9 nebo 10 cifer                  → rodné číslo
 *
 * Workflow:
 *   1) Vyhledat dle kódu nebo RČ.
 *   2) Z žádanky (pokud nalezena) získat PID pacienta.
 *   3) Paralelně ověřit existenci pacienta v naší DB (findPatientByPid).
 *   4) Render karta + seznam eŽádanek (4 stavy podle existence pacienta a žádanek).
 *
 * **Stav je v URL** (`?q=...`):
 *   - Recepční zadá kód/RČ a klepne Vyhledat → URL se aktualizuje.
 *   - Když odejde (např. klik "Nové vyšetření" → JSF) a klepne Zpět v
 *     prohlížeči, URL se vrátí na předchozí stav a stránka znovu načte
 *     pacienta. Bez tohohle by browser-back hodil recepční na prázdný
 *     vyhledávací formulář a musela by znovu zadávat RČ.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import DcFlipperHeader from "@/components/DcFlipperHeader";
import EzadankyList from "@/components/EzadankyList";
import PacientKarta, {
  type PacientKartaInitialData,
  EMPTY_PACIENT_KARTA_DATA,
} from "@/components/PacientKarta";
import { findPatientByPid } from "@/lib/api-patient";
import {
  searchEzadankyByCode,
  searchEzadankyByRid,
} from "@/lib/api";
import { normalizeRc, parseRc } from "@/lib/rc";
import type { PatientInfo } from "@/lib/patient-types";
import type { FlatZadankaListItem } from "@/lib/parser";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | {
      kind: "loaded";
      /** Vstup, který recepční zadala (kód nebo RČ) */
      input: string;
      /** PID pacienta — bud z eŽádanky nebo přímo z inputu (RČ) */
      pid: string;
      patient: PatientInfo | null;
      ezadanky: FlatZadankaListItem[];
    }
  | { kind: "error"; query: string; message: string }
  | { kind: "not-found"; query: string };

const KOD_PATTERN = /^[A-Z0-9]{8}$/;

export default function Home() {
  // useSearchParams musí být obalený v Suspense (Next 16 App Router pravidlo)
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  // Lokální stav inputu — synchronizujeme s URL při změně
  const [query, setQuery] = useState(urlQuery);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  /**
   * Vlastní search logika — volá se při změně URL parametru `q`.
   * Detekuje typ vstupu (kód vs RČ) a deleguje na příslušnou cestu.
   */
  const doSearch = useCallback(async (raw: string) => {
    setPhase({ kind: "loading", query: raw });

    const isCode = KOD_PATTERN.test(raw.toUpperCase());

    if (isCode) {
      await searchByCode(raw.toUpperCase(), setPhase);
    } else {
      await searchByRc(raw, setPhase);
    }
  }, []);

  // Reaguj na změny URL (`?q=...`) — typicky po router.push() a po
  // browser-back. Spustí search nebo vrátí na idle, podle obsahu.
  useEffect(() => {
    if (!urlQuery) {
      setPhase({ kind: "idle" });
      setQuery("");
      return;
    }
    setQuery(urlQuery);
    doSearch(urlQuery);
  }, [urlQuery, doSearch]);

  const handleSubmit = () => {
    const raw = query.trim();
    if (!raw) {
      alert("Zadej kód eŽádanky nebo rodné číslo pacienta.");
      return;
    }
    // Aktualizuj URL — useEffect výše to zachytí a spustí search.
    // Použijeme push, ne replace, aby browser-back fungoval (přesně co
    // recepční chtěla — vrátit se na karta pacienta po Nové vyšetření).
    router.push(`?q=${encodeURIComponent(raw)}`);
  };

  return (
    <>
      <DcFlipperHeader />

      <main className="min-h-screen py-6 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-center text-brand-navy">
            Hledat pacienta
          </h1>

          {/* Vyhledávací box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="rc-input"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Kód eŽádanky nebo rodné číslo pacienta
                </label>
                <input
                  id="rc-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="např. YXQWNAGG nebo 9412034082"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 bg-brand-teal hover:bg-brand-teal-700 text-white font-medium px-6 py-2.5 rounded-lg transition"
              >
                <Search className="w-4 h-4" />
                Vyhledat
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Kód žádanky má 8 alfanumerických znaků (z papírové eŽádanky).
              Rodné číslo zadej bez lomítka (9 nebo 10 cifer).
            </p>
          </div>

          {/* Loading */}
          {phase.kind === "loading" && (
            <div className="text-center py-6 text-sm text-gray-500">
              Hledám…
            </div>
          )}

          {/* Žádanka nenalezena */}
          {phase.kind === "not-found" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  eŽádanka s kódem &quot;{phase.query}&quot; nebyla nalezena
                </p>
                <p className="text-xs mt-0.5">
                  Zkontroluj kód na papírové žádance, nebo zadej rodné číslo
                  pacienta.
                </p>
              </div>
            </div>
          )}

          {/* Chyba */}
          {phase.kind === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Chyba při vyhledávání</p>
                <p className="mt-0.5">{phase.message}</p>
              </div>
            </div>
          )}

          {/* Načteno → render */}
          {phase.kind === "loaded" && (
            <Loaded
              pid={phase.pid}
              patient={phase.patient}
              ezadanky={phase.ezadanky}
            />
          )}
        </div>
      </main>
    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <DcFlipperHeader />
      <main className="min-h-screen py-6 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-gray-500">Načítám…</p>
        </div>
      </main>
    </>
  );
}

// ─── Search funkce ────────────────────────────────────────────────────────

/**
 * Vyhledávání podle kódu eŽádanky.
 *
 * 1) Najde žádanku v MZČR podle kódu → vytáhne PID pacienta.
 * 2) Pak udělá **stejný flow jako u RČ**: paralelně načte pacienta
 *    z naší DB + všechny aktivní žádanky daného pacienta.
 * Výsledek: úplně stejný stav, jako by recepční rovnou zadala RČ —
 *    zelený banner, tabulka všech aktivních žádanek, karta pacienta.
 */
async function searchByCode(
  code: string,
  setPhase: (p: Phase) => void
): Promise<void> {
  // Krok 1: najdi žádanku podle kódu (vrátí 0 nebo 1 položku)
  let firstHit: FlatZadankaListItem[];
  try {
    firstHit = await searchEzadankyByCode(code, { onlyActive: false });
  } catch (e) {
    setPhase({
      kind: "error",
      query: code,
      message: (e as Error).message,
    });
    return;
  }

  if (firstHit.length === 0) {
    setPhase({ kind: "not-found", query: code });
    return;
  }

  const pid = firstHit[0].pacient.rid;

  // Krok 2: paralelně — pacient v naší DB + všechny aktivní žádanky
  const [patientResult, ezadankyResult] = await Promise.allSettled([
    findPatientByPid(pid),
    searchEzadankyByRid(pid, { onlyActive: true }),
  ]);

  if (patientResult.status === "rejected") {
    setPhase({
      kind: "error",
      query: code,
      message: (patientResult.reason as Error).message,
    });
    return;
  }

  // Když by druhý fetch selhal, máme aspoň tu jednu žádanku z prvního.
  const ezadanky =
    ezadankyResult.status === "fulfilled" ? ezadankyResult.value : firstHit;

  setPhase({
    kind: "loaded",
    input: code,
    pid,
    patient: patientResult.value,
    ezadanky,
  });
}

/** Vyhledávání podle rodného čísla pacienta */
async function searchByRc(
  rc: string,
  setPhase: (p: Phase) => void
): Promise<void> {
  const normalized = normalizeRc(rc);
  const rcInfo = parseRc(normalized);
  if (!rcInfo.validFormat) {
    alert(rcInfo.error ?? "Neplatné rodné číslo (musí mít 9 nebo 10 cifer).");
    setPhase({ kind: "idle" });
    return;
  }

  // Paralelně — ať se to ukáže rychle
  const [patientResult, ezadankyResult] = await Promise.allSettled([
    findPatientByPid(normalized),
    searchEzadankyByRid(normalized, { onlyActive: true }),
  ]);

  if (patientResult.status === "rejected") {
    setPhase({
      kind: "error",
      query: normalized,
      message: (patientResult.reason as Error).message,
    });
    return;
  }

  const ezadanky =
    ezadankyResult.status === "fulfilled" ? ezadankyResult.value : [];

  setPhase({
    kind: "loaded",
    input: normalized,
    pid: normalized,
    patient: patientResult.value,
    ezadanky,
  });
}

// ─── Loaded view ──────────────────────────────────────────────────────────

function Loaded({
  pid,
  patient,
  ezadanky,
}: {
  pid: string;
  patient: PatientInfo | null;
  ezadanky: FlatZadankaListItem[];
}) {
  const maEzadanky = ezadanky.length > 0;
  const existuje = patient !== null;

  // Připravit initial pro PacientKartu — z DB nebo z eŽádanky nebo z RČ
  const initial: PacientKartaInitialData = existuje
    ? mapFromPatient(patient)
    : maEzadanky
    ? mapFromEzadanka(ezadanky[0], pid)
    : mapFromRc(pid);

  return (
    <div className="space-y-6">
      {/* Banner s upozorněním na eŽádanky — jen pokud existují */}
      {maEzadanky && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-medium">
            Pacient má {ezadanky.length}{" "}
            {ezadanky.length === 1
              ? "eŽádanku"
              : ezadanky.length < 5
              ? "eŽádanky"
              : "eŽádanek"}{" "}
            v MZČR.
          </p>
        </div>
      )}

      {/* eŽádanky tabulka — jen když nějaké jsou */}
      {maEzadanky && (
        <EzadankyList
          rid={pid}
          data={ezadanky}
          patientExists={existuje}
          patient={patient}
        />
      )}

      {/* Karta pacienta — vždy, jen v jiném módu */}
      <PacientKarta
        pid={pid}
        initial={initial}
        mode={existuje ? "existing" : "new"}
      />
    </div>
  );
}

// ─── Mappery initial dat ──────────────────────────────────────────────────

function mapFromPatient(p: PatientInfo): PacientKartaInitialData {
  const d = p.patientDataInfo;
  return {
    firstName: d?.firstName ?? "",
    middleName: d?.middleName ?? "",
    lastName: d?.lastName ?? "",
    title: d?.title ?? "",
    birthDate: d?.birthDate ?? "",
    gender:
      d?.gender === "MALE" || d?.gender === "FEMALE" ? d.gender : "",
    idInsuranceCompany: d?.idInsuranceCompany ?? "",
    email: d?.email ?? "",
    phone: d?.phone ?? "",
    weight: d?.weight != null ? String(d.weight) : "",
    height: d?.height != null ? String(d.height) : "",
  };
}

function mapFromEzadanka(
  e: FlatZadankaListItem,
  pid: string
): PacientKartaInitialData {
  const rcInfo = parseRc(pid);
  return {
    ...EMPTY_PACIENT_KARTA_DATA,
    firstName: capitalize(e.pacient.jmeno),
    lastName: capitalize(e.pacient.prijmeni),
    birthDate: e.pacient.datumNarozeni ?? rcInfo.birthDate ?? "",
    gender: rcInfo.gender ?? "",
  };
}

function mapFromRc(pid: string): PacientKartaInitialData {
  const rcInfo = parseRc(pid);
  return {
    ...EMPTY_PACIENT_KARTA_DATA,
    birthDate: rcInfo.birthDate ?? "",
    gender: rcInfo.gender ?? "",
  };
}

function capitalize(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
