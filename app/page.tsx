"use client";

/**
 * Demo / showcase stránka modulu eŽádanka.
 *
 * Recepční zadá rodné číslo pacienta, stránka načte aktivní eŽádanky
 * a zobrazí je v tabulce. Klik na řádek otevře detail.
 *
 * V produkci tato stránka bude naservírována přes Payaru pod
 * `/CardFileWebWS/michalovo/`. Stará JSF kartoteka bude na ni linkovat
 * z tlačítka "Nový pacient" — viz Václavův plán.
 */

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">
            eŽádanky pacienta
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Zadej rodné číslo pacienta a načti jeho aktivní žádanky z MZČR.
          </p>
        </header>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <label
            htmlFor="rc-input"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Rodné číslo
          </label>
          <div className="flex gap-2">
            <input
              id="rc-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="např. 9882826031"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleSubmit} className="gap-2">
              <Search className="w-4 h-4" />
              Vyhledat
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Pro otestování: <code>9882826031</code> (Roman Č.) má 2 testovací
            žádanky.
          </p>
        </div>

        {activeRid && <EzadankyList rid={activeRid} />}
      </div>
    </main>
  );
}
