"use client";

/**
 * Modal pro založení nového poskytovatele (lékaře / zdravotnické zařízení).
 *
 * Otevírá se z `EzadankaDetail`, když pre-check zjistí, že IČP žadatele
 * z eŽádanky není v naší DB poskytovatelů. Recepční tak nemusí přepínat
 * do staré JSF kartoteky — formulář je předvyplněný daty z eŽádanky
 * a po uložení (PUT /medical-institution/{IČP}) se rodiči zavolá
 * `onSuccess`, který re-runne pre-check a odblokne tlačítko
 * "Založit vyšetření".
 *
 * Pole odpovídají JSF formuláři "Založení lékaře" — IČP, Popis, Dlouhý
 * popis, Doktor, Email, Odbornost (autocomplete dropdown), IČZ, CGM ID,
 * XML export checkboxy, Platnost do.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Save, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  saveMedicalInstitution,
  searchMedicalSkills,
  type MedicalInstitutionInfo,
  type MedicalInstitutionSaveInfo,
  type MedicalSkillInfo,
} from "@/lib/api-medical-institutions";

interface Props {
  /** IČP žadatele z eŽádanky — read-only v formuláři */
  icp: string;
  /** Předvyplnit jméno doktora (z `zadatel.jmeno`) */
  defaultDoctorName?: string;
  /** Předvyplnit email (z eŽádanky, pokud máme) */
  defaultDoctorEmail?: string;
  /**
   * Po úspěšném uložení rodič dostane vrácený poskytovatel.
   * Použije ho na re-check existence (varování zmizí, "Založit vyšetření"
   * se odblokne).
   */
  onSuccess: (saved: MedicalInstitutionInfo) => void;
  onClose: () => void;
}

/** XML export typy — kódy do pole `idXmlExportDefinition` */
const XML_EXPORT_OPTIONS = [
  { code: "CGM", label: "CGM XML Export" },
  { code: "EZPRAVA", label: "Ezprava XML Export" },
];

