import { useState, type CSSProperties } from "react";
import BtPiecesCard, { type Piece } from "./BtPiecesCard";
import BtTachePhotos from "./BtTachePhotos";
import BtAutorisationClient from "./BtAutorisationClient";


type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
};

type AutorisationDecision = "autorise" | "refuse" | "attente" | "a_discuter";

type AutorisationInfo = {
  decision: AutorisationDecision;
  note_client: string | null;
  autorisation_tache_id: string;
};

type TacheEffectuee = {
  id: string;
  bt_id: string;
  unite_id: string;
  unite_note_id: string | null;
  titre: string;
  details: string | null;
  date_effectuee: string;
};

type MainOeuvreRow = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  description: string | null;
  heures: number;
  taux_horaire: number;
  created_at?: string | null;
};

type BtPointage = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  actif: boolean;
  note: string | null;
  created_at?: string | null;
};

type PointageResume = {
  mecano_nom: string;
  minutes: number;
  heures: number;
};

function money(v: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(v || 0);
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA");
}

function fmtDateTimeNoSeconds(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtHours(hours: number) {
  return `${hours.toFixed(2)} h`;
}

function toNum(value: string) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function localToIsoOrNull(v: string) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type Props = {
  btId: string;
  notes: NoteMeca[];
  autorisationMap: Record<string, AutorisationInfo>;
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedIds: string[];
  tachesEffectuees: TacheEffectuee[];
  isReadOnly: boolean;
  onOpenTaskModal: () => void;
  onCompleteSelectedTasks: () => void;
  onDeleteSelectedTasks: () => void;
  onAutoriserManuellementTache: (t: NoteMeca) => void;
  onCompleteSingleTaskFromAutorisation: (t: NoteMeca) => void;
  onRefresh?: () => void | Promise<void>;
  onRemettreTacheOuverte: (t: TacheEffectuee) => void;

  pieces: Piece[];
  setPieces: React.Dispatch<React.SetStateAction<Piece[]>>;
  piecesTableAvailable: boolean;
  isBtOpenPricing: boolean;
  effectiveMargePiecesPct: number;
  onReloadPiecesAndRecalc: (btId: string) => Promise<void>;

  pointagesTableAvailable: boolean;
  pointagesResume: PointageResume[];
  pointages: BtPointage[];
  effectiveTauxHoraire: number;
  pointageMenuOpenId: string | null;
  setPointageMenuOpenId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPointageId: string | null;
  setEditingPointageId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPointageStart: string;
  setEditingPointageStart: React.Dispatch<React.SetStateAction<string>>;
  editingPointageEnd: string;
  setEditingPointageEnd: React.Dispatch<React.SetStateAction<string>>;
  onOpenEditPointage: (p: BtPointage) => void;
  onSavePointageRow: (pointageId: string) => void;
  onDeletePointage: (pointageId: string) => void;

  mainOeuvreTableAvailable: boolean;
  mainOeuvre: MainOeuvreRow[];
  mainOeuvreMenuOpenId: string | null;
  setMainOeuvreMenuOpenId: React.Dispatch<React.SetStateAction<string | null>>;
  editingMainOeuvreId: string | null;
  onOpenEditMainOeuvre: (rowId: string) => void;
  onSaveMainOeuvreRow: (row: MainOeuvreRow) => void;
  onDeleteMainOeuvreRow: (rowId: string) => void;
  updateMainOeuvreLocal: (rowId: string, patch: Partial<MainOeuvreRow>) => void;
  onOpenTempsModal: () => void;

  totalPiecesCout: number;
  totalPiecesFacture: number;
  totalPointagesMainOeuvre: number;
  totalMainOeuvreManuelle: number;
  totalMainOeuvre: number;
  totalFraisAtelier: number;
  totalGeneral: number;
  totalTPS: number;
  totalTVQ: number;
  totalFinal: number;
  effectiveFraisAtelierPct: number;
  effectiveTpsRate: number;
  effectiveTvqRate: number;
};

export default function BonTravailOperations(props: Props) {
  const [showPointageDetails, setShowPointageDetails] = useState(false);

  const styles: Record<string, CSSProperties> = {
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    muted: { color: "rgba(0,0,0,.6)" },
    btn: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnLink: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
      fontSize: 13,
    },
    btnMini: {
      padding: "6px 9px",
      borderRadius: 9,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontWeight: 850,
      cursor: "pointer",
      fontSize: 12,
    },
    btnMiniPrimary: {
      padding: "6px 9px",
      borderRadius: 9,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 850,
      cursor: "pointer",
      fontSize: 12,
    },
    authStatusText: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: 850,
    },
    clientNoteBox: {
      marginTop: 6,
      padding: "7px 9px",
      borderRadius: 10,
      background: "rgba(255,255,255,.75)",
      border: "1px solid rgba(0,0,0,.08)",
      color: "#334155",
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: "pre-wrap",
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top",
    },
    photoTh: {
      textAlign: "center",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      width: 80,
    },
    photoTd: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "middle",
      textAlign: "center",
      width: 80,
    },
       
    tableWrap: {
      width: "100%",
      overflowX: "auto",
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
    menuWrap: {
      position: "relative",
      display: "inline-block",
    },
    menu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 140,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 10,
      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
      zIndex: 200,
      overflow: "hidden",
    },
    menuItem: {
      width: "100%",
      padding: "10px 12px",
      textAlign: "left",
      background: "#fff",
      border: "none",
      borderBottom: "1px solid rgba(0,0,0,.06)",
      cursor: "pointer",
      fontWeight: 700,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    sectionHeaderRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 6,
      marginTop: 14,
    },
    totalCard: {
      border: "1px solid rgba(0,0,0,.06)",
      borderRadius: 12,
      background: "#f8fafc",
      overflow: "hidden",
    },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 14px",
      borderTop: "1px solid rgba(0,0,0,.06)",
      gap: 12,
      minHeight: 52,
    },
    totalRowFirst: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 14px",
      gap: 12,
      minHeight: 52,
    },
    totalLeft: {
      display: "flex",
      alignItems: "center",
      minWidth: 0,
      flex: 1,
    },
    totalLabel: {
      fontSize: 17,
      fontWeight: 950,
      color: "#111827",
      lineHeight: 1.1,
    },
    totalValue: {
      fontSize: 16,
      fontWeight: 900,
      color: "#111827",
      whiteSpace: "nowrap",
      lineHeight: 1,
    },
    grandTotalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      background: "#e5e7eb",
      borderTop: "1px solid rgba(0,0,0,.08)",
      gap: 12,
      minHeight: 58,
    },
    grandTotalLabel: {
      fontSize: 18,
      fontWeight: 950,
      color: "#111827",
    },
    grandTotalValue: {
      fontSize: 24,
      fontWeight: 950,
      color: "#111827",
      whiteSpace: "nowrap",
      lineHeight: 1,
    },
    detailSubTitle: {
      fontSize: 13,
      fontWeight: 900,
      margin: "14px 0 6px",
      color: "#111827",
    },
  };

  const {
    btId,
    notes,
    autorisationMap,
    selected,
    setSelected,
    selectedIds,
    tachesEffectuees,
    isReadOnly,
    onOpenTaskModal,
    onCompleteSelectedTasks,
    onDeleteSelectedTasks,
    onAutoriserManuellementTache,
    onRefresh,
    onRemettreTacheOuverte,
    pieces,
    setPieces,
    piecesTableAvailable,
    isBtOpenPricing,
    effectiveMargePiecesPct,
    onReloadPiecesAndRecalc,
    pointagesTableAvailable,
    pointagesResume,
    pointages,
    effectiveTauxHoraire,
    pointageMenuOpenId,
    setPointageMenuOpenId,
    editingPointageId,
    editingPointageStart,
    setEditingPointageStart,
    editingPointageEnd,
    setEditingPointageEnd,
    onOpenEditPointage,
    onSavePointageRow,
    onDeletePointage,
    mainOeuvreTableAvailable,
    mainOeuvre,
    mainOeuvreMenuOpenId,
    setMainOeuvreMenuOpenId,
    editingMainOeuvreId,
    onOpenEditMainOeuvre,
    onSaveMainOeuvreRow,
    onDeleteMainOeuvreRow,
    updateMainOeuvreLocal,
    onOpenTempsModal,
    totalPiecesFacture,
    totalMainOeuvre,
    totalFraisAtelier,
    totalGeneral,
  } = props;

  return (
    <>
      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Tâches à compléter</div>

          <div style={styles.row}>
            <button
  style={styles.btn}
  onClick={onCompleteSelectedTasks}
  disabled={!selectedIds.length || isReadOnly}
>
  Effectuer
</button>

<button
  style={styles.btn}
  onClick={onDeleteSelectedTasks}
  disabled={!selectedIds.length || isReadOnly}
>
  Supprimer
</button>

{/* 🔥 NOUVEAU */}
<BtAutorisationClient
  btId={btId}
  notes={notes}
  isReadOnly={isReadOnly}
  onSent={() => void onRefresh?.()}
/>
          </div>
        </div>

        <div style={{ ...styles.row, marginTop: 10 }}>
          <button style={styles.btnPrimary} onClick={onOpenTaskModal} disabled={isReadOnly}>
            Ajouter une tâche
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={notes.length > 0 && notes.every((t) => selected[t.id])}
                    onChange={(e) => {
                      const on = e.target.checked;
                      const next: Record<string, boolean> = { ...selected };
                      notes.forEach((t) => (next[t.id] = on));
                      setSelected(next);
                    }}
                    disabled={isReadOnly && notes.length > 0}
                  />
                </th>
                <th style={styles.th}>Titre</th>
                <th style={{ ...styles.th, width: 180 }}>Créé</th>
                <th style={styles.photoTh}>Photos</th>
              </tr>
            </thead>

            <tbody>
              {notes.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={4}>
                    <span style={styles.muted}>Aucune tâche ouverte.</span>
                  </td>
                </tr>
              ) : (
                notes.map((t) => {
                  const autorisation = autorisationMap[t.id];
                  const decision = autorisation?.decision;
                  const noteClient = String(autorisation?.note_client || "").trim();
                  const isPendingClient = decision === "attente";
                  const isRefusedClient = decision === "refuse";
                  const isADiscuterClient = decision === "a_discuter";
                  const isBlockedClient = isPendingClient || isRefusedClient || isADiscuterClient;

                  const rowStyle: CSSProperties = {
                    background: isRefusedClient
                      ? "#fef2f2"
                      : isPendingClient
                      ? "#fefce8"
                      : isADiscuterClient
                      ? "#eff6ff"
                      : "transparent",
                    opacity: isRefusedClient ? 0.62 : isPendingClient || isADiscuterClient ? 0.9 : 1,
                    transition: "background .15s ease, opacity .15s ease",
                  };

                  return (
                    <tr key={t.id} style={rowStyle}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[t.id])}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [t.id]: e.target.checked }))
                          }
                          disabled={isReadOnly || isBlockedClient}
                        />
                      </td>

                      <td style={styles.td}>
                        <div style={{ fontWeight: 500, textTransform: "uppercase" }}>
                          {String(t.titre || "")}
                        </div>

                        {isPendingClient && (
                          <div style={{ ...styles.authStatusText, color: "#a16207" }}>
                            En attente client
                          </div>
                        )}

                        {isADiscuterClient && (
                          <div style={{ ...styles.authStatusText, color: "#2563eb" }}>
                            À discuter
                          </div>
                        )}

                        {isRefusedClient && (
                          <div style={{ ...styles.authStatusText, color: "#dc2626" }}>
                            Refusé par le client
                          </div>
                        )}

                        {noteClient && (
                          <div style={styles.clientNoteBox}>
                            Note client : {noteClient}
                          </div>
                        )}

                        {isRefusedClient && !isReadOnly && (
                          <div style={{ ...styles.row, gap: 6, marginTop: 8 }}>
                            <button
                              type="button"
                              style={styles.btnMiniPrimary}
                              onClick={() => onAutoriserManuellementTache(t)}
                            >
                              Autoriser à faire
                            </button>
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>{fmtDateTimeNoSeconds(t.created_at)}</td>

                      <td style={styles.photoTd}>
                        <BtTachePhotos
                          btId={btId}
                          uniteId={t.unite_id}
                          uniteNoteId={t.id}
                          isReadOnly={isReadOnly}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, fontSize: 14, fontWeight: 950 }}>
          Tâches effectuées <span style={styles.muted}>({tachesEffectuees.length})</span>
        </div>

        <table style={{ ...styles.table, marginTop: 6 }}>
          <thead>
            <tr>
              <th style={styles.th}>Titre</th>
              <th style={{ ...styles.th, width: 180 }}>Date</th>
              <th style={styles.photoTh}>Photos</th>
              <th style={{ ...styles.th, width: 140 }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {tachesEffectuees.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={4}>
                  <span style={styles.muted}>Aucune tâche effectuée.</span>
                </td>
              </tr>
            ) : (
              tachesEffectuees.map((t) => (
                <tr key={t.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 500, textTransform: "uppercase" }}>
                      {String(t.titre || "")}
                    </div>
                  </td>

                  <td style={styles.td}>{fmtDateTimeNoSeconds(t.date_effectuee)}</td>

                  <td style={styles.photoTd}>
                    <BtTachePhotos
                      btId={btId}
                      uniteId={t.unite_id}
                      tacheEffectueeId={t.id}
                      isReadOnly={isReadOnly}
                    />
                  </td>

                  <td style={styles.td}>
                    <button
                      style={styles.btn}
                      disabled={isReadOnly}
                      onClick={() => onRemettreTacheOuverte(t)}
                    >
                      Remettre
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BtPiecesCard
        btId={btId}
        pieces={pieces}
        setPieces={setPieces}
        isReadOnly={isReadOnly}
        piecesTableAvailable={piecesTableAvailable}
        isBtOpenPricing={isBtOpenPricing}
        effectiveMargePiecesPct={effectiveMargePiecesPct}
        onReload={onReloadPiecesAndRecalc}
      />

      <div style={styles.card}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Temps pointé</div>

        <div style={{ ...styles.row, marginBottom: 10 }}>
          <button
            style={styles.btnPrimary}
            onClick={onOpenTempsModal}
            disabled={isReadOnly || !mainOeuvreTableAvailable}
          >
            Ajouter du temps
          </button>
        </div>

        {!pointagesTableAvailable && (
          <div style={styles.warn}>
            ⚠️ La table <b>bt_pointages</b> n’existe pas encore. Ajoute-la pour activer cette
            section.
          </div>
        )}

        {pointagesTableAvailable && (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Mécano</th>
                    <th style={{ ...styles.th, width: 120 }}>Heures</th>
                    <th style={{ ...styles.th, width: 140 }}>Taux horaire</th>
                    <th style={{ ...styles.th, width: 140 }}>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {pointagesResume.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        <span style={styles.muted}>Aucun temps pointé pour ce BT.</span>
                      </td>
                    </tr>
                  ) : (
                    pointagesResume.map((r) => (
                      <tr key={r.mecano_nom}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{r.mecano_nom}</div>
                        </td>
                        <td style={styles.td}>{fmtHours(r.heures)}</td>
                        <td style={styles.td}>{money(effectiveTauxHoraire)}</td>
                        <td style={styles.td}>{money(r.heures * effectiveTauxHoraire)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {(pointages.length > 0 || mainOeuvre.length > 0) && (
              <div style={{ marginTop: 14 }}>
                <div style={styles.sectionHeaderRow}>
                  <div style={{ fontSize: 14, fontWeight: 950 }}>Détail des pointages</div>
                  <button
                    type="button"
                    style={styles.btnLink}
                    onClick={() => setShowPointageDetails((v) => !v)}
                  >
                    {showPointageDetails ? "Masquer détails" : "Voir détails"}
                  </button>
                </div>

                {showPointageDetails && (
                  <>
                    {pointages.length > 0 && (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Mécano</th>
                              <th style={{ ...styles.th, minWidth: 210 }}>Début</th>
                              <th style={{ ...styles.th, minWidth: 210 }}>Fin</th>
                              <th style={{ ...styles.th, width: 110 }}>Durée</th>
                              <th style={{ ...styles.th, minWidth: 180 }}>Note</th>
                              <th style={{ ...styles.th, width: 90 }}>Action</th>
                            </tr>
                          </thead>

                          <tbody>
                            {pointages.map((p) => (
                              <tr key={p.id}>
                                <td style={styles.td}>{p.mecano_nom}</td>

                                <td style={styles.td}>
                                  {editingPointageId === p.id ? (
                                    <input
                                      type="datetime-local"
                                      style={{ ...styles.input, minWidth: 190, width: "100%" }}
                                      value={editingPointageStart}
                                      onChange={(e) => setEditingPointageStart(e.target.value)}
                                      disabled={isReadOnly}
                                    />
                                  ) : (
                                    fmtDateTime(p.started_at)
                                  )}
                                </td>

                                <td style={styles.td}>
                                  {editingPointageId === p.id ? (
                                    <input
                                      type="datetime-local"
                                      style={{ ...styles.input, minWidth: 190, width: "100%" }}
                                      value={editingPointageEnd}
                                      onChange={(e) => setEditingPointageEnd(e.target.value)}
                                      disabled={isReadOnly}
                                    />
                                  ) : (
                                    fmtDateTime(p.ended_at)
                                  )}
                                </td>

                                <td style={styles.td}>
                                  {editingPointageId === p.id
                                    ? fmtHours(
                                        Math.max(
                                          0,
                                          (new Date(localToIsoOrNull(editingPointageEnd) || 0).getTime() -
                                            new Date(localToIsoOrNull(editingPointageStart) || 0).getTime()) /
                                            3600000
                                        )
                                      )
                                    : fmtHours(
                                        p.duration_minutes != null
                                          ? Number(p.duration_minutes || 0) / 60
                                          : Math.max(
                                              0,
                                              (new Date(p.ended_at || new Date().toISOString()).getTime() -
                                                new Date(p.started_at).getTime()) /
                                                3600000
                                            )
                                      )}
                                </td>

                                <td style={styles.td}>{p.note || "—"}</td>

                                <td style={styles.td}>
                                  <div style={styles.menuWrap} data-menu-root="pointage">
                                    <button
                                      type="button"
                                      style={styles.iconBtn}
                                      onClick={() =>
                                        setPointageMenuOpenId((cur) => (cur === p.id ? null : p.id))
                                      }
                                      disabled={isReadOnly}
                                    >
                                      ...
                                    </button>

                                    {pointageMenuOpenId === p.id && (
                                      <div style={styles.menu}>
                                        {editingPointageId === p.id ? (
                                          <>
                                            <button
                                              type="button"
                                              style={styles.menuItem}
                                              onClick={() => onSavePointageRow(p.id)}
                                            >
                                              Enregistrer
                                            </button>
                                            <button
                                              type="button"
                                              style={{ ...styles.menuItem, borderBottom: "none" }}
                                              onClick={() => onDeletePointage(p.id)}
                                            >
                                              Supprimer
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              style={styles.menuItem}
                                              onClick={() => onOpenEditPointage(p)}
                                            >
                                              Modifier
                                            </button>
                                            <button
                                              type="button"
                                              style={{ ...styles.menuItem, borderBottom: "none" }}
                                              onClick={() => onDeletePointage(p.id)}
                                            >
                                              Supprimer
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {mainOeuvre.length > 0 && (
                      <>
                        <div style={styles.detailSubTitle}>Temps manuel</div>

                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Mécano</th>
                                <th style={{ ...styles.th, minWidth: 220 }}>Description</th>
                                <th style={{ ...styles.th, width: 110 }}>Heures</th>
                                <th style={{ ...styles.th, width: 140 }}>Taux horaire</th>
                                <th style={{ ...styles.th, width: 130 }}>Total</th>
                                <th style={{ ...styles.th, width: 90 }}>Action</th>
                              </tr>
                            </thead>

                            <tbody>
                              {mainOeuvre.map((row) => {
                                const total =
                                  Number(row.heures || 0) *
                                  (isBtOpenPricing
                                    ? effectiveTauxHoraire
                                    : Number(row.taux_horaire || 0));

                                const isEditing = editingMainOeuvreId === row.id;

                                return (
                                  <tr key={row.id}>
                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          style={{ ...styles.input, minWidth: 160, width: "100%" }}
                                          value={row.mecano_nom ?? ""}
                                          onChange={(e) =>
                                            updateMainOeuvreLocal(row.id, {
                                              mecano_nom: e.target.value,
                                            })
                                          }
                                          disabled={isReadOnly || !mainOeuvreTableAvailable}
                                        />
                                      ) : (
                                        row.mecano_nom || "—"
                                      )}
                                    </td>

                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          style={{ ...styles.input, minWidth: 220, width: "100%" }}
                                          value={row.description ?? ""}
                                          onChange={(e) =>
                                            updateMainOeuvreLocal(row.id, {
                                              description: e.target.value,
                                            })
                                          }
                                          disabled={isReadOnly || !mainOeuvreTableAvailable}
                                        />
                                      ) : (
                                        row.description || "—"
                                      )}
                                    </td>

                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          style={{ ...styles.input, minWidth: 90, width: "100%" }}
                                          inputMode="decimal"
                                          value={String(row.heures ?? 0)}
                                          onChange={(e) =>
                                            updateMainOeuvreLocal(row.id, {
                                              heures: toNum(e.target.value),
                                            })
                                          }
                                          disabled={isReadOnly || !mainOeuvreTableAvailable}
                                        />
                                      ) : (
                                        fmtHours(Number(row.heures || 0))
                                      )}
                                    </td>

                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          style={{ ...styles.input, minWidth: 110, width: "100%" }}
                                          inputMode="decimal"
                                          value={String(row.taux_horaire ?? 0)}
                                          onChange={(e) =>
                                            updateMainOeuvreLocal(row.id, {
                                              taux_horaire: toNum(e.target.value),
                                            })
                                          }
                                          disabled={isReadOnly || !mainOeuvreTableAvailable}
                                        />
                                      ) : (
                                        money(
                                          isBtOpenPricing
                                            ? effectiveTauxHoraire
                                            : Number(row.taux_horaire || 0)
                                        )
                                      )}
                                    </td>

                                    <td style={styles.td}>{money(total)}</td>

                                    <td style={styles.td}>
                                      <div style={styles.menuWrap} data-menu-root="mainoeuvre">
                                        <button
                                          type="button"
                                          style={styles.iconBtn}
                                          onClick={() =>
                                            setMainOeuvreMenuOpenId((cur) =>
                                              cur === row.id ? null : row.id
                                            )
                                          }
                                          disabled={isReadOnly || !mainOeuvreTableAvailable}
                                        >
                                          ...
                                        </button>

                                        {mainOeuvreMenuOpenId === row.id && (
                                          <div style={styles.menu}>
                                            {isEditing ? (
                                              <>
                                                <button
                                                  type="button"
                                                  style={styles.menuItem}
                                                  onClick={() => onSaveMainOeuvreRow(row)}
                                                >
                                                  Enregistrer
                                                </button>
                                                <button
                                                  type="button"
                                                  style={{ ...styles.menuItem, borderBottom: "none" }}
                                                  onClick={() => onDeleteMainOeuvreRow(row.id)}
                                                >
                                                  Supprimer
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  type="button"
                                                  style={styles.menuItem}
                                                  onClick={() => onOpenEditMainOeuvre(row.id)}
                                                >
                                                  Modifier
                                                </button>
                                                <button
                                                  type="button"
                                                  style={{ ...styles.menuItem, borderBottom: "none" }}
                                                  onClick={() => onDeleteMainOeuvreRow(row.id)}
                                                >
                                                  Supprimer
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8 }}>Total</div>

        <div style={styles.totalCard}>
          <div style={styles.totalRowFirst}>
            <div style={styles.totalLeft}>
              <div style={styles.totalLabel}>Pièces</div>
            </div>
            <div style={styles.totalValue}>{money(totalPiecesFacture)}</div>
          </div>

          <div style={styles.totalRow}>
            <div style={styles.totalLeft}>
              <div style={styles.totalLabel}>Main-d’œuvre</div>
            </div>
            <div style={styles.totalValue}>{money(totalMainOeuvre)}</div>
          </div>

          <div style={styles.totalRow}>
            <div style={styles.totalLeft}>
              <div style={styles.totalLabel}>Frais d’atelier</div>
            </div>
            <div style={styles.totalValue}>{money(totalFraisAtelier)}</div>
          </div>

          <div style={styles.grandTotalRow}>
            <div style={styles.grandTotalLabel}>Total</div>
            <div style={styles.grandTotalValue}>{money(totalGeneral)}</div>
          </div>
        </div>
      </div>
    </>
  );
}