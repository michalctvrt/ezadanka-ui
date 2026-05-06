/**
 * DC Flipper hlavička — tmavě modrá s logem + teal navigační lišta.
 *
 * Pro standalone běh (demo page). V produkci, když bude modul embeddovaný
 * pod /CardFileWebWS/michalovo/ uvnitř JSF kartoteky, hlavičku skrýt
 * (přidat prop `hideHeader`).
 */

import { Fish } from "lucide-react";

export default function DcFlipperHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      {/* Tmavě modrá pruh s logem */}
      <div className="bg-brand-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Fish className="w-7 h-7 text-brand-teal" />
          <div>
            <div className="text-base font-bold leading-none">DC FLIPPER</div>
            <div className="text-[11px] uppercase tracking-wider opacity-80 mt-0.5">
              Radiodiagnostika
            </div>
          </div>
        </div>
      </div>

      {/* Tyrkysová navigační lišta */}
      <div className="bg-brand-teal text-white">
        <nav className="max-w-6xl mx-auto px-6 flex items-center gap-8 text-sm">
          <NavItem label="Pacient" />
          <NavItem label="Připojení lékaři" />
          <NavItem label="E-žádanka" active />
          <NavItem label="Hromadný tisk" />
        </nav>
      </div>
    </header>
  );
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className={`py-3 px-1 cursor-pointer transition ${
        active
          ? "border-b-2 border-white font-medium"
          : "opacity-90 hover:opacity-100"
      }`}
    >
      {label}
    </div>
  );
}
