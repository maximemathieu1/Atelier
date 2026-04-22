import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";

type EmployePep = {
  id: string;
  auth_user_id: string | null;
  nom_complet: string;
  numero_mecano: string | null;
  initiales: string | null;
  pep_actif: boolean;
  signature_nom: string | null;
};

type UniteRow = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  niv: string | null;
  plaque: string | null;
  statut: string;
  km_actuel: number | null;
  date_mise_en_service: string | null;
  type_unite_id: string | null;
  motorisation_id: string | null;
  freins_id: string | null;
  type_freins_id: string | null;
  suspension_id: string | null;
  pnbv: number | null;
  groupe_accessoire: string | null;
};

type OptionRow = {
  id: string;
  categorie:
    | "type_unite"
    | "motorisation"
    | "freins"
    | "type_freins"
    | "suspension"
    | "groupe_accessoire";
  libelle: string;
  ordre: number;
  actif: boolean;
};

type PepElement = {
  id: string;
  categorie: string;
  code: string | null;
  element: string;
  ordre: number;
  actif: boolean;
  categorie_ordre?: number | null;
};

type PepLoc = {
  id: string;
  code: string;
  description: string;
  ordre: number;
  actif: boolean;
};

type PepDef = {
  id: string;
  code: string;
  description: string;
  ordre: number;
  actif: boolean;
};

type PepFormState = {
  unite_id: string;
  date_inspection: string;
  odometre: string;
  commentaires: string;
};

type DefautItem = {
  id: string;
  categorie: string;
  element: string;
  element_id: string | null;
  loc_id: string | null;
  def_id: string | null;
  gravite: "Min" | "Maj";
};

type DefautDraft = {
  categorie: string;
  elementId: string;
  locId: string;
  defId: string;
  gravite: "Min" | "Maj";
};

type MeasureField = {
  key: string;
  code: "PE" | "FR" | "PI";
};

type GenericRow = Record<string, any>;

type PepUnitAttributeValue = {
  attribute_code: string;
  type_valeur: "bool" | "texte" | "nombre" | "liste";
  valeur_bool: boolean | null;
  valeur_text: string | null;
  valeur_number: number | null;
  valeur_option: string | null;
};



const LEFT_TOP: MeasureField[] = [
  { key: "left_top_pe", code: "PE" },
  { key: "left_top_fr", code: "FR" },
];

const LEFT_BOTTOM: MeasureField[] = [
  { key: "left_bottom_pe", code: "PE" },
  { key: "left_bottom_fr", code: "FR" },
  { key: "left_bottom_pi", code: "PI" },
];

const RIGHT_TOP: MeasureField[] = [
  { key: "right_top_fr", code: "FR" },
  { key: "right_top_pe", code: "PE" },
];

const RIGHT_BOTTOM: MeasureField[] = [
  { key: "right_bottom_pi", code: "PI" },
  { key: "right_bottom_fr", code: "FR" },
  { key: "right_bottom_pe", code: "PE" },
];

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMonthsIso(dateStr: string, months: number): string {
  if (!dateStr) return "";
  const base = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";

  const originalDay = base.getDate();
  base.setMonth(base.getMonth() + months);

  if (base.getDate() < originalDay) {
    base.setDate(0);
  }

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeStr(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnitSearch(value: string): string {
  return normalizeStr(value).replace(/\s+/g, "");
}

function findOptionLabel(options: OptionRow[], id: string | null | undefined): string {
  if (!id) return "";
  return options.find((o) => o.id === id)?.libelle ?? "";
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function firstDefined(obj: GenericRow | null | undefined, keys: string[]) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function truthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const n = normalizeStr(value);
  return ["1", "true", "oui", "yes", "actif"].includes(n);
}

function toSetKey(categorie: string, element: string): string {
  return `${normalizeStr(categorie)}|||${normalizeStr(element)}`;
}

function compareFlex(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    const av = truthyFlag(a);
    const bv = truthyFlag(b);
    return av === bv;
  }

  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }

  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return false;
  return na === nb;
}

function getRuleActive(rule: GenericRow): boolean {
  const value = firstDefined(rule, ["actif", "is_active", "enabled"]);
  if (value === undefined) return true;
  return truthyFlag(value);
}

function getItemActive(item: GenericRow): boolean {
  const value = firstDefined(item, ["actif", "is_active", "enabled"]);
  if (value === undefined) return true;
  return truthyFlag(value);
}


