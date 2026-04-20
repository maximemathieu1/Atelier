import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AdminTab = "elements" | "loc" | "def" | "regles";

type PepElement = {
  id: string;
  categorie: string;
  element: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

type PepLoc = {
  id: string;
  code: string;
  description: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

type PepDef = {
  id: string;
  code: string;
  description: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

type PepRegle = {
  id: string;
  type_unite?: string | null;
  motorisation?: string | null;
  freins?: string | null;
  type_freins?: string | null;
  suspension?: string | null;
  attribut?: string | null;   // 🔥 FIX
  valeur?: string | null;     // 🔥 FIX
  actif: boolean;
  created_at?: string;
};

type PepRegleItem = {
  id: string;
  regle_id: string;
  pep_element_id: string;
  created_at?: string;
};

type UniteOption = {
  id: string;
  categorie:
    | "type_unite"
    | "motorisation"
    | "freins"
    | "type_freins"
    | "suspension"
  libelle: string;
  ordre: number;
  actif: boolean;
};

type UniteAttribute = {
  id: string;
  code: string;
  libelle: string;
  type_valeur: "bool" | "texte" | "nombre" | "liste";
  categorie: string | null;
  ordre: number;
  actif: boolean;
};

type ElementForm = {
  categorie: string;
  element: string;
  ordre: string;
  actif: boolean;
};

type LocForm = {
  code: string;
  description: string;
  ordre: string;
  actif: boolean;
};

type DefForm = {
  code: string;
  description: string;
  ordre: string;
  actif: boolean;
};

type RegleForm = {
  mode: "fixed" | "dynamic";
  fixed_field: "" | "type_unite" | "motorisation" | "freins" | "type_freins" | "suspension";
  fixed_value: string;
  attribute_code: string;
  attribute_value: string;
  actif: boolean;
};

const FIXED_FIELD_OPTIONS: Array<{
  value: "type_unite" | "motorisation" | "freins" | "type_freins" | "suspension";
  label: string;
}> = [
  { value: "type_unite", label: "Type d’unité" },
  { value: "motorisation", label: "Motorisation" },
  { value: "freins", label: "Freins" },
  { value: "type_freins", label: "Type freins" },
  { value: "suspension", label: "Suspension" },
];

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  titleWrap: {
    minWidth: 240,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6b7280",
  },
  tabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  tab: {
    minHeight: 38,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabActive: {
    minHeight: 38,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
  },
  cardHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontWeight: 800,
    color: "#111827",
  },
  cardBody: {
    padding: 14,
    display: "grid",
    gap: 14,
  },
  btnPrimary: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSecondary: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnDanger: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#991b1b",
    fontWeight: 700,
    cursor: "pointer",
  },
  formGrid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
  },
  input: {
    width: "100%",
    minHeight: 40,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    fontWeight: 700,
    color: "#374151",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#6b7280",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 8px",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 8px",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "top",
    fontSize: 14,
  },
  selectedRow: {
    background: "#eff6ff",
  },
  statusOn: {
    color: "#166534",
    fontWeight: 700,
  },
  statusOff: {
    color: "#6b7280",
    fontWeight: 700,
  },
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 420px) minmax(0, 1fr)",
    gap: 14,
  },
  dualList: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
    gap: 12,
    alignItems: "start",
  },
  listBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
  },
  listHead: {
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 800,
  },
  listBody: {
    maxHeight: 420,
    overflowY: "auto",
  },
  listItem: {
    width: "100%",
    textAlign: "left",
    border: "none",
    borderBottom: "1px solid #f3f4f6",
    background: "#fff",
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 14,
  },
  listItemSelected: {
    width: "100%",
    textAlign: "left",
    border: "none",
    borderBottom: "1px solid #dbeafe",
    background: "#dbeafe",
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 14,
  },
  centerButtons: {
    display: "grid",
    gap: 10,
    alignContent: "center",
    minWidth: 120,
  },
  muted: {
    fontSize: 12,
    color: "#6b7280",
  },
  error: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
};

function toNumberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getRuleLabel(rule: PepRegle, attrs: UniteAttribute[]) {
  if (rule.type_unite) return { champ: "Type d’unité", valeur: rule.type_unite };
  if (rule.motorisation) return { champ: "Motorisation", valeur: rule.motorisation };
  if (rule.freins) return { champ: "Freins", valeur: rule.freins };
  if (rule.type_freins) return { champ: "Type freins", valeur: rule.type_freins };
  if (rule.suspension) return { champ: "Suspension", valeur: rule.suspension };
  if (rule.attribut) {
    const attr = attrs.find((x) => x.code === rule.attribut);
    return {
      champ: attr?.libelle || rule.attribut,
      valeur: rule.valeur || "",
    };
  }
  return { champ: "—", valeur: "—" };
}

function buildEmptyRuleForm(): RegleForm {
  return {
    mode: "fixed",
    fixed_field: "",
    fixed_value: "",
    attribute_code: "",
    attribute_value: "",
    actif: true,
  };
}

export default function PepAdministration() {
  const [tab, setTab] = useState<AdminTab>("elements");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [elements, setElements] = useState<PepElement[]>([]);
  const [locs, setLocs] = useState<PepLoc[]>([]);
  const [defs, setDefs] = useState<PepDef[]>([]);
  const [regles, setRegles] = useState<PepRegle[]>([]);
  const [regleItems, setRegleItems] = useState<PepRegleItem[]>([]);
  const [uniteOptions, setUniteOptions] = useState<UniteOption[]>([]);
  const [uniteAttributes, setUniteAttributes] = useState<UniteAttribute[]>([]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [selectedRegleId, setSelectedRegleId] = useState<string | null>(null);
  const [selectedAvailableElementId, setSelectedAvailableElementId] = useState<string | null>(null);
  const [selectedAssignedElementId, setSelectedAssignedElementId] = useState<string | null>(null);

  const [elementForm, setElementForm] = useState<ElementForm>({
    categorie: "",
    element: "",
    ordre: "0",
    actif: true,
  });

  const [locForm, setLocForm] = useState<LocForm>({
    code: "",
    description: "",
    ordre: "0",
    actif: true,
  });

  const [defForm, setDefForm] = useState<DefForm>({
    code: "",
    description: "",
    ordre: "0",
    actif: true,
  });

  const [regleForm, setRegleForm] = useState<RegleForm>(buildEmptyRuleForm());

  const selectedElement = useMemo(
    () => elements.find((x) => x.id === selectedElementId) ?? null,
    [elements, selectedElementId]
  );

  const selectedLoc = useMemo(
    () => locs.find((x) => x.id === selectedLocId) ?? null,
    [locs, selectedLocId]
  );

  const selectedDef = useMemo(
    () => defs.find((x) => x.id === selectedDefId) ?? null,
    [defs, selectedDefId]
  );

  const selectedRegle = useMemo(
    () => regles.find((x) => x.id === selectedRegleId) ?? null,
    [regles, selectedRegleId]
  );

  const fixedFieldValueOptions = useMemo(() => {
    if (!regleForm.fixed_field) return [];
    return uniteOptions
      .filter((o) => o.actif && o.categorie === regleForm.fixed_field)
      .map((o) => o.libelle);
  }, [uniteOptions, regleForm.fixed_field]);

  const selectedDynamicAttribute = useMemo(
    () => uniteAttributes.find((x) => x.code === regleForm.attribute_code) ?? null,
    [uniteAttributes, regleForm.attribute_code]
  );

  const assignedElementIds = useMemo(() => {
    if (!selectedRegleId) return new Set<string>();
    return new Set(
      regleItems.filter((x) => x.regle_id === selectedRegleId).map((x) => x.pep_element_id)
    );
  }, [regleItems, selectedRegleId]);

  const availableElements = useMemo(() => {
    return elements.filter((x) => !assignedElementIds.has(x.id));
  }, [elements, assignedElementIds]);

  const assignedElements = useMemo(() => {
    return elements.filter((x) => assignedElementIds.has(x.id));
  }, [elements, assignedElementIds]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedElement) {
      setElementForm({
        categorie: selectedElement.categorie,
        element: selectedElement.element,
        ordre: String(selectedElement.ordre ?? 0),
        actif: Boolean(selectedElement.actif),
      });
    } else {
      setElementForm({
        categorie: "",
        element: "",
        ordre: "0",
        actif: true,
      });
    }
  }, [selectedElement]);

  useEffect(() => {
    if (selectedLoc) {
      setLocForm({
        code: selectedLoc.code,
        description: selectedLoc.description,
        ordre: String(selectedLoc.ordre ?? 0),
        actif: Boolean(selectedLoc.actif),
      });
    } else {
      setLocForm({
        code: "",
        description: "",
        ordre: "0",
        actif: true,
      });
    }
  }, [selectedLoc]);

  useEffect(() => {
    if (selectedDef) {
      setDefForm({
        code: selectedDef.code,
        description: selectedDef.description,
        ordre: String(selectedDef.ordre ?? 0),
        actif: Boolean(selectedDef.actif),
      });
    } else {
      setDefForm({
        code: "",
        description: "",
        ordre: "0",
        actif: true,
      });
    }
  }, [selectedDef]);

  useEffect(() => {
    if (!selectedRegle) {
      setRegleForm(buildEmptyRuleForm());
      return;
    }

    if (selectedRegle.attribut) {
      setRegleForm({
        mode: "dynamic",
        fixed_field: "",
        fixed_value: "",
        attribute_code: selectedRegle.attribut ?? "",
attribute_value: selectedRegle.valeur ?? "",
        actif: Boolean(selectedRegle.actif),
      });
      return;
    }

    if (selectedRegle.type_unite) {
      setRegleForm({
        mode: "fixed",
        fixed_field: "type_unite",
        fixed_value: selectedRegle.type_unite,
        attribute_code: "",
        attribute_value: "",
        actif: Boolean(selectedRegle.actif),
      });
      return;
    }

    if (selectedRegle.motorisation) {
      setRegleForm({
        mode: "fixed",
        fixed_field: "motorisation",
        fixed_value: selectedRegle.motorisation,
        attribute_code: "",
        attribute_value: "",
        actif: Boolean(selectedRegle.actif),
      });
      return;
    }

    if (selectedRegle.freins) {
      setRegleForm({
        mode: "fixed",
        fixed_field: "freins",
        fixed_value: selectedRegle.freins,
        attribute_code: "",
        attribute_value: "",
        actif: Boolean(selectedRegle.actif),
      });
      return;
    }

    if (selectedRegle.type_freins) {
      setRegleForm({
        mode: "fixed",
        fixed_field: "type_freins",
        fixed_value: selectedRegle.type_freins,
        attribute_code: "",
        attribute_value: "",
        actif: Boolean(selectedRegle.actif),
      });
      return;
    }

    if (selectedRegle.suspension) {
      setRegleForm({
        mode: "fixed",
        fixed_field: "suspension",
        fixed_value: selectedRegle.suspension,
        attribute_code: "",
        attribute_value: "",
        actif: Boolean(selectedRegle.actif),
      });
      return;
    }

    setRegleForm(buildEmptyRuleForm());
  }, [selectedRegle]);

  async function loadAll() {
    setBusy(true);
    setError("");

    try {
      const [
        elementsRes,
        locsRes,
        defsRes,
        reglesRes,
        regleItemsRes,
        uniteOptionsRes,
        uniteAttributesRes,
      ] = await Promise.all([
        supabase
          .from("pep_elements")
          .select("*")
          .order("categorie", { ascending: true })
          .order("ordre", { ascending: true })
          .order("element", { ascending: true }),
        supabase
          .from("pep_loc")
          .select("*")
          .order("ordre", { ascending: true })
          .order("code", { ascending: true }),
        supabase
          .from("pep_def")
          .select("*")
          .order("ordre", { ascending: true })
          .order("code", { ascending: true }),
        supabase.from("pep_regles_so").select("*").order("id", { ascending: true }),
        supabase.from("pep_regles_so_items").select("*"),
        supabase
          .from("unite_options")
          .select("id,categorie,libelle,ordre,actif")
          .eq("actif", true)
          .order("categorie", { ascending: true })
          .order("ordre", { ascending: true })
          .order("libelle", { ascending: true }),
        supabase
          .from("unite_attributes")
          .select("id, code, libelle, type_valeur, categorie, ordre, actif")
          .eq("actif", true)
          .order("categorie", { ascending: true })
          .order("ordre", { ascending: true })
          .order("libelle", { ascending: true }),
      ]);

      if (elementsRes.error) throw elementsRes.error;
      if (locsRes.error) throw locsRes.error;
      if (defsRes.error) throw defsRes.error;
      if (reglesRes.error) throw reglesRes.error;
      if (regleItemsRes.error) throw regleItemsRes.error;
      if (uniteOptionsRes.error) throw uniteOptionsRes.error;
      if (uniteAttributesRes.error) throw uniteAttributesRes.error;

      setElements((elementsRes.data as PepElement[]) ?? []);
      setLocs((locsRes.data as PepLoc[]) ?? []);
      setDefs((defsRes.data as PepDef[]) ?? []);
      setRegles((reglesRes.data as PepRegle[]) ?? []);
      setRegleItems((regleItemsRes.data as PepRegleItem[]) ?? []);
      setUniteOptions((uniteOptionsRes.data as UniteOption[]) ?? []);
      setUniteAttributes((uniteAttributesRes.data as UniteAttribute[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addElement() {
    if (!elementForm.categorie.trim() || !elementForm.element.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_elements").insert({
        categorie: elementForm.categorie.trim(),
        element: elementForm.element.trim(),
        ordre: toNumberOrZero(elementForm.ordre),
        actif: elementForm.actif,
      });
      if (error) throw error;
      await loadAll();
      setSelectedElementId(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveElement() {
    if (!selectedElementId) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase
        .from("pep_elements")
        .update({
          categorie: elementForm.categorie.trim(),
          element: elementForm.element.trim(),
          ordre: toNumberOrZero(elementForm.ordre),
          actif: elementForm.actif,
        })
        .eq("id", selectedElementId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteElement() {
    if (!selectedElementId) return;
    if (!confirm("Supprimer cet élément PEP ?")) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_elements").delete().eq("id", selectedElementId);
      if (error) throw error;
      setSelectedElementId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addLoc() {
    if (!locForm.code.trim() || !locForm.description.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_loc").insert({
        code: locForm.code.trim(),
        description: locForm.description.trim(),
        ordre: toNumberOrZero(locForm.ordre),
        actif: locForm.actif,
      });
      if (error) throw error;
      await loadAll();
      setSelectedLocId(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveLoc() {
    if (!selectedLocId) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase
        .from("pep_loc")
        .update({
          code: locForm.code.trim(),
          description: locForm.description.trim(),
          ordre: toNumberOrZero(locForm.ordre),
          actif: locForm.actif,
        })
        .eq("id", selectedLocId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLoc() {
    if (!selectedLocId) return;
    if (!confirm("Supprimer ce LOC ?")) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_loc").delete().eq("id", selectedLocId);
      if (error) throw error;
      setSelectedLocId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addDef() {
    if (!defForm.code.trim() || !defForm.description.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_def").insert({
        code: defForm.code.trim(),
        description: defForm.description.trim(),
        ordre: toNumberOrZero(defForm.ordre),
        actif: defForm.actif,
      });
      if (error) throw error;
      await loadAll();
      setSelectedDefId(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDef() {
    if (!selectedDefId) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase
        .from("pep_def")
        .update({
          code: defForm.code.trim(),
          description: defForm.description.trim(),
          ordre: toNumberOrZero(defForm.ordre),
          actif: defForm.actif,
        })
        .eq("id", selectedDefId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDef() {
    if (!selectedDefId) return;
    if (!confirm("Supprimer ce DEF ?")) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_def").delete().eq("id", selectedDefId);
      if (error) throw error;
      setSelectedDefId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function buildRulePayload() {
  // 🔹 FIXED
  if (regleForm.mode === "fixed") {
    if (!regleForm.fixed_field || !regleForm.fixed_value.trim()) {
      setError("Champ et valeur requis.");
      return null;
    }

    return {
  type_unite: regleForm.fixed_field === "type_unite" ? regleForm.fixed_value.trim() : null,
  motorisation: regleForm.fixed_field === "motorisation" ? regleForm.fixed_value.trim() : null,
  freins: regleForm.fixed_field === "freins" ? regleForm.fixed_value.trim() : null,
  type_freins: regleForm.fixed_field === "type_freins" ? regleForm.fixed_value.trim() : null,
  suspension: regleForm.fixed_field === "suspension" ? regleForm.fixed_value.trim() : null,
  attribut: regleForm.fixed_field,          // 🔥 important
  valeur: regleForm.fixed_value.trim(),     // 🔥 important
  actif: regleForm.actif,
};
  }

  // 🔹 DYNAMIC
  if (!regleForm.attribute_code.trim()) {
    setError("Attribut requis.");
    return null;
  }

  // 🔥 BOOL → valeur automatique = "true"
if (selectedDynamicAttribute?.type_valeur === "bool") {
  if (regleForm.attribute_value === "") {
    setError("Valeur requise.");
    return null;
  }

  return {
    type_unite: null,
    motorisation: null,
    freins: null,
    type_freins: null,
    suspension: null,
    attribut: regleForm.attribute_code.trim(),
    valeur: regleForm.attribute_value, // "true" ou "false"
    actif: regleForm.actif,
  };
}
  // 🔥 AUTRES TYPES
  if (!regleForm.attribute_value.trim()) {
    setError("Valeur requise.");
    return null;
  }

  return {
    type_unite: null,
    motorisation: null,
    freins: null,
    type_freins: null,
    suspension: null,
    attribut: regleForm.attribute_code.trim(), // 🔥 FIX ICI
    valeur: regleForm.attribute_value.trim(),
    actif: regleForm.actif,
  };
}

  async function addRegle() {
    const payload = buildRulePayload();
if (!payload) return;

    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("pep_regles_so")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      await loadAll();
      setSelectedRegleId(data.id);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRegle() {
    if (!selectedRegleId) return;

    const payload = buildRulePayload();
    if (!payload) return;

    setBusy(true);
    setError("");
    try {
      const { error } = await supabase
        .from("pep_regles_so")
        .update(payload)
        .eq("id", selectedRegleId);

      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRegle() {
    if (!selectedRegleId) return;
    if (!confirm("Supprimer cette règle S/O ?")) return;

    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_regles_so").delete().eq("id", selectedRegleId);
      if (error) throw error;
      setSelectedRegleId(null);
      setSelectedAvailableElementId(null);
      setSelectedAssignedElementId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function assignSelectedElement() {
    if (!selectedRegleId || !selectedAvailableElementId) return;

    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("pep_regles_so_items").insert({
        regle_id: selectedRegleId,
        pep_element_id: selectedAvailableElementId,
      });

      if (error) throw error;
      setSelectedAvailableElementId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function unassignSelectedElement() {
    if (!selectedRegleId || !selectedAssignedElementId) return;

    setBusy(true);
    setError("");
    try {
      const row = regleItems.find(
        (x) => x.regle_id === selectedRegleId && x.pep_element_id === selectedAssignedElementId
      );
      if (!row) return;

      const { error } = await supabase.from("pep_regles_so_items").delete().eq("id", row.id);
      if (error) throw error;

      setSelectedAssignedElementId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function renderElementsTab() {
    return (
      <div style={styles.split}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Éléments PEP</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.formGrid2}>
              <div style={styles.field}>
                <label style={styles.label}>Catégorie</label>
                <input
                  style={styles.input}
                  value={elementForm.categorie}
                  onChange={(e) => setElementForm((p) => ({ ...p, categorie: e.target.value }))}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Élément</label>
                <input
                  style={styles.input}
                  value={elementForm.element}
                  onChange={(e) => setElementForm((p) => ({ ...p, element: e.target.value }))}
                />
              </div>
            </div>

            <div style={styles.formGrid2}>
              <div style={styles.field}>
                <label style={styles.label}>Ordre</label>
                <input
                  style={styles.input}
                  type="number"
                  value={elementForm.ordre}
                  onChange={(e) => setElementForm((p) => ({ ...p, ordre: e.target.value }))}
                />
              </div>
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={elementForm.actif}
                  onChange={(e) => setElementForm((p) => ({ ...p, actif: e.target.checked }))}
                />
                Actif
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={styles.btnPrimary} type="button" onClick={addElement} disabled={busy}>
                Ajouter
              </button>
              <button
                style={styles.btnSecondary}
                type="button"
                onClick={saveElement}
                disabled={busy || !selectedElementId}
              >
                Modifier
              </button>
              <button
                style={styles.btnDanger}
                type="button"
                onClick={deleteElement}
                disabled={busy || !selectedElementId}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Liste</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Catégorie</th>
                    <th style={styles.th}>Élément</th>
                    <th style={styles.th}>Ordre</th>
                    <th style={styles.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((row) => (
                    <tr
                      key={row.id}
                      style={selectedElementId === row.id ? styles.selectedRow : undefined}
                      onClick={() => setSelectedElementId(row.id)}
                    >
                      <td style={styles.td}>{row.categorie}</td>
                      <td style={styles.td}>{row.element}</td>
                      <td style={styles.td}>{row.ordre}</td>
                      <td style={styles.td}>
                        <span style={row.actif ? styles.statusOn : styles.statusOff}>
                          {row.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {elements.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        Aucun élément.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderLocTab() {
    return (
      <div style={styles.split}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>LOC</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.formGrid2}>
              <div style={styles.field}>
                <label style={styles.label}>Code LOC</label>
                <input
                  style={styles.input}
                  value={locForm.code}
                  onChange={(e) => setLocForm((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Ordre</label>
                <input
                  style={styles.input}
                  type="number"
                  value={locForm.ordre}
                  onChange={(e) => setLocForm((p) => ({ ...p, ordre: e.target.value }))}
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <input
                style={styles.input}
                value={locForm.description}
                onChange={(e) => setLocForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={locForm.actif}
                onChange={(e) => setLocForm((p) => ({ ...p, actif: e.target.checked }))}
              />
              Actif
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={styles.btnPrimary} type="button" onClick={addLoc} disabled={busy}>
                Ajouter
              </button>
              <button
                style={styles.btnSecondary}
                type="button"
                onClick={saveLoc}
                disabled={busy || !selectedLocId}
              >
                Modifier
              </button>
              <button
                style={styles.btnDanger}
                type="button"
                onClick={deleteLoc}
                disabled={busy || !selectedLocId}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Liste</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Ordre</th>
                    <th style={styles.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {locs.map((row) => (
                    <tr
                      key={row.id}
                      style={selectedLocId === row.id ? styles.selectedRow : undefined}
                      onClick={() => setSelectedLocId(row.id)}
                    >
                      <td style={styles.td}>{row.code}</td>
                      <td style={styles.td}>{row.description}</td>
                      <td style={styles.td}>{row.ordre}</td>
                      <td style={styles.td}>
                        <span style={row.actif ? styles.statusOn : styles.statusOff}>
                          {row.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {locs.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        Aucun LOC.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDefTab() {
    return (
      <div style={styles.split}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>DEF</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.formGrid2}>
              <div style={styles.field}>
                <label style={styles.label}>Code DEF</label>
                <input
                  style={styles.input}
                  value={defForm.code}
                  onChange={(e) => setDefForm((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Ordre</label>
                <input
                  style={styles.input}
                  type="number"
                  value={defForm.ordre}
                  onChange={(e) => setDefForm((p) => ({ ...p, ordre: e.target.value }))}
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <input
                style={styles.input}
                value={defForm.description}
                onChange={(e) => setDefForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={defForm.actif}
                onChange={(e) => setDefForm((p) => ({ ...p, actif: e.target.checked }))}
              />
              Actif
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={styles.btnPrimary} type="button" onClick={addDef} disabled={busy}>
                Ajouter
              </button>
              <button
                style={styles.btnSecondary}
                type="button"
                onClick={saveDef}
                disabled={busy || !selectedDefId}
              >
                Modifier
              </button>
              <button
                style={styles.btnDanger}
                type="button"
                onClick={deleteDef}
                disabled={busy || !selectedDefId}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Liste</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Ordre</th>
                    <th style={styles.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {defs.map((row) => (
                    <tr
                      key={row.id}
                      style={selectedDefId === row.id ? styles.selectedRow : undefined}
                      onClick={() => setSelectedDefId(row.id)}
                    >
                      <td style={styles.td}>{row.code}</td>
                      <td style={styles.td}>{row.description}</td>
                      <td style={styles.td}>{row.ordre}</td>
                      <td style={styles.td}>
                        <span style={row.actif ? styles.statusOn : styles.statusOff}>
                          {row.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {defs.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        Aucun DEF.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderRuleValueInput() {
    if (regleForm.mode === "fixed") {
      return (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Champ</label>
            <select
              style={styles.input}
              value={regleForm.fixed_field}
              onChange={(e) =>
                setRegleForm((p) => ({
                  ...p,
                  fixed_field: e.target.value as RegleForm["fixed_field"],
                  fixed_value: "",
                }))
              }
            >
              <option value="">—</option>
              {FIXED_FIELD_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Valeur</label>
            {fixedFieldValueOptions.length > 0 ? (
              <select
                style={styles.input}
                value={regleForm.fixed_value}
                onChange={(e) =>
                  setRegleForm((p) => ({
                    ...p,
                    fixed_value: e.target.value,
                  }))
                }
                disabled={!regleForm.fixed_field}
              >
                <option value="">—</option>
                {fixedFieldValueOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={styles.input}
                value={regleForm.fixed_value}
                onChange={(e) =>
                  setRegleForm((p) => ({
                    ...p,
                    fixed_value: e.target.value,
                  }))
                }
                disabled={!regleForm.fixed_field}
              />
            )}
          </div>
        </>
      );
    }

    return (
      <>
        <div style={styles.field}>
          <label style={styles.label}>Attribut dynamique</label>
          <select
            style={styles.input}
            value={regleForm.attribute_code}
            onChange={(e) =>
              setRegleForm((p) => ({
                ...p,
                attribute_code: e.target.value,
                attribute_value: "",
              }))
            }
          >
            <option value="">—</option>
            {uniteAttributes.map((attr) => (
              <option key={attr.id} value={attr.code}>
                {attr.libelle}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Valeur</label>
          {selectedDynamicAttribute?.type_valeur === "bool" ? (
  <select
    style={styles.input}
    value={regleForm.attribute_value}
    onChange={(e) =>
      setRegleForm((p) => ({
        ...p,
        attribute_value: e.target.value,
      }))
    }
    disabled={!regleForm.attribute_code}
  >
    <option value="">—</option>
    <option value="true">Oui</option>
    <option value="false">Non</option>
  </select>
) : selectedDynamicAttribute?.type_valeur === "liste" ? (
  <select
    style={styles.input}
    value={regleForm.attribute_value}
    onChange={(e) =>
      setRegleForm((p) => ({
        ...p,
        attribute_value: e.target.value,
      }))
    }
    disabled={!regleForm.attribute_code}
  >
    <option value="">—</option>
    {uniteOptions
      .filter((opt) => opt.categorie === selectedDynamicAttribute.code)
      .map((opt) => (
        <option key={opt.id} value={opt.libelle}>
          {opt.libelle}
        </option>
      ))}
  </select>
) : (
  <input
    style={styles.input}
    value={regleForm.attribute_value}
    onChange={(e) =>
      setRegleForm((p) => ({
        ...p,
        attribute_value: e.target.value,
      }))
    }
    disabled={!regleForm.attribute_code}
  />
)}
        </div>
      </>
    );
  }

  function renderReglesTab() {
  const isValidRule =
  regleForm.mode === "dynamic"
    ? !!regleForm.attribute_code &&
      (selectedDynamicAttribute?.type_valeur === "bool"
        ? regleForm.attribute_value !== ""
        : regleForm.attribute_value.trim() !== "")
    : !!regleForm.fixed_field && regleForm.fixed_value.trim() !== "";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={styles.split}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Règle S/O</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.field}>
              <label style={styles.label}>Type de règle</label>
              <select
                style={styles.input}
                value={regleForm.mode}
                onChange={(e) =>
                  setRegleForm({
                    mode: e.target.value as "fixed" | "dynamic",
                    fixed_field: "",
                    fixed_value: "",
                    attribute_code: "",
                    attribute_value: "",
                    actif: regleForm.actif,
                  })
                }
              >
                <option value="fixed">Config unité</option>
                <option value="dynamic">Attribut dynamique</option>
              </select>
            </div>

            <div style={styles.formGrid2}>{renderRuleValueInput()}</div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={regleForm.actif}
                onChange={(e) =>
                  setRegleForm((p) => ({ ...p, actif: e.target.checked }))
                }
              />
              Active
            </label>

            {/* 🔥 BOUTONS CORRIGÉS */}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={{
                  ...styles.btnPrimary,
                  opacity: isValidRule ? 1 : 0.5,
                  cursor: isValidRule ? "pointer" : "not-allowed",
                }}
                type="button"
                onClick={addRegle}
                disabled={busy || !isValidRule}
              >
                Ajouter règle S/O
              </button>

              <button
                style={{
                  ...styles.btnSecondary,
                  opacity: isValidRule && selectedRegleId ? 1 : 0.5,
                  cursor:
                    isValidRule && selectedRegleId
                      ? "pointer"
                      : "not-allowed",
                }}
                type="button"
                onClick={saveRegle}
                disabled={busy || !selectedRegleId || !isValidRule}
              >
                Modifier
              </button>

              <button
                style={styles.btnDanger}
                type="button"
                onClick={deleteRegle}
                disabled={busy || !selectedRegleId}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Liste des règles</div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Champ</th>
                    <th style={styles.th}>Valeur</th>
                    <th style={styles.th}>Éléments S/O</th>
                    <th style={styles.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {regles.map((row) => {
                    const count = regleItems.filter(
                      (x) => x.regle_id === row.id
                    ).length;
                    const info = getRuleLabel(row, uniteAttributes);

                    return (
                      <tr
                        key={row.id}
                        style={
                          selectedRegleId === row.id
                            ? styles.selectedRow
                            : undefined
                        }
                        onClick={() => {
                          setSelectedRegleId(row.id);
                          setSelectedAvailableElementId(null);
                          setSelectedAssignedElementId(null);
                        }}
                      >
                        <td style={styles.td}>{info.champ}</td>
                        <td style={styles.td}>{info.valeur}</td>
                        <td style={styles.td}>{count}</td>
                        <td style={styles.td}>
                          <span
                            style={
                              row.actif ? styles.statusOn : styles.statusOff
                            }
                          >
                            {row.actif ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {regles.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        Aucune règle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Éléments à cocher S/O</div>
          </div>
          <div style={styles.cardBody}>
            {!selectedRegle ? (
              <div style={styles.muted}>Sélectionne une règle S/O pour gérer ses éléments.</div>
            ) : (
              <>
                <div style={styles.muted}>
                  Règle sélectionnée :{" "}
                  <b>{getRuleLabel(selectedRegle, uniteAttributes).champ}</b> ={" "}
                  <b>{getRuleLabel(selectedRegle, uniteAttributes).valeur}</b>
                </div>

                <div style={styles.dualList}>
                  <div style={styles.listBox}>
                    <div style={styles.listHead}>Éléments disponibles</div>
                    <div style={styles.listBody}>
                      {availableElements.map((row) => {
                        const label = `${row.categorie} • ${row.element}`;
                        return (
                          <button
                            key={row.id}
                            type="button"
                            style={
                              selectedAvailableElementId === row.id
                                ? styles.listItemSelected
                                : styles.listItem
                            }
                            onClick={() => setSelectedAvailableElementId(row.id)}
                          >
                            {label}
                          </button>
                        );
                      })}
                      {availableElements.length === 0 && (
                        <div style={{ padding: 12, color: "#6b7280" }}>Aucun élément disponible.</div>
                      )}
                    </div>
                  </div>

                  <div style={styles.centerButtons}>
                    <button
                      type="button"
                      style={styles.btnPrimary}
                      onClick={assignSelectedElement}
                      disabled={busy || !selectedAvailableElementId}
                    >
                      &gt;&gt; Ajouter
                    </button>
                    <button
                      type="button"
                      style={styles.btnSecondary}
                      onClick={unassignSelectedElement}
                      disabled={busy || !selectedAssignedElementId}
                    >
                      &lt;&lt; Retirer
                    </button>
                  </div>

                  <div style={styles.listBox}>
                    <div style={styles.listHead}>S/O sélectionnés</div>
                    <div style={styles.listBody}>
                      {assignedElements.map((row) => {
                        const label = `${row.categorie} • ${row.element}`;
                        return (
                          <button
                            key={row.id}
                            type="button"
                            style={
                              selectedAssignedElementId === row.id
                                ? styles.listItemSelected
                                : styles.listItem
                            }
                            onClick={() => setSelectedAssignedElementId(row.id)}
                          >
                            {label}
                          </button>
                        );
                      })}
                      {assignedElements.length === 0 && (
                        <div style={{ padding: 12, color: "#6b7280" }}>Aucun élément associé.</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <h1 style={styles.title}>Administration PEP</h1>
          <div style={styles.subtitle}>
            Gère les éléments du formulaire, les codes LOC/DEF et les règles S/O.
          </div>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            style={tab === "elements" ? styles.tabActive : styles.tab}
            onClick={() => setTab("elements")}
          >
            Éléments PEP
          </button>
          <button
            type="button"
            style={tab === "loc" ? styles.tabActive : styles.tab}
            onClick={() => setTab("loc")}
          >
            LOC
          </button>
          <button
            type="button"
            style={tab === "def" ? styles.tabActive : styles.tab}
            onClick={() => setTab("def")}
          >
            DEF
          </button>
          <button
            type="button"
            style={tab === "regles" ? styles.tabActive : styles.tab}
            onClick={() => setTab("regles")}
          >
            Règles S/O
          </button>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      {tab === "elements" && renderElementsTab()}
      {tab === "loc" && renderLocTab()}
      {tab === "def" && renderDefTab()}
      {tab === "regles" && renderReglesTab()}
    </div>
  );
}