/**
 * DC Flipper hlavička — bílé pozadí, logo zarovnané vlevo.
 * Žádná navigační lišta — modul je jen pro eŽádanky, ne celá aplikace.
 *
 * V produkci, když bude modul embedded pod /CardFileWebWS/michalovo/ uvnitř
 * staré JSF kartoteky, hlavičku skryj přes prop nebo jen ji nepoužij na page.
 */

export default function DcFlipperHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="DC Flipper Radiodiagnostika" className="h-12" />
      </div>
    </header>
  );
}
