import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";

type TabKey = "unites" | "pieces" | "templates";

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

type EntretienTemplateRow = {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
  created_at?: string;
};

type EntretienTemplateItemRow = {
  id: string;
  template_id: string;
  ordre: number | null;
  nom: string | null;
  description: string | null;
  periodicite_km: number | null;
  periodicite_jours: number | null;
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

  const [templates, setTemplates] = useState<EntretienTemplateRow[]>([]);
  const [templateItems, setTemplateItems] = useState<EntretienTemplateItemRow[]>([]);

  const [openAdd, setOpenAdd] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [actif, setActif] = useState(true);

  const [openAddPiece, setOpenAddPiece] = useState(false);
  const [pieceNom, setPieceNom] = useState("");
  const [pieceActif, setPieceActif] = useState(true);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<"create" | "edit">("create");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateNom, setTemplateNom] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateActif, setTemplateActif] = useState(true);

  const [openAddTemplateItem, setOpenAddTemplateItem] = useState(false);
  const [templateItemNom, setTemplateItemNom] = useState("");
  const [templateItemDescription, setTemplateItemDescription] = useState("");
  const [templateItemPeriodiciteKm, setTemplateItemPeriodiciteKm] = useState("");
  const [templateItemPeriodiciteJours, setTemplateItemPeriodiciteJours] = useState("");
  const [templateItemActif, setTemplateItemActif] = useState(true);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuType, setMenuType] = useState<"unite" | "piece" | "template" | "template_item" | null>(
    null
  );

  const [editRow, setEditRow] = useState<OptionRow | null>(null);
  const [editLibelle, setEditLibelle] = useState("");

  const [editPieceRow, setEditPieceRow] = useState<PieceCategorieRow | null>(null);
  const [editPieceNom, setEditPieceNom] = useState("");

  const [editTemplateItemRow, setEditTemplateItemRow] = useState<EntretienTemplateItemRow | null>(
    null
  );
  const [editTemplateItemNom, setEditTemplateItemNom] = useState("");
  const [editTemplateItemDescription, setEditTemplateItemDescription] = useState("");
  const [editTemplateItemPeriodiciteKm, setEditTemplateItemPeriodiciteKm] = useState("");
  const [editTemplateItemPeriodiciteJours, setEditTemplateItemPeriodiciteJours] = useState("");
  const [editTemplateItemActif, setEditTemplateItemActif] = useState(true);

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

  const filteredTemplates = useMemo(() => {
    return [...templates].sort((a, b) =>
      String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" })
    );
  }, [templates]);



  const selectedTemplateItems = useMemo(() => {
    if (!selectedTemplateId) return [];
    return templateItems
      .filter((r) => r.template_id === selectedTemplateId)
      .sort((a, b) => {
        const ao = Number(a.ordre ?? 0);
        const bo = Number(b.ordre ?? 0);
        if (ao !== bo) return ao - bo;
        return String(a.nom || "").localeCompare(String(b.nom || ""), "fr", {
          sensitivity: "base",
        });
      });
  }, [templateItems, selectedTemplateId]);

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
      const [unitesRes, piecesRes, templatesRes, templateItemsRes] = await Promise.all([
        supabase
          .from("unite_options")
          .select("id,categorie,libelle,ordre,actif,created_at")
          .order("categorie", { ascending: true })
          .order("libelle", { ascending: true }),
        supabase
          .from("pieces_categories")
          .select("id,nom,ordre,actif,created_at")
          .order("nom", { ascending: true }),
        supabase
          .from("entretien_templates")
          .select("id,nom,description,actif,created_at")
          .order("nom", { ascending: true }),
        supabase
          .from("entretien_template_items")
          .select(
            "id,template_id,ordre,nom,description,periodicite_km,periodicite_jours,actif,created_at"
          )
          .order("template_id", { ascending: true })
          .order("ordre", { ascending: true })
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

      if (templatesRes.error) {
        const msg = String(templatesRes.error.message || "");
        const missingTable =
          msg.toLowerCase().includes("does not exist") ||
          msg.toLowerCase().includes("relation") ||
          msg.toLowerCase().includes("schema cache");
        if (missingTable) {
          setTemplates([]);
        } else {
          throw templatesRes.error;
        }
      } else {
        setTemplates((templatesRes.data as EntretienTemplateRow[]) ?? []);
      }

      if (templateItemsRes.error) {
        const msg = String(templateItemsRes.error.message || "");
        const missingTable =
          msg.toLowerCase().includes("does not exist") ||
          msg.toLowerCase().includes("relation") ||
          msg.toLowerCase().includes("schema cache");
        if (missingTable) {
          setTemplateItems([]);
        } else {
          throw templateItemsRes.error;
        }
      } else {
        setTemplateItems((templateItemsRes.data as EntretienTemplateItemRow[]) ?? []);
      }

      setRows((unitesRes.data as OptionRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setRows([]);
      setPieceCategories([]);
      setTemplates([]);
      setTemplateItems([]);
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

  async function loadTemplates() {
    setBusy(true);
    try {
      const [{ data: templatesData, error: templatesError }, { data: itemsData, error: itemsError }] =
        await Promise.all([
          supabase
            .from("entretien_templates")
            .select("id,nom,description,actif,created_at")
            .order("nom", { ascending: true }),
          supabase
            .from("entretien_template_items")
            .select(
              "id,template_id,ordre,nom,description,periodicite_km,periodicite_jours,actif,created_at"
            )
            .order("template_id", { ascending: true })
            .order("ordre", { ascending: true })
            .order("nom", { ascending: true }),
        ]);

      if (templatesError) throw templatesError;
      if (itemsError) throw itemsError;

      setTemplates((templatesData as EntretienTemplateRow[]) ?? []);
      setTemplateItems((itemsData as EntretienTemplateItemRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setTemplates([]);
      setTemplateItems([]);
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

  function resetTemplateForm() {
    setTemplateNom("");
    setTemplateDescription("");
    setTemplateActif(true);
  }

  function closeTemplateModal() {
    if (busy) return;
    setTemplateModalOpen(false);
    setTemplateModalMode("create");
    setSelectedTemplateId(null);
    resetTemplateForm();
    setMenuOpenId(null);
    setMenuType(null);
  }

  function closeAddTemplateItemModal() {
    if (busy) return;
    setOpenAddTemplateItem(false);
    setTemplateItemNom("");
    setTemplateItemDescription("");
    setTemplateItemPeriodiciteKm("");
    setTemplateItemPeriodiciteJours("");
    setTemplateItemActif(true);
  }

  function openCreateTemplateModal() {
    setMenuOpenId(null);
    setMenuType(null);
    setTemplateModalMode("create");
    setSelectedTemplateId(null);
    resetTemplateForm();
    setTemplateModalOpen(true);
  }

  function openEditTemplateModal(row: EntretienTemplateRow) {
    setMenuOpenId(null);
    setMenuType(null);
    setTemplateModalMode("edit");
    setSelectedTemplateId(row.id);
    setTemplateNom(row.nom ?? "");
    setTemplateDescription(row.description ?? "");
    setTemplateActif(Boolean(row.actif));
    setTemplateModalOpen(true);
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

  function openEditTemplateItemModal(row: EntretienTemplateItemRow) {
    setMenuOpenId(null);
    setMenuType(null);
    setEditTemplateItemRow(row);
    setEditTemplateItemNom(row.nom ?? "");
    setEditTemplateItemDescription(row.description ?? "");
    setEditTemplateItemPeriodiciteKm(
      row.periodicite_km == null ? "" : String(Number(row.periodicite_km))
    );
    setEditTemplateItemPeriodiciteJours(
      row.periodicite_jours == null ? "" : String(Number(row.periodicite_jours))
    );
    setEditTemplateItemActif(Boolean(row.actif));
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

  function closeEditTemplateItemModal() {
    if (busy) return;
    setEditTemplateItemRow(null);
    setEditTemplateItemNom("");
    setEditTemplateItemDescription("");
    setEditTemplateItemPeriodiciteKm("");
    setEditTemplateItemPeriodiciteJours("");
    setEditTemplateItemActif(true);
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
        existing.length > 0 ? Math.max(...existing.map((r) => Number(r.ordre ?? 0))) + 10 : 10;

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

  async function saveTemplate() {
    const nom = templateNom.trim();
    if (!nom || busy) return;

    setBusy(true);
    try {
      if (templateModalMode === "create") {
        const { data, error } = await supabase
          .from("entretien_templates")
          .insert({
            nom,
            description: templateDescription.trim() || null,
            actif: Boolean(templateActif),
          })
          .select("id")
          .single();

        if (error) throw error;

        await loadTemplates();

        if (data?.id) {
          setTemplateModalMode("edit");
          setSelectedTemplateId(data.id);
        }
      } else {
        if (!selectedTemplateId) return;

        const { error } = await supabase
          .from("entretien_templates")
          .update({
            nom,
            description: templateDescription.trim() || null,
            actif: Boolean(templateActif),
          })
          .eq("id", selectedTemplateId);

        if (error) throw error;

        await loadTemplates();
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addTemplateItem() {
    if (!selectedTemplateId || busy) return;

    const nom = templateItemNom.trim();
    if (!nom) return;

    const periodiciteKm =
      templateItemPeriodiciteKm.trim() === "" ? null : Number(templateItemPeriodiciteKm);
    const periodiciteJours =
      templateItemPeriodiciteJours.trim() === "" ? null : Number(templateItemPeriodiciteJours);

    if (periodiciteKm !== null && (!Number.isFinite(periodiciteKm) || periodiciteKm < 0)) {
      alert("La périodicité KM est invalide.");
      return;
    }

    if (periodiciteJours !== null && (!Number.isFinite(periodiciteJours) || periodiciteJours < 0)) {
      alert("La périodicité jours est invalide.");
      return;
    }

    setBusy(true);
    try {
      const existing = templateItems.filter((r) => r.template_id === selectedTemplateId);
      const nextOrdre =
        existing.length > 0 ? Math.max(...existing.map((r) => Number(r.ordre ?? 0))) + 10 : 10;

      const { error } = await supabase.from("entretien_template_items").insert({
        template_id: selectedTemplateId,
        ordre: nextOrdre,
        nom,
        description: templateItemDescription.trim() || null,
        periodicite_km: periodiciteKm,
        periodicite_jours: periodiciteJours,
        actif: Boolean(templateItemActif),
      });

      if (error) throw error;

      await loadTemplates();
      closeAddTemplateItemModal();
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

  async function saveEditTemplateItem() {
    if (!editTemplateItemRow || busy) return;

    const nom = editTemplateItemNom.trim();
    if (!nom) return;

    const periodiciteKm =
      editTemplateItemPeriodiciteKm.trim() === "" ? null : Number(editTemplateItemPeriodiciteKm);
    const periodiciteJours =
      editTemplateItemPeriodiciteJours.trim() === "" ? null : Number(editTemplateItemPeriodiciteJours);

    if (periodiciteKm !== null && (!Number.isFinite(periodiciteKm) || periodiciteKm < 0)) {
      alert("La périodicité KM est invalide.");
      return;
    }

    if (periodiciteJours !== null && (!Number.isFinite(periodiciteJours) || periodiciteJours < 0)) {
      alert("La périodicité jours est invalide.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("entretien_template_items")
        .update({
          nom,
          description: editTemplateItemDescription.trim() || null,
          periodicite_km: periodiciteKm,
          periodicite_jours: periodiciteJours,
          actif: Boolean(editTemplateItemActif),
        })
        .eq("id", editTemplateItemRow.id);

      if (error) throw error;

      await loadTemplates();
      closeEditTemplateItemModal();
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

  async function removeTemplateRow(id: string) {
    if (busy) return;
    setMenuOpenId(null);
    setMenuType(null);

    if (!confirm("Supprimer ce template d’entretien et toutes ses lignes ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("entretien_templates").delete().eq("id", id);
      if (error) throw error;
      await loadTemplates();

      if (selectedTemplateId === id) {
        closeTemplateModal();
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplateItemRow(id: string) {
    if (busy) return;
    setMenuOpenId(null);
    setMenuType(null);

    if (!confirm("Supprimer cette ligne d’entretien ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("entretien_template_items").delete().eq("id", id);
      if (error) throw error;
      await loadTemplates();
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
    textarea: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
      width: "100%",
      minHeight: 88,
      resize: "vertical",
      fontFamily: "inherit",
      fontSize: 14,
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
    modalCardLarge: {
      width: "100%",
      maxWidth: 1100,
      maxHeight: "88vh",
      background: "#fff",
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,.18)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
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
    modalBodyLarge: {
      padding: 16,
      display: "grid",
      gap: 14,
      overflowY: "auto",
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
    sectionBox: {
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      background: "#fff",
    } as CSSProperties,
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Configuration</div>
          <div style={{ color: "rgba(0,0,0,.6)" }}>
            Gère les paramètres utilisés par les unités, les pièces et les modèles d’entretien.
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

          <button
            type="button"
            style={styles.tabButton(tab === "templates")}
            onClick={() => {
              setTab("templates");
              setMenuOpenId(null);
              setMenuType(null);
            }}
          >
            Templates
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

      {tab === "templates" && (
        <>
          <div style={styles.card}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Templates d’entretien périodique</div>
                <div style={{ color: "rgba(0,0,0,.6)", marginTop: 4 }}>
                  Gère les modèles d’entretien périodique et leurs lignes de périodicité.
                </div>
              </div>

              <button type="button" style={styles.btnPrimary} onClick={openCreateTemplateModal}>
                Ajouter un template
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nom</th>
                    <th style={styles.th}>Description</th>
                    <th style={{ ...styles.th, width: 100 }}>Lignes</th>
                    <th style={{ ...styles.th, width: 120 }}>Statut</th>
                    <th style={{ ...styles.th, width: 90 }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={5}>
                        <span style={{ color: "rgba(0,0,0,.6)" }}>
                          Aucun template d’entretien.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredTemplates.map((tpl) => {
                      const count = templateItems.filter((i) => i.template_id === tpl.id).length;

                      return (
                        <tr key={tpl.id}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 700 }}>{tpl.nom || "—"}</div>
                          </td>

                          <td style={styles.td}>{tpl.description || "—"}</td>

                          <td style={styles.td}>{count}</td>

                          <td style={styles.td}>
                            <span style={tpl.actif ? styles.statusActive : styles.statusInactive}>
                              {tpl.actif ? "Actif" : "Inactif"}
                            </span>
                          </td>

                          <td style={styles.td}>
                            <div style={styles.menuWrap} data-menu-root="param-option">
                              <button
                                type="button"
                                style={styles.iconBtn}
                                onClick={() => {
                                  setMenuType("template");
                                  setMenuOpenId((cur) => (cur === tpl.id ? null : tpl.id));
                                }}
                                disabled={busy}
                              >
                                ...
                              </button>

                              {menuOpenId === tpl.id && menuType === "template" && (
                                <div style={styles.menu}>
                                  <button
                                    type="button"
                                    style={styles.menuItem}
                                    onClick={() => openEditTemplateModal(tpl)}
                                  >
                                    Ouvrir
                                  </button>

                                  <button
                                    type="button"
                                    style={{
                                      ...styles.menuItem,
                                      borderBottom: "none",
                                      color: "#b91c1c",
                                    }}
                                    onClick={() => removeTemplateRow(tpl.id)}
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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

      {templateModalOpen && (
        <div style={styles.modalBackdrop} onClick={closeTemplateModal}>
          <div style={styles.modalCardLarge} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>
                  {templateModalMode === "create" ? "Nouveau template" : templateNom || "Template"}
                </h3>
                <div style={{ color: "rgba(0,0,0,.6)", marginTop: 4 }}>
                  {templateModalMode === "create"
                    ? "Crée un nouveau modèle d’entretien périodique."
                    : "Modifie le template et gère ses lignes d’entretien."}
                </div>
              </div>

              <button type="button" style={styles.iconCloseBtn} onClick={closeTemplateModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBodyLarge}>
              <div style={styles.sectionBox}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                    <input
                      style={{ ...styles.input, width: "100%", minWidth: 0 }}
                      value={templateNom}
                      onChange={(e) => setTemplateNom(e.target.value)}
                      placeholder="Ex: Cummins EPA 17"
                      autoFocus={templateModalMode === "create"}
                    />
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Statut</div>
                    <label style={{ display: "inline-flex", gap: 10, alignItems: "center", height: 42 }}>
                      <input
                        type="checkbox"
                        checked={templateActif}
                        onChange={(e) => setTemplateActif(e.target.checked)}
                      />
                      <span style={{ fontWeight: 700 }}>Template actif</span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                  <textarea
                    style={styles.textarea}
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Description du modèle d’entretien"
                  />
                </div>

                <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    type="button"
                    style={styles.btnPrimary}
                    onClick={saveTemplate}
                    disabled={busy || !templateNom.trim()}
                  >
                    {templateModalMode === "create" ? "Créer le template" : "Enregistrer"}
                  </button>
                </div>
              </div>

              {templateModalMode === "edit" && selectedTemplateId && (
                <div style={styles.sectionBox}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>Lignes d’entretien</div>
                      <div style={{ color: "rgba(0,0,0,.6)" }}>
                        Gère les lignes de périodicité de ce template.
                      </div>
                    </div>

                    <button
                      type="button"
                      style={styles.btnPrimary}
                      onClick={() => setOpenAddTemplateItem(true)}
                    >
                      Ajouter une ligne
                    </button>
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.th, width: 70 }}>Ordre</th>
                          <th style={styles.th}>Nom</th>
                          <th style={styles.th}>Description</th>
                          <th style={{ ...styles.th, width: 120 }}>KM</th>
                          <th style={{ ...styles.th, width: 120 }}>Jours</th>
                          <th style={{ ...styles.th, width: 110 }}>Statut</th>
                          <th style={{ ...styles.th, width: 90 }}>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedTemplateItems.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={7}>
                              <span style={{ color: "rgba(0,0,0,.6)" }}>
                                Aucune ligne d’entretien dans ce template.
                              </span>
                            </td>
                          </tr>
                        ) : (
                          selectedTemplateItems.map((r) => (
                            <tr key={r.id}>
                              <td style={styles.td}>{r.ordre ?? "—"}</td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 700 }}>{r.nom || "—"}</div>
                              </td>
                              <td style={styles.td}>{r.description || "—"}</td>
                              <td style={styles.td}>
                                {r.periodicite_km == null ? "—" : Number(r.periodicite_km)}
                              </td>
                              <td style={styles.td}>
                                {r.periodicite_jours == null ? "—" : Number(r.periodicite_jours)}
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
                                      setMenuType("template_item");
                                      setMenuOpenId((cur) => (cur === r.id ? null : r.id));
                                    }}
                                    disabled={busy}
                                  >
                                    ...
                                  </button>

                                  {menuOpenId === r.id && menuType === "template_item" && (
                                    <div style={styles.menu}>
                                      <button
                                        type="button"
                                        style={styles.menuItem}
                                        onClick={() => openEditTemplateItemModal(r)}
                                      >
                                        Modifier
                                      </button>

                                      <button
                                        type="button"
                                        style={styles.menuItem}
                                        onClick={async () => {
                                          if (busy) return;
                                          setMenuOpenId(null);
                                          setMenuType(null);
                                          setBusy(true);
                                          try {
                                            const { error } = await supabase
                                              .from("entretien_template_items")
                                              .update({ actif: !r.actif })
                                              .eq("id", r.id);

                                            if (error) throw error;
                                            await loadTemplates();
                                          } catch (e: any) {
                                            alert(e?.message ?? String(e));
                                          } finally {
                                            setBusy(false);
                                          }
                                        }}
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
                                        onClick={() => removeTemplateItemRow(r.id)}
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
              )}
            </div>
          </div>
        </div>
      )}

      {openAddTemplateItem && (
        <div style={styles.modalBackdrop} onClick={closeAddTemplateItemModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une ligne d’entretien</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={closeAddTemplateItemModal}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={templateItemNom}
                  onChange={(e) => setTemplateItemNom(e.target.value)}
                  placeholder="Ex: Huile moteur"
                  autoFocus
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                <textarea
                  style={styles.textarea}
                  value={templateItemDescription}
                  onChange={(e) => setTemplateItemDescription(e.target.value)}
                  placeholder="Détails de l’entretien"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Périodicité KM</div>
                  <input
                    type="number"
                    min="0"
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={templateItemPeriodiciteKm}
                    onChange={(e) => setTemplateItemPeriodiciteKm(e.target.value)}
                    placeholder="Ex: 15000"
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Périodicité jours</div>
                  <input
                    type="number"
                    min="0"
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={templateItemPeriodiciteJours}
                    onChange={(e) => setTemplateItemPeriodiciteJours(e.target.value)}
                    placeholder="Ex: 180"
                  />
                </div>
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={templateItemActif}
                  onChange={(e) => setTemplateItemActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Ligne active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btn}
                onClick={closeAddTemplateItemModal}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addTemplateItem}
                disabled={busy || !templateItemNom.trim() || !selectedTemplateId}
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

      {editTemplateItemRow && (
        <div style={styles.modalBackdrop} onClick={closeEditTemplateItemModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier la ligne d’entretien</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={closeEditTemplateItemModal}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editTemplateItemNom}
                  onChange={(e) => setEditTemplateItemNom(e.target.value)}
                  placeholder="Ex: Huile moteur"
                  autoFocus
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                <textarea
                  style={styles.textarea}
                  value={editTemplateItemDescription}
                  onChange={(e) => setEditTemplateItemDescription(e.target.value)}
                  placeholder="Détails de l’entretien"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Périodicité KM</div>
                  <input
                    type="number"
                    min="0"
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={editTemplateItemPeriodiciteKm}
                    onChange={(e) => setEditTemplateItemPeriodiciteKm(e.target.value)}
                    placeholder="Ex: 15000"
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Périodicité jours</div>
                  <input
                    type="number"
                    min="0"
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={editTemplateItemPeriodiciteJours}
                    onChange={(e) => setEditTemplateItemPeriodiciteJours(e.target.value)}
                    placeholder="Ex: 180"
                  />
                </div>
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={editTemplateItemActif}
                  onChange={(e) => setEditTemplateItemActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Ligne active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btn}
                onClick={closeEditTemplateItemModal}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveEditTemplateItem}
                disabled={busy || !editTemplateItemNom.trim()}
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