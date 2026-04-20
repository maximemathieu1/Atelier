import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useBarcodeLabels } from "../hooks/useBarcodeLabels";

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
type SortKey =
  | "sku"
  | "nom"
  | "categorie"
  | "quantite"
  | "unite"
  | "cout_unitaire"
  | "seuil_alerte"
  | "emplacement"
  | "statut";
type SortDir = "asc" | "desc";

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
  const { openPrintBarcode } = useBarcodeLabels();

  const [items, setItems] = useState<InventaireItem[]>([]);
  const [categoriesOptions, setCategoriesOptions] = useState<PieceCategorieRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"actifs" | "inactifs" | "tous">("actifs");

  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function getSortValue(item: InventaireItem, key: SortKey) {
    switch (key) {
      case "sku":
        return item.sku ?? "";
      case "nom":
        return item.nom ?? "";
      case "categorie":
        return item.categorie ?? "";
      case "quantite":
        return Number(item.quantite ?? 0);
      case "unite":
        return item.unite ?? "";
      case "cout_unitaire":
        return Number(item.cout_unitaire ?? 0);
      case "seuil_alerte":
        return Number(item.seuil_alerte ?? 0);
      case "emplacement":
        return item.emplacement ?? "";
      case "statut":
        return item.actif ? "actif" : "inactif";
      default:
        return "";
    }
  }

  const filteredSortedItems = useMemo(() => {
    const copy = [...filteredItems];

    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "fr", {
            numeric: true,
            sensitivity: "base",
          })
        : String(bv).localeCompare(String(av), "fr", {
            numeric: true,
            sensitivity: "base",
          });
    });

    return copy;
  }, [filteredItems, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, showLowStockOnly, statusFilter, sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedItems.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSortedItems.slice(start, start + pageSize);
  }, [filteredSortedItems, page, pageSize]);

  const stats = useMemo(() => {
    const lowStock = items.filter(
      (x) => Number(x.quantite ?? 0) <= Number(x.seuil_alerte ?? 0)
    ).length;

    return {
      lowStock,
      total: items.length,
    };
  }, [items]);

  const totalRows = filteredSortedItems.length;
  const currentPage = page;
  const fromRow = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toRow = Math.min(currentPage * pageSize, totalRows);

  function setCurrentPage(next: number) {
    setPage(next);
  }

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

    const exact = filteredSortedItems.filter((item) => {
      const sku = (item.sku ?? "").trim().toLowerCase();
      const nom = (item.nom ?? "").trim().toLowerCase();
      return sku === q || nom === q;
    });

    if (exact.length === 1) {
      e.preventDefault();
      openDetails(exact[0]);
    }
  }

  function renderSortArrow(key: SortKey) {
    if (sortKey !== key) return <span style={{ opacity: 0.35 }}>↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
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
          <button type="button" onClick={openCreate} style={btnPrimary}>
            + Nouvelle pièce
          </button>
        </div>
      </div>

      <div style={toolbarCard}>
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Scanner ou rechercher par SKU, nom, catégorie, unité, emplacement..."
          style={inventorySearchInput}
          autoComplete="off"
          spellCheck={false}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "actifs" | "inactifs" | "tous")}
          style={inventorySelect}
        >
          <option value="actifs">Actifs seulement</option>
          <option value="inactifs">Inactifs seulement</option>
          <option value="tous">Tous</option>
        </select>

        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={inventorySelect}
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        <div style={toolbarRight}>
          <label style={inventoryCheckboxWrap}>
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
            />
            <span>Stock bas seulement</span>
            <span style={lowStockInlineCount}>{stats.lowStock}</span>
          </label>

          <div style={resultsText}>
            {filteredSortedItems.length} résultat{filteredSortedItems.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div style={panel}>
        {loading ? (
          <div style={emptyBox}>Chargement...</div>
        ) : filteredSortedItems.length === 0 ? (
          <div style={emptyBox}>Aucune pièce trouvée.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("sku")}>
                      <span style={sortHeadInner}>SKU {renderSortArrow("sku")}</span>
                    </th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nom")}>
                      <span style={sortHeadInner}>Nom {renderSortArrow("nom")}</span>
                    </th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("categorie")}>
                      <span style={sortHeadInner}>Catégorie {renderSortArrow("categorie")}</span>
                    </th>
                    <th
                      style={{ ...thRight, cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("quantite")}
                    >
                      <span style={sortHeadInnerRight}>Stock {renderSortArrow("quantite")}</span>
                    </th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("unite")}>
                      <span style={sortHeadInner}>Unité {renderSortArrow("unite")}</span>
                    </th>
                    <th
                      style={{ ...thRight, cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("cout_unitaire")}
                    >
                      <span style={sortHeadInnerRight}>Coût {renderSortArrow("cout_unitaire")}</span>
                    </th>
                    <th
                      style={{ ...thRight, cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("seuil_alerte")}
                    >
                      <span style={sortHeadInnerRight}>Seuil {renderSortArrow("seuil_alerte")}</span>
                    </th>
                    <th
                      style={{ ...th, cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("emplacement")}
                    >
                      <span style={sortHeadInner}>Emplacement {renderSortArrow("emplacement")}</span>
                    </th>
                    <th style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("statut")}>
                      <span style={sortHeadInner}>Statut {renderSortArrow("statut")}</span>
                    </th>
                    <th style={thActions}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((item, index) => {
                    const isLow =
                      Number(item.quantite ?? 0) <= Number(item.seuil_alerte ?? 0);

                    const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                    const bg = isLow ? "#fff8e1" : rowBg;

                    return (
                      <tr key={item.id} style={{ background: bg }}>
                        <td style={{ ...td, background: bg }}>{item.sku || "—"}</td>
                        <td style={{ ...td, background: bg }}>{item.nom}</td>
                        <td style={{ ...td, background: bg }}>{item.categorie || "—"}</td>
                        <td style={{ ...tdRight, background: bg }}>{fmtQty(item.quantite)}</td>
                        <td style={{ ...td, background: bg }}>{item.unite || "—"}</td>
                        <td style={{ ...tdRight, background: bg }}>{fmtMoney(item.cout_unitaire)}</td>
                        <td style={{ ...tdRight, background: bg }}>{fmtQty(item.seuil_alerte)}</td>
                        <td style={{ ...td, background: bg }}>{item.emplacement || "—"}</td>

                        <td style={{ ...td, background: bg }}>
                          <span style={item.actif ? badgeActive : badgeInactive}>
                            {item.actif ? "Actif" : "Inactif"}
                          </span>
                          {isLow && <span style={badgeLow}>Stock bas</span>}
                        </td>

                        <td style={{ ...td, background: bg }}>
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

            <div style={pagerWrap}>
              <div style={pagerLeft}>
                <span style={resultsText}>
                  Affichage {fromRow} à {toRow} sur {totalRows}
                </span>
              </div>

              <div style={pagerRight}>
                <button
                  type="button"
                  style={currentPage <= 1 ? btnPagerInactive : btnPagerGhost}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                >
                  « Première
                </button>

                <button
                  type="button"
                  style={currentPage <= 1 ? btnPagerInactive : btnPagerGhost}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  ‹ Précédente
                </button>

                <button type="button" style={btnPagerActive}>
                  Page {currentPage} / {totalPages}
                </button>

                <button
                  type="button"
                  style={currentPage >= totalPages ? btnPagerInactive : btnPagerGhost}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                >
                  Suivante ›
                </button>

                <button
                  type="button"
                  style={currentPage >= totalPages ? btnPagerInactive : btnPagerGhost}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  Dernière »
                </button>
              </div>
            </div>
          </>
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
              style={dropdownItem}
              onClick={() => {
                openPrintBarcode(menuItem);
                setMenuOpen(null);
              }}
            >
              Code-barres
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
                          {history.map((h, index) => {
                            const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                            return (
                              <tr key={h.id} style={{ background: rowBg }}>
                                <td style={{ ...td, background: rowBg }}>{fmtDateTime(h.date_effective)}</td>
                                <td style={{ ...tdRight, background: rowBg }}>{fmtMoney(h.cout_unitaire)}</td>
                                <td style={{ ...td, background: rowBg }}>{h.fournisseur || "—"}</td>
                                <td style={{ ...td, background: rowBg }}>{h.numero_facture || "—"}</td>
                                <td style={{ ...td, background: rowBg }}>{h.note || "—"}</td>
                              </tr>
                            );
                          })}
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
                          {installHistory.map((row, index) => {
                            const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                            return (
                              <tr key={row.id} style={{ background: rowBg }}>
                                <td style={{ ...td, background: rowBg }}>{fmtDateTime(row.installed_at)}</td>
                                <td style={{ ...td, background: rowBg }}>{row.unite || "—"}</td>
                                <td style={{ ...td, background: rowBg }}>{row.bt_numero || "—"}</td>
                                <td style={{ ...tdRight, background: rowBg }}>{fmtQty(row.quantite)}</td>
                              </tr>
                            );
                          })}
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
                          {supersedRows.map((row, index) => {
                            const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                            return (
                              <tr key={row.id} style={{ background: rowBg }}>
                                <td style={{ ...td, background: rowBg }}>{row.sku_remplacement || "—"}</td>
                                <td style={{ ...td, background: rowBg }}>{row.nom_remplacement || "—"}</td>
                                <td style={{ ...td, background: rowBg }}>
                                  <span style={row.actif ? badgeActive : badgeInactive}>
                                    {row.actif ? "Actif" : "Inactif"}
                                  </span>
                                </td>
                                <td style={{ ...td, background: rowBg }}>{row.note || "—"}</td>
                                <td style={{ ...td, background: rowBg }}>{fmtDateTime(row.created_at)}</td>
                              </tr>
                            );
                          })}
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
                    style={inputClassic}
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
                    style={inputClassic}
                    value={form.nom}
                    onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label style={label}>Catégorie</label>
                  <select
                    style={inputClassic}
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
                    style={inputClassic}
                    value={form.unite}
                    onChange={(e) => setForm((p) => ({ ...p, unite: e.target.value }))}
                    placeholder="Ex.: UN, L, FT, Boîte..."
                  />
                </div>

                <div>
                  <label style={label}>Quantité en stock</label>
                  <input
                    style={inputClassic}
                    value={form.quantite}
                    onChange={(e) => setForm((p) => ({ ...p, quantite: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label style={label}>Coût unitaire</label>
                  <input
                    style={inputClassic}
                    value={form.cout_unitaire}
                    onChange={(e) => setForm((p) => ({ ...p, cout_unitaire: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label style={label}>Seuil alerte</label>
                  <input
                    style={inputClassic}
                    value={form.seuil_alerte}
                    onChange={(e) => setForm((p) => ({ ...p, seuil_alerte: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label style={label}>Emplacement</label>
                  <input
                    style={inputClassic}
                    value={form.emplacement}
                    onChange={(e) => setForm((p) => ({ ...p, emplacement: e.target.value }))}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={label}>Note</label>
                  <textarea
                    style={{ ...inputClassic, minHeight: 90, resize: "vertical" }}
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
  background: "#f5f7fb",
  minHeight: "100%",
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
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.02em",
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 4,
  fontSize: 14,
  fontWeight: 600,
};

const toolbarCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  marginBottom: 14,
  boxShadow: "0 10px 24px rgba(15,23,42,.04)",
};

const toolbarRight: React.CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const inventorySearchInput: React.CSSProperties = {
  height: 44,
  borderRadius: 14,
  border: "1px solid #d6dbe7",
  background: "#fff",
  padding: "0 14px",
  fontSize: 14,
  color: "#0f172a",
  outline: "none",
  minWidth: 280,
  flex: 1,
  boxSizing: "border-box",
};

const inventorySelect: React.CSSProperties = {
  height: 44,
  borderRadius: 14,
  border: "1px solid #d6dbe7",
  background: "#fff",
  padding: "0 12px",
  fontSize: 14,
  color: "#0f172a",
  outline: "none",
  minWidth: 160,
  boxSizing: "border-box",
};

const inventoryCheckboxWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  color: "#0f172a",
  whiteSpace: "nowrap",
};

const lowStockInlineCount: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 24,
  height: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
};

const panel: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#fff",
  overflow: "hidden",
  boxShadow: "0 10px 24px rgba(15,23,42,.04)",
};

const emptyBox: React.CSSProperties = {
  padding: 18,
  margin: 14,
  border: "1px dashed #d1d5db",
  borderRadius: 12,
  color: "#6b7280",
  background: "#fafafa",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 14,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  fontWeight: 900,
  background: "#f8fafc",
  color: "#0f172a",
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

const sortHeadInner: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const sortHeadInnerRight: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "flex-end",
  width: "100%",
};

const td: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top",
  fontWeight: 400,
  color: "#0f172a",
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
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

const inputClassic: React.CSSProperties = {
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
  color: "#0f172a",
};

const btnBase: React.CSSProperties = {
  borderRadius: 14,
  padding: "10px 16px",
  fontWeight: 800,
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

const resultsText: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const pagerWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  marginTop: 0,
  padding: 16,
  borderTop: "1px solid #e2e8f0",
  background: "#fff",
};

const pagerLeft: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const pagerRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const btnPagerGhost: React.CSSProperties = {
  borderRadius: 10,
  padding: "8px 12px",
  border: "1px solid rgba(0,0,0,.14)",
  background: "#fff",
  color: "#111",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPagerInactive: React.CSSProperties = {
  ...btnPagerGhost,
  opacity: 0.5,
  cursor: "not-allowed",
  background: "#f3f4f6",
  color: "#9ca3af",
  border: "1px solid rgba(0,0,0,.08)",
};

const btnPagerActive: React.CSSProperties = {
  borderRadius: 10,
  padding: "8px 12px",
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
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