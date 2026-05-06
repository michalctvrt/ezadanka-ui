"use client";

/**
 * Modal s plným detailem konkrétní eŽádanky.
 *
 * Sám si fetchne data z `/CardFileWebWS/rest/ezadanka/{id}`,
 * dekóduje klinický obsah z Base64, zploští přes parser a zobrazí.
 */

import { useEffect, useState } from "react";
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            {data ? (
              <>
                eŽádanka <code className="text-sm">{data.kod}</code>
              </>
            ) : (
              "eŽádanka"
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="py-6 text-sm text-gray-500">Načítám detail…</p>}

        {error && (
          <div className="my-4 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <div className="space-y-6 mt-2">
            {/* Hlavička */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge>{data.stav}</Badge>
              <Badge variant={urgentnostVariant(data.urgentnost)}>
                {data.urgentnost}
              </Badge>
              <span className="text-sm text-gray-500">
                vystaveno {formatDate(data.datumVytvoreni)}
              </span>
            </div>

            <Section title="Vyšetření">
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

            <Section title="Diagnóza a klinická otázka">
              <Row
                label="Diagnóza"
                value={composeIcd(data.diagnoza.kod, data.diagnoza.nazev)}
              />
              <Row label="Klinická otázka" value={data.diagnoza.klinickaOtazka} />
            </Section>

            <Section title="Pacient">
              <Row
                label="Jméno"
                value={`${data.pacient.jmeno} ${data.pacient.prijmeni}`.trim() || null}
              />
              <Row
                label="Datum narození"
                value={data.pacient.datumNarozeni}
              />
              <Row label="Rodné číslo" value={formatRc(data.pacient.rid)} />
              <Row
                label="Pojišťovna"
                value={composePojistovna(
                  data.pacient.pojistovnaKod,
                  data.pacient.pojistovnaNazev
                )}
              />
            </Section>

            <Section title="Stav pacienta">
              <Row label="Mobilita" value={data.pacientStav.omezeniMobility} />
              <Row label="Výška" value={data.pacientStav.vyska} />
              <Row label="Váha" value={data.pacientStav.vaha} />
              <Row
                label="Implantát"
                value={data.pacientStav.implantat ? "ano" : "ne"}
              />
              <Row
                label="Samoplátce"
                value={data.pacientStav.samoplatce ? "ano" : "ne"}
              />
              <Row label="Úhrada" value={data.uhrada} />
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
      </DialogContent>
    </Dialog>
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
    <section>
      <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
        {title}
      </h3>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
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
      <span className="text-xs text-gray-500">{label}</span>
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
      : "bg-blue-100 text-blue-800";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}
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