const styles: Record<string, CSSProperties> = {
  page: {
    padding: 16,
    display: "grid",
    gap: 14,
  },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  titleWrap: {
    minWidth: 220,
  },

  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.15,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },

  mechBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 700,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "visible",
  },

  cardHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 800,
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    flexWrap: "wrap",
  },

  cardBody: {
    padding: 14,
    display: "grid",
    gap: 14,
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
    minHeight: 42,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    padding: "0 12px",
    fontSize: 14,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    minHeight: 110,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    padding: 12,
    fontSize: 14,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },

  compactSelectedUnit: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#ffffff",
  },

  compactSelectedUnitLeft: {
    display: "grid",
    gap: 2,
  },

  compactSelectedUnitTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#111827",
  },

  compactSelectedUnitSub: {
    fontSize: 12,
    color: "#6b7280",
  },

  alertError: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },

  alertInfo: {
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },

  alertWarn: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },

  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  btnPrimary: {
    minHeight: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  btnSecondary: {
    minHeight: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  comboWrap: {
    position: "relative",
  },

  comboMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    maxHeight: 260,
    overflowY: "auto",
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    boxShadow: "0 12px 24px rgba(0,0,0,0.10)",
    zIndex: 2000,
  },

  comboItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    color: "#111827",
    borderBottom: "1px solid #f3f4f6",
  },

  comboItemMuted: {
    padding: "10px 12px",
    fontSize: 14,
    color: "#6b7280",
  },

  measuresWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  measuresSide: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },

  sideTitle: {
    fontWeight: 800,
    color: "#111827",
    marginBottom: 10,
  },

  sideInnerTop2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 10,
  },

  sideInnerBottom3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  measureCell: {
    display: "grid",
    gap: 6,
    justifyItems: "center",
  },

  measureCode: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
  },

  measureInput: {
    width: "100%",
    minHeight: 34,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 8px",
    textAlign: "center",
    fontSize: 14,
    boxSizing: "border-box",
  },

  defectsTableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
  },

  defectsTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 720,
  },

  th: {
    padding: "10px 8px",
    fontSize: 12,
    color: "#6b7280",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "8px",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "middle",
    fontSize: 14,
  },

  rowSelected: {
    background: "#eff6ff",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 700,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10000,
  },

  modalCard: {
    width: "100%",
    maxWidth: 640,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,.08)",
    boxShadow: "0 24px 60px rgba(0,0,0,.18)",
    overflow: "hidden",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(0,0,0,.08)",
    gap: 12,
  },

  modalBody: {
    padding: 16,
    display: "grid",
    gap: 12,
    maxHeight: "70vh",
    overflowY: "auto",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 16,
    borderTop: "1px solid rgba(0,0,0,.08)",
  },

  modalTitle: {
    fontWeight: 800,
    color: "#111827",
  },

  radioRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
};

