"use client";

/**
 * Modal s plným detailem konkrétní eŽádanky.
 *
 * Sám si fetchne data z `/CardFileWebWS/rest/ezadanka/{id}`,
 * dekóduje klinický obsah z Base64, zploští přes parser a zobrazí.
 *
 * Edit režim:
 *   - Klik na "Editovat" → pole se přepnou na inputy.
 *   - Změny se drží jen v paměti modalu (nikam neukládáme — MZČR je read-only).
 *   - Klik na "Založit vyšetření" → upravená data jdou jako query params do
 *     staré JSF stránky pro novou kartu vyšetření.
 *   - Klik na "Zrušit úpravy" → vrátí se původní data ze žádanky.
 */

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Stethoscope, Pencil, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getEzadankaById } from "@/lib/api";
import {
  buildStudyDraftFromEzadanka,
  createStudy,
} from "@/lib/api-study";
import type { FlatZadankaDetail } from "@/lib/parser";
import type { Gender, PatientInfo } from "@/lib/patient-types";
import VykonyEditor from "./VykonyEditor";
import { calculateAge } from "@/lib/age";

interface Props {
  /** UUID žádanky (např. "0d54820f-6dcd-47cc-8c85-36b80bb515cf") */
  id: string;
  /** RČ pacienta — pro link "Založit vyšetření" do staré JSF kartoteky */
  pid?: string;
  /** Pacient z naší DB — potřebujeme pro POST /study (patientData) */
  patient?: PatientInfo | null;
  /**
   * Existuje pacient v naší DB? Tlačítko "Založit vyšetření" je aktivní
   * jen v tomto případě — vyšetření se nedá založit pro pacienta,
   * který v DB ještě není. Default true (zachová staré chování).
   */
  patientExists?: boolean;
  /** URL prefix pro starou JSF kartoteku (default: /CFLocalSyncWeb) */
  legacyBase?: string;
  /**
   * ID pracoviště, kde se vyšetření zakládá. Pro test natvrdo "BRLE" (Lesná).
   * V produkci přijde podle přihlášené ordinace.
   */
  idWorkingplace?: string;
  onClose: () => void;
}

// V dev mode lze přepsat doménu staré JSF (např. http://cftest.dc-flipper.cz).
// V produkci (modul same-origin v Payaře) zůstane relativní /CFLocalSyncWeb.
const DEFAULT_LEGACY_BASE =
  process.env.NEXT_PUBLIC_LEGACY_BASE_URL
    ? `${process.env.NEXT_PUBLIC_LEGACY_BASE_URL}/CFLocalSyncWeb`
    : "/CFLocalSyncWeb";

