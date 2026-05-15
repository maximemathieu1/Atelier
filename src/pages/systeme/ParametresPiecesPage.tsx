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

type PieceSousCategorieRow = {
  id: string;
  categorie_id: string;
  nom: string;
  ordre: number | null;
  actif: boolean;
  created_at?: string;
};

type ActiveTab = "categories" | "sous_categories";
type ModalMode = "add-category" | "edit-category" | "add-sub" | "edit-sub" | null;

export default function ParametresPiecesPage() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("categories");

  const [categories, setCategories] = useState<PieceCategorieRow[]>([]);
  const [sousCategories, setSousCategories] = useState<PieceSousCategorieRow[]>([]);

  const [selectedCategorieId, setSelectedCategorieId] = useState("");
  const [menuOpen, setMenuOpen] = useState<{ id: string; x: number; y: number } | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editCategory, setEditCategory] = useState<PieceCategorieRow | null>(null);
  const [editSub, setEditSub] = useState<PieceSousCategorieRow | null>(null);

  const [formNom, setFormNom] = useState("");
  const [formActif, setFormActif] = useState(true);
  const [formCategorieId, setFormCategorieId] = useState("");

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) =>
      String(a.nom || "").localeCompare(String(b.nom || ""), "fr", {
        sensitivity: "base",
      })
    );
  }, [categories]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategorieId) ?? null;
  }, [categories, selectedCategorieId]);

  const filteredSousCategories = useMemo(() => {
    return sousCategories
      .filter((s) => !selectedCategorieId || s.categorie_id === selectedCategorieId)
      .sort((a, b) => {
        const ca = categories.find((c) => c.id === a.categorie_id)?.nom || "";
        const cb = categories.find((c) => c.id === b.categorie_id)?.nom || "";
        const catSort = ca.localeCompare(cb, "fr", { sensitivity: "base" });
        if (catSort !== 0) return catSort;

        const ordreSort = Number(a.ordre ?? 0) - Number(b.ordre ?? 0);
        if (ordreSort !== 0) return ordreSort;

        return String(a.nom || "").localeCompare(String(b.nom || ""), "fr", {
          sensitivity: "base",
        });
      });
  }, [sousCategories, selectedCategorieId, categories]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const inMenu = target.closest('[data-menu-root="param-piece"]');
      if (!inMenu) setMenuOpen(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadAll() {
    setBusy(true);
    try {
      const [catRes, subRes] = await Promise.all([
        supabase
          .from("pieces_categories")
          .select("id,nom,ordre,actif,created_at")
          .order("nom", { ascending: true }),
        supabase
          .from("pieces_sous_categories")
          .select("id,categorie_id,nom,ordre,actif,created_at")
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),
      ]);

      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;

      const nextCategories = (catRes.data as PieceCategorieRow[]) ?? [];
      setCategories(nextCategories);
      setSousCategories((subRes.data as PieceSousCategorieRow[]) ?? []);

      if (!selectedCategorieId && nextCategories.length > 0) {
        setSelectedCategorieId(nextCategories[0].id);
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setCategories([]);
      setSousCategories([]);
    } finally {
      setBusy(false);
    }
  }

  function getCategorieNom(id: string | null | undefined) {
    if (!id) return "—";
    return categories.find((c) => c.id === id)?.nom || "—";
  }

  function closeMenu() {
    setMenuOpen(null);
  }

  function openRowMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    setMenuOpen((cur) =>
      cur?.id === id
        ? null
        : {
            id,
            x: rect.right,
            y: rect.bottom,
          }
    );
  }

  function closeModal() {
    setModalMode(null);
    setEditCategory(null);
    setEditSub(null);
    setFormNom("");
    setFormActif(true);
    setFormCategorieId("");
  }

  function openAddCategory() {
    setFormNom("");
    setFormActif(true);
    setModalMode("add-category");
  }

  function openEditCategory(row: PieceCategorieRow) {
    setEditCategory(row);
    setFormNom(row.nom || "");
    setFormActif(Boolean(row.actif));
    setModalMode("edit-category");
  }

  function openAddSub() {
    setFormNom("");
    setFormActif(true);
    setFormCategorieId(selectedCategorieId || categories[0]?.id || "");
    setModalMode("add-sub");
  }

  function openEditSub(row: PieceSousCategorieRow) {
    setEditSub(row);
    setFormNom(row.nom || "");
    setFormActif(Boolean(row.actif));
    setFormCategorieId(row.categorie_id || "");
    setModalMode("edit-sub");
  }

  async function saveModal() {
    const nom = formNom.trim();
    if (!nom || busy) return;

    setBusy(true);
    try {
      if (modalMode === "add-category") {
        const nextOrdre = categories.length > 0 ? Math.max(...categories.map((r) => Number(r.ordre ?? 0))) + 10 : 10;
        const { error } = await supabase.from("pieces_categories").insert({
          nom,
          ordre: nextOrdre,
          actif: Boolean(formActif),
        });
        if (error) throw error;
      }

      if (modalMode === "edit-category" && editCategory) {
        const { error } = await supabase
          .from("pieces_categories")
          .update({ nom, actif: Boolean(formActif) })
          .eq("id", editCategory.id);
        if (error) throw error;
      }

      if (modalMode === "add-sub") {
        if (!formCategorieId) throw new Error("Sélectionne une catégorie.");

        const related = sousCategories.filter((s) => s.categorie_id === formCategorieId);
        const nextOrdre = related.length > 0 ? Math.max(...related.map((r) => Number(r.ordre ?? 0))) + 10 : 10;

        const { error } = await supabase.from("pieces_sous_categories").insert({
          categorie_id: formCategorieId,
          nom,
          ordre: nextOrdre,
          actif: Boolean(formActif),
        });
        if (error) throw error;
      }

      if (modalMode === "edit-sub" && editSub) {
        if (!formCategorieId) throw new Error("Sélectionne une catégorie.");

        const { error } = await supabase
          .from("pieces_sous_categories")
          .update({
            categorie_id: formCategorieId,
            nom,
            actif: Boolean(formActif),
          })
          .eq("id", editSub.id);
        if (error) throw error;
      }

      await loadAll();
      closeModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategorie(row: PieceCategorieRow) {
    if (busy) return;
    closeMenu();
    setBusy(true);
    try {
      const { error } = await supabase.from("pieces_categories").update({ actif: !row.actif }).eq("id", row.id);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSub(row: PieceSousCategorieRow) {
    if (busy) return;
    closeMenu();
    setBusy(true);
    try {
      const { error } = await supabase.from("pieces_sous_categories").update({ actif: !row.actif }).eq("id", row.id);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeCategorie(row: PieceCategorieRow) {
    if (busy) return;
    closeMenu();
    if (!confirm("Supprimer cette catégorie de pièce ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("pieces_categories").delete().eq("id", row.id);
      if (error) throw error;
      if (selectedCategorieId === row.id) setSelectedCategorieId("");
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeSub(row: PieceSousCategorieRow) {
    if (busy) return;
    closeMenu();
    if (!confirm("Supprimer cette sous-catégorie ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("pieces_sous_categories").delete().eq("id", row.id);
      if (error) throw error;
      await loadAll();
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
    tabRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    } as CSSProperties,
    tab: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      color: "#0f172a",
      fontWeight: 900,
      cursor: "pointer",
    } as CSSProperties,
    tabActive: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
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
      position: "fixed",
      minWidth: 180,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 10,
      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
      zIndex: 99999,
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

  const modalTitle =
    modalMode === "add-category"
      ? "Ajouter une catégorie"
      : modalMode === "edit-category"
      ? "Modifier la catégorie"
      : modalMode === "add-sub"
      ? "Ajouter une sous-catégorie"
      : "Modifier la sous-catégorie";

  return (
    <>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Paramètres pièces</div>
              <div style={{ color: "rgba(0,0,0,.6)", marginTop: 4 }}>
                Gère les catégories et sous-catégories utilisées dans l’inventaire.
              </div>
            </div>

            <button type="button" style={styles.btn} onClick={() => nav("/systeme/parametres")}>
              Retour
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: "space-between" }}>
            <div style={styles.tabRow}>
              <button
                type="button"
                style={activeTab === "categories" ? styles.tabActive : styles.tab}
                onClick={() => {
                  setActiveTab("categories");
                  closeMenu();
                }}
              >
                Catégories
              </button>

              <button
                type="button"
                style={activeTab === "sous_categories" ? styles.tabActive : styles.tab}
                onClick={() => {
                  setActiveTab("sous_categories");
                  closeMenu();
                }}
              >
                Sous-catégories
              </button>
            </div>

            {activeTab === "categories" ? (
              <button type="button" style={styles.btnPrimary} onClick={openAddCategory} disabled={busy}>
                Ajouter une catégorie
              </button>
            ) : (
              <button type="button" style={styles.btnPrimary} onClick={openAddSub} disabled={busy || categories.length === 0}>
                Ajouter une sous-catégorie
              </button>
            )}
          </div>
        </div>

        {activeTab === "categories" && (
          <div style={styles.card}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Catégories de pièces</div>
              <div style={{ color: "rgba(0,0,0,.6)" }}>Consulte les catégories et gère-les via le menu d’action.</div>
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
                  {sortedCategories.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={3}>
                        <span style={{ color: "rgba(0,0,0,.6)" }}>Aucune catégorie de pièce.</span>
                      </td>
                    </tr>
                  ) : (
                    sortedCategories.map((r) => (
                      <tr key={r.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 650 }}>{r.nom || "—"}</div>
                        </td>

                        <td style={styles.td}>
                          <span style={r.actif ? styles.statusActive : styles.statusInactive}>{r.actif ? "Actif" : "Inactif"}</span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.menuWrap} data-menu-root="param-piece">
                            <button type="button" style={styles.iconBtn} onClick={(e) => openRowMenu(e, r.id)} disabled={busy}>
                              ...
                            </button>

                            {menuOpen?.id === r.id && (
                              <div style={{ ...styles.menu, top: menuOpen.y + 6, left: Math.max(12, menuOpen.x - 180) }}>
                                <button type="button" style={styles.menuItem} onClick={() => { closeMenu(); openEditCategory(r); }}>
                                  Modifier
                                </button>
                                <button type="button" style={styles.menuItem} onClick={() => toggleCategorie(r)}>
                                  {r.actif ? "Inactif" : "Actif"}
                                </button>
                                <button type="button" style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }} onClick={() => removeCategorie(r)}>
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
        )}

        {activeTab === "sous_categories" && (
          <div style={styles.card}>
            <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Sous-catégories de pièces</div>
                <div style={{ color: "rgba(0,0,0,.6)" }}>
                  Sélectionne une catégorie pour gérer ses sous-catégories.
                </div>
              </div>

              <select
                style={{ ...styles.input, minWidth: 260 }}
                value={selectedCategorieId}
                onChange={(e) => setSelectedCategorieId(e.target.value)}
                disabled={busy || categories.length === 0}
              >
                <option value="">Toutes les catégories</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Sous-catégorie</th>
                    <th style={styles.th}>Catégorie</th>
                    <th style={{ ...styles.th, width: 120 }}>Statut</th>
                    <th style={{ ...styles.th, width: 90 }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSousCategories.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        <span style={{ color: "rgba(0,0,0,.6)" }}>
                          {selectedCategory ? `Aucune sous-catégorie pour ${selectedCategory.nom}.` : "Aucune sous-catégorie."}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredSousCategories.map((r) => (
                      <tr key={r.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 650 }}>{r.nom || "—"}</div>
                        </td>
                        <td style={styles.td}>{getCategorieNom(r.categorie_id)}</td>
                        <td style={styles.td}>
                          <span style={r.actif ? styles.statusActive : styles.statusInactive}>{r.actif ? "Actif" : "Inactif"}</span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.menuWrap} data-menu-root="param-piece">
                            <button type="button" style={styles.iconBtn} onClick={(e) => openRowMenu(e, r.id)} disabled={busy}>
                              ...
                            </button>

                            {menuOpen?.id === r.id && (
                              <div style={{ ...styles.menu, top: menuOpen.y + 6, left: Math.max(12, menuOpen.x - 180) }}>
                                <button type="button" style={styles.menuItem} onClick={() => { closeMenu(); openEditSub(r); }}>
                                  Modifier
                                </button>
                                <button type="button" style={styles.menuItem} onClick={() => toggleSub(r)}>
                                  {r.actif ? "Inactif" : "Actif"}
                                </button>
                                <button type="button" style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }} onClick={() => removeSub(r)}>
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
        )}
      </div>

      {modalMode && (
        <div style={styles.modalBackdrop} onClick={closeModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{modalTitle}</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {(modalMode === "add-sub" || modalMode === "edit-sub") && (
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Catégorie</div>
                  <select
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={formCategorieId}
                    onChange={(e) => setFormCategorieId(e.target.value)}
                  >
                    <option value="">— Sélectionner —</option>
                    {sortedCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  placeholder={modalMode === "add-sub" || modalMode === "edit-sub" ? "Ex: Plaquettes" : "Ex: Freins"}
                  autoFocus
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={formActif} onChange={(e) => setFormActif(e.target.checked)} />
                <span style={{ fontWeight: 700 }}>Actif</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveModal}
                disabled={busy || !formNom.trim() || ((modalMode === "add-sub" || modalMode === "edit-sub") && !formCategorieId)}
              >
                {modalMode.startsWith("add") ? "Ajouter" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