export default function LekarFormModal({
  icp,
  defaultDoctorName,
  defaultDoctorEmail,
  onSuccess,
  onClose,
}: Props) {
  // ─── Form state ───────────────────────────────────────────────────────
  const [description, setDescription] = useState(defaultDoctorName ?? "");
  const [descriptionLong, setDescriptionLong] = useState(
    defaultDoctorName ?? ""
  );
  const [doctorName, setDoctorName] = useState(defaultDoctorName ?? "");
  const [doctorEmail, setDoctorEmail] = useState(defaultDoctorEmail ?? "");
  const [idMedicalSkill, setIdMedicalSkill] = useState<string>("");
  const [skillName, setSkillName] = useState<string>("");
  const [icz, setIcz] = useState("");
  const [cgmId, setCgmId] = useState("");
  const [xmlExport, setXmlExport] = useState<string[]>([]);
  const [dateValidTill, setDateValidTill] = useState<string>(""); // YYYY-MM-DD

  // ─── Skills autocomplete state ────────────────────────────────────────
  const [skillQuery, setSkillQuery] = useState("");
  const [skillResults, setSkillResults] = useState<MedicalSkillInfo[]>([]);
  const [skillSearching, setSkillSearching] = useState(false);
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const skillBoxRef = useRef<HTMLDivElement>(null);
  /**
   * Je `POST /medical-skill/:search` dostupný? Vašek momentálně nemá
   * číselník odborností v API (404). Když selže fetch, přepneme
   * na plain text input — recepční napíše kód odbornosti ručně.
   */
  const [skillSearchAvailable, setSkillSearchAvailable] = useState(true);

  // ─── Submit state ─────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounced search odborností při psaní
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setSkillSearching(true);
      try {
        const r = await searchMedicalSkills(skillQuery, 50);
        if (!cancelled) setSkillResults(r);
      } catch {
        if (!cancelled) setSkillResults([]);
      } finally {
        if (!cancelled) setSkillSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [skillQuery]);

  // Načti všechny odbornosti hned při otevření, aby uživatel viděl seznam
  // bez psaní (typický UX pattern u krátkých číselníků). Pokud endpoint
  // neexistuje (404), přepneme na manual input.
  useEffect(() => {
    let cancelled = false;
    searchMedicalSkills("", 100)
      .then((r) => {
        if (!cancelled) {
          setSkillResults(r);
          setSkillSearchAvailable(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSkillSearchAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Klik mimo dropdown → zavřít
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        skillBoxRef.current &&
        !skillBoxRef.current.contains(e.target as Node)
      ) {
        setSkillDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleXmlExport = (code: string) => {
    setXmlExport((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    );
  };

  const selectSkill = (skill: MedicalSkillInfo) => {
    setIdMedicalSkill(skill.id);
    setSkillName(skill.name);
    setSkillQuery("");
    setSkillDropdownOpen(false);
  };

  const validate = (): string | null => {
    if (!description.trim()) return "Vyplň prosím popis.";
    if (!descriptionLong.trim()) return "Vyplň prosím dlouhý popis.";
    if (!doctorName.trim()) return "Vyplň prosím jméno doktora.";
    if (!doctorEmail.trim()) return "Vyplň prosím email lékaře.";
    if (!idMedicalSkill.trim()) return "Vyber odbornost.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setSaveError(err);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload: MedicalInstitutionSaveInfo = {
      description: description.trim(),
      descriptionLong: descriptionLong.trim(),
      doctorName: doctorName.trim(),
      doctorEmail: doctorEmail.trim(),
      idMedicalSkill: idMedicalSkill.trim(),
      icz: icz.trim() || null,
      cgmId: cgmId.trim() || null,
      idXmlExportDefinition: xmlExport.length > 0 ? xmlExport : undefined,
      dateValidTill: dateValidTill || null,
    };

    try {
      const saved = await saveMedicalInstitution(icp, payload);
      onSuccess(saved);
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="bg-brand-teal-50 border-b border-brand-teal-100 px-6 py-4">
          <DialogTitle className="text-brand-navy">
            Založit nového lékaře
          </DialogTitle>
          <p className="text-xs text-gray-600 mt-1">
            Recepční jednorázově doplní údaje z eŽádanky do číselníku
            poskytovatelů. Většina polí je předvyplněná.
          </p>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* IČP — read-only, z eŽádanky */}
          <Field label="IČP" hint="z eŽádanky, neměnné">
            <input
              type="text"
              value={icp}
              readOnly
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-gray-50 font-mono"
            />
          </Field>

          <Field label="Popis" required>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
              placeholder="Krátký název (typicky jméno lékaře)"
            />
          </Field>

          <Field label="Dlouhý popis" required>
            <input
              type="text"
              value={descriptionLong}
              onChange={(e) => setDescriptionLong(e.target.value)}
              className={inputCls}
              placeholder="Plný název / adresa"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Doktor" required>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Email lékaře" required>
              <input
                type="email"
                value={doctorEmail}
                onChange={(e) => setDoctorEmail(e.target.value)}
                className={inputCls}
                placeholder="lekar@example.cz"
              />
            </Field>
          </div>

          {/* Odbornost — autocomplete z číselníku, fallback na plain input */}
          <div ref={skillBoxRef}>
            <Field
              label="Odbornost"
              required
              hint={
                skillSearchAvailable
                  ? undefined
                  : "číselník nedostupný — napiš kód ručně, např. 001"
              }
            >
              {idMedicalSkill ? (
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs font-semibold text-brand-teal-700 px-2 py-1 bg-brand-teal-50 rounded">
                    {idMedicalSkill}
                  </code>
                  {skillName && (
                    <span className="text-sm text-gray-900 flex-1">
                      {skillName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIdMedicalSkill("");
                      setSkillName("");
                      setSkillDropdownOpen(true);
                    }}
                    className="text-xs text-brand-teal-700 hover:underline ml-auto"
                  >
                    Změnit
                  </button>
                </div>
              ) : skillSearchAvailable ? (
                // ── Mode A: autocomplete dropdown z číselníku ──────────
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={skillQuery}
                    onChange={(e) => {
                      setSkillQuery(e.target.value);
                      setSkillDropdownOpen(true);
                    }}
                    onFocus={() => setSkillDropdownOpen(true)}
                    placeholder="Hledat odbornost…"
                    className={`${inputCls} pl-9`}
                  />
                  {skillDropdownOpen && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
                      {skillSearching && (
                        <p className="p-3 text-xs text-gray-500">Hledám…</p>
                      )}
                      {!skillSearching && skillResults.length === 0 && (
                        <p className="p-3 text-xs text-gray-500">
                          Žádné odbornosti nenalezeny.
                        </p>
                      )}
                      {!skillSearching &&
                        skillResults.map((s) => (
                          <button
                            type="button"
                            key={s.id}
                            onClick={() => selectSkill(s)}
                            className="block w-full text-left px-3 py-2 hover:bg-brand-teal-50/50 border-b border-gray-100 last:border-0 text-sm"
                          >
                            <div className="flex items-baseline gap-2">
                              <code className="font-mono text-xs font-semibold text-brand-teal-700 shrink-0">
                                {s.id}
                              </code>
                              <span className="flex-1 text-gray-900 truncate">
                                {s.name}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                // ── Mode B: fallback na plain input ────────────────────
                <input
                  type="text"
                  value={skillQuery}
                  onChange={(e) => {
                    setSkillQuery(e.target.value);
                    // při psaní ručně rovnou nastavovat idMedicalSkill,
                    // ať uživatel nemusí "potvrzovat"
                    setIdMedicalSkill(e.target.value.trim());
                    setSkillName("");
                  }}
                  placeholder="Kód odbornosti (např. 001)"
                  className={inputCls}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="IČZ" hint="nepovinné">
              <input
                type="text"
                value={icz}
                onChange={(e) => setIcz(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="CGM ID" hint="nepovinné">
              <input
                type="text"
                value={cgmId}
                onChange={(e) => setCgmId(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* XML export */}
          <Field label="XML export" hint="zaškrtni, pokud je s lékařem propojen přes daný systém">
            <div className="flex flex-wrap gap-4 mt-1">
              {XML_EXPORT_OPTIONS.map((o) => (
                <label
                  key={o.code}
                  className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={xmlExport.includes(o.code)}
                    onChange={() => toggleXmlExport(o.code)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-teal-600 focus:ring-brand-teal"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Platnost do" hint="nepovinné — YYYY-MM-DD">
            <input
              type="date"
              value={dateValidTill}
              onChange={(e) => setDateValidTill(e.target.value)}
              className={inputCls}
            />
          </Field>

          {saveError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Akce */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              className="gap-1.5 text-gray-600"
            >
              <X className="w-4 h-4" />
              Zrušit
            </Button>
            <Button
              variant="teal"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Ukládám…" : "Uložit lékaře"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-komponenty ─────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-gray-400 italic">({hint})</span>}
      </span>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent";
