"use client";

/**
 * Karta pacienta — formulář s daty pacienta.
 *
 * Použití:
 *   <PacientKarta pid="9412034082" initial={...} mode="existing" onSaved={...} />
 *   <PacientKarta pid="9412034082" initial={...} mode="new" onSaved={...} />
 *
 * - mode="existing" → tlačítka "Vyšetření pacienta", "Nové vyšetření", "Uložit"
 * - mode="new" → jen tlačítko "Založit pacienta"
 *
 * Pole odpovídají staré JSF kartě (Editace pacienta) + naší DB struktuře.
 *
 * Tlačítka pro vyšetření zatím odkazují na starou JSF stránku pod
 * /CFLocalSyncWeb/secured/study/* — než budeme mít vlastní vyšetření v Reactu.
 */

import { useEffect, useState } from "react";
import { Save, FileText, Plus, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  findPatientByPid,
  listInsuranceCompanies,
  savePatientData,
} from "@/lib/api-patient";
import type {
  Gender,
  InsuranceCompanyInfo,
  PatientDataSaveInfo,
} from "@/lib/patient-types";
import { formatRc } from "@/lib/rc";

export interface PacientKartaInitialData {
  firstName: string;
  middleName: string;
  lastName: string;
  title: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender | "";
  idInsuranceCompany: string; // např. "207"
  email: string;
  phone: string;
  weight: string; // string kvůli inputu
  height: string;
}

export const EMPTY_PACIENT_KARTA_DATA: PacientKartaInitialData = {
  firstName: "",
  middleName: "",
  lastName: "",
  title: "",
  birthDate: "",
  gender: "",
  idInsuranceCompany: "",
  email: "",
  phone: "",
  weight: "",
  height: "",
};


interface Props {
  /** Rodné číslo bez lomítka */
  pid: string;
  /** Předvyplněná data — z naší DB nebo z eŽádanky nebo z RČ */
  initial: PacientKartaInitialData;
  /** "existing" = update režim, "new" = nový pacient */
  mode: "existing" | "new";
  /** URL prefix pro odkazy na starou JSF kartoteku (default: /CFLocalSyncWeb) */
  legacyBase?: string;
  /** Callback po úspěšném uložení */
  onSaved?: () => void;
}

// V dev mode lze přepsat doménu staré JSF (např. http://cftest.dc-flipper.cz).
// V produkci (modul same-origin v Payaře) zůstane relativní /CFLocalSyncWeb.
const DEFAULT_LEGACY_BASE =
  process.env.NEXT_PUBLIC_LEGACY_BASE_URL
    ? `${process.env.NEXT_PUBLIC_LEGACY_BASE_URL}/CFLocalSyncWeb`
    : "/CFLocalSyncWeb";

