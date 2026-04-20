import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type UniteMode = "options" | "attributs";

type Categorie =
  | "type_unite"
  | "motorisation"
  | "freins"
  | "type_freins"
  | "suspension";

type OptionRow = {
  id: string;
  categorie: Categorie;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

type UniteAttributeRow = {
  id: string;
  code: string;
  libelle: string;
  type_valeur: "bool" | "texte" | "nombre" | "liste";
  categorie: string | null;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

type UniteAttributeOptionRow = {
  id: string;
  attribute_id: string;
  valeur: string;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

const CATEGORIES: { key: Categorie; label: string; hint: string }[] = [
  { key: "type_unite", label: "Type d’unité", hint: "Ex: Autobus, Minibus, Adapté…" },
  { key: "motorisation", label: "Motorisation", hint: "Ex: Diesel, Électrique…" },
  { key: "freins", label: "Freins", hint: "Ex: Air, Hydraulique…" },
  { key: "type_freins", label: "Type de freins", hint: "Ex: Disque, Tambour, Mixte…" },
  { key: "suspension", label: "Suspension", hint: "Ex: Air, Ressorts…" },
];

const ATTRIBUTE_TYPES: Array<{
  value: UniteAttributeRow["type_valeur"];
  label: string;
}> = [
  { value: "bool", label: "Oui / Non" },
  { value: "texte", label: "Texte" },
  { value: "nombre", label: "Nombre" },
  { value: "liste", label: "Liste" },
];

function slugifyCode(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export default function ParametresUnitesPage() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [uniteMode, setUniteMode] = useState<UniteMode>("options");

  const [rows, setRows] = useState<OptionRow[]>([]);
  const [cat, setCat] = useState<Categorie>("type_unite");

  const [attributes, setAttributes] = useState<UniteAttributeRow[]>([]);
  const [attributeOptions, setAttributeOptions] = useState<UniteAttributeOptionRow[]>([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuType, setMenuType] = useState<"unite" | "attribute" | "attribute_option" | null>(null);

  const [openAddOption, setOpenAddOption] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionActif, setNewOptionActif] = useState(true);

  const [openEditOption, setOpenEditOption] = useState(false);
  const [editOptionRow, setEditOptionRow] = useState<OptionRow | null>(null);
  const [editOptionLabel, setEditOptionLabel] = useState("");

  const [openAddAttribute, setOpenAddAttribute] = useState(false);
  const [attributeLibelle, setAttributeLibelle] = useState("");
  const [attributeCode, setAttributeCode] = useState("");
  const [attributeType, setAttributeType] = useState<UniteAttributeRow["type_valeur"]>("bool");
  const [attributeCategorie, setAttributeCategorie] = useState("PEP");
  const [attributeActif, setAttributeActif] = useState(true);

  const [openEditAttribute, setOpenEditAttribute] = useState(false);
  const [editAttributeRow, setEditAttributeRow] = useState<UniteAttributeRow | null>(null);
  const [editAttributeLibelle, setEditAttributeLibelle] = useState("");
  const [editAttributeCode, setEditAttributeCode] = useState("");
  const [editAttributeType, setEditAttributeType] =
    useState<UniteAttributeRow["type_valeur"]>("bool");
  const [editAttributeCategorie, setEditAttributeCategorie] = useState("PEP");
  const [editAttributeActif, setEditAttributeActifState] = useState(true);

  const [openAddAttributeOption, setOpenAddAttributeOption] = useState(false);
  const [attributeOptionLibelle, setAttributeOptionLibelle] = useState("");
  const [attributeOptionValeur, setAttributeOptionValeur] = useState("");
  const [attributeOptionActif, setAttributeOptionActif] = useState(true);

  const [openEditAttributeOption, setOpenEditAttributeOption] = useState(false);
  const [editAttributeOptionRow, setEditAttributeOptionRow] =
    useState<UniteAttributeOptionRow | null>(null);
  const [editAttributeOptionLibelle, setEditAttributeOptionLibelle] = useState("");
  const [editAttributeOptionValeur, setEditAttributeOptionValeur] = useState("");
  const [editAttributeOptionActif, setEditAttributeOptionActifState] = useState(true);

  const meta = useMemo(() => CATEGORIES.find((c) => c.key === cat)!, [cat]);

  const filteredOptions = useMemo(() => {
    return rows
      .filter((r) => r.categorie === cat)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { sensitivity: "base" }));
  }, [rows, cat]);

  const filteredAttributes = useMemo(() => {
    return [...attributes].sort((a, b) => {
      const ao = Number(a.ordre ?? 0);
      const bo = Number(b.ordre ?? 0);
      if (ao !== bo) return ao - bo;
      return String(a.libelle || "").localeCompare(String(b.libelle || ""), "fr", {
        sensitivity: "base",
      });
    });
  }, [attributes]);

  const selectedAttribute = useMemo(
    () => attributes.find((r) => r.id === selectedAttributeId) ?? null,
    [attributes, selectedAttributeId]
  );

  const selectedAttributeOptions = useMemo(() => {
    if (!selectedAttributeId) return [];
    return attributeOptions
      .filter((r) => r.attribute_id === selectedAttributeId)
      .sort((a, b) => {
        const ao = Number(a.ordre ?? 0);
        const bo = Number(b.ordre ?? 0);
        if (ao !== bo) return ao - bo;
        return String(a.libelle || "").localeCompare(String(b.libelle || ""), "fr", {
          sensitivity: "base",
        });
      });
  }, [attributeOptions, selectedAttributeId]);

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
      const [unitesRes, attributesRes, attributeOptionsRes] = await Promise.all([
        supabase
          .from("unite_options")
          .select("id,categorie,libelle,ordre,actif,created_at")
          .order("categorie", { ascending: true })
          .order("libelle", { ascending: true }),

        supabase
          .from("unite_attributes")
          .select("id,code,libelle,type_valeur,categorie,ordre,actif,created_at")
          .order("categorie", { ascending: true })
          .order("ordre", { ascending: true })
          .order("libelle", { ascending: true }),

        supabase
          .from("unite_attribute_options")
          .select("id,attribute_id,valeur,libelle,ordre,actif,created_at")
          .order("attribute_id", { ascending: true })
          .order("ordre", { ascending: true })
          .order("libelle", { ascending: true }),
      ]);

      if (unitesRes.error) throw unitesRes.error;

      if (attributesRes.error) {
        const msg = String(attributesRes.error.message || "").toLowerCase();
        const missing =
          msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
        if (!missing) throw attributesRes.error;
      }

      if (attributeOptionsRes.error) {
        const msg = String(attributeOptionsRes.error.message || "").toLowerCase();
        const missing =
          msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
        if (!missing) throw attributeOptionsRes.error;
      }

      setRows((unitesRes.data as OptionRow[]) ?? []);
      setAttributes((attributesRes.data as UniteAttributeRow[]) ?? []);
      setAttributeOptions((attributeOptionsRes.data as UniteAttributeOptionRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
      setRows([]);
      setAttributes([]);
      setAttributeOptions([]);
    } finally {
      setBusy(false);
    }
  }

  async function loadOptionsOnly() {
    const { data, error } = await supabase
      .from("unite_options")
      .select("id,categorie,libelle,ordre,actif,created_at")
      .order("categorie", { ascending: true })
      .order("libelle", { ascending: true });

    if (error) throw error;
    setRows((data as OptionRow[]) ?? []);
  }

  async function loadAttributesOnly() {
    const [attrsRes, optsRes] = await Promise.all([
      supabase
        .from("unite_attributes")
        .select("id,code,libelle,type_valeur,categorie,ordre,actif,created_at")
        .order("categorie", { ascending: true })
        .order("ordre", { ascending: true })
        .order("libelle", { ascending: true }),
      supabase
        .from("unite_attribute_options")
        .select("id,attribute_id,valeur,libelle,ordre,actif,created_at")
        .order("attribute_id", { ascending: true })
        .order("ordre", { ascending: true })
        .order("libelle", { ascending: true }),
    ]);

    if (attrsRes.error) throw attrsRes.error;
    if (optsRes.error) throw optsRes.error;

    setAttributes((attrsRes.data as UniteAttributeRow[]) ?? []);
    setAttributeOptions((optsRes.data as UniteAttributeOptionRow[]) ?? []);
  }

  function closeMenus() {
    setMenuOpenId(null);
    setMenuType(null);
  }

  function closeAddOptionModal() {
    setOpenAddOption(false);
    setNewOptionLabel("");
    setNewOptionActif(true);
  }

  function closeEditOptionModal() {
    setOpenEditOption(false);
    setEditOptionRow(null);
    setEditOptionLabel("");
  }

  function closeAddAttributeModal() {
    setOpenAddAttribute(false);
    setAttributeLibelle("");
    setAttributeCode("");
    setAttributeType("bool");
    setAttributeCategorie("PEP");
    setAttributeActif(true);
  }

  function closeEditAttributeModal() {
    setOpenEditAttribute(false);
    setEditAttributeRow(null);
    setEditAttributeLibelle("");
    setEditAttributeCode("");
    setEditAttributeType("bool");
    setEditAttributeCategorie("PEP");
    setEditAttributeActifState(true);
  }

  function closeAddAttributeOptionModal() {
    setOpenAddAttributeOption(false);
    setAttributeOptionLibelle("");
    setAttributeOptionValeur("");
    setAttributeOptionActif(true);
  }

  function closeEditAttributeOptionModal() {
    setOpenEditAttributeOption(false);
    setEditAttributeOptionRow(null);
    setEditAttributeOptionLibelle("");
    setEditAttributeOptionValeur("");
    setEditAttributeOptionActifState(true);
  }

  async function addOption() {
    const label = newOptionLabel.trim();
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
        actif: Boolean(newOptionActif),
      });

      if (error) throw error;
      await loadOptionsOnly();
      closeAddOptionModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveOptionEdit() {
    if (!editOptionRow || busy) return;
    const next = editOptionLabel.trim();
    if (!next) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("unite_options")
        .update({ libelle: next })
        .eq("id", editOptionRow.id);

      if (error) throw error;
      await loadOptionsOnly();
      closeEditOptionModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleOptionActif(row: OptionRow) {
    if (busy) return;
    closeMenus();
    setBusy(true);

    try {
      const { error } = await supabase
        .from("unite_options")
        .update({ actif: !row.actif })
        .eq("id", row.id);

      if (error) throw error;
      await loadOptionsOnly();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteOption(id: string) {
    if (!confirm("Supprimer cette option ?")) return;
    closeMenus();
    setBusy(true);

    try {
      const { error } = await supabase.from("unite_options").delete().eq("id", id);
      if (error) throw error;
      await loadOptionsOnly();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addAttribute() {
    const label = attributeLibelle.trim();
    const code = (attributeCode.trim() || slugifyCode(label)).trim();

    if (!label || !code || busy) return;

    setBusy(true);
    try {
      const nextOrdre =
        attributes.length > 0 ? Math.max(...attributes.map((r) => Number(r.ordre ?? 0))) + 10 : 10;

      const { data, error } = await supabase
        .from("unite_attributes")
        .insert({
          libelle: label,
          code,
          type_valeur: attributeType,
          categorie: attributeCategorie.trim() || "PEP",
          ordre: nextOrdre,
          actif: Boolean(attributeActif),
        })
        .select("id")
        .single();

      if (error) throw error;

      await loadAttributesOnly();
      if (data?.id) setSelectedAttributeId(data.id);
      closeAddAttributeModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveAttributeEdit() {
    if (!editAttributeRow || busy) return;

    const label = editAttributeLibelle.trim();
    const code = (editAttributeCode.trim() || slugifyCode(label)).trim();
    if (!label || !code) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("unite_attributes")
        .update({
          libelle: label,
          code,
          type_valeur: editAttributeType,
          categorie: editAttributeCategorie.trim() || "PEP",
          actif: Boolean(editAttributeActif),
        })
        .eq("id", editAttributeRow.id);

      if (error) throw error;
      await loadAttributesOnly();
      closeEditAttributeModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAttributeRowActif(row: UniteAttributeRow) {
    if (busy) return;
    closeMenus();
    setBusy(true);

    try {
      const { error } = await supabase
        .from("unite_attributes")
        .update({ actif: !row.actif })
        .eq("id", row.id);

      if (error) throw error;
      await loadAttributesOnly();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAttribute(id: string) {
    if (!confirm("Supprimer cet attribut ?")) return;
    closeMenus();
    setBusy(true);

    try {
      const { error } = await supabase.from("unite_attributes").delete().eq("id", id);
      if (error) throw error;
      await loadAttributesOnly();
      if (selectedAttributeId === id) setSelectedAttributeId(null);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addAttributeOption() {
    if (!selectedAttributeId || !selectedAttribute || busy) return;

    const label = attributeOptionLibelle.trim();
    const value = (attributeOptionValeur.trim() || slugifyCode(label)).trim();
    if (!label || !value) return;

    setBusy(true);
    try {
      const nextOrdre =
        selectedAttributeOptions.length > 0
          ? Math.max(...selectedAttributeOptions.map((r) => Number(r.ordre ?? 0))) + 10
          : 10;

      const { error } = await supabase.from("unite_attribute_options").insert({
        attribute_id: selectedAttributeId,
        libelle: label,
        valeur: value,
        ordre: nextOrdre,
        actif: Boolean(attributeOptionActif),
      });

      if (error) throw error;
      await loadAttributesOnly();
      closeAddAttributeOptionModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveAttributeOptionEdit() {
    if (!editAttributeOptionRow || busy) return;

    const label = editAttributeOptionLibelle.trim();
    const value = (editAttributeOptionValeur.trim() || slugifyCode(label)).trim();
    if (!label || !value) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("unite_attribute_options")
        .update({
          libelle: label,
          valeur: value,
          actif: Boolean(editAttributeOptionActif),
        })
        .eq("id", editAttributeOptionRow.id);

      if (error) throw error;
      await loadAttributesOnly();
      closeEditAttributeOptionModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAttributeOptionRowActif(row: UniteAttributeOptionRow) {
    if (busy) return;
    closeMenus();
    setBusy(true);

    try {
      const { error } = await supabase
        .from("unite_attribute_options")
        .update({ actif: !row.actif })
        .eq("id", row.id);

      if (error) throw error;
      await loadAttributesOnly();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAttributeOption(id: string) {
    if (!confirm("Supprimer cette option d’attribut ?")) return;
    closeMenus();
    setBusy(true);

    try {
      const { error } = await supabase.from("unite_attribute_options").delete().eq("id", id);
      if (error) throw error;
      await loadAttributesOnly();
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
      minWidth: 760,
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
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Paramètres unités</div>
              <div style={{ color: "rgba(0,0,0,.6)", marginTop: 4 }}>
                Gère les options fixes et les attributs dynamiques PEP.
              </div>
            </div>

            <button type="button" style={styles.btn} onClick={() => nav("/systeme/parametres")}>
              Retour
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ ...styles.row, marginBottom: 12 }}>
            <button
              type="button"
              style={styles.tabButton(uniteMode === "options")}
              onClick={() => {
                setUniteMode("options");
                closeMenus();
              }}
            >
              Options fixes
            </button>

            <button
              type="button"
              style={styles.tabButton(uniteMode === "attributs")}
              onClick={() => {
                setUniteMode("attributs");
                closeMenus();
              }}
            >
              Attributs
            </button>
          </div>

          {uniteMode === "options" ? (
            <>
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
                <button type="button" style={styles.btnPrimary} onClick={() => setOpenAddOption(true)}>
                  Ajouter une option
                </button>
              </div>
            </>
          ) : (
            <div style={{ ...styles.row, justifyContent: "space-between" }}>
              <div style={{ color: "rgba(0,0,0,.6)" }}>
                Configure ici les attributs dynamiques utilisés dans la fiche unité et dans les règles S/O.
              </div>

              <div style={styles.row}>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => setOpenAddAttribute(true)}
                >
                  Ajouter un attribut
                </button>

                <button
                  type="button"
                  style={styles.btn}
                  onClick={() => setOpenAddAttributeOption(true)}
                  disabled={!selectedAttribute || selectedAttribute.type_valeur !== "liste"}
                >
                  Ajouter une option de liste
                </button>
              </div>
            </div>
          )}
        </div>

        {uniteMode === "options" && (
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
                  {filteredOptions.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={3}>
                        <span style={{ color: "rgba(0,0,0,.6)" }}>
                          Aucune option dans cette catégorie.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredOptions.map((r) => (
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
                                  onClick={() => {
                                    closeMenus();
                                    setEditOptionRow(r);
                                    setEditOptionLabel(r.libelle ?? "");
                                    setOpenEditOption(true);
                                  }}
                                >
                                  Modifier
                                </button>

                                <button
                                  type="button"
                                  style={styles.menuItem}
                                  onClick={() => toggleOptionActif(r)}
                                >
                                  {r.actif ? "Inactif" : "Actif"}
                                </button>

                                <button
                                  type="button"
                                  style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }}
                                  onClick={() => deleteOption(r.id)}
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

        {uniteMode === "attributs" && (
          <>
            <div style={styles.card}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Attributs dynamiques</div>
                <div style={{ color: "rgba(0,0,0,.6)" }}>
                  Ces attributs seront configurables dans la fiche unité et utilisables dans les règles S/O.
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Libellé</th>
                      <th style={styles.th}>Code</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Catégorie</th>
                      <th style={{ ...styles.th, width: 120 }}>Statut</th>
                      <th style={{ ...styles.th, width: 90 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttributes.length === 0 ? (
                      <tr>
                        <td style={styles.td} colSpan={6}>
                          <span style={{ color: "rgba(0,0,0,.6)" }}>
                            Aucun attribut dynamique.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      filteredAttributes.map((r) => (
                        <tr
                          key={r.id}
                          style={
                            selectedAttributeId === r.id
                              ? { background: "rgba(37,99,235,.06)" }
                              : undefined
                          }
                        >
                          <td style={styles.td} onClick={() => setSelectedAttributeId(r.id)}>
                            <div style={{ fontWeight: 700 }}>{r.libelle || "—"}</div>
                          </td>
                          <td style={styles.td} onClick={() => setSelectedAttributeId(r.id)}>
                            {r.code || "—"}
                          </td>
                          <td style={styles.td} onClick={() => setSelectedAttributeId(r.id)}>
                            {ATTRIBUTE_TYPES.find((x) => x.value === r.type_valeur)?.label || r.type_valeur}
                          </td>
                          <td style={styles.td} onClick={() => setSelectedAttributeId(r.id)}>
                            {r.categorie || "—"}
                          </td>
                          <td style={styles.td} onClick={() => setSelectedAttributeId(r.id)}>
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
                                  setSelectedAttributeId(r.id);
                                  setMenuType("attribute");
                                  setMenuOpenId((cur) => (cur === r.id ? null : r.id));
                                }}
                                disabled={busy}
                              >
                                ...
                              </button>

                              {menuOpenId === r.id && menuType === "attribute" && (
                                <div style={styles.menu}>
                                  <button
                                    type="button"
                                    style={styles.menuItem}
                                    onClick={() => {
                                      closeMenus();
                                      setEditAttributeRow(r);
                                      setEditAttributeLibelle(r.libelle ?? "");
                                      setEditAttributeCode(r.code ?? "");
                                      setEditAttributeType(r.type_valeur ?? "bool");
                                      setEditAttributeCategorie(r.categorie ?? "PEP");
                                      setEditAttributeActifState(Boolean(r.actif));
                                      setOpenEditAttribute(true);
                                    }}
                                  >
                                    Modifier
                                  </button>

                                  <button
                                    type="button"
                                    style={styles.menuItem}
                                    onClick={() => toggleAttributeRowActif(r)}
                                  >
                                    {r.actif ? "Inactif" : "Actif"}
                                  </button>

                                  <button
                                    type="button"
                                    style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }}
                                    onClick={() => deleteAttribute(r.id)}
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

            {selectedAttribute && selectedAttribute.type_valeur === "liste" && (
              <div style={styles.card}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 950 }}>
                    Options de l’attribut : {selectedAttribute.libelle}
                  </div>
                  <div style={{ color: "rgba(0,0,0,.6)" }}>
                    Gère les choix disponibles pour cet attribut de type liste.
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    style={styles.btnPrimary}
                    onClick={() => setOpenAddAttributeOption(true)}
                  >
                    Ajouter une option
                  </button>
                </div>

                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Libellé</th>
                        <th style={styles.th}>Valeur</th>
                        <th style={{ ...styles.th, width: 120 }}>Statut</th>
                        <th style={{ ...styles.th, width: 90 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAttributeOptions.length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={4}>
                            <span style={{ color: "rgba(0,0,0,.6)" }}>
                              Aucune option pour cet attribut.
                            </span>
                          </td>
                        </tr>
                      ) : (
                        selectedAttributeOptions.map((r) => (
                          <tr key={r.id}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 500 }}>{r.libelle || "—"}</div>
                            </td>
                            <td style={styles.td}>{r.valeur || "—"}</td>
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
                                    setMenuType("attribute_option");
                                    setMenuOpenId((cur) => (cur === r.id ? null : r.id));
                                  }}
                                  disabled={busy}
                                >
                                  ...
                                </button>

                                {menuOpenId === r.id && menuType === "attribute_option" && (
                                  <div style={styles.menu}>
                                    <button
                                      type="button"
                                      style={styles.menuItem}
                                      onClick={() => {
                                        closeMenus();
                                        setEditAttributeOptionRow(r);
                                        setEditAttributeOptionLibelle(r.libelle ?? "");
                                        setEditAttributeOptionValeur(r.valeur ?? "");
                                        setEditAttributeOptionActifState(Boolean(r.actif));
                                        setOpenEditAttributeOption(true);
                                      }}
                                    >
                                      Modifier
                                    </button>

                                    <button
                                      type="button"
                                      style={styles.menuItem}
                                      onClick={() => toggleAttributeOptionRowActif(r)}
                                    >
                                      {r.actif ? "Inactif" : "Actif"}
                                    </button>

                                    <button
                                      type="button"
                                      style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }}
                                      onClick={() => deleteAttributeOption(r.id)}
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
          </>
        )}
      </div>

      {openAddOption && (
        <div style={styles.modalBackdrop} onClick={closeAddOptionModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une option</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAddOptionModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Catégorie</div>
                <input style={{ ...styles.input, width: "100%", minWidth: 0 }} value={meta.label} disabled />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  placeholder="Ex: Autobus"
                  autoFocus
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={newOptionActif}
                  onChange={(e) => setNewOptionActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Option active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeAddOptionModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addOption}
                disabled={busy || !newOptionLabel.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditOption && (
        <div style={styles.modalBackdrop} onClick={closeEditOptionModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier l’option</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeEditOptionModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editOptionLabel}
                  onChange={(e) => setEditOptionLabel(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeEditOptionModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveOptionEdit}
                disabled={busy || !editOptionLabel.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {openAddAttribute && (
        <div style={styles.modalBackdrop} onClick={closeAddAttributeModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter un attribut</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAddAttributeModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={attributeLibelle}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAttributeLibelle(next);
                    if (!attributeCode.trim()) setAttributeCode(slugifyCode(next));
                  }}
                  placeholder="Ex: Attache remorque"
                  autoFocus
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Code</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={attributeCode}
                  onChange={(e) => setAttributeCode(slugifyCode(e.target.value))}
                  placeholder="Ex: attache_remorque"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Type</div>
                  <select
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={attributeType}
                    onChange={(e) => setAttributeType(e.target.value as UniteAttributeRow["type_valeur"])}
                  >
                    {ATTRIBUTE_TYPES.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Catégorie</div>
                  <input
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={attributeCategorie}
                    onChange={(e) => setAttributeCategorie(e.target.value)}
                    placeholder="Ex: PEP"
                  />
                </div>
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={attributeActif}
                  onChange={(e) => setAttributeActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Attribut actif</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeAddAttributeModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addAttribute}
                disabled={busy || !attributeLibelle.trim() || !attributeCode.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditAttribute && (
        <div style={styles.modalBackdrop} onClick={closeEditAttributeModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier l’attribut</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeEditAttributeModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editAttributeLibelle}
                  onChange={(e) => setEditAttributeLibelle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Code</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editAttributeCode}
                  onChange={(e) => setEditAttributeCode(slugifyCode(e.target.value))}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Type</div>
                  <select
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={editAttributeType}
                    onChange={(e) => setEditAttributeType(e.target.value as UniteAttributeRow["type_valeur"])}
                  >
                    {ATTRIBUTE_TYPES.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Catégorie</div>
                  <input
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    value={editAttributeCategorie}
                    onChange={(e) => setEditAttributeCategorie(e.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={editAttributeActif}
                  onChange={(e) => setEditAttributeActifState(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Attribut actif</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeEditAttributeModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveAttributeEdit}
                disabled={busy || !editAttributeLibelle.trim() || !editAttributeCode.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {openAddAttributeOption && (
        <div style={styles.modalBackdrop} onClick={closeAddAttributeOptionModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une option d’attribut</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAddAttributeOptionModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Attribut</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={selectedAttribute?.libelle || ""}
                  disabled
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={attributeOptionLibelle}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAttributeOptionLibelle(next);
                    if (!attributeOptionValeur.trim()) setAttributeOptionValeur(slugifyCode(next));
                  }}
                  placeholder="Ex: Oui"
                  autoFocus
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Valeur</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={attributeOptionValeur}
                  onChange={(e) => setAttributeOptionValeur(slugifyCode(e.target.value))}
                  placeholder="Ex: oui"
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={attributeOptionActif}
                  onChange={(e) => setAttributeOptionActif(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Option active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeAddAttributeOptionModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addAttributeOption}
                disabled={
                  busy ||
                  !selectedAttributeId ||
                  !selectedAttribute ||
                  selectedAttribute.type_valeur !== "liste" ||
                  !attributeOptionLibelle.trim() ||
                  !attributeOptionValeur.trim()
                }
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditAttributeOption && (
        <div style={styles.modalBackdrop} onClick={closeEditAttributeOptionModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier l’option d’attribut</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeEditAttributeOptionModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Libellé</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editAttributeOptionLibelle}
                  onChange={(e) => setEditAttributeOptionLibelle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Valeur</div>
                <input
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={editAttributeOptionValeur}
                  onChange={(e) => setEditAttributeOptionValeur(slugifyCode(e.target.value))}
                />
              </div>

              <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={editAttributeOptionActif}
                  onChange={(e) => setEditAttributeOptionActifState(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Option active</span>
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btn} onClick={closeEditAttributeOptionModal} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={saveAttributeOptionEdit}
                disabled={
                  busy || !editAttributeOptionLibelle.trim() || !editAttributeOptionValeur.trim()
                }
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