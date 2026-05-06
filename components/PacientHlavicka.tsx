/**
 * Hlavička pacienta nad seznamem žádanek.
 *
 * Ukáže recepční jasně, čí žádanky pod tím vidí. Data čerpá ze
 * `FlatZadankaListItem.pacient` (vytáhnuto z `zasilka.pacientData`).
 */

import { User } from "lucide-react";

interface Props {
  jmeno: string;
  prijmeni: string;
  /** Datum narození ve formátu YYYY-MM-DD (z MZČR API) */
  datumNarozeni: string | null;
  /** Rodné číslo bez lomítka (např. "9882826031") */
  rid: string;
}

export default function PacientHlavicka({
  jmeno,
  prijmeni,
  datumNarozeni,
  rid,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-brand-teal-50 border-b border-brand-teal-100 px-5 py-3 flex items-center gap-2">
        <User className="w-4 h-4 text-brand-teal-600" />
        <h2 className="font-semibold text-brand-navy">Pacient</h2>
      </div>
      <div className="px-5 py-4 grid sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <Field label="Jméno" value={`${jmeno} ${prijmeni}`.trim() || "—"} />
        <Field label="Datum narození" value={formatDate(datumNarozeni)} />
        <Field label="Rodné číslo" value={formatRc(rid)} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 mb-0.5">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
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

function formatRc(rc: string): string {
  if (!rc || rc.length <= 6) return rc ?? "—";
  return `${rc.substring(0, 6)}/${rc.substring(6)}`;
}
