"use client";

/**
 * Tabulka aktivních eŽádanek pro daného pacienta.
 *
 * Použití:
 *   <EzadankyList rid="9882826031" />
 *   <EzadankyList rid={pid} onlyActive={false} />
 *
 * Komponenta si data fetchuje sama přes `searchEzadankyByRid(rid)`.
 * Při kliknutí na řádek otevře `EzadankaDetail` modal s plnými údaji.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import EzadankaDetail from "./EzadankaDetail";
import { searchEzadankyByRid } from "@/lib/api";
import type { FlatZadankaListItem, Modalita } from "@/lib/parser";

interface Props {
  rid: string;
  /** Default true. Když false, vrátí i vyřízené/stornované */
  onlyActive?: boolean;
}

const MODALITA_BARVY: Record<Modalita, string> = {
  RTG: "bg-orange-100 text-orange-800",
  SONO: "bg-blue-100 text-blue-800",
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

export default function EzadankyList({ rid, onlyActive = true }: Props) {
  const [data, setData] = useState<FlatZadankaListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
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
  }, [rid, onlyActive]);

  if (!rid) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {onlyActive ? "Aktivní eŽádanky" : "eŽádanky pacienta"}
          {!loading && data.length > 0 && (
            <span className="text-xs font-normal text-gray-500 ml-2">
              ({data.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {loading && (
          <p className="p-6 text-sm text-gray-500">Načítám eŽádanky…</p>
        )}

        {error && (
          <div className="m-4 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
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
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Modalita</th>
                <th className="px-4 py-2 font-medium">Vyšetření</th>
                <th className="px-4 py-2 font-medium">Urgentnost</th>
                <th className="px-4 py-2 font-medium">Žadatel</th>
                <th className="px-4 py-2 font-medium">Datum</th>
                <th className="px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((z) => (
                <tr
                  key={z.id}
                  onClick={() => setOpenId(z.id)}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        MODALITA_BARVY[z.modalita]
                      }`}
                    >
                      {z.modalita}
                    </span>
                  </td>
                  <td className="px-4 py-3">{z.vysetreniNazev}</td>
                  <td
                    className={`px-4 py-3 ${
                      URGENTNOST_BARVY[z.urgentnost] ?? URGENTNOST_BARVY.rutinní
                    }`}
                  >
                    {z.urgentnost}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{z.zadatel}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(z.datumVytvoreni)}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      {openId && (
        <EzadankaDetail id={openId} onClose={() => setOpenId(null)} />
      )}
    </Card>
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
