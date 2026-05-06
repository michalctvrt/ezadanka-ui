"use client";

/**
 * Modal s plným detailem konkrétní eŽádanky.
 *
 * Sám si fetchne data z `/CardFileWebWS/rest/ezadanka/{id}`,
 * dekóduje klinický obsah z Base64, zploští přes parser a zobrazí.
 *
 * Styl: DC Flipper — sekce s teal hlavičkou, čistý layout.
 * Sekce, které mají všechny řádky prázdné, se schovávají automaticky.
 */

import React, { useEffect, useState } from "react";
import { AlertTriangle, Stethoscope } from "lucide-react";
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
  onClose: () => void;
}

export default function EzadankaDetail({ id, onClose }: Props) {
  const [data, setData] = useState<FlatZadankaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Detekce, jestli klinický obsah byl dekódován (poznáme podle toho,
  // že máme alespoň jeden klinický údaj — diagnózu, část těla, lateralitu,
  // výšku nebo váhu)
  const klinickyObsahDostupny = !!(
    data &&
    (data.diagnoza.kod ||
      data.diagnoza.nazev ||
      data.diagnoza.klinickaOtazka ||
      data.vysetreni.castTela ||
      data.vysetreni.lateralita ||
      data.pacientStav.vyska ||
      data.pacientStav.vaha)
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Hlavička modalu — DC Flipper teal */}
        <DialogHeader className="bg-brand-teal-50 border-b border-brand-teal-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-brand-navy">
            <Stethoscope className="w-5 h-5 text-brand-teal-600" />
            <span>eŽádanka</span>
            {data && (
              <code className="text-sm font-mono text-brand-teal-700 ml-1">
                {data.kod}
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

          {data && (
            <div className="space-y-6">
              {/* Hlavička: stav + urgentnost + datum */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge>{data.stav}</Badge>
                <Badge variant={urgentnostVariant(data.urgentnost)}>
                  {data.urgentnost}
                </Badge>
                <span className="text-sm text-gray-500">
                  vystaveno {formatDate(data.datumVytvoreni)}
                </span>
              </div>

              {/* Upozornění, když chybí klinický obsah */}
              {!klinickyObsahDostupny && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Klinický obsah není dostupný</p>
                    <p className="text-xs mt-0.5">
                      Detail vyšetření, diagnóza a biometrické údaje nepřišly
                      ze MZČR API. Pacient by se měl vrátit k žadateli s
                      papírovou žádankou.
                    </p>
                  </div>
                </div>
              )}

              <Section title="Vyšetření" hideIfEmpty>
                <Row label="Název" value={data.vysetreni.nazev} />
                <Row
                  label="Modalita"
                  value={
                    data.vysetreni.modalita +
                    (data.vysetreni.modalitaKod
                      ? ` (${data.vysetreni.modalitaKod})`
                      : "")
                  }
                />
                <Row label="Část těla" value={data.vysetreni.castTela} />
                <Row label="Lateralita" value={data.vysetreni.lateralita} />
                <Row label="Poznámka" value={data.vysetreni.poznamka} />
                {data.vysetreni.informaceProPacienta && (
                  <Row
                    label="Instrukce pro pacienta"
                    value={data.vysetreni.informaceProPacienta}
                    highlight
                  />
                )}
                {data.instrukceProPacienta && (
                  <Row
                    label="Další instrukce"
                    value={data.instrukceProPacienta}
                    highlight
                  />
                )}
              </Section>

              <Section title="Diagnóza a klinická otázka" hideIfEmpty>
                <Row
                  label="Diagnóza"
                  value={composeIcd(data.diagnoza.kod, data.diagnoza.nazev)}
                />
                <Row
                  label="Klinická otázka"
                  value={data.diagnoza.klinickaOtazka}
                />
              </Section>

              <Section title="Pacient">
                <Row
                  label="Jméno"
                  value={
                    `${data.pacient.jmeno} ${data.pacient.prijmeni}`.trim() ||
                    null
                  }
                />
                <Row
                  label="Datum narození"
                  value={data.pacient.datumNarozeni}
                />
                <Row
                  label="Rodné číslo"
                  value={formatRc(data.pacient.rid)}
                />
                <Row
                  label="Pojišťovna"
                  value={composePojistovna(
                    data.pacient.pojistovnaKod,
                    data.pacient.pojistovnaNazev
                  )}
                />
              </Section>

              <Section title="Stav pacienta" hideIfEmpty>
                <Row
                  label="Mobilita"
                  value={data.pacientStav.omezeniMobility}
                />
                <Row label="Výška" value={data.pacientStav.vyska} />
                <Row label="Váha" value={data.pacientStav.vaha} />
                <Row
                  label="Implantát"
                  value={data.pacientStav.implantat ? "ano" : "ne"}
                />
                <Row
                  label="Úhrada"
                  value={
                    data.uhrada ??
                    (data.pacientStav.samoplatce
                      ? "samoplátce"
                      : "zdravotní pojištění")
                  }
                />
              </Section>

              <Section title="Žadatel">
                <Row label="Lékař" value={data.zadatel.jmeno} />
                <Row
                  label="IČO poskytovatele"
                  value={data.zadatel.poskytovatelIco}
                />
                <Row label="ICP" value={data.zadatel.icpZadatele} />
              </Section>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <Button variant="outline" onClick={onClose}>
                  Zavřít
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-komponenty ───────────────────────────────────────────────────────

/**
 * Sekce s teal hlavičkou.
 * Když `hideIfEmpty` a všechny Row uvnitř jsou null, sekce se nezobrazí.
 */
function Section({
  title,
  children,
  hideIfEmpty,
}: {
  title: string;
  children: React.ReactNode;
  hideIfEmpty?: boolean;
}) {
  // Detekce prázdné sekce — projdeme děti a hledáme alespoň jeden Row
  // s neprázdnou hodnotou. Pokud žádný, sekce se nevykreslí.
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
  highlight,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 mb-0.5">{label}</span>
      <span
        className={
          highlight
            ? "text-amber-700 font-medium"
            : "text-gray-900"
        }
      >
        {value}
      </span>
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

function composeIcd(kod: string | null, nazev: string | null): string | null {
  if (kod && nazev) return `${kod} — ${nazev}`;
  return nazev ?? kod ?? null;
}

function composePojistovna(
  kod: string | null,
  nazev: string | null
): string | null {
  if (kod && nazev) return `${kod} — ${nazev}`;
  return nazev ?? kod ?? null;
}

