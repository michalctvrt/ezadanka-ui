"use client";

/**
 * Demo / showcase stránka modulu eŽádanka — pro standalone běh
 * (`npm run dev` na test serveru). V produkci pod `/CardFileWebWS/michalovo/`
 * bude tato stránka entry point modulu, hlavičku DcFlipperHeader případně
 * skryjeme (záleží, jak Václav modul integruje do staré JSF kartoteky).
 */

import { useState } from "react";
import { Search } from "lucide-react";
import DcFlipperHeader from "@/components/DcFlipperHeader";
import EzadankyList from "@/components/EzadankyList";

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeRid, setActiveRid] = useState<string | null>(null);

  const normalize = (s: string) =>
    s.trim().replace(/\s+/g, "").replace("/", "");

  const handleSubmit = () => {
    const rc = normalize(query);
    if (!/^\d{9,10}$/.test(rc)) {
      alert("Zadej rodné číslo (9 nebo 10 cifer, bez lomítka)");
      return;
    }
    setActiveRid(rc);
  };

  return (
    <>
      <DcFlipperHeader />

      <main className="min-h-screen py-8 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-center text-brand-navy">
            eŽádanky pacienta
          </h1>

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
              Zadej rodné číslo bez lomítka (9 nebo 10 cifer). Pacient musí být
              registrovaný v MZČR systému eŽádanka.
            </p>
          </div>

          {activeRid && <EzadankyList rid={activeRid} />}
        </div>
      </main>
    </>
  );
}
