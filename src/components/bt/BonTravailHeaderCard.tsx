import type { CSSProperties } from "react";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  km_actuel: number | null;
  statut: string;
  niv?: string | null;
  plaque?: string | null;
};

type BonTravail = {
  id: string;
  numero?: string | null;
  bon_commande?: string | null;
  statut: string;
  verrouille?: boolean | null;
};

function isOpenStatut(statut: string | null | undefined) {
  return statut === "ouvert" || statut === "a_faire" || statut === "en_cours";
}

function isClosedStatut(statut: string | null | undefined) {
  return statut === "ferme" || statut === "termine" || statut === "a_facturer";
}

function isFacturedStatut(statut: string | null | undefined) {
  return statut === "facture";
}

function statutLabel(statut: string) {
  if (isOpenStatut(statut)) return "Ouvert";
  if (statut === "a_facturer") return "À facturer";
  if (isClosedStatut(statut)) return "Fermé";
  if (isFacturedStatut(statut)) return "Facturé";
  if (statut === "verrouille") return "Verrouillé";
  return statut;
}

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid rgba(0,0,0,.12)",
      }}
    >
      {statutLabel(statut)}
    </span>
  );
}

type Props = {
  bt: BonTravail;
  unite: Unite;
  snapshotClientNom: string;
  dateOuvertureInput: string;
  setDateOuvertureInput: (v: string) => void;
  dateFermetureInput: string;
  setDateFermetureInput: (v: string) => void;
  kmInput: string;
  setKmInput: (v: string) => void;
  poInput: string;
  setPoInput: (v: string) => void;
  isReadOnly: boolean;
  hasKmColumn: boolean;
  clientNoteFacturation?: string | null;
};

export default function BonTravailHeaderCard({
  bt,
  unite,
  snapshotClientNom,
  dateOuvertureInput,
  setDateOuvertureInput,
  dateFermetureInput,
  setDateFermetureInput,
  kmInput,
  setKmInput,
  poInput,
  setPoInput,
  isReadOnly,
  hasKmColumn,
  clientNoteFacturation,
}: Props) {
  const styles: Record<string, CSSProperties> = {
    cardMuted: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    pill: {
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      border: "1px solid rgba(0,0,0,.12)",
    },
    warn: {
      background: "rgba(245,158,11,.10)",
      border: "1px solid rgba(245,158,11,.25)",
      borderRadius: 12,
      padding: 10,
      color: "rgba(0,0,0,.78)",
      fontWeight: 700,
      fontSize: 13,
      marginTop: 10,
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
    topMetaGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
      gap: 12,
      marginTop: 14,
    },
    topMetaItem: {
      border: "1px solid rgba(0,0,0,.06)",
      borderRadius: 12,
      background: "#f8fafc",
      padding: "12px 14px",
      minWidth: 0,
    },
    topMetaLabel: {
      fontSize: 11,
      lineHeight: 1.1,
      textTransform: "uppercase",
      letterSpacing: ".04em",
      color: "rgba(0,0,0,.55)",
      fontWeight: 800,
      marginBottom: 8,
    },
    topMetaValue: {
      fontSize: 15,
      fontWeight: 900,
      color: "#111827",
      lineHeight: 1.2,
      wordBreak: "break-word",
    },
    topMetaSub: {
      marginTop: 4,
      fontSize: 12,
      color: "rgba(0,0,0,.58)",
      lineHeight: 1.25,
    },
    topFormGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
      gap: 12,
      marginTop: 14,
    },
    topField: {
      minWidth: 0,
    },
    topFieldLabel: {
      fontSize: 11,
      lineHeight: 1.1,
      textTransform: "uppercase",
      letterSpacing: ".04em",
      color: "rgba(0,0,0,.55)",
      fontWeight: 800,
      marginBottom: 8,
    },
  };

  return (
    <div style={styles.cardMuted}>
      <div style={{ ...styles.row, justifyContent: "space-between" }}>
        <div style={styles.row}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>
            {bt.numero || (bt as any).no_bt || "(BT)"}
          </div>
          <StatutBadge statut={bt.statut} />
          {Boolean(bt.verrouille) && <span style={styles.pill}>Verrouillé</span>}
        </div>
      </div>

      <div style={styles.topMetaGrid}>
        <div style={styles.topMetaItem}>
          <div style={styles.topMetaLabel}>Unité</div>
          <div style={styles.topMetaValue}>{unite.no_unite || "—"}</div>
          <div style={styles.topMetaSub}>
            {[unite.marque, unite.modele, unite.annee].filter(Boolean).join(" ") || "—"}
          </div>
        </div>

        <div style={styles.topMetaItem}>
          <div style={styles.topMetaLabel}>VIN / NIV</div>
          <div style={styles.topMetaValue}>{unite.niv || "—"}</div>
        </div>

        <div style={styles.topMetaItem}>
          <div style={styles.topMetaLabel}>Plaque</div>
          <div style={styles.topMetaValue}>{unite.plaque || "—"}</div>
        </div>

        <div style={styles.topMetaItem}>
          <div style={styles.topMetaLabel}>Client</div>
          <div style={styles.topMetaValue}>{snapshotClientNom}</div>
        </div>
      </div>

      <div style={styles.topFormGrid}>
        <div style={styles.topField}>
          <div style={styles.topFieldLabel}>Date d’ouverture</div>
          <input
            type="datetime-local"
            style={{ ...styles.input, width: "100%", minWidth: 0 }}
            value={dateOuvertureInput}
            onChange={(e) => setDateOuvertureInput(e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div style={styles.topField}>
          <div style={styles.topFieldLabel}>Date de fermeture</div>
          <input
            type="datetime-local"
            style={{ ...styles.input, width: "100%", minWidth: 0 }}
            value={dateFermetureInput}
            onChange={(e) => setDateFermetureInput(e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div style={styles.topField}>
          <div style={styles.topFieldLabel}>KM actuel BT</div>
          <input
            style={{ ...styles.input, width: "100%", minWidth: 0 }}
            inputMode="numeric"
            placeholder="Ex: 123456"
            value={kmInput}
            onChange={(e) => setKmInput(e.target.value)}
            disabled={isReadOnly || !hasKmColumn}
          />
        </div>

        <div style={styles.topField}>
          <div style={styles.topFieldLabel}>Bon de commande / PO</div>
          <input
            style={{ ...styles.input, width: "100%", minWidth: 0 }}
            placeholder="Ex: PO-12345"
            value={poInput}
            onChange={(e) => setPoInput(e.target.value)}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {clientNoteFacturation ? (
        <div style={styles.warn}>
          Note facturation client : <b>{clientNoteFacturation}</b>
        </div>
      ) : null}

      {!hasKmColumn && (
        <div style={styles.warn}>
          ⚠️ La colonne <b>bons_travail.km</b> n’existe pas encore. Ajoute-la avec :
          <div
            style={{
              marginTop: 6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            alter table public.bons_travail add column if not exists km integer null;
          </div>
        </div>
      )}
    </div>
  );
}