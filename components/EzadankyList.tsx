"use client";

/**
 * Tabulka aktivních eŽádanek pro daného pacienta.
 *
 * Použití:
 *   <EzadankyList rid="9882826031" />                 // sám si fetchne
 *   <EzadankyList rid={pid} data={preloaded} />        // dostane data zvenku
 *
 * Při kliknutí na řádek otevře `EzadankaDetail` modal s plnými údaji.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, ChevronRight } from "lucide-react";
import EzadankaDetail from "./EzadankaDetail";
import { searchEzadankyByRid } from "@/lib/api";
import type { FlatZadankaListItem, Modalita } from "@/lib/parser";

interface Props {
  rid: string;
  /** Default true. Když false, vrátí i vyřízené/stornované */
  onlyActive?: boolean;
  /** Předem načtená data — pokud máme, fetch přeskočíme */
  data?: FlatZadankaListItem[];
  /**
   * Existuje pacient v naší DB? Předáno do EzadankaDetail — ovlivní,
   * jestli se zobrazí tlačítko "Založit vyšetření" nebo info hláška.
   */
  patientExists?: boolean;
}

const MODALITA_BARVY: Record<Modalita, string> = {
  RTG: "bg-orange-100 text-orange-800",
  SONO: "bg-sky-100 text-sky-800",
  MR: "bg-purple-100 text-purple-800",
  CT: "bg-red-100 text-red-800",
  OTHER: "bg-gray-200 text-gray-700",
};

const URGENTNOST_BARVY: Record<string, string> = {
  rutinní: "text-gray-600",
  normální: "text-gray-600",
  urgentní: "text-amber-600 font-medium",
  statim: "text-red-600 font-semibold",
};

export default function EzadankyList({
  rid,
  onlyActive = true,
  data: preloadedData,
  patientExists = true,
}: Props) {
  const [data, setData] = useState<FlatZadankaListItem[]>(
    preloadedData ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Pokud rodič dodal data, použijeme je. Jinak fetchneme sami.
  useEffect(() => {
    if (preloadedData) {
      setData(preloadedData);
      return;
    }
    if (!rid) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchEzadankyByRid(rid, { onlyActive })
      .then((items) => {
        if (!cancelled) setData(items);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rid, onlyActive, preloadedData]);

  if (!rid) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="bg-brand-teal-50 border-b border-brand-teal-100 px-5 py-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-brand-teal-600" />
        <h2 className="font-semibold text-brand-navy">
          {onlyActive ? "Aktivní eŽádanky" : "eŽádanky pacienta"}
        </h2>
        {!loading && data.length > 0 && (
          <span className="text-sm text-gray-500">({data.length})</span>
        )}
      </div>

      {loading && (
        <p className="p-6 text-sm text-gray-500">Načítám eŽádanky…</p>
      )}

      {error && (
        <div className="m-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="p-6 text-sm text-gray-500">
          Pacient nemá žádné aktivní eŽádanky.
        </p>
      )}

      {!loading && !error && data.length > 0 && (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-b border-gray-200">
              <th className="px-5 py-3">Modalita</th>
              <th className="px-5 py-3">Vyšetření</th>
              <th className="px-5 py-3">Urgentnost</th>
              <th className="px-5 py-3">Žadatel</th>
              <th className="px-5 py-3">Datum</th>
              <th className="px-5 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((z) => (
              <tr
                key={z.id}
                onClick={() => setOpenId(z.id)}
                className="border-b border-gray-100 last:border-0 hover:bg-brand-teal-50/50 cursor-pointer transition"
              >
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${
                      MODALITA_BARVY[z.modalita]
                    }`}
                  >
                    {z.modalita}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-900">
                  {z.vysetreniNazev}
                </td>
                <td
                  className={`px-5 py-3.5 ${
                    URGENTNOST_BARVY[z.urgentnost] ?? URGENTNOST_BARVY.rutinní
                  }`}
                >
                  {z.urgentnost}
                </td>
                <td className="px-5 py-3.5 text-gray-600">{z.zadatel}</td>
                <td className="px-5 py-3.5 text-gray-600">
                  {formatDate(z.datumVytvoreni)}
                </td>
                <td className="px-5 py-3.5 text-gray-400">
                  <ChevronRight className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId && (
        <EzadankaDetail
          id={openId}
          pid={rid}
          patientExists={patientExists}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}