export default function PepNouvelle() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(true);

  const [error, setError] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [unitsError, setUnitsError] = useState("");

  const [employe, setEmploye] = useState<EmployePep | null>(null);
  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [pepElements, setPepElements] = useState<PepElement[]>([]);
  const [pepLocs, setPepLocs] = useState<PepLoc[]>([]);
  const [pepDefs, setPepDefs] = useState<PepDef[]>([]);
  const [reglesSo, setReglesSo] = useState<GenericRow[]>([]);
  const [reglesSoItems, setReglesSoItems] = useState<GenericRow[]>([]);
  const [unitDynamicAttributes, setUnitDynamicAttributes] = useState<Record<string, any>>({});

  const [form, setForm] = useState<PepFormState>({
    unite_id: "",
    date_inspection: todayIso(),
    odometre: "",
    commentaires: "",
  });

  const [unitQuery, setUnitQuery] = useState("");
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);

  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  const [defauts, setDefauts] = useState<DefautItem[]>([]);
  const [selectedDefautId, setSelectedDefautId] = useState<string | null>(null);

  const [openDefautModal, setOpenDefautModal] = useState(false);
  const [defautDraft, setDefautDraft] = useState<DefautDraft>({
    categorie: "",
    elementId: "",
    locId: "",
    defId: "",
    gravite: "Min",
  });

  const comboRef = useRef<HTMLDivElement | null>(null);

  const uniteSelectionnee = useMemo(
    () => unites.find((u) => u.id === form.unite_id) ?? null,
    [unites, form.unite_id]
  );

  const filteredUnites = useMemo(() => {
    const q = normalizeUnitSearch(unitQuery);
    if (!q) return unites.slice(0, 25);
    return unites.filter((u) => normalizeUnitSearch(u.no_unite).includes(q)).slice(0, 25);
  }, [unites, unitQuery]);

  const dateProchaineInspection = useMemo(
    () => (form.date_inspection ? addMonthsIso(form.date_inspection, 3) : ""),
    [form.date_inspection]
  );

  const summaryContext = useMemo(() => {
    return {
      typeUnite: findOptionLabel(options, uniteSelectionnee?.type_unite_id),
      motorisation: findOptionLabel(options, uniteSelectionnee?.motorisation_id),
      freins: findOptionLabel(options, uniteSelectionnee?.freins_id),
      typeFreins: findOptionLabel(options, uniteSelectionnee?.type_freins_id),
      suspension: findOptionLabel(options, uniteSelectionnee?.suspension_id),
    };
  }, [options, uniteSelectionnee]);

  const categories = useMemo(() => {
    return Array.from(new Set(pepElements.map((x) => x.categorie))).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
  }, [pepElements]);

  const unitContextForRules = useMemo(() => {
    return {
      unite_id: uniteSelectionnee?.id ?? "",
      type_unite_id: uniteSelectionnee?.type_unite_id ?? "",
      motorisation_id: uniteSelectionnee?.motorisation_id ?? "",
      freins_id: uniteSelectionnee?.freins_id ?? "",
      type_freins_id: uniteSelectionnee?.type_freins_id ?? "",
      suspension_id: uniteSelectionnee?.suspension_id ?? "",
      type_unite: summaryContext.typeUnite,
      motorisation: summaryContext.motorisation,
      freins: summaryContext.freins,
      type_freins: summaryContext.typeFreins,
      suspension: summaryContext.suspension,
      dynamic_attributes: unitDynamicAttributes,
    };
  }, [uniteSelectionnee, summaryContext, unitDynamicAttributes]);

  function matchRuleToUnit(rule: GenericRow): boolean {
    if (!uniteSelectionnee) return false;
    if (!getRuleActive(rule)) return false;

    const checks: Array<{ ruleKeys: string[]; unitValues: unknown[] }> = [
      {
        ruleKeys: ["unite_id"],
        unitValues: [unitContextForRules.unite_id],
      },
      {
        ruleKeys: ["type_unite_id"],
        unitValues: [unitContextForRules.type_unite_id],
      },
      {
        ruleKeys: ["type_unite", "type_unite_libelle", "type_unite_label"],
        unitValues: [unitContextForRules.type_unite_id, unitContextForRules.type_unite],
      },
      {
        ruleKeys: ["motorisation_id"],
        unitValues: [unitContextForRules.motorisation_id],
      },
      {
        ruleKeys: ["motorisation", "motorisation_libelle", "motorisation_label"],
        unitValues: [unitContextForRules.motorisation_id, unitContextForRules.motorisation],
      },
      {
        ruleKeys: ["freins_id"],
        unitValues: [unitContextForRules.freins_id],
      },
      {
        ruleKeys: ["freins", "freins_libelle", "freins_label"],
        unitValues: [unitContextForRules.freins_id, unitContextForRules.freins],
      },
      {
        ruleKeys: ["type_freins_id"],
        unitValues: [unitContextForRules.type_freins_id],
      },
      {
        ruleKeys: ["type_freins", "type_freins_libelle", "type_freins_label"],
        unitValues: [unitContextForRules.type_freins_id, unitContextForRules.type_freins],
      },
      {
        ruleKeys: ["suspension_id"],
        unitValues: [unitContextForRules.suspension_id],
      },
      {
        ruleKeys: ["suspension", "suspension_libelle", "suspension_label"],
        unitValues: [unitContextForRules.suspension_id, unitContextForRules.suspension],
      },
    ];

    let hasAtLeastOneCondition = false;

    for (const check of checks) {
      const ruleValue = firstDefined(rule, check.ruleKeys);
      if (ruleValue === undefined) continue;

      hasAtLeastOneCondition = true;
      const ok = check.unitValues.some((unitValue) => compareFlex(ruleValue, unitValue));
      if (!ok) return false;
    }

    const dynamicAttributeCode = firstDefined(rule, [
  "attribute_code",
  "attribut_code",
  "attribute",
  "attribut",
]);

const dynamicAttributeValue = firstDefined(rule, [
  "attribute_value",
  "attribut_valeur",
  "value",
  "valeur",
]);

const fixedFieldNames = new Set([
  "unite_id",
  "type_unite",
  "type_unite_id",
  "motorisation",
  "motorisation_id",
  "freins",
  "freins_id",
  "type_freins",
  "type_freins_id",
  "suspension",
  "suspension_id",
]);

const isTrueDynamicRule =
  dynamicAttributeCode !== undefined &&
  !fixedFieldNames.has(String(dynamicAttributeCode));

if (isTrueDynamicRule) {
  hasAtLeastOneCondition = true;

  const attr =
    unitContextForRules.dynamic_attributes?.[String(dynamicAttributeCode)];

  if (!attr) return false;

  if (!compareFlex(attr.value, dynamicAttributeValue)) {
    return false;
  }
}

    return hasAtLeastOneCondition;
  }

  const autoSoSet = useMemo(() => {
    const result = new Set<string>();
    if (!uniteSelectionnee) return result;
    if (reglesSo.length === 0 || reglesSoItems.length === 0) return result;

    const matchedRuleIds = new Set(
      reglesSo
        .filter((rule) => matchRuleToUnit(rule))
        .map((rule) => firstDefined(rule, ["id"]))
        .filter(Boolean)
        .map((id) => String(id))
    );

    if (matchedRuleIds.size === 0) return result;

    for (const item of reglesSoItems) {
      if (!getItemActive(item)) continue;

      const ruleId = firstDefined(item, ["regle_id", "pep_regle_so_id", "pep_regles_so_id", "rule_id"]);
      if (!ruleId || !matchedRuleIds.has(String(ruleId))) continue;

      const elementId = firstDefined(item, ["element_id", "pep_element_id"]);
      const categorie =
        firstDefined(item, ["categorie", "pep_categorie", "categorie_element"]) ??
        (elementId
          ? pepElements.find((el) => el.id === String(elementId))?.categorie
          : undefined);
      const element =
        firstDefined(item, ["element", "pep_element", "element_nom"]) ??
        (elementId
          ? pepElements.find((el) => el.id === String(elementId))?.element
          : undefined);

      if (!categorie || !element) continue;
      result.add(toSetKey(String(categorie), String(element)));
    }

    return result;
  }, [uniteSelectionnee, reglesSo, reglesSoItems, pepElements, unitContextForRules]);

  const autoSoCount = autoSoSet.size;

  const availableElements = useMemo(() => {
    if (!defautDraft.categorie) return [];
    return pepElements
      .filter((x) => x.actif && x.categorie === defautDraft.categorie)
      .sort((a, b) => {
        const ao = Number(a.ordre ?? 0);
        const bo = Number(b.ordre ?? 0);
        if (ao !== bo) return ao - bo;
        return a.element.localeCompare(b.element, "fr", { sensitivity: "base" });
      });
  }, [pepElements, defautDraft.categorie]);

  const selectedDraftElement = useMemo(() => {
    return pepElements.find((x) => x.id === defautDraft.elementId) ?? null;
  }, [pepElements, defautDraft.elementId]);

  const selectedDraftElementIsAutoSo = useMemo(() => {
    if (!selectedDraftElement) return false;
    return autoSoSet.has(toSetKey(selectedDraftElement.categorie, selectedDraftElement.element));
  }, [selectedDraftElement, autoSoSet]);

  const canContinue = Boolean(
    employe &&
      form.unite_id &&
      form.date_inspection &&
      form.odometre &&
      !employeeError &&
      !unitsError
  );

  function getLocLabel(id: string | null) {
    if (!id) return "";
    const row = pepLocs.find((x) => x.id === id);
    return row ? `${row.code} - ${row.description}` : "";
  }

  function getDefLabel(id: string | null) {
    if (!id) return "";
    const row = pepDefs.find((x) => x.id === id);
    return row ? `${row.code} - ${row.description}` : "";
  }

   function handleContinuer() {
    try {
      if (!uniteSelectionnee || !employe) return;

      const defectsFormatted = defauts.map((d) => {
        const loc = pepLocs.find((x) => x.id === d.loc_id);
        const def = pepDefs.find((x) => x.id === d.def_id);

        return {
          categorie: d.categorie,
          element: d.element,
          loc_code: loc?.code ?? "",
          def_code: def?.code ?? "",
          gravite: d.gravite,
        };
      });

      const rulesSoFormatted = Array.from(autoSoSet).map((key) => {
        const [cat, el] = key.split("|||");
        return { cat, el };
      });

      const mappedMeasures = {
        T_AVG: measurements.left_top_pe ?? "",
        B_AVG: measurements.left_top_fr ?? "",

        T_ARG: measurements.left_bottom_pe ?? "",
        B_ARG: measurements.left_bottom_fr ?? "",
        T_ARIG: measurements.left_bottom_pi ?? "",

        B_AVD: measurements.right_top_fr ?? "",
        T_AVD: measurements.right_top_pe ?? "",

        T_ARID: measurements.right_bottom_pi ?? "",
        B_ARD: measurements.right_bottom_fr ?? "",
        T_ARD: measurements.right_bottom_pe ?? "",
      };

      const payload = {
  unite_id: uniteSelectionnee.id ?? "",
  unite: uniteSelectionnee.no_unite ?? "",
  marque: uniteSelectionnee.marque ?? "",
  modele: uniteSelectionnee.modele ?? "",
  annee: uniteSelectionnee.annee != null ? String(uniteSelectionnee.annee) : "",
  odom: form.odometre ?? "",
  niv: uniteSelectionnee.niv ?? "",
  plaque: uniteSelectionnee.plaque ?? "",
  pnbv: uniteSelectionnee.pnbv != null ? String(uniteSelectionnee.pnbv) : "",
  type: summaryContext.typeUnite ?? "",
  raison: "10",
  num_mecano: employe.numero_mecano ?? "",
  date_pep: form.date_inspection ?? "",
  date_prochain: dateProchaineInspection ?? "",
  rules_so_active: rulesSoFormatted,
  defects: defectsFormatted,
  commentaires: form.commentaires ?? "",
  measures: mappedMeasures,
};

      navigate("/pep/final", {
        state: {
          payload,
        },
      });
    } catch (e: any) {
      setError(e?.message ?? "Impossible de préparer le PEP.");
    }
  }

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setLoading(true);
      setError("");
      setEmployeeError("");
      setUnitsError("");

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (!alive) return;

        if (authError) {
          setError("Impossible de récupérer l’utilisateur connecté.");
          setLoading(false);
          setEmployeeLoading(false);
          setUnitsLoading(false);
          return;
        }

        const user = authData.user;
        if (!user) {
          setError("Aucun utilisateur connecté.");
          setLoading(false);
          setEmployeeLoading(false);
          setUnitsLoading(false);
          return;
        }

        const employePromise = supabase
          .from("employes")
          .select("id, auth_user_id, nom_complet, numero_mecano, initiales, pep_actif, signature_nom")
          .eq("auth_user_id", user.id)
          .single();

        const unitesPromise = supabase
          .from("unites")
          .select(
            [
              "id",
              "no_unite",
              "marque",
              "modele",
              "annee",
              "niv",
              "plaque",
              "statut",
              "km_actuel",
              "date_mise_en_service",
              "type_unite_id",
              "motorisation_id",
              "freins_id",
              "type_freins_id",
              "suspension_id",
              "pnbv",
              "groupe_accessoire",
            ].join(",")
          )
          .order("no_unite", { ascending: true });

        const optionsPromise = supabase
          .from("unite_options")
          .select("id,categorie,libelle,ordre,actif")
          .eq("actif", true)
          .order("categorie", { ascending: true })
          .order("ordre", { ascending: true })
          .order("libelle", { ascending: true });

        const pepElementsPromise = supabase
          .from("pep_elements")
          .select("*")
          .eq("actif", true)
          .order("categorie", { ascending: true })
          .order("ordre", { ascending: true })
          .order("element", { ascending: true });

        const pepLocsPromise = supabase
          .from("pep_loc")
          .select("*")
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("code", { ascending: true });

        const pepDefsPromise = supabase
          .from("pep_def")
          .select("*")
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("code", { ascending: true });

        const reglesSoPromise = supabase
          .from("pep_regles_so")
          .select("*")
          .order("id", { ascending: true });

        const reglesSoItemsPromise = supabase
          .from("pep_regles_so_items")
          .select("*")
          .order("id", { ascending: true });

        const [
          employeRes,
          unitesRes,
          optionsRes,
          pepElementsRes,
          pepLocsRes,
          pepDefsRes,
          reglesSoRes,
          reglesSoItemsRes,
        ] = await Promise.all([
          employePromise,
          unitesPromise,
          optionsPromise,
          pepElementsPromise,
          pepLocsPromise,
          pepDefsPromise,
          reglesSoPromise,
          reglesSoItemsPromise,
        ]);

        if (!alive) return;

        if (employeRes.error) {
          setEmployeeError("Aucun employé lié à cet utilisateur.");
          setEmploye(null);
        } else {
          const employeRow = employeRes.data as EmployePep;
          if (!employeRow.pep_actif) {
            setEmployeeError("Cet employé n’est pas autorisé à remplir des fiches PEP.");
            setEmploye(null);
          } else {
            setEmploye(employeRow);
          }
        }

        if (unitesRes.error) {
          setUnitsError("Impossible de charger les unités.");
          setUnites([]);
        } else {
          setUnites((unitesRes.data ?? []) as unknown as UniteRow[]);
        }

        if (optionsRes.error) {
          setOptions([]);
        } else {
          setOptions((optionsRes.data ?? []) as OptionRow[]);
        }

        if (pepElementsRes.error) throw pepElementsRes.error;
        if (pepLocsRes.error) throw pepLocsRes.error;
        if (pepDefsRes.error) throw pepDefsRes.error;

        setPepElements((pepElementsRes.data ?? []) as PepElement[]);
        setPepLocs((pepLocsRes.data ?? []) as PepLoc[]);
        setPepDefs((pepDefsRes.data ?? []) as PepDef[]);

        if (reglesSoRes.error) {
          console.error("Erreur pep_regles_so:", reglesSoRes.error);
          setReglesSo([]);
        } else {
          setReglesSo((reglesSoRes.data ?? []) as GenericRow[]);
        }

        if (reglesSoItemsRes.error) {
          console.error("Erreur pep_regles_so_items:", reglesSoItemsRes.error);
          setReglesSoItems([]);
        } else {
          setReglesSoItems((reglesSoItemsRes.data ?? []) as GenericRow[]);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Une erreur imprévue est survenue pendant le chargement.");
      } finally {
        if (!alive) return;
        setEmployeeLoading(false);
        setUnitsLoading(false);
        setLoading(false);
      }
    }

    loadAll();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!uniteSelectionnee) return;

    setUnitQuery(uniteSelectionnee.no_unite);

    setForm((prev) => ({
      ...prev,
      odometre:
        prev.odometre ||
        (uniteSelectionnee.km_actuel != null ? String(uniteSelectionnee.km_actuel) : ""),
    }));
  }, [uniteSelectionnee]);

  useEffect(() => {
    let alive = true;

    async function loadUnitDynamicAttributes() {
      if (!form.unite_id) {
        setUnitDynamicAttributes({});
        return;
      }

      const { data, error } = await supabase
        .from("v_unites_attributes")
        .select(
          "attribute_code, type_valeur, valeur_bool, valeur_text, valeur_number, valeur_option"
        )
        .eq("unite_id", form.unite_id);

      if (!alive) return;

      if (error) {
        console.error("Erreur chargement attributs dynamiques unité:", error);
        setUnitDynamicAttributes({});
        return;
      }

      const map: Record<string, { value: any; type: string }> = {};

      for (const row of (data ?? []) as PepUnitAttributeValue[]) {
        let value: any = null;

        if (row.type_valeur === "bool") value = row.valeur_bool ?? false;
        else if (row.type_valeur === "texte") value = row.valeur_text ?? "";
        else if (row.type_valeur === "nombre") value = row.valeur_number ?? null;
        else if (row.type_valeur === "liste") value = row.valeur_option ?? "";

        map[row.attribute_code] = {
          value,
          type: row.type_valeur,
        };
      }

      setUnitDynamicAttributes(map);
    }

    loadUnitDynamicAttributes();

    return () => {
      alive = false;
    };
  }, [form.unite_id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!comboRef.current) return;
      if (!comboRef.current.contains(e.target as Node)) {
        setUnitMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
  if (defauts.length === 0 || autoSoSet.size === 0) return;

  let removedSelected = false;

  const nextDefauts = defauts.filter((d) => {
    if (!d.categorie || !d.element) return true;

    const isAutoSo = autoSoSet.has(toSetKey(d.categorie, d.element));

    if (isAutoSo && selectedDefautId === d.id) {
      removedSelected = true;
    }

    return !isAutoSo;
  });

  if (nextDefauts.length === defauts.length) return;

  setDefauts(nextDefauts);

  if (removedSelected) {
    setSelectedDefautId(null);
  } else if (selectedDefautId) {
    const stillExists = nextDefauts.some((d) => d.id === selectedDefautId);
    if (!stillExists) {
      setSelectedDefautId(null);
    }
  }
}, [autoSoSet, defauts, selectedDefautId]);

  function updateField<K extends keyof PepFormState>(key: K, value: PepFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateMeasurement(key: string, value: string) {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm({
      unite_id: "",
      date_inspection: todayIso(),
      odometre: "",
      commentaires: "",
    });
    setUnitQuery("");
    setUnitMenuOpen(false);
    setMeasurements({});
    setDefauts([]);
    setSelectedDefautId(null);
    setUnitDynamicAttributes({});
  }

  function handleUnitSearchChange(value: string) {
    setUnitQuery(value);
    setUnitMenuOpen(true);

    if (!value.trim()) {
      setForm((prev) => ({ ...prev, unite_id: "" }));
      setUnitDynamicAttributes({});
      return;
    }

    const exact = unites.find(
      (u) => normalizeUnitSearch(u.no_unite) === normalizeUnitSearch(value)
    );

    if (exact) {
      setForm((prev) => ({ ...prev, unite_id: exact.id }));
    } else {
      setForm((prev) => ({ ...prev, unite_id: "" }));
      setUnitDynamicAttributes({});
    }
  }

  function handleSelectUnit(unit: UniteRow) {
    setForm((prev) => ({
      ...prev,
      unite_id: unit.id,
      odometre: prev.odometre || (unit.km_actuel != null ? String(unit.km_actuel) : ""),
    }));
    setUnitQuery(unit.no_unite);
    setUnitMenuOpen(false);
  }

    function openAddDefautModal() {
    setDefautDraft({
      categorie: "",
      elementId: "",
      locId: "",
      defId: "",
      gravite: "Min",
    });
    setOpenDefautModal(true);
  }

  function applyDefautDraft() {
    if (!defautDraft.categorie || !defautDraft.elementId) return;

    const selectedElement = pepElements.find((x) => x.id === defautDraft.elementId);
    if (!selectedElement) return;

    const isAutoSo = autoSoSet.has(toSetKey(selectedElement.categorie, selectedElement.element));
    if (isAutoSo) return;

    const next: DefautItem = {
      id: makeId(),
      categorie: defautDraft.categorie,
      element: selectedElement.element,
      element_id: selectedElement.id,
      loc_id: defautDraft.locId || null,
      def_id: defautDraft.defId || null,
      gravite: defautDraft.gravite,
    };

    setDefauts((prev) => [...prev, next]);
    setSelectedDefautId(next.id);
    setOpenDefautModal(false);
  }

  function removeSelectedDefaut() {
    if (!selectedDefautId) return;
    setDefauts((prev) => prev.filter((d) => d.id !== selectedDefautId));
    setSelectedDefautId(null);
  }

  function clearDefauts() {
    setDefauts([]);
    setSelectedDefautId(null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div style={styles.titleWrap}>
          <h1 style={styles.title}>Nouvelle fiche PEP</h1>
          <div style={styles.subtitle}>
            Formulaire PEP sans aperçu final avant impression.
          </div>
        </div>

        <div style={styles.mechBadge}>
          {employeeLoading
            ? "Chargement…"
            : employe
              ? `${employe.nom_complet}${employe.numero_mecano ? ` • #${employe.numero_mecano}` : ""}`
              : "Employé non disponible"}
        </div>
      </div>

      {error ? <div style={styles.alertError}>{error}</div> : null}
      {!error && employeeError ? <div style={styles.alertError}>{employeeError}</div> : null}
      {!error && !unitsError && loading ? (
        <div style={styles.alertInfo}>Chargement du module PEP…</div>
      ) : null}

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span>Unité</span>
        </div>

        <div style={styles.cardBody}>
          {!uniteSelectionnee ? (
            <div style={styles.field}>
              <label style={styles.label} htmlFor="pep-unite-search">
                Numéro d’unité
              </label>

              <div style={styles.comboWrap} ref={comboRef}>
                <input
                  id="pep-unite-search"
                  type="text"
                  value={unitQuery}
                  onChange={(e) => handleUnitSearchChange(e.target.value)}
                  onFocus={() => setUnitMenuOpen(true)}
                  placeholder={unitsLoading ? "Chargement des unités…" : "Taper un numéro d’unité"}
                  style={styles.input}
                  autoComplete="off"
                  disabled={unitsLoading || Boolean(unitsError)}
                />

                {unitMenuOpen && !unitsLoading && !unitsError ? (
                  <div style={styles.comboMenu}>
                    {filteredUnites.length > 0 ? (
                      filteredUnites.map((unit) => (
                        <button
                          key={unit.id}
                          type="button"
                          style={styles.comboItem}
                          onClick={() => handleSelectUnit(unit)}
                        >
                          {unit.no_unite}
                        </button>
                      ))
                    ) : (
                      <div style={styles.comboItemMuted}>Aucune unité trouvée</div>
                    )}
                  </div>
                ) : null}
              </div>

              {unitsError ? <div style={styles.alertError}>{unitsError}</div> : null}
            </div>
          ) : (
            <div style={styles.compactSelectedUnit}>
              <div style={styles.compactSelectedUnitLeft}>
                <div style={styles.compactSelectedUnitTitle}>
                  Unité {uniteSelectionnee.no_unite}
                </div>
                <div style={styles.compactSelectedUnitSub}>
                  {[uniteSelectionnee.marque, uniteSelectionnee.modele, uniteSelectionnee.annee]
                    .filter((v) => v !== null && v !== undefined && v !== "")
                    .join(" ") || "Aucune description"}
                </div>
                <div style={styles.compactSelectedUnitSub}>
                  {[
                    summaryContext.typeUnite,
                    summaryContext.motorisation,
                    summaryContext.freins,
                    summaryContext.typeFreins,
                    summaryContext.suspension,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              </div>

              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => {
                  setForm((prev) => ({ ...prev, unite_id: "" }));
                  setUnitQuery("");
                  setUnitMenuOpen(false);
                  setDefauts([]);
                  setSelectedDefautId(null);
                  setUnitDynamicAttributes({});
                }}
              >
                Changer
              </button>
            </div>
          )}

          {uniteSelectionnee ? (
            <div style={styles.alertInfo}>
              {autoSoCount > 0
                ? `${autoSoCount} élément(s) seront automatiquement cochés S/O selon les règles applicables à cette unité.`
                : "Aucune règle S/O automatique applicable pour cette unité."}
            </div>
          ) : null}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span>Inspection</span>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.grid2}>
            <div style={styles.field}>
              <label style={styles.label}>Date d’inspection</label>
              <input
                type="date"
                value={form.date_inspection}
                onChange={(e) => updateField("date_inspection", e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Date prochaine inspection</label>
              <input type="date" value={dateProchaineInspection} style={styles.input} readOnly />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Odomètre</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.odometre}
                onChange={(e) => updateField("odometre", e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span>Mesures</span>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.measuresWrap}>
            <div style={styles.measuresSide}>
              <div style={styles.sideTitle}>Côté gauche</div>

              <div style={styles.sideInnerTop2}>
                {LEFT_TOP.map((field) => (
                  <div key={field.key} style={styles.measureCell}>
                    <div style={styles.measureCode}>{field.code}</div>
                    <input
                      type="text"
                      value={measurements[field.key] ?? ""}
                      onChange={(e) => updateMeasurement(field.key, e.target.value)}
                      style={styles.measureInput}
                    />
                  </div>
                ))}
              </div>

              <div style={styles.sideInnerBottom3}>
                {LEFT_BOTTOM.map((field) => (
                  <div key={field.key} style={styles.measureCell}>
                    <div style={styles.measureCode}>{field.code}</div>
                    <input
                      type="text"
                      value={measurements[field.key] ?? ""}
                      onChange={(e) => updateMeasurement(field.key, e.target.value)}
                      style={styles.measureInput}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.measuresSide}>
              <div style={styles.sideTitle}>Côté droit</div>

              <div style={styles.sideInnerTop2}>
                {RIGHT_TOP.map((field) => (
                  <div key={field.key} style={styles.measureCell}>
                    <div style={styles.measureCode}>{field.code}</div>
                    <input
                      type="text"
                      value={measurements[field.key] ?? ""}
                      onChange={(e) => updateMeasurement(field.key, e.target.value)}
                      style={styles.measureInput}
                    />
                  </div>
                ))}
              </div>

              <div style={styles.sideInnerBottom3}>
                {RIGHT_BOTTOM.map((field) => (
                  <div key={field.key} style={styles.measureCell}>
                    <div style={styles.measureCode}>{field.code}</div>
                    <input
                      type="text"
                      value={measurements[field.key] ?? ""}
                      onChange={(e) => updateMeasurement(field.key, e.target.value)}
                      style={styles.measureInput}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span>Défectuosités</span>
          <div style={styles.actions}>
            <button type="button" style={styles.btnSecondary} onClick={openAddDefautModal}>
              Ajouter une défectuosité
            </button>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={removeSelectedDefaut}
              disabled={!selectedDefautId}
            >
              Supprimer la sélection
            </button>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={clearDefauts}
              disabled={defauts.length === 0}
            >
              Vider la liste
            </button>
          </div>
        </div>

        <div style={styles.cardBody}>
          {autoSoCount > 0 ? (
            <div style={styles.alertWarn}>
              Les éléments marqués automatiquement S/O ne peuvent pas être ajoutés comme défectuosité.
            </div>
          ) : null}

          <div style={styles.defectsTableWrap}>
            <table style={styles.defectsTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Catégorie</th>
                  <th style={styles.th}>Élément</th>
                  <th style={styles.th}>LOC</th>
                  <th style={styles.th}>DÉF</th>
                  <th style={styles.th}>Gravité</th>
                </tr>
              </thead>

              <tbody>
                {defauts.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={5}>
                      Aucune défectuosité ajoutée.
                    </td>
                  </tr>
                ) : (
                  defauts.map((row) => (
                    <tr
                      key={row.id}
                      style={selectedDefautId === row.id ? styles.rowSelected : undefined}
                      onClick={() => setSelectedDefautId(row.id)}
                    >
                      <td style={styles.td}>{row.categorie}</td>
                      <td style={styles.td}>{row.element}</td>
                      <td style={styles.td}>{getLocLabel(row.loc_id) || "—"}</td>
                      <td style={styles.td}>{getDefLabel(row.def_id) || "—"}</td>
                      <td style={styles.td}>{row.gravite}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span>Commentaires</span>
        </div>

        <div style={styles.cardBody}>
          <textarea
            value={form.commentaires}
            onChange={(e) => updateField("commentaires", e.target.value)}
            style={styles.textarea}
            placeholder="Commentaires de l’inspection…"
          />

          <div style={styles.actions}>
            <button type="button" style={styles.btnSecondary} onClick={resetForm}>
              Réinitialiser
            </button>
            <button
              type="button"
              style={{
                ...styles.btnPrimary,
                opacity: canContinue ? 1 : 0.6,
                cursor: canContinue ? "pointer" : "not-allowed",
              }}
              disabled={!canContinue}
              onClick={handleContinuer}
            >
              Continuer
            </button>
          </div>
        </div>
      </div>

      {openDefautModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Ajouter une défectuosité</div>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => setOpenDefautModal(false)}
              >
                Fermer
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.field}>
                <label style={styles.label}>Catégorie</label>
                <select
                  value={defautDraft.categorie}
                  onChange={(e) =>
                    setDefautDraft((prev) => ({
                      ...prev,
                      categorie: e.target.value,
                      elementId: "",
                    }))
                  }
                  style={styles.input}
                >
                  <option value="">—</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Élément</label>
                <select
                  value={defautDraft.elementId}
                  onChange={(e) =>
                    setDefautDraft((prev) => ({
                      ...prev,
                      elementId: e.target.value,
                    }))
                  }
                  style={styles.input}
                >
                  <option value="">—</option>
                  {availableElements.map((row) => {
                    const disabled = autoSoSet.has(toSetKey(row.categorie, row.element));
                    return (
                      <option key={row.id} value={row.id} disabled={disabled}>
                        {disabled ? `${row.element} (S/O auto)` : row.element}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedDraftElementIsAutoSo ? (
                <div style={styles.alertWarn}>
                  Cet élément est déjà visé par une règle S/O automatique.
                </div>
              ) : null}

              <div style={styles.field}>
                <label style={styles.label}>LOC</label>
                <select
                  value={defautDraft.locId}
                  onChange={(e) =>
                    setDefautDraft((prev) => ({ ...prev, locId: e.target.value }))
                  }
                  style={styles.input}
                >
                  <option value="">—</option>
                  {pepLocs.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} - {row.description}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>DEF</label>
                <select
                  value={defautDraft.defId}
                  onChange={(e) =>
                    setDefautDraft((prev) => ({ ...prev, defId: e.target.value }))
                  }
                  style={styles.input}
                >
                  <option value="">—</option>
                  {pepDefs.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} - {row.description}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Gravité</label>
                <div style={styles.radioRow}>
                  <label>
                    <input
                      type="radio"
                      checked={defautDraft.gravite === "Min"}
                      onChange={() =>
                        setDefautDraft((prev) => ({ ...prev, gravite: "Min" }))
                      }
                    />{" "}
                    Min
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={defautDraft.gravite === "Maj"}
                      onChange={() =>
                        setDefautDraft((prev) => ({ ...prev, gravite: "Maj" }))
                      }
                    />{" "}
                    Maj
                  </label>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => setOpenDefautModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                style={{
                  ...styles.btnPrimary,
                  opacity:
                    !defautDraft.categorie || !defautDraft.elementId || selectedDraftElementIsAutoSo
                      ? 0.6
                      : 1,
                  cursor:
                    !defautDraft.categorie || !defautDraft.elementId || selectedDraftElementIsAutoSo
                      ? "not-allowed"
                      : "pointer",
                }}
                onClick={applyDefautDraft}
                disabled={
                  !defautDraft.categorie || !defautDraft.elementId || selectedDraftElementIsAutoSo
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}