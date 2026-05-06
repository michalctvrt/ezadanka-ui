"use client";

/**
 * Hlavní stránka modulu — workflow přijetí pacienta.
 *
 * 1) Recepční zadá rodné číslo.
 * 2) Paralelně se zavolá:
 *    - `findPatientByPid(rc)` → existuje pacient v naší DB?
 *    - `searchEzadankyByRid(rc, onlyActive)` → má MZČR aktivní eŽádanky?
 * 3) Render podle 4 stavů:
 *    a) existuje + má eŽádanky → karta s daty z DB + nahoře tabulka eŽádanek
 *    b) existuje + bez eŽádanek → jen karta s daty z DB
 *    c) neexistuje + má eŽádanku → karta předvyplněná z eŽádanky + tabulka
 *    d) neexistuje + bez eŽádanek → karta předvyplněná z RČ (datum nar, pohlaví)
 */

import { useState } from "react";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import DcFlipperHeader from "@/components/DcFlipperHeader";
import EzadankyList from "@/components/EzadankyList";
import PacientKarta, {
  type PacientKartaInitialData,
  EMPTY_PACIENT_KARTA_DATA,
} from "@/components/PacientKarta";
import { findPatientByPid } from "@/lib/api-patient";
import { searchEzadankyByRid } from "@/lib/api";
import { normalizeRc, parseRc } from "@/lib/rc";
import type { PatientInfo } from "@/lib/patient-types";
import type { FlatZadankaListItem } from "@/lib/parser";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; rid: string }
  | {
      kind: "loaded";
      rid: string;
      patient: PatientInfo | null;
      ezadanky: FlatZadankaListItem[];
    }
  | { kind: "error"; rid: string; message: string };

export default function Home() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const handleSubmit = async () => {
    const rc = normalizeRc(query);
    const rcInfo = parseRc(rc);
    if (!rcInfo.validFormat) {
      alert(rcInfo.error ?? "Neplatné rodné číslo.");
      return;
    }

    setPhase({ kind: "loading", rid: rc });

    // Paralelně — ať to ukáže rychle
    const [patientResult, ezadankyResult] = await Promise.allSettled([
      findPatientByPid(rc),
      searchEzadankyByRid(rc, { onlyActive: true }),
    ]);

    // Pokud findPatientByPid vyhodil chybu jinou než 404 (které vrací null),
    // ukážeme chybový stav.
    if (patientResult.status === "rejected") {
      setPhase({
        kind: "error",
        rid: rc,
        message: (patientResult.reason as Error).message,
      });
      return;
    }

    // searchEzadankyByRid může selhat samostatně — to není fatální,
    // jen nepřesměrujeme. Pokud chyba: prázdné pole.
    const ezadanky =
      ezadankyResult.status === "fulfilled" ? ezadankyResult.value : [];

    setPhase({
      kind: "loaded",
      rid: rc,
      patient: patientResult.value,
      ezadanky,
    });
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
                  Rodné číslo pacienta
                </label>
                <input
                  id="rc-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="např. 9882826031"
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
              Zadej rodné číslo bez lomítka (9 nebo 10 cifer).
            </p>
          </div>

          {/* Loading */}
          {phase.kind === "loading" && (
            <div className="text-center py-6 text-sm text-gray-500">
              Hledám pacienta a eŽádanky…
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

          {/* Načteno → render podle 4 stavů */}
          {phase.kind === "loaded" && (
            <Loaded
              rid={phase.rid}
              patient={phase.patient}
              ezadanky={phase.ezadanky}
            />
          )}
        </div>
      </main>
    </>
  );
}

// ─── Loaded view ──────────────────────────────────────────────────────────

function Loaded({
  rid,
  patient,
  ezadanky,
}: {
  rid: string;
  patient: PatientInfo | null;
  ezadanky: FlatZadankaListItem[];
}) {
  const maEzadanky = ezadanky.length > 0;
  const existuje = patient !== null;

  // Připravit initial pro PacientKartu — z DB nebo z eŽádanky nebo z RČ
  const initial: PacientKartaInitialData = existuje
    ? mapFromPatient(patient)
    : maEzadanky
    ? mapFromEzadanka(ezadanky[0], rid)
    : mapFromRc(rid);

  return (
    <div className="space-y-6">
      {/* Banner s upozorněním na eŽádanky — jen pokud existují */}
      {maEzadanky && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-medium">
            Pacient má {ezadanky.length} aktivní{" "}
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
      {maEzadanky && <EzadankyList rid={rid} data={ezadanky} />}

      {/* Karta pacienta — vždy, jen v jiném módu */}
      <PacientKarta
        pid={rid}
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
      d?.gender === "MALE" || d?.gender === "FEMALE"
        ? d.gender
        : "",
    idInsuranceCompany: d?.idInsuranceCompany ?? "",
    email: d?.email ?? "",
    phone: d?.phone ?? "",
    weight: d?.weight != null ? String(d.weight) : "",
    height: d?.height != null ? String(d.height) : "",
  };
}

function mapFromEzadanka(
  e: FlatZadankaListItem,
  rid: string
): PacientKartaInitialData {
  // FlatZadankaListItem má jen základní info (jméno, příjmení, datum nar.).
  // Zbytek (pohlaví, pojišťovna) doplníme z RČ.
  const rcInfo = parseRc(rid);
  return {
    ...EMPTY_PACIENT_KARTA_DATA,
    firstName: capitalize(e.pacient.jmeno),
    lastName: capitalize(e.pacient.prijmeni),
    birthDate: e.pacient.datumNarozeni ?? rcInfo.birthDate ?? "",
    gender: rcInfo.gender ?? "",
  };
}

function mapFromRc(rid: string): PacientKartaInitialData {
  const rcInfo = parseRc(rid);
  return {
    ...EMPTY_PACIENT_KARTA_DATA,
    birthDate: rcInfo.birthDate ?? "",
    gender: rcInfo.gender ?? "",
  };
}

function capitalize(s: string): string {
  if (!s) return "";
  // ROMAN ČTVRTNÍČEK → Roman Čtvrtníček
  return s
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
