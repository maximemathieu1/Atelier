import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type PieceCategorieRow = {
  id: string;
  nom: string;
  ordre: number | null;
  actif: boolean;
  created_at?: string;
};

export default function ParametresPiecesPage() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PieceCategorieRow[]>([]);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [openAddModal, setOpenAddModal] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newActif, setNewActif] = useState(true);

  const [openEditModal, setOpenEditModal] = useState(false);
  const [editRow, setEditRow] = useState<PieceCategorieRow | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editActif, setEditActif] = useState(true);

  const filteredRows = useMemo(() => {
    return [...rows].sort((a, b) =>
      String(a.nom || "").localeCompare(String(b.nom || ""), "fr", {
        sensitivity: "base",
      })
    );
  }, [rows]);

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const inMenu = target.closest('[data-menu-root="param-piece"]');
      if (!inMenu) setMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadRows() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("pieces_categories")
        .select("id,nom,ordre,actif,created_at")
        .order("nom", { ascending: true });

      if (error) throw error;
      setRows((data as PieceCategorieRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  function closeAddModal() {
    setOpenAddModal(false);
    setNewNom("");
    setNewActif(true);
  }

  function closeEditModal() {
    setOpenEditModal(false);
    setEditRow(null);
    setEditNom("");
    setEditActif(true);
  }

  function closeMenu() {
    setMenuOpenId(null);
  }

  async function addRow() {
    const nom = newNom.trim();
    if (!nom || busy) return;

    setBusy(true);
    try {
      const nextOrdre =
        rows.length > 0 ? Math.max(...rows.map((r) => Number(r.ordre ?? 0))) + 10 : 10;

      const { error } = await supabase.from("pieces_categories").insert({
        nom,
        ordre: nextOrdre,
        actif: Boolean(newActif),
      });

      if (error) throw error;

      await loadRows();
      closeAddModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editRow || busy) return;

    const nom = editNom.trim();
    if (!nom) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("pieces_categories")
        .update({
          nom,
          actif: Boolean(editActif),
        })
        .eq("id", editRow.id);

      if (error) throw error;

      await loadRows();
      closeEditModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActif(row: PieceCategorieRow) {
    if (busy) return;
    closeMenu();
    setBusy(true);

    try {
      const { error } = await supabase
        .from("pieces_categories")
        .update({ actif: !row.actif })
        .eq("id", row.id);

      if (error) throw error;
      await loadRows();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(row: PieceCategorieRow) {
    if (busy) return;
    closeMenu();

    if (!confirm("Supprimer cette catégorie de pièce ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("pieces_categories").delete().eq("id", row.id);
      if (error) throw error;
      await loadRows();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    page: {
      padding: 16,
      display: "grid",
      gap: 12,
    } as CSSProperties,
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      overflow: "visible",
      position: "relative",
      zIndex: 1,
    } as CSSProperties,
    row: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    } as CSSProperties,
    btn: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    } as CSSProperties,
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    } as CSSProperties,
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    } as CSSProperties,
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 720,
    } as CSSProperties,
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    } as CSSProperties,
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top",
    } as CSSProperties,
    tableWrap: {
      width: "100%",
      overflowX: "auto",
      overflowY: "visible",
      position: "relative",
    } as CSSProperties,
    menuWrap: {
      position: "relative",
      display: "inline-block",
    } as CSSProperties,
    menu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 180,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 10,
      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
      zIndex: 9999,
      overflow: "hidden",
    } as CSSProperties,
    menuItem: {
      width: "100%",
      padding: "10px 12px",
      textAlign: "left",
      background: "#fff",
      border: "none",
      borderBottom: "1px solid rgba(0,0,0,.06)",
      cursor: "pointer",
      fontWeight: 700,
    } as CSSProperties,
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    } as CSSProperties,
    statusActive: {
      color: "#166534",
      fontWeight: 800,
    } as CSSProperties,
    statusInactive: {
      color: "#64748b",
      fontWeight: 800,
    } as CSSProperties,
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 10000,
    } as CSSProperties,
    modalCard: {
      width: "100%",
      maxWidth: 560,
      background: "#fff",
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,.18)",
      overflow: "hidden",
    } as CSSProperties,
    modalHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
      gap: 12,
    } as CSSProperties,
    modalTitle: {
      fontSize: 18,
      fontWeight: 900,
      margin: 0,
    } as CSSProperties,
    modalBody: {
      padding: 16,
      display: "grid",
      gap: 12,
    } as CSSProperties,
    modalFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      padding: 16,
      borderTop: "1px solid rgba(0,0,0,.08)",
    } as CSSProperties,
    iconCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
    } as CSSProperties,
  };

  return (
    <>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Paramètres pièces</div>
              <div style={{ color: "rgba(0,0,0,.6)", marginTop: 4 }}>
                Gère les catégories de pièces utilisées dans l’inventaire.
              </div>
            </div>

            <button type="button" style={styles.btn} onClick={() => nav("/systeme/parametres")}>
              Retour
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: "space-between" }}>
            <div style={{ color: "rgba(0,0,0,.6)" }}>
              Ex: Freins, Moteur, Suspension, Éclairage…
            </div>

            <button type="button" style={styles.btnPrimary} onClick={() => setOpenAddModal(true)}>
              Ajouter une catégorie
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Catégories de pièces</div>
            <div style={{ color: "rgba(0,0,0,.6)" }}>
              Consulte les catégories et gère-les via le menu d’action.
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nom</th>
                  <th style={{ ...styles.th, width: 120 }}>Statut</th>
                  <th style={{ ...styles.th, width: 90 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={3}>
                      <span style={{ color: "rgba(0,0,0,.6)" }}>
                        Aucune catégorie de pièce.
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 500 }}>{r.nom || "—"}</div>
                      </td>

                      <td style={styles.td}>
                        <span style={r.actif ? styles.statusActive : styles.statusInactive}>
                          {r.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.menuWrap} data-menu-root="param-piece">
                          <button
                            type="button"
                            style={styles.iconBtn}
                            onClick={() => setMenuOpenId((cur) => (cur === r.id ? null : r.id))}
                            disabled={busy}
                          >
                            ...
                          </button>

                          {menuOpenId === r.id && (
                            <div style={styles.menu}>
                              <button
                                type="button"
                                style={styles.menuItem}
                                onClick={() => {
                                  closeMenu();
                                  setEditRow(r);
                                  setEditNom(r.nom ?? "");
                                  setEditActif(Boolean(r.actif));
                                  setOpenEditModal(true);
                                }}
                              >
                                Modifier
                              </button>

                              <button
                                type="button"
                                style={styles.menuItem}
                                onClick={() => toggleActif(r)}
                              >
                                {r.actif ? "Inactif" : "Actif"}
                              </button>

                              <button
                                type="button"
                                style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }}
                                onClick={() => removeRow(r)}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openAddModal && (
        <div style={styles.modalBackdrop} onClick={closeAddModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une catégorie de pièce</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAddModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  placeholder="Ex: Freins"
                  autoFocus
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={newActif}
                  onChange={(e) => setNewActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Catégorie active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeAddModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addRow}
                disabled={busy || !newNom.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditModal && (
        <div style={styles.modalBackdrop} onClick={closeEditModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier la catégorie de pièce</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeEditModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  autoFocus
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={editActif}
                  onChange={(e) => setEditActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Catégorie active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeEditModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveEdit}
                disabled={busy || !editNom.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}