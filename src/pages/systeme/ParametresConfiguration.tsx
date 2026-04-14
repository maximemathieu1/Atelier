import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";

type TabKey = "unites" | "pieces";

type Categorie = "type_unite" | "motorisation" | "freins" | "suspension";

type OptionRow = {
  id: string;
  categorie: Categorie;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

type PieceCategorieRow = {
  id: string;
  nom: string;
  ordre: number | null;
  actif: boolean;
  created_at?: string;
};

const CATEGORIES: { key: Categorie; label: string; hint: string }[] = [
  { key: "type_unite", label: "Type d’unité", hint: "Ex: Autobus, Minibus, Adapté…" },
  { key: "motorisation", label: "Motorisation", hint: "Ex: Diesel, Électrique…" },
  { key: "freins", label: "Freins", hint: "Ex: Air, Hydraulique…" },
  { key: "suspension", label: "Suspension", hint: "Ex: Air, Ressorts…" },
];

export default function ParametresConfiguration() {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("unites");

  const [rows, setRows] = useState<OptionRow[]>([]);
  const [cat, setCat] = useState<Categorie>("type_unite");

  const [pieceCategories, setPieceCategories] = useState<PieceCategorieRow[]>([]);

  const [openAdd, setOpenAdd] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [actif, setActif] = useState(true);

  const [openAddPiece, setOpenAddPiece] = useState(false);
  const [pieceNom, setPieceNom] = useState("");
  const [pieceActif, setPieceActif] = useState(true);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuType, setMenuType] = useState<"unite" | "piece" | null>(null);

  const [editRow, setEditRow] = useState<OptionRow | null>(null);
  const [editLibelle, setEditLibelle] = useState("");

  const [editPieceRow, setEditPieceRow] = useState<PieceCategorieRow | null>(null);
  const [editPieceNom, setEditPieceNom] = useState("");

  const meta = useMemo(() => CATEGORIES.find((c) => c.key === cat)!, [cat]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => r.categorie === cat)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { sensitivity: "base" }));
  }, [rows, cat]);

  const filteredPieceCategories = useMemo(() => {
    return [...pieceCategories].sort((a, b) =>
      String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" })
    );
  }, [pieceCategories]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const inMenu = target.closest('[data-menu-root="param-option"]');
      if (!inMenu) {
        setMenuOpenId(null);
        setMenuType(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadAll() {
    setBusy(true);
    try {
      const [unitesRes, piecesRes] = await Promise.all([
        supabase
          .from("unite_options")
          .select("id,categorie,libelle,ordre,actif,created_at")
          .order("categorie", { ascending: true })
          .order("libelle", { ascending: true }),
        supabase
          .from("pieces_categories")
          .select("id,nom,ordre,actif,created_at")
          .order("nom", { ascending: true }),
      ]);

      if (unitesRes.error) throw unitesRes.error;

      if (piecesRes.error) {
        const msg = String(piecesRes.error.message || "");
        const missingTable =
          msg.toLowerCase().includes("does not exist") ||
          msg.toLowerCase().includes("relation") ||
          msg.toLowerCase().includes("schema cache");
        if (missingTable) {
          setPieceCategories([]);
        } else {
          throw piecesRes.error;
        }
      } else {
        setPieceCategories((piecesRes.data as PieceCategorieRow[]) ?? []);
      }

      setRows((unitesRes.data as OptionRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setRows([]);
      setPieceCategories([]);
    } finally {
      setBusy(false);
    }
  }

  async function loadUnites() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("unite_options")
        .select("id,categorie,libelle,ordre,actif,created_at")
        .order("categorie", { ascending: true })
        .order("libelle", { ascending: true });

      if (error) throw error;
      setRows((data as OptionRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  async function loadPieceCategories() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("pieces_categories")
        .select("id,nom,ordre,actif,created_at")
        .order("nom", { ascending: true });

      if (error) throw error;
      setPieceCategories((data as PieceCategorieRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setPieceCategories([]);
    } finally {
      setBusy(false);
    }
  }

  function closeAddModal() {
    if (busy) return;
    setOpenAdd(false);
    setLibelle("");
    setActif(true);
  }

  function closeAddPieceModal() {
    if (busy) return;
    setOpenAddPiece(false);
    setPieceNom("");
    setPieceActif(true);
  }

  function openEditModal(row: OptionRow) {
    setMenuOpenId(null);
    setMenuType(null);
    setEditRow(row);
    setEditLibelle(row.libelle ?? "");
  }

  function openEditPieceModal(row: PieceCategorieRow) {
    setMenuOpenId(null);
    setMenuType(null);
    setEditPieceRow(row);
    setEditPieceNom(row.nom ?? "");
  }

  function closeEditModal() {
    if (busy) return;
    setEditRow(null);
    setEditLibelle("");
  }

  function closeEditPieceModal() {
    if (busy) return;
    setEditPieceRow(null);
    setEditPieceNom("");
  }

  async function add() {
    const label = libelle.trim();
    if (!label || busy) return;

    setBusy(true);
    try {
      const existing = rows.filter((r) => r.categorie === cat);
      const nextOrdre =
        existing.length > 0 ? Math.max(...existing.map((r) => Number(r.ordre ?? 0))) + 10 : 10;

      const { error } = await supabase.from("unite_options").insert({
        categorie: cat,
        libelle: label,
        ordre: nextOrdre,
        actif: Boolean(actif),
      });

      if (error) throw error;

      await loadUnites();
      closeAddModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addPieceCategory() {
    const label = pieceNom.trim();
    if (!label || busy) return;

    setBusy(true);
    try {
      const existing = [...pieceCategories];
      const nextOrdre =
        existing.length > 0
          ? Math.max(...existing.map((r) => Number(r.ordre ?? 0))) + 10
          : 10;

      const { error } = await supabase.from("pieces_categories").insert({
        nom: label,
        ordre: nextOrdre,
        actif: Boolean(pieceActif),
      });

      if (error) throw error;

      await loadPieceCategories();
      closeAddPieceModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editRow || busy) return;

    const next = editLibelle.trim();
    if (!next) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("unite_options")
        .update({ libelle: next })
        .eq("id", editRow.id);

      if (error) throw error;

      await loadUnites();
      closeEditModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveEditPiece() {
    if (!editPieceRow || busy) return;

    const next = editPieceNom.trim();
    if (!next) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("pieces_categories")
        .update({ nom: next })
        .eq("id", editPieceRow.id);

      if (error) throw error;

      await loadPieceCategories();
      closeEditPieceModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setRowActif(row: OptionRow, nextActif: boolean) {
    if (busy) return;
    setMenuOpenId(null);
    setMenuType(null);
    setBusy(true);

    try {
      const { error } = await supabase
        .from("unite_options")
        .update({ actif: nextActif })
        .eq("id", row.id);

      if (error) throw error;
      await loadUnites();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setPieceRowActif(row: PieceCategorieRow, nextActif: boolean) {
    if (busy) return;
    setMenuOpenId(null);
    setMenuType(null);
    setBusy(true);

    try {
      const { error } = await supabase
        .from("pieces_categories")
        .update({ actif: nextActif })
        .eq("id", row.id);

      if (error) throw error;
      await loadPieceCategories();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: string) {
    if (busy) return;
    setMenuOpenId(null);
    setMenuType(null);

    if (!confirm("Supprimer cette option ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_options").delete().eq("id", id);
      if (error) throw error;
      await loadUnites();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removePieceRow(id: string) {
    if (busy) return;
    setMenuOpenId(null);
    setMenuType(null);

    if (!confirm("Supprimer cette catégorie de pièce ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("pieces_categories").delete().eq("id", id);
      if (error) throw error;
      await loadPieceCategories();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
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
      zIndex: 1,
    } as CSSProperties,
    menuWrap: {
      position: "relative",
      display: "inline-block",
    } as CSSProperties,
    menu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 160,
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
    tabButton: (active: boolean): CSSProperties => ({
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid #d6dbe3",
      background: active ? "#2563eb" : "#fff",
      color: active ? "#fff" : "#0f172a",
      fontWeight: 800,
      cursor: "pointer",
    }),
    categoryButton: (active: boolean): CSSProperties => ({
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid #d6dbe3",
      background: active ? "#2563eb" : "#fff",
      color: active ? "#fff" : "#0f172a",
      fontWeight: 800,
      cursor: "pointer",
    }),
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Configuration</div>
          <div style={{ color: "rgba(0,0,0,.6)" }}>
            Gère les paramètres utilisés par les unités et les pièces.
          </div>
        </div>

        <div style={styles.row}>
          <button
            type="button"
            style={styles.tabButton(tab === "unites")}
            onClick={() => {
              setTab("unites");
              setMenuOpenId(null);
              setMenuType(null);
            }}
          >
            Unités
          </button>

          <button
            type="button"
            style={styles.tabButton(tab === "pieces")}
            onClick={() => {
              setTab("pieces");
              setMenuOpenId(null);
              setMenuType(null);
            }}
          >
            Pièces
          </button>
        </div>
      </div>

      {tab === "unites" && (
        <>
          <div style={styles.card}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Configuration des options d’unité</div>
              <div style={{ color: "rgba(0,0,0,.6)" }}>
                Gère les choix disponibles dans les fiches d’unité.
              </div>
            </div>

            <div style={{ ...styles.row, marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCat(c.key)}
                  style={styles.categoryButton(cat === c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div style={{ ...styles.row, justifyContent: "space-between" }}>
              <div style={{ color: "rgba(0,0,0,.6)" }}>{meta.hint}</div>

              <div style={styles.row}>
                <button style={styles.btn} onClick={loadUnites} disabled={busy} type="button">
                  Rafraîchir
                </button>
                <button style={styles.btnPrimary} onClick={() => setOpenAdd(true)} type="button">
                  Ajouter une option
                </button>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>{meta.label}</div>
              <div style={{ color: "rgba(0,0,0,.6)" }}>
                Consulte les options et gère-les via le menu d’action.
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Libellé</th>
                    <th style={{ ...styles.th, width: 120 }}>Statut</th>
                    <th style={{ ...styles.th, width: 90 }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={3}>
                        <span style={{ color: "rgba(0,0,0,.6)" }}>
                          Aucune option dans cette catégorie.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 500 }}>{r.libelle || "—"}</div>
                        </td>

                        <td style={styles.td}>
                          <span style={r.actif ? styles.statusActive : styles.statusInactive}>
                            {r.actif ? "Actif" : "Inactif"}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.menuWrap} data-menu-root="param-option">
                            <button
                              type="button"
                              style={styles.iconBtn}
                              onClick={() => {
                                setMenuType("unite");
                                setMenuOpenId((cur) => (cur === r.id ? null : r.id));
                              }}
                              disabled={busy}
                            >
                              ...
                            </button>

                            {menuOpenId === r.id && menuType === "unite" && (
                              <div style={styles.menu}>
                                <button
                                  type="button"
                                  style={styles.menuItem}
                                  onClick={() => openEditModal(r)}
                                >
                                  Modifier
                                </button>

                                <button
                                  type="button"
                                  style={styles.menuItem}
                                  onClick={() => setRowActif(r, !r.actif)}
                                >
                                  {r.actif ? "Inactif" : "Actif"}
                                </button>

                                <button
                                  type="button"
                                  style={{
                                    ...styles.menuItem,
                                    borderBottom: "none",
                                    color: "#b91c1c",
                                  }}
                                  onClick={() => removeRow(r.id)}
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
        </>
      )}

      {tab === "pieces" && (
        <>
          <div style={styles.card}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Configuration des pièces</div>
              <div style={{ color: "rgba(0,0,0,.6)" }}>
                Gère les catégories de pièces pour préparer l’intégration à l’inventaire.
              </div>
            </div>

            <div style={{ ...styles.row, justifyContent: "space-between" }}>
              <div style={{ color: "rgba(0,0,0,.6)" }}>
                Ex: Freins, Moteur, Suspension, Éclairage…
              </div>

              <div style={styles.row}>
                <button style={styles.btn} onClick={loadPieceCategories} disabled={busy} type="button">
                  Rafraîchir
                </button>
                <button
                  style={styles.btnPrimary}
                  onClick={() => setOpenAddPiece(true)}
                  type="button"
                >
                  Ajouter une catégorie
                </button>
              </div>
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
                  {filteredPieceCategories.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={3}>
                        <span style={{ color: "rgba(0,0,0,.6)" }}>
                          Aucune catégorie de pièce.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredPieceCategories.map((r) => (
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
                          <div style={styles.menuWrap} data-menu-root="param-option">
                            <button
                              type="button"
                              style={styles.iconBtn}
                              onClick={() => {
                                setMenuType("piece");
                                setMenuOpenId((cur) => (cur === r.id ? null : r.id));
                              }}
                              disabled={busy}
                            >
                              ...
                            </button>

                            {menuOpenId === r.id && menuType === "piece" && (
                              <div style={styles.menu}>
                                <button
                                  type="button"
                                  style={styles.menuItem}
                                  onClick={() => openEditPieceModal(r)}
                                >
                                  Modifier
                                </button>

                                <button
                                  type="button"
                                  style={styles.menuItem}
                                  onClick={() => setPieceRowActif(r, !r.actif)}
                                >
                                  {r.actif ? "Inactif" : "Actif"}
                                </button>

                                <button
                                  type="button"
                                  style={{
                                    ...styles.menuItem,
                                    borderBottom: "none",
                                    color: "#b91c1c",
                                  }}
                                  onClick={() => removePieceRow(r.id)}
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
        </>
      )}

      {openAdd && (
        <div style={styles.modalBackdrop} onClick={closeAddModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une option</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAddModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Catégorie</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={meta.label}
                  disabled
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={libelle}
                  onChange={(e) => setLibelle(e.target.value)}
                  placeholder="Ex: Autobus"
                  autoFocus
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={actif}
                  onChange={(e) => setActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Option active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeAddModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={add}
                disabled={busy || !libelle.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {openAddPiece && (
        <div style={styles.modalBackdrop} onClick={closeAddPieceModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une catégorie de pièce</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAddPieceModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={pieceNom}
                  onChange={(e) => setPieceNom(e.target.value)}
                  placeholder="Ex: Freins"
                  autoFocus
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={pieceActif}
                  onChange={(e) => setPieceActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Catégorie active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btn}
                onClick={closeAddPieceModal}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addPieceCategory}
                disabled={busy || !pieceNom.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div style={styles.modalBackdrop} onClick={closeEditModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier l’option</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeEditModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editLibelle}
                  onChange={(e) => setEditLibelle(e.target.value)}
                  placeholder="Ex: Autobus"
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeEditModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveEdit}
                disabled={busy || !editLibelle.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {editPieceRow && (
        <div style={styles.modalBackdrop} onClick={closeEditPieceModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier la catégorie de pièce</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeEditPieceModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editPieceNom}
                  onChange={(e) => setEditPieceNom(e.target.value)}
                  placeholder="Ex: Freins"
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btn}
                onClick={closeEditPieceModal}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveEditPiece}
                disabled={busy || !editPieceNom.trim()}
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