export default function PacientKarta({
  pid,
  initial,
  mode,
  legacyBase = DEFAULT_LEGACY_BASE,
  onSaved,
}: Props) {
  const [form, setForm] = useState<PacientKartaInitialData>(initial);
  const [insuranceCompanies, setInsuranceCompanies] = useState<
    InsuranceCompanyInfo[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Když rodič změní initial (např. po asynchronním fetch), updatuj formulář
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  // Nahraj seznam pojišťoven
  useEffect(() => {
    listInsuranceCompanies()
      .then(setInsuranceCompanies)
      .catch(() => {
        /* tichá chyba — dropdown bude prázdný */
      });
  }, []);

  const update = (patch: Partial<PacientKartaInitialData>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const canSave =
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.birthDate !== "" &&
    (form.gender === "MALE" || form.gender === "FEMALE") &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    // Pro string pole posíláme prázdný řetězec ("") místo null, když je
    // pole prázdné. Václavův backend pravděpodobně ignoruje `null` (chápe
    // ho jako "nepřišlo, neměnit"). Prázdný string = explicit "smaž to".
    const request: PatientDataSaveInfo = {
      pid,
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      lastName: form.lastName.trim(),
      title: form.title.trim(),
      birthDate: form.birthDate,
      gender: form.gender as Gender,
      idInsuranceCompany: form.idInsuranceCompany.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      weight: form.weight ? Number(form.weight) : null,
      height: form.height ? Number(form.height) : null,
    };

    try {
      await savePatientData(pid, request);

      // Po uložení znovu načteme pacienta z DB — backend mohl některá pole
      // zpracovat jinak, než jsme poslali (cleanup, výchozí hodnoty, atd.).
      // Předejdeme tak situaci, kdy uživatel vidí "uloženo OK", ale po
      // refreshi se objeví stará data.
      try {
        const fresh = await findPatientByPid(pid);
        if (fresh?.patientDataInfo) {
          setForm({
            firstName: fresh.patientDataInfo.firstName ?? "",
            middleName: fresh.patientDataInfo.middleName ?? "",
            lastName: fresh.patientDataInfo.lastName ?? "",
            title: fresh.patientDataInfo.title ?? "",
            birthDate: fresh.patientDataInfo.birthDate ?? "",
            gender:
              fresh.patientDataInfo.gender === "MALE" ||
              fresh.patientDataInfo.gender === "FEMALE"
                ? fresh.patientDataInfo.gender
                : "",
            idInsuranceCompany:
              fresh.patientDataInfo.idInsuranceCompany ?? "",
            email: fresh.patientDataInfo.email ?? "",
            phone: fresh.patientDataInfo.phone ?? "",
            weight:
              fresh.patientDataInfo.weight != null
                ? String(fresh.patientDataInfo.weight)
                : "",
            height:
              fresh.patientDataInfo.height != null
                ? String(fresh.patientDataInfo.height)
                : "",
          });
        }
      } catch {
        /* refresh selhal — uživatel uvidí svoji uloženou verzi */
      }

      setSavedAt(Date.now());
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="bg-brand-teal-50 border-b border-brand-teal-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-brand-teal-600" />
          <h2 className="font-semibold text-brand-navy">
            {mode === "existing"
              ? "Karta pacienta"
              : "Založení nového pacienta"}
          </h2>
          <code className="text-sm font-mono text-brand-teal-700 ml-1">
            {formatRc(pid)}
          </code>
        </div>

        <div className="flex items-center gap-2">
          {mode === "existing" && (
            <>
              <a
                href={`${legacyBase}/secured/study/list.xhtml?pid=${encodeURIComponent(
                  pid
                )}`}
                className="inline-flex items-center justify-center gap-2 border border-brand-navy bg-white text-brand-navy hover:bg-brand-teal-50 text-sm font-medium px-3 py-1.5 rounded-md transition"
              >
                <FileText className="w-4 h-4" />
                Vyšetření pacienta
              </a>
              <a
                href={`${legacyBase}/secured/study/edit.xhtml?pid=${encodeURIComponent(
                  pid
                )}`}
                className="inline-flex items-center justify-center gap-2 border border-brand-navy bg-white text-brand-navy hover:bg-brand-teal-50 text-sm font-medium px-3 py-1.5 rounded-md transition"
              >
                <Plus className="w-4 h-4" />
                Nové vyšetření
              </a>
            </>
          )}
          <Button
            onClick={handleSave}
            disabled={!canSave}
            variant="teal"
            size="sm"
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {mode === "existing" ? "Uložit" : "Založit pacienta"}
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Sekce: Identifikace */}
        <Section title="Identifikace">
          <Row>
            <Field label="Rodné číslo" value={formatRc(pid)} readOnly />
            <Field
              label="Datum narození *"
              type="date"
              value={form.birthDate}
              onChange={(v) => update({ birthDate: v })}
            />
            <SelectField
              label="Pohlaví *"
              value={form.gender}
              onChange={(v) =>
                update({ gender: v as PacientKartaInitialData["gender"] })
              }
              options={[
                { value: "", label: "—" },
                { value: "MALE", label: "Muž" },
                { value: "FEMALE", label: "Žena" },
              ]}
            />
          </Row>
          <Row>
            <Field
              label="Titul"
              value={form.title}
              onChange={(v) => update({ title: v })}
              placeholder="MUDr., Mgr., Ing., …"
            />
            <Field
              label="Křestní jméno *"
              value={form.firstName}
              onChange={(v) => update({ firstName: v })}
            />
            <Field
              label="Druhé jméno"
              value={form.middleName}
              onChange={(v) => update({ middleName: v })}
            />
            <Field
              label="Příjmení *"
              value={form.lastName}
              onChange={(v) => update({ lastName: v })}
            />
          </Row>
        </Section>

        {/* Sekce: Kontakt */}
        <Section title="Kontaktní údaje">
          <Row>
            <Field
              label="Telefon"
              value={form.phone}
              onChange={(v) => update({ phone: v })}
              placeholder="+420 …"
            />
            <Field
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(v) => update({ email: v })}
            />
          </Row>
        </Section>

        {/* Sekce: Pojišťovna + biometrie */}
        <Section title="Pojišťovna a biometrie">
          <Row>
            <SelectField
              label="Pojišťovna"
              value={form.idInsuranceCompany}
              onChange={(v) => update({ idInsuranceCompany: v })}
              options={[
                { value: "", label: "—" },
                ...insuranceCompanies.map((ic) => ({
                  value: ic.id,
                  label: `${ic.id} — ${ic.descriptionLong || ic.description}`,
                })),
              ]}
              wide
            />
            <Field
              label="Výška (cm)"
              type="number"
              value={form.height}
              onChange={(v) => update({ height: v })}
            />
            <Field
              label="Váha (kg)"
              type="number"
              value={form.weight}
              onChange={(v) => update({ weight: v })}
            />
          </Row>
        </Section>

        {/* Footer s případnou chybou + "uloženo" indikací */}
        {error && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {savedAt && !error && !saving && (
          <p className="text-xs text-green-700">
            Uloženo {new Date(savedAt).toLocaleTimeString("cs-CZ")}.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-komponenty ───────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-brand-teal-700 uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: "text" | "date" | "email" | "number";
  readOnly?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`px-3 py-2 border rounded-md text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent ${
          readOnly
            ? "border-gray-200 bg-gray-50 text-gray-700"
            : "border-gray-300 bg-white"
        }`}
      />
      {hint && (
        <span className="text-[11px] text-amber-700">{hint}</span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  wide?: boolean;
}) {
  return (
    <label
      className={`flex flex-col gap-1 ${wide ? "lg:col-span-2" : ""}`}
    >
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
