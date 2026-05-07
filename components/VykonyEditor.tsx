"use client";

/**
 * Editor zdravotních výkonů (medical services) pro vyšetření.
 *
 * Recepční hledá výkony v autocomplete inputu (debounced search). Výsledky
 * jsou filtrované podle modality žádanky (RTG/SONO/MR/CT). Klik na výsledek
 * přidá výkon do tabulky vybraných s default počtem 1. Recepční pak může
 * měnit počet (-/+) nebo položku odstranit.
 *
 * Při mountu se automaticky předvyplní auto-fill kódy podle pravidel
 * (viz `lib/auto-fill-services.ts`) — např. RTG dítě 6–12 let → kód 09556.
 *
 * Stav (kód → počet) se propaguje rodiči přes `onChange`. Rodič ho použije
 * v `medicalServices` při POST /study.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, Minus, Trash2, Search, AlertTriangle } from "lucide-react";
import {
  searchMedicalServices,
  findMedicalServiceById,
} from "@/lib/api-medical-services";
import { getAutoFillServices } from "@/lib/auto-fill-services";
import type { MedicalServiceInfo } from "@/lib/medical-service-types";
import type { Modalita } from "@/lib/parser";

interface Props {
  /** Modalita vyšetření — filtruje výkony v autocomplete */
  modalita: Modalita;
  /** Věk pacienta v letech (pro auto-fill) — null = neznáme */
  age: number | null;
  /** Callback s aktuálním stavem (kód → počet) */
  onChange: (services: Record<string, number>) => void;
}

export interface SelectedService {
  code: string;
  name: string;
  count: number;
  /** Auto-fill ze pravidla (vizuálně označit) */
  autoFilled?: boolean;
  /** Důvod, proč auto-fill (tooltip) */
  autoFillReason?: string;
}

export default function VykonyEditor({ modalita, age, onChange }: Props) {
  const [selected, setSelected] = useState<SelectedService[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicalServiceInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-fill při mountu — přidat výkony podle modality + věku
  useEffect(() => {
    const rules = getAutoFillServices({ modalita, age });
    if (rules.length === 0) return;

    let cancelled = false;
    Promise.all(
      rules.map(async (rule) => {
        try {
          const info = await findMedicalServiceById(rule.code);
          if (!info) return null;
          return {
            code: rule.code,
            name: info.descriptionLong || info.description,
            count: rule.count,
            autoFilled: true,
            autoFillReason: rule.reason,
          } as SelectedService;
        } catch {
          // Chybí API — přidáme aspoň kód s placeholder názvem
          return {
            code: rule.code,
            name: `(${rule.code} — popis nedohledán)`,
            count: rule.count,
            autoFilled: true,
            autoFillReason: rule.reason,
          } as SelectedService;
        }
      })
    ).then((items) => {
      if (cancelled) return;
      const filtered = items.filter((x): x is SelectedService => x !== null);
      setSelected(filtered);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalita, age]);

  // Propagace nahoru při každé změně selected
  useEffect(() => {
    const map: Record<string, number> = {};
    for (const s of selected) {
      map[s.code] = s.count;
    }
    onChange(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Debounced search při změně query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const r = await searchMedicalServices(query, modalita, 30);
        if (!cancelled) setResults(r);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, modalita]);

  // Klik mimo dropdown → zavře ho
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addService = (info: MedicalServiceInfo) => {
    setSelected((prev) => {
      // Pokud už ve výběru je, zvyš count o 1
      if (prev.some((s) => s.code === info.id)) {
        return prev.map((s) =>
          s.code === info.id ? { ...s, count: s.count + 1 } : s
        );
      }
      return [
        ...prev,
        {
          code: info.id,
          name: info.descriptionLong || info.description,
          count: 1,
        },
      ];
    });
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  };

  const updateCount = (code: string, delta: number) => {
    setSelected((prev) =>
      prev
        .map((s) =>
          s.code === code
            ? { ...s, count: Math.max(1, s.count + delta) }
            : s
        )
        .filter((s) => s.count > 0)
    );
  };

  const removeService = (code: string) => {
    setSelected((prev) => prev.filter((s) => s.code !== code));
  };

  return (
    <section ref={containerRef}>
      <h3 className="text-xs font-semibold text-brand-teal-700 mb-3 uppercase tracking-wider">
        Výkony pro vyšetření
      </h3>

      {/* Vyhledávací input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={`Hledat výkon ${modalita}…`}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />

        {/* Dropdown s výsledky */}
        {showDropdown && (query.trim() || searching || results.length > 0) && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
            {searching && (
              <p className="p-3 text-xs text-gray-500">Hledám…</p>
            )}
            {error && (
              <p className="p-3 text-xs text-red-600">Chyba: {error}</p>
            )}
            {!searching && !error && results.length === 0 && query.trim() && (
              <p className="p-3 text-xs text-gray-500">
                Žádné výkony nenalezeny.
              </p>
            )}
            {!searching &&
              results.map((r) => {
                const alreadyAdded = selected.some((s) => s.code === r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => addService(r)}
                    className="block w-full text-left px-3 py-2 hover:bg-brand-teal-50/50 border-b border-gray-100 last:border-0 text-sm"
                  >
                    <div className="flex items-baseline gap-2">
                      <code className="font-mono text-xs font-semibold text-brand-teal-700 shrink-0">
                        {r.id}
                      </code>
                      <span className="flex-1 text-gray-900 truncate">
                        {r.descriptionLong || r.description}
                      </span>
                      {alreadyAdded && (
                        <span className="text-[10px] text-gray-400 italic">
                          již ve výběru
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Tabulka vybraných výkonů */}
      {selected.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Žádný výkon nevybrán. Pro založení vyšetření vyber alespoň jeden.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-b border-gray-200">
                <th className="px-3 py-2">Kód</th>
                <th className="px-3 py-2">Název</th>
                <th className="px-3 py-2 w-32 text-center">Počet</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {selected.map((s) => (
                <tr
                  key={s.code}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-xs font-semibold text-brand-teal-700">
                        {s.code}
                      </code>
                      {s.autoFilled && (
                        <span
                          title={s.autoFillReason}
                          className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded"
                        >
                          auto
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900">{s.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => updateCount(s.code, -1)}
                        className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        aria-label="Snížit počet"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-medium">
                        {s.count}
                      </span>
                      <button
                        onClick={() => updateCount(s.code, 1)}
                        className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        aria-label="Zvýšit počet"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeService(s.code)}
                      className="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
                      aria-label="Odebrat výkon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