export default function EzadankaDetail({
  id,
  pid,
  patient,
  patientExists = true,
  legacyBase = DEFAULT_LEGACY_BASE,
  idWorkingplace = "BRLE",
  onClose,
}: Props) {
  const [data, setData] = useState<FlatZadankaDetail | null>(null);
  const [editedData, setEditedData] = useState<FlatZadankaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /**
   * Výkony vybrané recepční (kód → počet). Předvyplňuje se auto-fill
   * pravidly při mountu VykonyEditoru. Posílá se do POST /study jako
   * `medicalServices`. Pokud je prázdné, tlačítko "Založit vyšetření" je
   * disablované — backend by jinak vrátil 422 ("medicalServices is EMPTY").
   */
  const [vybraneSluzby, setVybraneSluzby] = useState<Record<string, number>>(
    {}
  );

  const isEditing = editedData !== null;
  const view = editedData ?? data;

  // Věk pacienta — pro auto-fill pravidla ve VykonyEditoru
  const age = useMemo(
    () => calculateAge(view?.pacient.datumNarozeni ?? null),
    [view?.pacient.datumNarozeni]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getEzadankaById(id)
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [id]);

  // Klinický obsah dostupný? — když máme aspoň jeden klinický údaj
  const klinickyObsahDostupny = !!(
    view &&
    (view.diagnoza.kod ||
      view.diagnoza.nazev ||
      view.diagnoza.klinickaOtazka ||
      view.vysetreni.castTela ||
      view.vysetreni.lateralita ||
      view.pacientStav.vyska ||
      view.pacientStav.vaha)
  );

  const startEdit = () => {
    if (!data) return;
    // Hluboká kopie — Set, Date, Map nemáme, JSON stringify stačí
    setEditedData(JSON.parse(JSON.stringify(data)) as FlatZadankaDetail);
  };

  const cancelEdit = () => setEditedData(null);

  /**
   * Helper pro update do nested fieldu v editedData.
   * Použití: updateEdited("diagnoza", "klinickaOtazka", "novy text")
   * Pokud zatím edit režim není zapnut, sám ho zapne.
   */
  const updateEdited = <
    S extends keyof FlatZadankaDetail,
    K extends keyof FlatZadankaDetail[S],
  >(
    section: S,
    field: K,
    value: FlatZadankaDetail[S][K]
  ) => {
    setEditedData((prev) => {
      const base =
        prev ?? (JSON.parse(JSON.stringify(data)) as FlatZadankaDetail);
      const sectionObj = { ...(base[section] as object) } as FlatZadankaDetail[S];
      (sectionObj as Record<string, unknown>)[field as string] = value;
      return { ...base, [section]: sectionObj };
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Hlavička modalu — DC Flipper teal */}
        <DialogHeader className="bg-brand-teal-50 border-b border-brand-teal-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-brand-navy">
            <Stethoscope className="w-5 h-5 text-brand-teal-600" />
            <span>eŽádanka</span>
            {view && (
              <code className="text-sm font-mono text-brand-teal-700 ml-1">
                {view.kod}
              </code>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          {loading && (
            <p className="py-6 text-sm text-gray-500">Načítám detail…</p>
          )}

          {error && (
            <div className="my-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {view && (
            <div className="space-y-6">
              {/* Hlavička: stav + urgentnost + datum + edit info */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge>{view.stav}</Badge>
                <Badge variant={urgentnostVariant(view.urgentnost)}>
                  {view.urgentnost}
                </Badge>
                <span className="text-sm text-gray-500">
                  vystaveno {formatDate(view.datumVytvoreni)}
                </span>
                {isEditing && (
                  <span className="ml-auto text-xs text-amber-700 italic">
                    Úpravy se použijí jen pro nové vyšetření,
                    do MZČR se neukládají.
                  </span>
                )}
              </div>

              {/* Upozornění, když chybí klinický obsah */}
              {!klinickyObsahDostupny && !isEditing && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Klinický obsah není dostupný</p>
                    <p className="text-xs mt-0.5">
                      Detail vyšetření, diagnóza a biometrické údaje nejsou v
                      databázi MZČR.
                    </p>
                  </div>
                </div>
              )}

              <Section title="Vyšetření" hideIfEmpty={!isEditing}>
                <Row label="Název" value={view.vysetreni.nazev} editing={false} />
                <Row
                  label="Modalita"
                  value={
                    view.vysetreni.modalita +
                    (view.vysetreni.modalitaKod
                      ? ` (${view.vysetreni.modalitaKod})`
                      : "")
                  }
                  editing={false}
                />
                <Row
                  label="Část těla"
                  value={view.vysetreni.castTela}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("vysetreni", "castTela", v || null)
                  }
                />
                <Row
                  label="Lateralita"
                  value={view.vysetreni.lateralita}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("vysetreni", "lateralita", v || null)
                  }
                />
                <Row
                  label="Poznámka"
                  value={view.vysetreni.poznamka}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("vysetreni", "poznamka", v || null)
                  }
                />
                <Row
                  label="Instrukce pro pacienta"
                  value={view.vysetreni.informaceProPacienta}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("vysetreni", "informaceProPacienta", v || null)
                  }
                  highlight={!isEditing}
                />
              </Section>

              <Section title="Diagnóza a klinická otázka" hideIfEmpty={!isEditing}>
                <Row
                  label="Diagnóza (kód)"
                  value={view.diagnoza.kod}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("diagnoza", "kod", v || null)
                  }
                />
                <Row
                  label="Diagnóza (název)"
                  value={view.diagnoza.nazev}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("diagnoza", "nazev", v || null)
                  }
                />
                <Row
                  label="Klinická otázka"
                  value={view.diagnoza.klinickaOtazka}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("diagnoza", "klinickaOtazka", v || null)
                  }
                />
              </Section>

              <Section title="Pacient">
                <Row
                  label="Jméno"
                  value={
                    `${view.pacient.jmeno} ${view.pacient.prijmeni}`.trim() ||
                    null
                  }
                  editing={false}
                />
                <Row
                  label="Datum narození"
                  value={view.pacient.datumNarozeni}
                  editing={false}
                />
                <Row
                  label="Rodné číslo"
                  value={
                    isEditing
                      ? view.pacient.rid
                      : formatRc(view.pacient.rid)
                  }
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited(
                      "pacient",
                      "rid",
                      v.replace(/\s+/g, "").replace(/\//g, "")
                    )
                  }
                />
                <Row
                  label="Pojišťovna"
                  value={composePojistovna(
                    view.pacient.pojistovnaKod,
                    view.pacient.pojistovnaNazev
                  )}
                  editing={false}
                />
              </Section>

              <Section title="Stav pacienta" hideIfEmpty={!isEditing}>
                <Row
                  label="Mobilita"
                  value={view.pacientStav.omezeniMobility}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("pacientStav", "omezeniMobility", v || null)
                  }
                />
                <Row
                  label="Výška"
                  value={view.pacientStav.vyska}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("pacientStav", "vyska", v || null)
                  }
                />
                <Row
                  label="Váha"
                  value={view.pacientStav.vaha}
                  editing={isEditing}
                  onChange={(v) =>
                    updateEdited("pacientStav", "vaha", v || null)
                  }
                />
                <Row
                  label="Implantát"
                  value={view.pacientStav.implantat ? "ano" : "ne"}
                  editing={false}
                />
                <Row
                  label="Úhrada"
                  value={
                    view.uhrada ??
                    (view.pacientStav.samoplatce
                      ? "samoplátce"
                      : "zdravotní pojištění")
                  }
                  editing={false}
                />
              </Section>

              <Section title="Žadatel">
                <Row
                  label="Lékař"
                  value={view.zadatel.jmeno}
                  editing={false}
                />
                <Row
                  label="IČO poskytovatele"
                  value={view.zadatel.poskytovatelIco}
                  editing={false}
                />
                <Row
                  label="ICP"
                  value={view.zadatel.icpZadatele}
                  editing={false}
                />
              </Section>

              {/* Editor výkonů — recepční vybírá kódy úkonů.
                  Zobrazuje se jen, když existuje pacient v naší DB
                  (jinak nelze vyšetření založit ani s vybranými výkony). */}
              {patientExists && view.vysetreni.modalita !== "OTHER" && (
                <VykonyEditor
                  modalita={view.vysetreni.modalita}
                  age={age}
                  onChange={setVybraneSluzby}
                />
              )}

              {/* Chyba při zakládání vyšetření */}
              {createError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">
                      Nepodařilo se založit vyšetření
                    </p>
                    <p className="text-xs mt-0.5">{createError}</p>
                  </div>
                </div>
              )}

              {/* Akční tlačítka */}
              <div className="flex justify-between items-center gap-2 pt-3 border-t border-gray-200">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Zavřít
                  </Button>
                  {isEditing ? (
                    <Button
                      variant="ghost"
                      onClick={cancelEdit}
                      className="gap-1.5 text-gray-600"
                    >
                      <X className="w-4 h-4" />
                      Zrušit úpravy
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={startEdit}
                      className="gap-1.5 text-brand-teal-700"
                    >
                      <Pencil className="w-4 h-4" />
                      Editovat
                    </Button>
                  )}
                </div>

                {pid &&
                  (patientExists ? (
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        variant="teal"
                        onClick={() =>
                          handleZalozitVysetreni(
                            view,
                            patient,
                            idWorkingplace,
                            legacyBase,
                            vybraneSluzby,
                            setCreating,
                            setCreateError
                          )
                        }
                        disabled={
                          creating ||
                          Object.keys(vybraneSluzby).length === 0
                        }
                        className="gap-2"
                      >
                        {creating && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {creating ? "Zakládám…" : "Založit vyšetření"}
                      </Button>
                      {Object.keys(vybraneSluzby).length === 0 && (
                        <span className="text-[11px] text-gray-500 italic">
                          Vyber alespoň jeden výkon.
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 italic max-w-md text-right">
                      Před založením vyšetření nejprve založ pacienta v
                      kartě níže.
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-komponenty ───────────────────────────────────────────────────────

function Section({
  title,
  children,
  hideIfEmpty,
}: {
  title: string;
  children: React.ReactNode;
  hideIfEmpty?: boolean;
}) {
  if (hideIfEmpty) {
    const hasContent = React.Children.toArray(children).some(
      (child) =>
        React.isValidElement<{ value?: unknown }>(child) &&
        child.props.value !== null &&
        child.props.value !== undefined &&
        child.props.value !== ""
    );
    if (!hasContent) return null;
  }

  return (
    <section>
      <h3 className="text-xs font-semibold text-brand-teal-700 mb-3 uppercase tracking-wider">
        {title}
      </h3>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  editing,
  onChange,
  highlight,
}: {
  label: string;
  value: string | null | undefined;
  editing: boolean;
  onChange?: (v: string) => void;
  highlight?: boolean;
}) {
  // Read-only mode: skryj prázdné, jak to bylo dřív
  if (!editing && (value === null || value === undefined || value === "")) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {editing && onChange ? (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
      ) : (
        <span
          className={
            highlight
              ? "text-amber-700 font-medium"
              : "text-gray-900"
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "warning" | "danger";
}) {
  const cls =
    variant === "warning"
      ? "bg-amber-100 text-amber-800"
      : variant === "danger"
      ? "bg-red-100 text-red-800"
      : "bg-brand-teal-100 text-brand-teal-700";
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

// ─── Helpery ──────────────────────────────────────────────────────────────

function urgentnostVariant(
  urgentnost: string
): "default" | "warning" | "danger" {
  const u = urgentnost.toLowerCase();
  if (u.includes("statim")) return "danger";
  if (u.includes("urgent")) return "warning";
  return "default";
}

function formatRc(rc: string): string {
  if (!rc || rc.length <= 6) return rc ?? "";
  return `${rc.substring(0, 6)}/${rc.substring(6)}`;
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

function composePojistovna(
  kod: string | null,
  nazev: string | null
): string | null {
  if (kod && nazev) return `${kod} — ${nazev}`;
  return nazev ?? kod ?? null;
}

/**
 * Handler pro tlačítko "Založit vyšetření".
 *
 * 1) Sestaví draft `StudySaveBasicInfo` z eŽádanky a údajů pacienta.
 * 2) Pošle `POST /CardFileWebWS/rest/study` → vytvoří záznam vyšetření v DB.
 * 3) Po úspěchu naviguje na JSF `/study/edit.xhtml?id=<vrácené ID>`,
 *    kde recepční vyšetření dokončí (RIS workflow).
 *
 * `medicalServices` je mapa kód → počet vybraná recepční ve VykonyEditoru.
 * Backend vyžaduje aspoň jednu položku, jinak vrátí 422.
 */
async function handleZalozitVysetreni(
  z: FlatZadankaDetail,
  patient: PatientInfo | null | undefined,
  idWorkingplace: string,
  legacyBase: string,
  medicalServices: Record<string, number>,
  setCreating: (b: boolean) => void,
  setCreateError: (s: string | null) => void
) {
  if (!patient || !patient.patientDataInfo) {
    setCreateError(
      "Pacient v naší DB nebyl nalezen. Nelze založit vyšetření."
    );
    return;
  }

  if (Object.keys(medicalServices).length === 0) {
    setCreateError("Pro založení vyšetření vyber alespoň jeden výkon.");
    return;
  }

  setCreating(true);
  setCreateError(null);

  try {
    const d = patient.patientDataInfo;
    const study = await createStudy(
      buildStudyDraftFromEzadanka(
        z,
        {
          pid: patient.pid,
          firstName: d.firstName,
          middleName: d.middleName,
          lastName: d.lastName,
          title: d.title,
          birthDate: d.birthDate,
          gender:
            d.gender === "MALE" || d.gender === "FEMALE"
              ? (d.gender as Gender)
              : undefined,
          idInsuranceCompany: d.idInsuranceCompany,
          email: d.email,
          phone: d.phone,
          weight: d.weight,
          height: d.height,
        },
        {
          idWorkingplace,
          medicalServices,
        }
      )
    );

    // Po úspěchu naviguj na JSF stránku se zobrazením/editací vyšetření.
    window.location.href = `${legacyBase}/secured/study/edit.xhtml?id=${study.id}`;
  } catch (e) {
    setCreateError((e as Error).message);
    setCreating(false);
  }
}
