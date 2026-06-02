import type { CSSProperties } from "react";
import { useBtFusion, type BtFusionBt, type BtFusionClient, type BtFusionUnite } from "../../hooks/useBtFusion";

type Props = {
  open: boolean;
  onClose: () => void;
  bts: BtFusionBt[];
  unitesById: Record<string, BtFusionUnite>;
  clientsById: Record<string, BtFusionClient>;
  resolveClientName: (bt: BtFusionBt) => string;
  onDone?: () => Promise<void> | void;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusLabel(value: string | null | undefined) {
  if (value === "ouvert" || value === "a_faire" || value === "en_cours") return "Ouvert";
  if (value === "ferme" || value === "termine") return "Fermé";
  if (value === "a_facturer") return "À facturer";
  if (value === "facture") return "Facturé";
  if (value === "fusionne") return "Fusionné";
  return value || "—";
}

export default function BtFusionModal({
  open,
  onClose,
  bts,
  unitesById,
  clientsById,
  resolveClientName,
  onDone,
}: Props) {
  const fusion = useBtFusion({
    bts,
    unitesById,
    clientsById,
    resolveClientName,
    onDone,
  });

  if (!open) return null;

  const group = fusion.selectedGroup;

  async function handleMerge() {
    if (!group || fusion.busy) return;

    const sourceList = group.sources
      .map((bt) => bt.numero || "BT")
      .join(", ");

    const ok = window.confirm(
      `Fusionner ${group.sources.length} BT dans ${group.destination.numero || "le BT destination"} ?\n\n` +
        `Destination : ${group.destination.numero || "—"}\n` +
        `Sources : ${sourceList}\n\n` +
        `Les pièces, temps, pointages, tâches, documents, confirmations client et photos seront transférés.\n` +
        `Les anciens BT deviendront Fusionné.`,
    );

    if (!ok) return;

    try {
      await fusion.mergeGroup(group);
      onClose();
    } catch {
      // L'erreur est affichée dans le modal.
    }
  }

  return (
    <div style={styles.backdrop} onMouseDown={() => !fusion.busy && onClose()}>
      <div style={styles.card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Fusionner des bons de travail</h2>
            <div style={styles.subtitle}>
              Seuls les groupes avec même unité, même client, non facturés et non verrouillés sont affichés.
            </div>
          </div>

          <button type="button" style={styles.closeBtn} onClick={onClose} disabled={fusion.busy}>
            ×
          </button>
        </div>

        <div style={styles.body}>
          {fusion.groups.length === 0 ? (
            <div style={styles.emptyBox}>
              Aucun groupe de BT admissible à fusionner.
            </div>
          ) : (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Groupe admissible</label>
                <select
                  value={group?.key || ""}
                  onChange={(e) => fusion.setSelectedGroupKey(e.target.value)}
                  style={styles.select}
                  disabled={fusion.busy}
                >
                  {fusion.groups.map((g) => (
                    <option key={g.key} value={g.key}>
                      Unité {g.uniteLabel} • {g.clientLabel} • {g.bts.length} BT
                    </option>
                  ))}
                </select>
              </div>

              {group && (
                <div style={styles.previewBox}>
                  <div style={styles.previewHeader}>
                    <div>
                      <div style={styles.groupTitle}>Unité {group.uniteLabel}</div>
                      <div style={styles.groupSub}>Client : {group.clientLabel}</div>
                    </div>
                    <div style={styles.badge}>{group.bts.length} BT</div>
                  </div>

                  <div style={styles.ruleBox}>
                    <div>
                      <b>Destination automatique :</b> {group.destination.numero || "—"}
                    </div>
                    <div>
                      <b>Date d’ouverture après fusion :</b> {fmtDate(group.oldestDateOuverture)}
                    </div>
                    <div style={styles.ruleMuted}>
                      Le BT le plus récent conserve son numéro, mais reprend la date d’ouverture du plus ancien BT.
                    </div>
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Rôle</th>
                          <th style={styles.th}>BT</th>
                          <th style={styles.th}>Ouverture</th>
                          <th style={styles.th}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.bts.map((bt) => {
                          const isDestination = bt.id === group.destination.id;
                          return (
                            <tr key={bt.id} style={isDestination ? styles.destinationRow : undefined}>
                              <td style={styles.td}>{isDestination ? "Destination" : "Source"}</td>
                              <td style={styles.tdStrong}>{bt.numero || "—"}</td>
                              <td style={styles.td}>{fmtDateTime(bt.date_ouverture || bt.created_at)}</td>
                              <td style={styles.td}>{statusLabel(bt.statut)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={styles.noticeBox}>
                    <b>Fusion brute :</b> les pièces et le temps sont transférés tels quels, sans déduplication. Les tâches ouvertes déjà effectuées dans le BT destination sont retirées pour éviter les doublons.
                  </div>
                </div>
              )}
            </>
          )}

          {fusion.error ? <div style={styles.errorBox}>{fusion.error}</div> : null}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.btnSecondary} onClick={onClose} disabled={fusion.busy}>
            Annuler
          </button>
          <button
            type="button"
            style={!group || fusion.busy ? styles.btnPrimaryDisabled : styles.btnPrimary}
            onClick={handleMerge}
            disabled={!group || fusion.busy}
          >
            {fusion.busy ? "Fusion en cours..." : "Fusionner"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 4000,
  },
  card: {
    width: "min(900px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "#fff",
    borderRadius: 22,
    border: "1px solid #e2e8f0",
    boxShadow: "0 25px 80px rgba(15,23,42,.24)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: 22,
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #d6dbe7",
    background: "#fff",
    color: "#475569",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
  },
  body: {
    padding: 22,
    display: "grid",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: 900,
    color: "#334155",
  },
  select: {
    height: 44,
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    padding: "0 12px",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },
  emptyBox: {
    padding: 22,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 800,
    textAlign: "center",
  },
  previewBox: {
    display: "grid",
    gap: 14,
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#fff",
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 950,
    color: "#0f172a",
  },
  groupSub: {
    marginTop: 3,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 13,
  },
  ruleBox: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontSize: 14,
  },
  ruleMuted: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 680,
  },
  th: {
    padding: "12px 14px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 950,
    textAlign: "left",
  },
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    fontSize: 14,
  },
  tdStrong: {
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },
  destinationRow: {
    background: "#f0fdf4",
  },
  noticeBox: {
    padding: 13,
    borderRadius: 14,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 700,
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    padding: 12,
    borderRadius: 14,
    fontWeight: 800,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 22,
    borderTop: "1px solid #e2e8f0",
    background: "#fff",
  },
  btnSecondary: {
    height: 42,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  btnPrimary: {
    height: 42,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
  },
  btnPrimaryDisabled: {
    height: 42,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#dbeafe",
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: 950,
    cursor: "not-allowed",
  },
};
