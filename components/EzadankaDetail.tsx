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

import React, { useEffect, useState } from "react";
import { AlertTriangle, Stethoscope, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getEzadankaById } from "@/lib/api";
import type { FlatZadankaDetail } from "@/lib/parser";

interface Props {
  /** UUID žádanky (např. "0d54820f-6dcd-47cc-8c85-36b80bb515cf") */
  id: string;
  /** RČ pacienta — pro link "Založit vyšetření" do staré JSF kartoteky */
  pid?: string;
  /**
   * Existuje pacient v naší DB? Tlačítko "Založit vyšetření" je aktivní
   * jen v tomto případě — JSF stránka pacienta hledá v DB a pokud nenajde,
   * vrátí "Chybné rodné číslo!". Default true (zachová staré chování).
   */
  patientExists?: boolean;
  /** URL prefix pro starou JSF kartoteku (default: /CFLocalSyncWeb) */
  legacyBase?: string;
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
  patientExists = true,
  legacyBase = DEFAULT_LEGACY_BASE,
  onClose,
}: Props) {
  const [data, setData] = useState<FlatZadankaDetail | null>(null);
  const [editedData, setEditedData] = useState<FlatZadankaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editedData !== null;
  const view = editedData ?? data;

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
                  value={formatRc(view.pacient.rid)}
                  editing={false}
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
                    <a
                      href={buildZalozitVysetreniUrl(legacyBase, pid, view)}
                      className="inline-flex items-center justify-center gap-2 bg-brand-teal hover:bg-brand-teal-700 text-white text-sm font-medium px-4 py-2 rounded-md transition"
                    >
                      Založit vyšetření
                    </a>
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
 * Sestavení URL na starou JSF stránku "Nové vyšetření" s předvyplněnými
 * daty (po případných úpravách) z eŽádanky.
 */
function buildZalozitVysetreniUrl(
  legacyBase: string,
  pid: string,
  z: FlatZadankaDetail
): string {
  const params = new URLSearchParams({
    pid,
    ezadanka_id: z.id,
    ezadanka_kod: z.kod,
  });
  if (z.diagnoza.kod) params.set("diagnoza_kod", z.diagnoza.kod);
  if (z.diagnoza.nazev) params.set("diagnoza_nazev", z.diagnoza.nazev);
  if (z.diagnoza.klinickaOtazka)
    params.set("popis_diagnozy", z.diagnoza.klinickaOtazka);
  if (z.vysetreni.modalitaKod)
    params.set("modalita", z.vysetreni.modalitaKod);
  if (z.vysetreni.castTela) params.set("cast_tela", z.vysetreni.castTela);
  if (z.vysetreni.lateralita)
    params.set("lateralita", z.vysetreni.lateralita);
  if (z.vysetreni.poznamka) params.set("poznamka", z.vysetreni.poznamka);
  if (z.vysetreni.informaceProPacienta)
    params.set("instrukce", z.vysetreni.informaceProPacienta);
  if (z.pacientStav.vyska) params.set("vyska", z.pacientStav.vyska);
  if (z.pacientStav.vaha) params.set("vaha", z.pacientStav.vaha);
  return `${legacyBase}/secured/study/edit.xhtml?${params.toString()}`;
}
