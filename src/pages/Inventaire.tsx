import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type InventaireItem = {
  id: string;
  sku: string | null;
  nom: string;
  categorie: string | null;
  quantite: number;
  unite: string | null;
  cout_unitaire: number | null;
  seuil_alerte: number;
  emplacement: string | null;
  actif: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CoutHistorique = {
  id: string;
  item_id: string;
  date_effective: string;
  cout_unitaire: number;
  fournisseur: string | null;
  numero_facture: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

type PieceCategorieRow = {
  id: string;
  nom: string;
  ordre: number | null;
  actif: boolean;
  created_at?: string;
};

type InstallationHistorique = {
  id: string;
  item_id: string;
  bt_id: string | null;
  bt_numero: string | null;
  unite: string | null;
  quantite: number | null;
  installed_at: string | null;
};

type SupersedRow = {
  id: string;
  item_id: string;
  sku_remplacement: string | null;
  nom_remplacement: string | null;
  note: string | null;
  actif: boolean | null;
  created_at: string | null;
};

type FormState = {
  id: string | null;
  sku: string;
  nom: string;
  categorie: string;
  quantite: string;
  unite: string;
  cout_unitaire: string;
  seuil_alerte: string;
  emplacement: string;
  actif: boolean;
  note: string;
};

type MenuState = {
  id: string;
  x: number;
  y: number;
};

type DetailsTab = "infos" | "couts" | "installations" | "supersed";

const emptyForm: FormState = {
  id: null,
  sku: "",
  nom: "",
  categorie: "",
  quantite: "0",
  unite: "",
  cout_unitaire: "",
  seuil_alerte: "0",
  emplacement: "",
  actif: true,
  note: "",
};

function fmtMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(v);
}

function fmtQty(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "0";
  return new Intl.NumberFormat("fr-CA", {
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toNullableText(v: string) {
  const t = v.trim();
  return t === "" ? null : t;
}

function toNullableNumber(v: string) {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toNumberOrZero(v: string) {
  const t = v.trim().replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function isMissingRelation(error: unknown) {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    msg.includes("not found")
  );
}

export default function Inventaire() {
  const [items, setItems] = useState<InventaireItem[]>([]);
  const [categoriesOptions, setCategoriesOptions] = useState<PieceCategorieRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"actifs" | "inactifs" | "tous">("actifs");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [selectedItem, setSelectedItem] = useState<InventaireItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("infos");

  const [history, setHistory] = useState<CoutHistorique[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [installHistory, setInstallHistory] = useState<InstallationHistorique[]>([]);
  const [installHistoryLoading, setInstallHistoryLoading] = useState(false);

  const [supersedRows, setSupersedRows] = useState<SupersedRow[]>([]);
  const [supersedLoading, setSupersedLoading] = useState(false);

  const [menuOpen, setMenuOpen] = useState<MenuState | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  async function loadItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventaire_items")
      .select("*")
      .order("nom", { ascending: true });

    if (error) {
      console.error(error);
      alert("Erreur lors du chargement de l’inventaire.");
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as InventaireItem[]);
    setLoading(false);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("pieces_categories")
      .select("id,nom,ordre,actif,created_at")
      .eq("actif", true)
      .order("ordre", { ascending: true })
      .order("nom", { ascending: true });

    if (error) {
      console.error(error);

      if (!isMissingRelation(error)) {
        alert("Erreur lors du chargement des catégories de pièces.");
      }

      setCategoriesOptions([]);
      return;
    }

    setCategoriesOptions((data ?? []) as PieceCategorieRow[]);
  }

  async function loadHistory(itemId: string) {
    setHistoryLoading(true);

    const { data, error } = await supabase
      .from("inventaire_couts_historique")
      .select("*")
      .eq("item_id", itemId)
      .order("date_effective", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      if (!isMissingRelation(error)) {
        alert("Erreur lors du chargement de l’historique des coûts.");
      }

      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    setHistory((data ?? []) as CoutHistorique[]);
    setHistoryLoading(false);
  }

  async function loadInstallHistory(itemId: string) {
    setInstallHistoryLoading(true);

    const { data, error } = await supabase
      .from("inventaire_installations")
      .select("id,item_id,bt_id,bt_numero,unite,quantite,installed_at")
      .eq("item_id", itemId)
      .order("installed_at", { ascending: false });

    if (error) {
      console.error(error);

      if (!isMissingRelation(error)) {
        alert("Erreur lors du chargement de l’historique d’installation.");
      }

      setInstallHistory([]);
      setInstallHistoryLoading(false);
      return;
    }

    setInstallHistory((data ?? []) as InstallationHistorique[]);
    setInstallHistoryLoading(false);
  }

  async function loadSupersed(itemId: string) {
    setSupersedLoading(true);

    const { data, error } = await supabase
      .from("inventaire_supersedes")
      .select("id,item_id,sku_remplacement,nom_remplacement,note,actif,created_at")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);

      if (!isMissingRelation(error)) {
        alert("Erreur lors du chargement des supersed.");
      }

      setSupersedRows([]);
      setSupersedLoading(false);
      return;
    }

    setSupersedRows((data ?? []) as SupersedRow[]);
    setSupersedLoading(false);
  }

  useEffect(() => {
    loadItems();
    loadCategories();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);

    return () => window.clearTimeout(t);
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter === "actifs" && !item.actif) return false;
      if (statusFilter === "inactifs" && item.actif) return false;

      if (showLowStockOnly && !(Number(item.quantite ?? 0) <= Number(item.seuil_alerte ?? 0))) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        item.sku ?? "",
        item.nom ?? "",
        item.categorie ?? "",
        item.unite ?? "",
        item.emplacement ?? "",
        item.note ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, search, showLowStockOnly, statusFilter]);

  const stats = useMemo(() => {
    const lowStock = items.filter(
      (x) => Number(x.quantite ?? 0) <= Number(x.seuil_alerte ?? 0)
    ).length;

    return {
      lowStock,
      total: items.length,
    };
  }, [items]);

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
  }

  function closeDetails() {
    setDetailsOpen(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(item: InventaireItem) {
    setForm({
      id: item.id,
      sku: item.sku ?? "",
      nom: item.nom ?? "",
      categorie: item.categorie ?? "",
      quantite: String(item.quantite ?? 0),
      unite: item.unite ?? "",
      cout_unitaire: item.cout_unitaire == null ? "" : String(item.cout_unitaire),
      seuil_alerte: String(item.seuil_alerte ?? 0),
      emplacement: item.emplacement ?? "",
      actif: !!item.actif,
      note: item.note ?? "",
    });
    setFormOpen(true);
  }

  async function openDetails(item: InventaireItem) {
    setSelectedItem(item);
    setDetailsTab("infos");
    setDetailsOpen(true);
    setMenuOpen(null);

    await Promise.all([
      loadHistory(item.id),
      loadInstallHistory(item.id),
      loadSupersed(item.id),
    ]);
  }

  function openEditFromDetails() {
    if (!selectedItem) return;
    openEdit(selectedItem);
  }

  function openActionMenu(e: React.MouseEvent<HTMLButtonElement>, itemId: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    if (menuOpen?.id === itemId) {
      setMenuOpen(null);
      return;
    }

    setMenuOpen({
      id: itemId,
      x: rect.right,
      y: rect.bottom,
    });
  }

  function getMenuItem() {
    if (!menuOpen) return null;
    return items.find((i) => i.id === menuOpen.id) ?? null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nom = form.nom.trim();
    if (!nom) {
      alert("Le nom est obligatoire.");
      return;
    }

    const payload = {
      sku: toNullableText(form.sku),
      nom,
      categorie: toNullableText(form.categorie),
      quantite: toNumberOrZero(form.quantite),
      unite: toNullableText(form.unite),
      cout_unitaire: toNullableNumber(form.cout_unitaire),
      seuil_alerte: toNumberOrZero(form.seuil_alerte),
      emplacement: toNullableText(form.emplacement),
      actif: !!form.actif,
      note: toNullableText(form.note),
    };

    setSaving(true);

    if (form.id) {
      const { error } = await supabase
        .from("inventaire_items")
        .update(payload)
        .eq("id", form.id);

      if (error) {
        console.error(error);
        alert("Erreur lors de la modification.");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("inventaire_items").insert(payload);

      if (error) {
        console.error(error);
        alert("Erreur lors de la création.");
        setSaving(false);
        return;
      }
    }

    const editedId = form.id;

    setSaving(false);
    setFormOpen(false);
    await loadItems();

    if (editedId) {
      const updated = await supabase
        .from("inventaire_items")
        .select("*")
        .eq("id", editedId)
        .single();

      if (!updated.error && updated.data) {
        setSelectedItem(updated.data as InventaireItem);

        if (detailsOpen) {
          await Promise.all([
            loadHistory(editedId),
            loadInstallHistory(editedId),
            loadSupersed(editedId),
          ]);
        }
      }
    }
  }

  async function toggleActif(item: InventaireItem) {
    const next = !item.actif;

    const { error } = await supabase
      .from("inventaire_items")
      .update({ actif: next })
      .eq("id", item.id);

    if (error) {
      console.error(error);
      alert("Erreur lors du changement de statut.");
      return;
    }

    await loadItems();
    setMenuOpen(null);

    if (selectedItem?.id === item.id) {
      setSelectedItem({ ...item, actif: next });
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;

    const q = search.trim().toLowerCase();
    if (!q) return;

    const exact = filteredItems.filter((item) => {
      const sku = (item.sku ?? "").trim().toLowerCase();
      const nom = (item.nom ?? "").trim().toLowerCase();
      return sku === q || nom === q;
    });

    if (exact.length === 1) {
      e.preventDefault();
      openDetails(exact[0]);
    }
  }

  const menuItem = getMenuItem();

  return (
    <div style={pageWrap}>
      <div style={headerRow}>
        <div>
          <h1 style={title}>Inventaire</h1>
          <div style={subtitle}>Gestion des pièces et du stock courant</div>
        </div>

        <div style={headerActions}>
          <div style={lowStockPill}>
            <span style={lowStockDot} />
            <span>Stock bas : {stats.lowStock}</span>
          </div>

          <button type="button" onClick={openCreate} style={btnPrimary}>
            + Nouvelle pièce
          </button>
        </div>
      </div>

      <div style={toolbar}>
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Scanner ou rechercher par SKU, nom, catégorie, unité, emplacement..."
          style={{ ...input, minWidth: 320, flex: 1 }}
          autoComplete="off"
          spellCheck={false}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "actifs" | "inactifs" | "tous")}
          style={input}
        >
          <option value="actifs">Actifs seulement</option>
          <option value="inactifs">Inactifs seulement</option>
          <option value="tous">Tous</option>
        </select>

        <label style={checkboxWrap}>
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
          />
          <span>Stock bas seulement</span>
        </label>
      </div>

      <div style={scanHintBox}>
        Lecteur code-barres compatible clavier : clique dans la recherche, scanne le SKU, puis
        appuie sur Entrée. Si une seule pièce correspond, elle s’ouvre automatiquement.
      </div>

      <div style={panel}>
        <div style={panelTitle}>Liste des pièces</div>

        {loading ? (
          <div style={emptyBox}>Chargement...</div>
        ) : filteredItems.length === 0 ? (
          <div style={emptyBox}>Aucune pièce trouvée.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>SKU</th>
                  <th style={th}>Nom</th>
                  <th style={th}>Catégorie</th>
                  <th style={thRight}>Stock</th>
                  <th style={th}>Unité</th>
                  <th style={thRight}>Coût</th>
                  <th style={thRight}>Seuil</th>
                  <th style={th}>Emplacement</th>
                  <th style={th}>Statut</th>
                  <th style={thActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isLow = Number(item.quantite ?? 0) <= Number(item.seuil_alerte ?? 0);

                  return (
                    <tr key={item.id} style={isLow ? rowLowStock : undefined}>
                      <td style={td}>{item.sku || "—"}</td>
                      <td style={tdStrong}>{item.nom}</td>
                      <td style={td}>{item.categorie || "—"}</td>
                      <td style={tdRight}>{fmtQty(item.quantite)}</td>
                      <td style={td}>{item.unite || "—"}</td>
                      <td style={tdRight}>{fmtMoney(item.cout_unitaire)}</td>
                      <td style={tdRight}>{fmtQty(item.seuil_alerte)}</td>
                      <td style={td}>{item.emplacement || "—"}</td>
                      <td style={td}>
                        <span style={item.actif ? badgeActive : badgeInactive}>
                          {item.actif ? "Actif" : "Inactif"}
                        </span>
                        {isLow && <span style={badgeLow}>Stock bas</span>}
                      </td>
                      <td style={td}>
                        <div style={actionMenuWrap}>
                          <button
                            type="button"
                            style={btnDots}
                            onClick={(e) => openActionMenu(e, item.id)}
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
        )}
      </div>

      {menuOpen && menuItem && (
        <>
          <div style={menuBackdrop} onClick={() => setMenuOpen(null)} />
          <div
            style={{
              ...dropdownMenuFixed,
              top: menuOpen.y + 6,
              left: Math.max(12, menuOpen.x - 180),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" style={dropdownItem} onClick={() => openDetails(menuItem)}>
              Ouvrir
            </button>

            <button
              type="button"
              style={dropdownItem}
              onClick={() => {
                setMenuOpen(null);
                openEdit(menuItem);
              }}
            >
              Modifier
            </button>

            <button
              type="button"
              style={dropdownItemDanger}
              onClick={() => toggleActif(menuItem)}
            >
              {menuItem.actif ? "Désactiver" : "Réactiver"}
            </button>
          </div>
        </>
      )}

      {detailsOpen && selectedItem && (
        <div style={modalBackdrop}>
          <div style={detailsModalCard}>
            <div style={modalHeader}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{selectedItem.nom}</div>
                <div style={{ opacity: 0.65, marginTop: 4 }}>
                  Détail de la pièce, historique et supersed
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" style={btnClose} onClick={closeDetails}>
                  ×
                </button>
              </div>
            </div>

            <div style={detailTabsBar}>
              <button
                type="button"
                style={detailsTab === "infos" ? detailTabBtnActive : detailTabBtn}
                onClick={() => setDetailsTab("infos")}
              >
                Infos
              </button>

              <button
                type="button"
                style={detailsTab === "couts" ? detailTabBtnActive : detailTabBtn}
                onClick={() => setDetailsTab("couts")}
              >
                Historique des coûts
              </button>

              <button
                type="button"
                style={detailsTab === "installations" ? detailTabBtnActive : detailTabBtn}
                onClick={() => setDetailsTab("installations")}
              >
                Historique d’installation
              </button>

              <button
                type="button"
                style={detailsTab === "supersed" ? detailTabBtnActive : detailTabBtn}
                onClick={() => setDetailsTab("supersed")}
              >
                Supersed
              </button>
            </div>

            <div style={detailsBody}>
              {detailsTab === "infos" && (
                <>
                  <div style={detailGrid}>
                    <div>
                      <div style={detailLabel}>Nom</div>
                      <div style={detailValue}>{selectedItem.nom}</div>
                    </div>
                    <div>
                      <div style={detailLabel}>SKU</div>
                      <div style={detailValue}>{selectedItem.sku || "—"}</div>
                    </div>
                    <div>
                      <div style={detailLabel}>Catégorie</div>
                      <div style={detailValue}>{selectedItem.categorie || "—"}</div>
                    </div>
                    <div>
                      <div style={detailLabel}>Stock</div>
                      <div style={detailValue}>
                        {fmtQty(selectedItem.quantite)} {selectedItem.unite || ""}
                      </div>
                    </div>
                    <div>
                      <div style={detailLabel}>Coût courant</div>
                      <div style={detailValue}>{fmtMoney(selectedItem.cout_unitaire)}</div>
                    </div>
                    <div>
                      <div style={detailLabel}>Seuil alerte</div>
                      <div style={detailValue}>{fmtQty(selectedItem.seuil_alerte)}</div>
                    </div>
                    <div>
                      <div style={detailLabel}>Emplacement</div>
                      <div style={detailValue}>{selectedItem.emplacement || "—"}</div>
                    </div>
                    <div>
                      <div style={detailLabel}>Statut</div>
                      <div style={detailValue}>{selectedItem.actif ? "Actif" : "Inactif"}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={detailLabel}>Note</div>
                    <div style={noteBox}>{selectedItem.note || "—"}</div>
                  </div>
                </>
              )}

              {detailsTab === "couts" && (
                <>
                  {historyLoading ? (
                    <div style={emptyBox}>Chargement de l’historique...</div>
                  ) : history.length === 0 ? (
                    <div style={emptyBox}>Aucun historique trouvé.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={th}>Date</th>
                            <th style={thRight}>Coût</th>
                            <th style={th}>Fournisseur</th>
                            <th style={th}>No facture</th>
                            <th style={th}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.id}>
                              <td style={td}>{fmtDateTime(h.date_effective)}</td>
                              <td style={tdRight}>{fmtMoney(h.cout_unitaire)}</td>
                              <td style={td}>{h.fournisseur || "—"}</td>
                              <td style={td}>{h.numero_facture || "—"}</td>
                              <td style={td}>{h.note || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {detailsTab === "installations" && (
                <>
                  {installHistoryLoading ? (
                    <div style={emptyBox}>Chargement de l’historique d’installation...</div>
                  ) : installHistory.length === 0 ? (
                    <div style={emptyBox}>
                      Aucun historique d’installation trouvé pour cette pièce.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={th}>Date</th>
                            <th style={th}>Unité</th>
                            <th style={th}>BT</th>
                            <th style={thRight}>Qté</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installHistory.map((row) => (
                            <tr key={row.id}>
                              <td style={td}>{fmtDateTime(row.installed_at)}</td>
                              <td style={td}>{row.unite || "—"}</td>
                              <td style={td}>{row.bt_numero || "—"}</td>
                              <td style={tdRight}>{fmtQty(row.quantite)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {detailsTab === "supersed" && (
                <>
                  <div style={tabIntroText}>
                    Remplacements / numéros remplacés pour cette pièce.
                  </div>

                  {supersedLoading ? (
                    <div style={emptyBox}>Chargement des supersed...</div>
                  ) : supersedRows.length === 0 ? (
                    <div style={emptyBox}>Aucun supersed défini pour cette pièce.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={th}>SKU remplacement</th>
                            <th style={th}>Nom remplacement</th>
                            <th style={th}>Statut</th>
                            <th style={th}>Note</th>
                            <th style={th}>Ajouté le</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supersedRows.map((row) => (
                            <tr key={row.id}>
                              <td style={td}>{row.sku_remplacement || "—"}</td>
                              <td style={td}>{row.nom_remplacement || "—"}</td>
                              <td style={td}>
                                <span style={row.actif ? badgeActive : badgeInactive}>
                                  {row.actif ? "Actif" : "Inactif"}
                                </span>
                              </td>
                              <td style={td}>{row.note || "—"}</td>
                              <td style={td}>{fmtDateTime(row.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={modalFooter}>
              <button type="button" style={btnPrimary} onClick={openEditFromDetails}>
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div style={modalBackdrop}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {form.id ? "Modifier la pièce" : "Nouvelle pièce"}
              </div>
              <button type="button" style={btnClose} onClick={closeForm}>
                ×
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div style={formGrid}>
                <div>
                  <label style={label}>SKU</label>
                  <input
                    style={input}
                    value={form.sku}
                    onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Compatible scan code-barres"
                  />
                </div>

                <div>
                  <label style={label}>Nom *</label>
                  <input
                    style={input}
                    value={form.nom}
                    onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label style={label}>Catégorie</label>
                  <select
                    style={input}
                    value={form.categorie}
                    onChange={(e) => setForm((p) => ({ ...p, categorie: e.target.value }))}
                  >
                    <option value="">— Sélectionner —</option>
                    {categoriesOptions.map((cat) => (
                      <option key={cat.id} value={cat.nom}>
                        {cat.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={label}>Unité</label>
                  <input
                    style={input}
                    value={form.unite}
                    onChange={(e) => setForm((p) => ({ ...p, unite: e.target.value }))}
                    placeholder="Ex.: UN, L, FT, Boîte..."
                  />
                </div>

                <div>
                  <label style={label}>Quantité en stock</label>
                  <input
                    style={input}
                    value={form.quantite}
                    onChange={(e) => setForm((p) => ({ ...p, quantite: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label style={label}>Coût unitaire</label>
                  <input
                    style={input}
                    value={form.cout_unitaire}
                    onChange={(e) => setForm((p) => ({ ...p, cout_unitaire: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label style={label}>Seuil alerte</label>
                  <input
                    style={input}
                    value={form.seuil_alerte}
                    onChange={(e) => setForm((p) => ({ ...p, seuil_alerte: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label style={label}>Emplacement</label>
                  <input
                    style={input}
                    value={form.emplacement}
                    onChange={(e) => setForm((p) => ({ ...p, emplacement: e.target.value }))}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={label}>Note</label>
                  <textarea
                    style={{ ...input, minHeight: 90, resize: "vertical" }}
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={form.actif}
                      onChange={(e) => setForm((p) => ({ ...p, actif: e.target.checked }))}
                    />
                    <span>Pièce active</span>
                  </label>
                </div>
              </div>

              <div style={modalFooter}>
                <button type="button" style={btnDanger} onClick={closeForm}>
                  Annuler
                </button>
                <button type="submit" style={btnPrimary} disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Styles
========================= */

const pageWrap: React.CSSProperties = {
  padding: 20,
  display: "grid",
  gap: 14,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 800,
};

const subtitle: React.CSSProperties = {
  opacity: 0.75,
  marginTop: 4,
};

const lowStockPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #fcd34d",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 800,
};

const lowStockDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#f59e0b",
  display: "inline-block",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const scanHintBox: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 600,
};

const panel: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  overflow: "visible",
};

const panelTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 18,
  marginBottom: 12,
};

const emptyBox: React.CSSProperties = {
  padding: 18,
  border: "1px dashed #d1d5db",
  borderRadius: 12,
  color: "#6b7280",
  background: "#fafafa",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontWeight: 700,
  background: "#fafafa",
};

const thRight: React.CSSProperties = {
  ...th,
  textAlign: "right",
};

const thActions: React.CSSProperties = {
  ...th,
  width: 90,
  textAlign: "center",
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};

const tdStrong: React.CSSProperties = {
  ...td,
  fontWeight: 700,
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const rowLowStock: React.CSSProperties = {
  background: "#fff8e1",
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  marginRight: 6,
};

const badgeActive: React.CSSProperties = {
  ...badgeBase,
  background: "#dcfce7",
  color: "#166534",
};

const badgeInactive: React.CSSProperties = {
  ...badgeBase,
  background: "#f3f4f6",
  color: "#374151",
};

const badgeLow: React.CSSProperties = {
  ...badgeBase,
  background: "#fef3c7",
  color: "#92400e",
};

const actionMenuWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const btnDots: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "6px 12px",
  fontWeight: 800,
  cursor: "pointer",
  minWidth: 42,
};

const menuBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "transparent",
  zIndex: 99998,
};

const dropdownMenuFixed: React.CSSProperties = {
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
};

const dropdownItem: React.CSSProperties = {
  border: "none",
  background: "#fff",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const dropdownItemDanger: React.CSSProperties = {
  ...dropdownItem,
  color: "#991b1b",
};

const detailGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  opacity: 0.65,
  marginBottom: 4,
  fontWeight: 700,
};

const detailValue: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
};

const noteBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  minHeight: 56,
  background: "#fafafa",
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 700,
  fontSize: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  background: "#fff",
  boxSizing: "border-box",
};

const checkboxWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
};

const btnBase: React.CSSProperties = {
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid transparent",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#2563eb",
  color: "#fff",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "#dc2626",
  color: "#fff",
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalCard: React.CSSProperties = {
  width: "min(900px, 100%)",
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const detailsModalCard: React.CSSProperties = {
  width: "min(1100px, 100%)",
  maxHeight: "90vh",
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const detailsBody: React.CSSProperties = {
  padding: 18,
  overflowY: "auto",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 18px",
  borderBottom: "1px solid #e5e7eb",
  gap: 12,
};

const detailTabsBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "12px 18px 0 18px",
  flexWrap: "wrap",
};

const detailTabBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const detailTabBtnActive: React.CSSProperties = {
  ...detailTabBtn,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
};

const tabIntroText: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#4b5563",
  marginBottom: 12,
};

const btnClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  padding: 18,
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: "0 18px 18px 18px",
};