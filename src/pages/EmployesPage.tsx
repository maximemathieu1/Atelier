import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type EmployeRow = {
  id: string;
  email: string;
  nom_complet: string;
  numero_mecano: string | null;
  role: string | null;
  actif: boolean;
  created_at?: string;
};

const roles = [
  { value: "mecano", label: "Mécano" },
  { value: "admin", label: "Admin" },
  { value: "bureau", label: "Bureau" },
  { value: "gestion", label: "Gestion" },
];

type SortKey = "nom_complet" | "email" | "numero_mecano" | "role" | "actif";
type SortDir = "asc" | "desc";

type MenuState = {
  id: string;
  x: number;
  y: number;
};

export default function EmployesPage() {
  const [employes, setEmployes] = useState<EmployeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState<SortKey>("nom_complet");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [menuOpen, setMenuOpen] = useState<MenuState | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [formNomComplet, setFormNomComplet] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNumeroMecano, setFormNumeroMecano] = useState("");
  const [formRole, setFormRole] = useState("mecano");
  const [formActif, setFormActif] = useState(true);

  async function loadEmployes() {
    setLoading(true);

    const { data, error } = await supabase
      .from("employes")
      .select("id, email, nom_complet, numero_mecano, role, actif, created_at")
      .order("nom_complet", { ascending: true });

    if (error) {
      alert("Erreur lors du chargement des employés : " + error.message);
      setEmployes([]);
      setLoading(false);
      return;
    }

    setEmployes((data || []) as EmployeRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadEmployes();
  }, []);

  useEffect(() => {
    function closeMenu() {
      setMenuOpen(null);
    }

    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  function resetForm() {
    setFormNomComplet("");
    setFormEmail("");
    setFormNumeroMecano("");
    setFormRole("mecano");
    setFormActif(true);
  }

  function openAddModal() {
    resetForm();
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (adding) return;
    setShowAddModal(false);
  }

  function openEditModal(employe: EmployeRow) {
    setEditingId(employe.id);
    setFormNomComplet(employe.nom_complet || "");
    setFormEmail(employe.email || "");
    setFormNumeroMecano(employe.numero_mecano || "");
    setFormRole(employe.role || "mecano");
    setFormActif(!!employe.actif);
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setShowEditModal(false);
    setEditingId(null);
  }

  async function handleAdd() {
    const nom = formNomComplet.trim();
    const courriel = formEmail.trim().toLowerCase();
    const numeroMecano = formNumeroMecano.trim();

    if (!nom) {
      alert("Le nom complet est obligatoire.");
      return;
    }

    if (!courriel) {
      alert("Le courriel est obligatoire.");
      return;
    }

    setAdding(true);

    const { error } = await supabase.from("employes").insert({
      nom_complet: nom,
      email: courriel,
      numero_mecano: numeroMecano || null,
      role: formRole || "mecano",
      actif: formActif,
    });

    setAdding(false);

    if (error) {
      alert("Erreur lors de l'ajout : " + error.message);
      return;
    }

    setShowAddModal(false);
    resetForm();
    await loadEmployes();
  }

  async function handleSaveEdit() {
    const nom = formNomComplet.trim();
    const courriel = formEmail.trim().toLowerCase();
    const numeroMecano = formNumeroMecano.trim();

    if (!editingId) return;

    if (!nom) {
      alert("Le nom complet est obligatoire.");
      return;
    }

    if (!courriel) {
      alert("Le courriel est obligatoire.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("employes")
      .update({
        nom_complet: nom,
        email: courriel,
        numero_mecano: numeroMecano || null,
        role: formRole || "mecano",
        actif: formActif,
      })
      .eq("id", editingId);

    setSavingEdit(false);

    if (error) {
      alert("Erreur lors de l'enregistrement : " + error.message);
      return;
    }

    closeEditModal();
    await loadEmployes();
  }

  async function handleToggleActif(employe: EmployeRow) {
    const { error } = await supabase
      .from("employes")
      .update({ actif: !employe.actif })
      .eq("id", employe.id);

    if (error) {
      alert("Erreur lors du changement de statut : " + error.message);
      return;
    }

    await loadEmployes();
    setMenuOpen(null);
  }

  async function handleDelete(employe: EmployeRow) {
    const ok = window.confirm(`Supprimer l'employé "${employe.nom_complet}" ?`);
    if (!ok) return;

    const { error } = await supabase.from("employes").delete().eq("id", employe.id);

    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
      return;
    }

    await loadEmployes();
    setMenuOpen(null);
  }

  function resolveRoleLabel(role: string | null) {
    return roles.find((r) => r.value === role)?.label || role || "—";
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function getSortValue(row: EmployeRow, key: SortKey) {
    switch (key) {
      case "nom_complet":
        return row.nom_complet ?? "";
      case "email":
        return row.email ?? "";
      case "numero_mecano":
        return row.numero_mecano ?? "";
      case "role":
        return resolveRoleLabel(row.role);
      case "actif":
        return row.actif ? 1 : 0;
      default:
        return "";
    }
  }

  const filteredEmployes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employes;

    return employes.filter((e) => {
      return (
        (e.nom_complet || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q) ||
        (e.numero_mecano || "").toLowerCase().includes(q) ||
        (resolveRoleLabel(e.role) || "").toLowerCase().includes(q) ||
        (e.actif ? "actif" : "inactif").includes(q)
      );
    });
  }, [employes, search]);

  const sortedEmployes = useMemo(() => {
    const copy = [...filteredEmployes];

    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "fr", { numeric: true, sensitivity: "base" })
        : String(bv).localeCompare(String(av), "fr", { numeric: true, sensitivity: "base" });
    });

    return copy;
  }, [filteredEmployes, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedEmployes.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedEmployes.slice(start, start + pageSize);
  }, [sortedEmployes, page, pageSize]);

  const fromRow = sortedEmployes.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, sortedEmployes.length);

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.35 }}>↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function renderHeader(label: string, key: SortKey, alignRight = false) {
    return (
      <th style={alignRight ? styles.thRight : styles.th}>
        <button type="button" style={styles.sortBtn} onClick={() => handleSort(key)}>
          <span>{label}</span>
          <SortArrow col={key} />
        </button>
      </th>
    );
  }

  function openActionMenu(
    ev: React.MouseEvent<HTMLButtonElement>,
    employeId: string
  ) {
    ev.stopPropagation();
    const rect = ev.currentTarget.getBoundingClientRect();

    if (menuOpen?.id === employeId) {
      setMenuOpen(null);
      return;
    }

    setMenuOpen({
      id: employeId,
      x: rect.right,
      y: rect.bottom,
    });
  }

  const menuEmploye = menuOpen
    ? employes.find((e) => e.id === menuOpen.id) ?? null
    : null;

  return (
    <div style={styles.page}>
      <div style={styles.headerWrap}>
        <div>
          <h1 style={styles.h1}>Employés</h1>
          <div style={styles.subtitle}>Gestion des employés et accès atelier</div>
        </div>

        <button type="button" style={styles.primaryBtn} onClick={openAddModal}>
          + Nouvel employé
        </button>
      </div>

      <div style={styles.toolbarCard}>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, courriel, no mécano, rôle..."
        />

        <select
          style={styles.select}
          value={String(pageSize)}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>

        <div style={styles.resultsText}>
          {sortedEmployes.length} résultat{sortedEmployes.length > 1 ? "s" : ""}
        </div>
      </div>

      <div style={styles.tableShell}>
        {loading ? (
          <div style={styles.emptyWrap}>Chargement...</div>
        ) : paginatedRows.length === 0 ? (
          <div style={styles.emptyWrap}>Aucun employé.</div>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.theadRow}>
                    {renderHeader("Nom", "nom_complet")}
                    {renderHeader("Courriel", "email")}
                    {renderHeader("No mécano", "numero_mecano")}
                    {renderHeader("Rôle", "role")}
                    {renderHeader("Statut", "actif")}
                    <th style={styles.thActions}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.map((e, index) => {
                    const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

                    return (
                      <tr key={e.id} style={{ background: rowBg }}>
                        <td style={{ ...styles.td, background: rowBg }}>
                          <div style={styles.mainValue}>{e.nom_complet || "—"}</div>
                        </td>

                        <td style={{ ...styles.td, background: rowBg }}>
                          <div style={styles.cellPrimary}>{e.email || "—"}</div>
                        </td>

                        <td style={{ ...styles.td, background: rowBg }}>
                          <div style={styles.cellPrimary}>{e.numero_mecano || "—"}</div>
                        </td>

                        <td style={{ ...styles.td, background: rowBg }}>
                          <div style={styles.cellPrimary}>{resolveRoleLabel(e.role)}</div>
                        </td>

                        <td style={{ ...styles.td, background: rowBg }}>
                          <span
                            style={{
                              ...styles.statusPill,
                              ...(e.actif ? styles.statusActive : styles.statusInactive),
                            }}
                          >
                            {e.actif ? "Actif" : "Inactif"}
                          </span>
                        </td>

                        <td style={{ ...styles.tdCenter, background: rowBg }}>
                          <div style={styles.actionMenuWrap}>
                            <button
                              type="button"
                              style={styles.menuBtn}
                              onClick={(ev) => openActionMenu(ev, e.id)}
                              aria-label="Actions"
                              title="Actions"
                            >
                              ...
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={styles.pagerWrap}>
              <div style={styles.pagerLeft}>
                <span style={styles.resultsText}>
                  Affichage {fromRow} à {toRow} sur {sortedEmployes.length}
                </span>
              </div>

              <div style={styles.pagerRight}>
                <button
                  type="button"
                  style={page <= 1 ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                >
                  « Première
                </button>

                <button
                  type="button"
                  style={page <= 1 ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ‹ Précédente
                </button>

                <button type="button" style={styles.primaryBtnPage}>
                  Page {page} / {totalPages}
                </button>

                <button
                  type="button"
                  style={page >= totalPages ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Suivante ›
                </button>

                <button
                  type="button"
                  style={page >= totalPages ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                >
                  Dernière »
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {menuOpen && menuEmploye && (
        <>
          <div style={styles.menuBackdrop} onClick={() => setMenuOpen(null)} />
          <div
            style={{
              ...styles.dropdownMenuFixed,
              top: menuOpen.y + 6,
              left: Math.max(12, menuOpen.x - 180),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={styles.dropdownItem}
              onClick={() => {
                setMenuOpen(null);
                openEditModal(menuEmploye);
              }}
            >
              Modifier
            </button>

            <button
              type="button"
              style={styles.dropdownItem}
              onClick={() => {
                handleToggleActif(menuEmploye);
              }}
            >
              {menuEmploye.actif ? "Mettre inactif" : "Mettre actif"}
            </button>

            <button
              type="button"
              style={styles.dropdownItemDanger}
              onClick={() => {
                handleDelete(menuEmploye);
              }}
            >
              Supprimer
            </button>
          </div>
        </>
      )}

      {showAddModal && (
        <div style={styles.modalBackdrop} onClick={closeAddModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Ajouter un employé</div>

              <button type="button" onClick={closeAddModal} style={styles.modalClose}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={styles.fieldLabel}>Nom complet</div>
                <input
                  style={styles.input}
                  value={formNomComplet}
                  onChange={(e) => setFormNomComplet(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Courriel</div>
                <input
                  style={styles.input}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Courriel"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Numéro mécano</div>
                <input
                  style={styles.input}
                  value={formNumeroMecano}
                  onChange={(e) => setFormNumeroMecano(e.target.value)}
                  placeholder="Ex: 123"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Rôle</div>
                <select
                  style={styles.input}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={formActif}
                  onChange={(e) => setFormActif(e.target.checked)}
                />
                Employé actif
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={closeAddModal}
                disabled={adding}
              >
                Annuler
              </button>

              <button
                type="button"
                style={styles.primaryBtn}
                onClick={handleAdd}
                disabled={adding}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={styles.modalBackdrop} onClick={closeEditModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Modifier l’employé</div>

              <button type="button" onClick={closeEditModal} style={styles.modalClose}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={styles.fieldLabel}>Nom complet</div>
                <input
                  style={styles.input}
                  value={formNomComplet}
                  onChange={(e) => setFormNomComplet(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Courriel</div>
                <input
                  style={styles.input}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Courriel"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Numéro mécano</div>
                <input
                  style={styles.input}
                  value={formNumeroMecano}
                  onChange={(e) => setFormNumeroMecano(e.target.value)}
                  placeholder="Ex: 123"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Rôle</div>
                <select
                  style={styles.input}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={formActif}
                  onChange={(e) => setFormActif(e.target.checked)}
                />
                Employé actif
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={closeEditModal}
                disabled={savingEdit}
              >
                Annuler
              </button>

              <button
                type="button"
                style={styles.primaryBtn}
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    padding: 20,
    background: "#f5f7fb",
    minHeight: "100%",
  },

  headerWrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  h1: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  subtitle: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 4,
  },

  primaryBtn: {
    height: 48,
    padding: "0 18px",
    borderRadius: 18,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 1px 0 rgba(255,255,255,.22) inset",
  },

  primaryBtnPage: {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },

  ghostBtn: {
    height: 40,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  ghostBtnDisabled: {
    height: 40,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: 800,
    cursor: "not-allowed",
  },

  toolbarCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },

  searchInput: {
    height: 44,
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    padding: "0 14px",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    minWidth: 320,
    flex: 1,
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
    minWidth: 160,
  },

  resultsText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  tableShell: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: 980,
    borderCollapse: "separate",
    borderSpacing: 0,
    tableLayout: "fixed",
  },

  theadRow: {
    background: "#f8fafc",
  },

  th: {
    padding: "16px 14px",
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    background: "#f8fafc",
  },

  thRight: {
    padding: "16px 14px",
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "right",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    background: "#f8fafc",
  },

  thActions: {
    padding: "16px 14px",
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "center",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    background: "#f8fafc",
    width: 90,
  },

  td: {
    padding: "16px 14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    fontWeight: 400,
  },

  tdCenter: {
    padding: "16px 14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    fontWeight: 400,
    textAlign: "center",
  },

  sortBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    fontWeight: 900,
  },

  mainValue: {
    color: "#0f172a",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  cellPrimary: {
    fontWeight: 400,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  },

  statusActive: {
    background: "#dcfce7",
    borderColor: "#bbf7d0",
    color: "#166534",
  },

  statusInactive: {
    background: "#f3f4f6",
    borderColor: "#d1d5db",
    color: "#374151",
  },

  actionMenuWrap: {
    display: "flex",
    justifyContent: "center",
  },

  menuBtn: {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    borderRadius: 10,
    padding: "6px 12px",
    fontWeight: 800,
    cursor: "pointer",
    minWidth: 42,
  },

  menuBackdrop: {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 99998,
  },

  dropdownMenuFixed: {
    position: "fixed",
    width: 180,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 20px 50px rgba(0,0,0,0.20)",
    padding: 6,
    zIndex: 99999,
    display: "grid",
    gap: 4,
  },

  dropdownItem: {
    border: "none",
    background: "#fff",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    color: "#111827",
  },

  dropdownItemDanger: {
    border: "none",
    background: "#fff",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    color: "#991b1b",
  },

  emptyWrap: {
    padding: 28,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },

  pagerWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: 16,
    background: "#fff",
  },

  pagerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  pagerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(17,24,39,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },

  modalCard: {
    width: "100%",
    maxWidth: 560,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "16px 18px",
    borderBottom: "1px solid #e5e7eb",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },

  modalClose: {
    border: "none",
    background: "transparent",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
    color: "#6b7280",
  },

  modalBody: {
    padding: 18,
    display: "grid",
    gap: 14,
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "16px 18px",
    borderTop: "1px solid #e5e7eb",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
  },

  fieldLabel: {
    fontWeight: 600,
    marginBottom: 6,
    color: "#111827",
    fontSize: 14,
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#111827",
    fontSize: 14,
  },
};