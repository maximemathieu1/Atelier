import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { supabase } from "../lib/supabaseClient";

type PneuRow = {
  id: string;
  numero: string;
  type?: string | null;
  type_usage?: string | null;
  marque: string | null;
  modele: string | null;
  dimension: string | null;
  marque_id?: string | null;
  modele_id?: string | null;
  dimension_id?: string | null;
  dot: string | null;
  km_total: number | null;
  profondeur_actuelle: number | null;
  statut: "installe" | "entrepose";
  note: string | null;
  created_at: string | null;
};

type InstallationRow = {
  id: string;
  pneu_id: string;
  unite_id: string;
  position: string;
  date_installation: string;
  km_installation: number | null;
  date_retrait: string | null;
  km_retrait: number | null;
  km_utilise: number | null;
  pneu?: {
    numero: string | null;
    marque: string | null;
    modele: string | null;
    dimension: string | null;
  } | null;
  unite?: {
    no_unite: string | null;
    marque: string | null;
    modele: string | null;
  } | null;
};

type UniteRow = {
  id: string;
  no_unite: string | null;
  marque: string | null;
  modele: string | null;
  km_actuel: number | null;
};

type PositionRow = {
  code: string;
  nom: string;
  ordre: number | null;
  actif: boolean | null;
};

type RefRow = {
  id: string;
  nom: string;
  actif?: boolean | null;
  marque_id?: string | null;
};

type PneuForm = {
  quantite: string;
  type_usage: string;
  marque_id: string;
  modele_id: string;
  dimension_id: string;
  new_marque: string;
  new_modele: string;
  new_dimension: string;
  dot: string;
  profondeur_actuelle: string;
  note: string;
};

type BatchInstallForm = {
  unite_id: string;
  km_installation: string;
  positions: Record<string, string>;
};

type BatchRetireForm = {
  km_retrait: string;
};

const emptyForm: PneuForm = {
  quantite: "1",
  type_usage: "traction",
  marque_id: "",
  modele_id: "",
  dimension_id: "",
  new_marque: "",
  new_modele: "",
  new_dimension: "",
  dot: "",
  profondeur_actuelle: "",
  note: "",
};

const emptyBatchInstallForm: BatchInstallForm = {
  unite_id: "",
  km_installation: "",
  positions: {},
};

const emptyBatchRetireForm: BatchRetireForm = {
  km_retrait: "",
};

const fallbackPositions: PositionRow[] = [
  { code: "AVG", nom: "Avant gauche", ordre: 10, actif: true },
  { code: "AVD", nom: "Avant droit", ordre: 20, actif: true },
  { code: "ARG", nom: "Arrière gauche", ordre: 30, actif: true },
  { code: "ARD", nom: "Arrière droit", ordre: 40, actif: true },
  { code: "ARG-INT", nom: "Arrière gauche intérieur", ordre: 50, actif: true },
  { code: "ARG-EXT", nom: "Arrière gauche extérieur", ordre: 60, actif: true },
  { code: "ARD-INT", nom: "Arrière droit intérieur", ordre: 70, actif: true },
  { code: "ARD-EXT", nom: "Arrière droit extérieur", ordre: 80, actif: true },
  { code: "TAG-G", nom: "Tag gauche", ordre: 90, actif: true },
  { code: "TAG-D", nom: "Tag droit", ordre: 100, actif: true },
];

function fmtKm(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Math.round(Number(v)).toLocaleString("fr-CA")} km`;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(`${v}T00:00:00`).toLocaleDateString("fr-CA");
}

function statutLabel(statut: string) {
  if (statut === "installe") return "Installé";
  if (statut === "entrepose") return "Entreposé";
  return statut;
}

function usageLabel(v: string | null | undefined) {
  if (v === "direction") return "Conduite";
  if (v === "traction") return "Traction";
  if (v === "mixte") return "Mixte";
  if (v === "remorque") return "Remorque";
  return "—";
}

function cleanText(v: string) {
  const s = v.trim();
  return s.length ? s : null;
}

function parseNullableNumber(v: string) {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredNumber(v: string) {
  const s = v.trim().replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseQuantity(v: string) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, n));
}

function pneuDescription(p: PneuRow | null | undefined) {
  if (!p) return "—";
  return [p.marque, p.modele, p.dimension].filter(Boolean).join(" ") || "—";
}

function installationDescription(i: InstallationRow | null | undefined) {
  if (!i) return "—";
  return [i.pneu?.marque, i.pneu?.modele, i.pneu?.dimension]
    .filter(Boolean)
    .join(" ") || "—";
}

export default function PneusPage() {
  const [pneus, setPneus] = useState<PneuRow[]>([]);
  const [installations, setInstallations] = useState<InstallationRow[]>([]);
  const [allInstallations, setAllInstallations] = useState<InstallationRow[]>([]);
  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>(fallbackPositions);
  const [marques, setMarques] = useState<RefRow[]>([]);
  const [modeles, setModeles] = useState<RefRow[]>([]);
  const [dimensions, setDimensions] = useState<RefRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [installationSearch, setInstallationSearch] = useState("");

  const [selectedPneuIds, setSelectedPneuIds] = useState<string[]>([]);
  const [selectedInstallIds, setSelectedInstallIds] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [nextNumero, setNextNumero] = useState("PN0001");
  const [form, setForm] = useState<PneuForm>(emptyForm);

  const [detailPneu, setDetailPneu] = useState<PneuRow | null>(null);
  const [editPneu, setEditPneu] = useState<PneuRow | null>(null);
  const [editForm, setEditForm] = useState<PneuForm>(emptyForm);

  const [batchInstallOpen, setBatchInstallOpen] = useState(false);
  const [batchInstallForm, setBatchInstallForm] =
    useState<BatchInstallForm>(emptyBatchInstallForm);

  const [batchRetireOpen, setBatchRetireOpen] = useState(false);
  const [batchRetireForm, setBatchRetireForm] =
    useState<BatchRetireForm>(emptyBatchRetireForm);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const [
        pneusRes,
        installationsRes,
        allInstallationsRes,
        unitesRes,
        positionsRes,
        marquesRes,
        modelesRes,
        dimensionsRes,
      ] = await Promise.all([
        supabase.from("pneus").select("*").order("numero", { ascending: true }),

        supabase
          .from("pneus_installations")
          .select(`
            *,
            pneu:pneus(numero,marque,modele,dimension),
            unite:unites(no_unite,marque,modele)
          `)
          .is("date_retrait", null)
          .order("date_installation", { ascending: false }),

        supabase
          .from("pneus_installations")
          .select(`
            *,
            pneu:pneus(numero,marque,modele,dimension),
            unite:unites(no_unite,marque,modele)
          `)
          .order("date_installation", { ascending: false }),

        supabase
          .from("unites")
          .select("id,no_unite,marque,modele,km_actuel")
          .order("no_unite", { ascending: true }),

        supabase
          .from("pneus_positions")
          .select("code,nom,ordre,actif")
          .eq("actif", true)
          .order("ordre", { ascending: true }),

        supabase
          .from("pneus_marques")
          .select("id,nom,actif")
          .eq("actif", true)
          .order("nom", { ascending: true }),

        supabase
          .from("pneus_modeles")
          .select("id,nom,marque_id,actif")
          .eq("actif", true)
          .order("nom", { ascending: true }),

        supabase
          .from("pneus_dimensions")
          .select("id,nom,actif")
          .eq("actif", true)
          .order("nom", { ascending: true }),
      ]);

      if (pneusRes.error) throw pneusRes.error;
      if (installationsRes.error) throw installationsRes.error;
      if (allInstallationsRes.error) throw allInstallationsRes.error;
      if (unitesRes.error) throw unitesRes.error;

      setPneus((pneusRes.data || []) as PneuRow[]);
      setInstallations((installationsRes.data || []) as InstallationRow[]);
      setAllInstallations((allInstallationsRes.data || []) as InstallationRow[]);
      setUnites((unitesRes.data || []) as UniteRow[]);

      if (!positionsRes.error && positionsRes.data?.length) {
        setPositions(positionsRes.data as PositionRow[]);
      }

      if (!marquesRes.error) setMarques((marquesRes.data || []) as RefRow[]);
      if (!modelesRes.error) setModeles((modelesRes.data || []) as RefRow[]);
      if (!dimensionsRes.error) setDimensions((dimensionsRes.data || []) as RefRow[]);
    } catch (e: any) {
      setErr(e?.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  async function getNextNumeroStart() {
    const { data, error } = await supabase
      .from("pneus")
      .select("numero")
      .like("numero", "PN%");

    if (error) throw error;

    const maxNumber = (data || []).reduce((max, row) => {
      const match = String(row.numero || "").match(/^PN(\d+)$/i);
      if (!match) return max;
      const n = Number(match[1]);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);

    return maxNumber + 1;
  }

  function buildNumero(start: number) {
    return `PN${String(start).padStart(4, "0")}`;
  }

  async function previewNextNumero(qtyValue = form.quantite) {
    const qty = parseQuantity(qtyValue);
    const start = await getNextNumeroStart();
    if (qty <= 1) return buildNumero(start);
    return `${buildNumero(start)} à ${buildNumero(start + qty - 1)}`;
  }

  function refName(list: RefRow[], id: string | null | undefined) {
    return list.find((x) => x.id === id)?.nom || null;
  }

  async function getOrCreateMarqueId(currentForm: PneuForm) {
    if (currentForm.marque_id) return currentForm.marque_id;

    const nom = cleanText(currentForm.new_marque);
    if (!nom) return null;

    const existing = marques.find(
      (m) => m.nom.toLowerCase() === nom.toLowerCase(),
    );
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("pneus_marques")
      .insert({ nom })
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  }

  async function getOrCreateModeleId(
    currentForm: PneuForm,
    marqueId: string | null,
  ) {
    if (currentForm.modele_id) return currentForm.modele_id;

    const nom = cleanText(currentForm.new_modele);
    if (!nom || !marqueId) return null;

    const existing = modeles.find(
      (m) =>
        m.marque_id === marqueId &&
        m.nom.toLowerCase() === nom.toLowerCase(),
    );
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("pneus_modeles")
      .insert({ nom, marque_id: marqueId })
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  }

  async function getOrCreateDimensionId(currentForm: PneuForm) {
    if (currentForm.dimension_id) return currentForm.dimension_id;

    const nom = cleanText(currentForm.new_dimension);
    if (!nom) return null;

    const existing = dimensions.find(
      (d) => d.nom.toLowerCase() === nom.toLowerCase(),
    );
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("pneus_dimensions")
      .insert({ nom })
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  }

  async function resolveRefs(currentForm: PneuForm) {
    const marqueId = await getOrCreateMarqueId(currentForm);
    const modeleId = await getOrCreateModeleId(currentForm, marqueId);
    const dimensionId = await getOrCreateDimensionId(currentForm);

    const marqueNom = refName(marques, marqueId) || cleanText(currentForm.new_marque);
    const modeleNom = refName(modeles, modeleId) || cleanText(currentForm.new_modele);
    const dimensionNom =
      refName(dimensions, dimensionId) || cleanText(currentForm.new_dimension);

    return { marqueId, modeleId, dimensionId, marqueNom, modeleNom, dimensionNom };
  }

  async function openAddModal() {
    setErr(null);
    setForm(emptyForm);

    try {
      setNextNumero(await previewNextNumero("1"));
      setAddOpen(true);
    } catch (e: any) {
      setErr(e?.message || "Impossible de générer le prochain numéro de pneu.");
    }
  }

  async function savePneu() {
    if (saving) return;

    setSaving(true);
    setErr(null);

    try {
      const qty = parseQuantity(form.quantite);
      const start = await getNextNumeroStart();
      const refs = await resolveRefs(form);

      const rows = Array.from({ length: qty }, (_, index) => ({
        numero: buildNumero(start + index),
        type_usage: form.type_usage || "traction",
        marque_id: refs.marqueId,
        modele_id: refs.modeleId,
        dimension_id: refs.dimensionId,
        marque: refs.marqueNom,
        modele: refs.modeleNom,
        dimension: refs.dimensionNom,
        dot: cleanText(form.dot),
        profondeur_actuelle: parseNullableNumber(form.profondeur_actuelle),
        statut: "entrepose",
        note: cleanText(form.note),
      }));

      const { error } = await supabase.from("pneus").insert(rows);

      if (error) throw error;

      setAddOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l’ajout du pneu.");
    } finally {
      setSaving(false);
    }
  }

  function formFromPneu(p: PneuRow): PneuForm {
    return {
      quantite: "1",
      type_usage: p.type_usage || "traction",
      marque_id: p.marque_id || "",
      modele_id: p.modele_id || "",
      dimension_id: p.dimension_id || "",
      new_marque: p.marque || "",
      new_modele: p.modele || "",
      new_dimension: p.dimension || "",
      dot: p.dot || "",
      profondeur_actuelle:
        p.profondeur_actuelle == null ? "" : String(p.profondeur_actuelle),
      note: p.note || "",
    };
  }

  function openEditModal(p: PneuRow) {
    setErr(null);
    setDetailPneu(null);
    setEditPneu(p);
    setEditForm(formFromPneu(p));
  }

  async function saveEditPneu() {
    if (saving || !editPneu) return;

    setSaving(true);
    setErr(null);

    try {
      const refs = await resolveRefs(editForm);

      const { error } = await supabase
        .from("pneus")
        .update({
          type_usage: editForm.type_usage || "traction",
          marque_id: refs.marqueId,
          modele_id: refs.modeleId,
          dimension_id: refs.dimensionId,
          marque: refs.marqueNom,
          modele: refs.modeleNom,
          dimension: refs.dimensionNom,
          dot: cleanText(editForm.dot),
          profondeur_actuelle: parseNullableNumber(editForm.profondeur_actuelle),
          note: cleanText(editForm.note),
        })
        .eq("id", editPneu.id);

      if (error) throw error;

      setEditPneu(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la modification.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePneu(p: PneuRow) {
    if (p.statut === "installe") {
      setErr("Impossible de supprimer un pneu installé.");
      return;
    }

    const ok = window.confirm(
      `Supprimer ${p.numero}? Cette action est seulement pour corriger une erreur.`,
    );
    if (!ok) return;

    setSaving(true);
    setErr(null);

    try {
      const { count, error: countError } = await supabase
        .from("pneus_installations")
        .select("id", { count: "exact", head: true })
        .eq("pneu_id", p.id);

      if (countError) throw countError;

      if ((count || 0) > 0) {
        throw new Error("Ce pneu a déjà un historique. Suppression bloquée.");
      }

      const { error } = await supabase.from("pneus").delete().eq("id", p.id);

      if (error) throw error;

      setSelectedPneuIds((prev) => prev.filter((id) => id !== p.id));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la suppression.");
    } finally {
      setSaving(false);
    }
  }

  function openBatchInstallModal(selectedIds?: string[]) {
    setErr(null);

    const ids = selectedIds?.length ? selectedIds : selectedPneuIds;
    const pneusToInstall = pneus.filter(
      (p) => ids.includes(p.id) && p.statut === "entrepose",
    );

    if (!pneusToInstall.length) {
      setErr("Sélectionne au moins un pneu entreposé.");
      return;
    }

    setSelectedPneuIds(pneusToInstall.map((p) => p.id));

    const defaultPositions: Record<string, string> = {};
    pneusToInstall.forEach((p, index) => {
      defaultPositions[p.id] = positions[index]?.code || "";
    });

    setBatchInstallForm({
      unite_id: "",
      km_installation: "",
      positions: defaultPositions,
    });

    setBatchInstallOpen(true);
  }

  async function saveBatchInstallation() {
    if (saving) return;

    setSaving(true);
    setErr(null);

    try {
      const pneusToInstall = pneus.filter(
        (p) => selectedPneuIds.includes(p.id) && p.statut === "entrepose",
      );

      const km = parseRequiredNumber(batchInstallForm.km_installation);

      if (!pneusToInstall.length) throw new Error("Aucun pneu sélectionné.");
      if (!batchInstallForm.unite_id) throw new Error("Sélectionne une unité.");
      if (km == null || km < 0) throw new Error("Entre un KM valide.");

      const usedPositions = new Set<string>();

      for (const pneu of pneusToInstall) {
        const position = batchInstallForm.positions[pneu.id];

        if (!position) throw new Error(`Position manquante pour ${pneu.numero}.`);

        if (usedPositions.has(position)) {
          throw new Error(`La position ${position} est utilisée plus d’une fois.`);
        }

        usedPositions.add(position);
      }

      for (const pneu of pneusToInstall) {
        const { error } = await supabase.rpc("installer_pneu", {
          p_pneu_id: pneu.id,
          p_unite_id: batchInstallForm.unite_id,
          p_position: batchInstallForm.positions[pneu.id],
          p_km_installation: km,
        });

        if (error) throw error;
      }

      setBatchInstallOpen(false);
      setSelectedPneuIds([]);
      setBatchInstallForm(emptyBatchInstallForm);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l’installation multiple.");
    } finally {
      setSaving(false);
    }
  }

  function openBatchRetireModal(selectedIds?: string[]) {
    setErr(null);

    const ids = selectedIds?.length ? selectedIds : selectedInstallIds;
    const activeToRetire = installations.filter((i) => ids.includes(i.id));

    if (!activeToRetire.length) {
      setErr("Sélectionne au moins un pneu installé.");
      return;
    }

    setSelectedInstallIds(activeToRetire.map((i) => i.id));

    const firstKm = activeToRetire
      .map((i) => unites.find((u) => u.id === i.unite_id)?.km_actuel)
      .find((v) => v != null);

    setBatchRetireForm({
      km_retrait: firstKm != null ? String(firstKm) : "",
    });

    setBatchRetireOpen(true);
  }

  async function saveBatchRetrait() {
    if (saving) return;

    setSaving(true);
    setErr(null);

    try {
      const km = parseRequiredNumber(batchRetireForm.km_retrait);

      if (km == null || km < 0) throw new Error("Entre un KM de retrait valide.");

      const installsToRetire = installations.filter((i) => selectedInstallIds.includes(i.id));

      if (!installsToRetire.length) {
        throw new Error("Aucun pneu sélectionné pour le retrait.");
      }

      for (const inst of installsToRetire) {
        const kmInstallation = Number(inst.km_installation || 0);

        if (km < kmInstallation) {
          throw new Error(
            `Le KM de retrait ne peut pas être plus bas que le KM d’installation pour ${inst.pneu?.numero || "un pneu"}.`,
          );
        }
      }

      for (const inst of installsToRetire) {
        const { error } = await supabase.rpc("retirer_pneu", {
          p_pneu_id: inst.pneu_id,
          p_km_retrait: km,
        });

        if (error) throw error;
      }

      setBatchRetireOpen(false);
      setSelectedInstallIds([]);
      setBatchRetireForm(emptyBatchRetireForm);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors du retrait multiple.");
    } finally {
      setSaving(false);
    }
  }

  function onQuantityChange(value: string) {
    setForm((f) => ({ ...f, quantite: value }));
    void previewNextNumero(value).then(setNextNumero).catch(() => {});
  }

  function togglePneuSelection(id: string, checked: boolean) {
    setSelectedPneuIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleInstallSelection(id: string, checked: boolean) {
    setSelectedInstallIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function handleAction(p: PneuRow, action: string) {
    if (!action) return;

    if (action === "detail") setDetailPneu(p);
    if (action === "modifier") openEditModal(p);
    if (action === "installer") openBatchInstallModal([p.id]);

    if (action === "retirer") {
      const active = installations.find((i) => i.pneu_id === p.id);
      if (!active) {
        setErr("Aucune installation active trouvée pour ce pneu.");
        return;
      }
      openBatchRetireModal([active.id]);
    }

    if (action === "supprimer") void deletePneu(p);
  }

  const filteredPneus = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pneus;

    return pneus.filter((p) =>
      [
        p.numero,
        usageLabel(p.type_usage),
        p.marque,
        p.modele,
        p.dimension,
        p.dot,
        p.statut,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [pneus, search]);

  const filteredInstallations = useMemo(() => {
    const q = installationSearch.trim().toLowerCase();
    if (!q) return installations;

    return installations.filter((i) =>
      [
        i.pneu?.numero,
        i.pneu?.marque,
        i.pneu?.modele,
        i.pneu?.dimension,
        i.unite?.no_unite,
        i.unite?.marque,
        i.unite?.modele,
        i.position,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [installations, installationSearch]);

  const selectableFilteredPneus = filteredPneus.filter((p) => p.statut === "entrepose");

  const selectedPneus = useMemo(() => {
    return pneus.filter((p) => selectedPneuIds.includes(p.id) && p.statut === "entrepose");
  }, [pneus, selectedPneuIds]);

  const selectedInstallations = useMemo(() => {
    return installations.filter((i) => selectedInstallIds.includes(i.id));
  }, [installations, selectedInstallIds]);

  const stats = useMemo(() => {
    return {
      total: pneus.length,
      installe: pneus.filter((p) => p.statut === "installe").length,
      entrepose: pneus.filter((p) => p.statut === "entrepose").length,
    };
  }, [pneus]);

  const selectedBatchUnite = useMemo(() => {
    return unites.find((u) => u.id === batchInstallForm.unite_id) || null;
  }, [unites, batchInstallForm.unite_id]);

  const selectedDetailInstall = detailPneu
    ? installations.find((i) => i.pneu_id === detailPneu.id)
    : null;

  const detailHistory = detailPneu
    ? allInstallations.filter((i) => i.pneu_id === detailPneu.id)
    : [];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Pneus</div>
          <div style={styles.subtitle}>
            Inventaire, installations actives et suivi de durabilité.
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.secondaryBtn} onClick={() => void load()} type="button">
            Actualiser
          </button>
          <button style={styles.primaryBtn} onClick={() => void openAddModal()} type="button">
            Ajouter pneu
          </button>
        </div>
      </div>

      {err && <div style={styles.error}>{err}</div>}

      <div style={styles.kpiGrid}>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Total pneus</div>
          <div style={styles.kpiValue}>{stats.total}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Installés</div>
          <div style={styles.kpiValue}>{stats.installe}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Entreposés</div>
          <div style={styles.kpiValue}>{stats.entrepose}</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardTitle}>Inventaire pneus</div>
            <div style={styles.muted}>
              Coche les pneus entreposés à installer. Double-clic sur une ligne pour ouvrir le détail.
            </div>
          </div>

          <div style={styles.headerControls}>
            {selectedPneus.length > 0 && (
              <button
                style={styles.primaryBtn}
                type="button"
                onClick={() => openBatchInstallModal()}
              >
                Installer sélection ({selectedPneus.length})
              </button>
            )}

            <input
              style={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
            />
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thSmall}>
                  <input
                    type="checkbox"
                    checked={
                      selectableFilteredPneus.length > 0 &&
                      selectableFilteredPneus.every((p) => selectedPneuIds.includes(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPneuIds(selectableFilteredPneus.map((p) => p.id));
                      } else {
                        setSelectedPneuIds([]);
                      }
                    }}
                  />
                </th>
                <th style={styles.th}>Numéro</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Marque / modèle</th>
                <th style={styles.th}>Dimension</th>
                <th style={styles.th}>DOT</th>
                <th style={styles.th}>KM total</th>
                <th style={styles.th}>Prof.</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.thRight}>...</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={styles.td} colSpan={10}>
                    Chargement...
                  </td>
                </tr>
              ) : filteredPneus.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={10}>
                    Aucun pneu trouvé.
                  </td>
                </tr>
              ) : (
                filteredPneus.map((p) => (
                  <tr
                    key={p.id}
                    onDoubleClick={() => setDetailPneu(p)}
                    style={styles.trClickable}
                  >
                    <td style={styles.tdSmall} onDoubleClick={(e) => e.stopPropagation()}>
                      {p.statut === "entrepose" && (
                        <input
                          type="checkbox"
                          checked={selectedPneuIds.includes(p.id)}
                          onChange={(e) => togglePneuSelection(p.id, e.target.checked)}
                        />
                      )}
                    </td>
                    <td style={styles.td}>
                      <b>{p.numero}</b>
                    </td>
                    <td style={styles.td}>{usageLabel(p.type_usage)}</td>
                    <td style={styles.td}>
                      {[p.marque, p.modele].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td style={styles.td}>{p.dimension || "—"}</td>
                    <td style={styles.td}>{p.dot || "—"}</td>
                    <td style={styles.td}>{fmtKm(p.km_total)}</td>
                    <td style={styles.td}>
                      {p.profondeur_actuelle == null ? "—" : `${p.profondeur_actuelle}/32`}
                    </td>
                    <td style={styles.td}>
                      <span style={badgeStyle(p.statut)}>{statutLabel(p.statut)}</span>
                    </td>
                    <td style={styles.tdRight} onDoubleClick={(e) => e.stopPropagation()}>
                      <select
                        style={styles.actionSelect}
                        value=""
                        onChange={(e) => {
                          handleAction(p, e.target.value);
                          e.currentTarget.value = "";
                        }}
                      >
                        <option value="">...</option>
                        <option value="detail">Voir détail</option>
                        <option value="modifier">Modifier</option>
                        {p.statut === "entrepose" && <option value="installer">Installer</option>}
                        {p.statut === "installe" && <option value="retirer">Retirer</option>}
                        {p.statut === "entrepose" && <option value="supprimer">Supprimer</option>}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardTitle}>Installations actives</div>
            <div style={styles.muted}>Coche les pneus installés à retirer en lot.</div>
          </div>

          <div style={styles.headerControls}>
            {selectedInstallations.length > 0 && (
              <button
                style={styles.primaryBtn}
                type="button"
                onClick={() => openBatchRetireModal()}
              >
                Retirer sélection ({selectedInstallations.length})
              </button>
            )}

            <input
              style={styles.search}
              value={installationSearch}
              onChange={(e) => setInstallationSearch(e.target.value)}
              placeholder="Rechercher unité..."
            />
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thSmall}>
                  <input
                    type="checkbox"
                    checked={
                      filteredInstallations.length > 0 &&
                      filteredInstallations.every((i) => selectedInstallIds.includes(i.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInstallIds(filteredInstallations.map((i) => i.id));
                      } else {
                        setSelectedInstallIds([]);
                      }
                    }}
                  />
                </th>
                <th style={styles.th}>Pneu</th>
                <th style={styles.th}>Unité</th>
                <th style={styles.th}>Position</th>
                <th style={styles.th}>Date installation</th>
                <th style={styles.th}>KM installation</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstallations.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={6}>
                    Aucune installation active.
                  </td>
                </tr>
              ) : (
                filteredInstallations.map((i) => (
                  <tr key={i.id}>
                    <td style={styles.tdSmall}>
                      <input
                        type="checkbox"
                        checked={selectedInstallIds.includes(i.id)}
                        onChange={(e) => toggleInstallSelection(i.id, e.target.checked)}
                      />
                    </td>
                    <td style={styles.td}>
                      <b>{i.pneu?.numero || "—"}</b>
                      <div style={styles.mutedSmall}>{installationDescription(i)}</div>
                    </td>
                    <td style={styles.td}>
                      <b>{i.unite?.no_unite || "—"}</b>
                      <div style={styles.mutedSmall}>
                        {[i.unite?.marque, i.unite?.modele].filter(Boolean).join(" ") || "—"}
                      </div>
                    </td>
                    <td style={styles.td}>{i.position}</td>
                    <td style={styles.td}>{fmtDate(i.date_installation)}</td>
                    <td style={styles.td}>{fmtKm(i.km_installation)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <PneuFormModal
          title="Ajouter des pneus"
          subtitle={`Numéros automatiques : ${nextNumero}`}
          form={form}
          setForm={setForm}
          marques={marques}
          modeles={modeles}
          dimensions={dimensions}
          saving={saving}
          onClose={() => setAddOpen(false)}
          onSave={() => void savePneu()}
          onQuantityChange={onQuantityChange}
          showQuantity
        />
      )}

      {editPneu && (
        <PneuFormModal
          title={`Modifier ${editPneu.numero}`}
          subtitle={pneuDescription(editPneu)}
          form={editForm}
          setForm={setEditForm}
          marques={marques}
          modeles={modeles}
          dimensions={dimensions}
          saving={saving}
          onClose={() => setEditPneu(null)}
          onSave={() => void saveEditPneu()}
          showQuantity={false}
        />
      )}

      {detailPneu && (
        <div style={styles.modalBackdrop} onMouseDown={() => setDetailPneu(null)}>
          <div style={styles.modalWide} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>{detailPneu.numero}</div>
                <div style={styles.muted}>{pneuDescription(detailPneu)}</div>
              </div>
              <button style={styles.closeBtn} onClick={() => setDetailPneu(null)} type="button">
                ×
              </button>
            </div>

            <div style={styles.detailGrid}>
              <Info label="Type" value={usageLabel(detailPneu.type_usage)} />
              <Info label="Statut" value={statutLabel(detailPneu.statut)} />
              <Info label="DOT" value={detailPneu.dot || "—"} />
              <Info label="Dimension" value={detailPneu.dimension || "—"} />
              <Info
                label="Profondeur"
                value={
                  detailPneu.profondeur_actuelle == null
                    ? "—"
                    : `${detailPneu.profondeur_actuelle}/32`
                }
              />
              <Info label="KM total" value={fmtKm(detailPneu.km_total)} />
              <Info label="Position actuelle" value={selectedDetailInstall?.position || "—"} />
              <Info label="Unité actuelle" value={selectedDetailInstall?.unite?.no_unite || "—"} />
            </div>

            {detailPneu.note && (
              <div style={styles.noteBox}>
                <div style={styles.infoLabel}>Note</div>
                <div style={styles.infoValue}>{detailPneu.note}</div>
              </div>
            )}

            <div style={styles.historyHeader}>Historique</div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Unité</th>
                    <th style={styles.th}>Position</th>
                    <th style={styles.th}>Date installation</th>
                    <th style={styles.th}>KM installation</th>
                    <th style={styles.th}>Date retrait</th>
                    <th style={styles.th}>KM retrait</th>
                    <th style={styles.th}>KM utilisé</th>
                  </tr>
                </thead>
                <tbody>
                  {detailHistory.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={7}>
                        Aucun historique.
                      </td>
                    </tr>
                  ) : (
                    detailHistory.map((h) => (
                      <tr key={h.id}>
                        <td style={styles.td}>{h.unite?.no_unite || "—"}</td>
                        <td style={styles.td}>{h.position || "—"}</td>
                        <td style={styles.td}>{fmtDate(h.date_installation)}</td>
                        <td style={styles.td}>{fmtKm(h.km_installation)}</td>
                        <td style={styles.td}>{fmtDate(h.date_retrait)}</td>
                        <td style={styles.td}>{fmtKm(h.km_retrait)}</td>
                        <td style={styles.td}>{fmtKm(h.km_utilise)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.secondaryBtn} onClick={() => setDetailPneu(null)} type="button">
                Fermer
              </button>
              <button style={styles.primaryBtn} onClick={() => openEditModal(detailPneu)} type="button">
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {batchInstallOpen && (
        <div style={styles.modalBackdrop} onMouseDown={() => setBatchInstallOpen(false)}>
          <div style={styles.modalWide} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>Installer pneus</div>
                <div style={styles.muted}>{selectedPneus.length} pneus sélectionnés</div>
              </div>
              <button style={styles.closeBtn} onClick={() => setBatchInstallOpen(false)} type="button">
                ×
              </button>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.label}>
                Unité
                <select
                  style={styles.input}
                  value={batchInstallForm.unite_id}
                  onChange={(e) => {
                    const unite = unites.find((u) => u.id === e.target.value);
                    setBatchInstallForm((f) => ({
                      ...f,
                      unite_id: e.target.value,
                      km_installation:
                        f.km_installation ||
                        (unite?.km_actuel != null ? String(unite.km_actuel) : ""),
                    }));
                  }}
                >
                  <option value="">Sélectionner...</option>
                  {unites.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.no_unite || "Sans numéro"} — {[u.marque, u.modele].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                KM installation
                <input
                  style={styles.input}
                  value={batchInstallForm.km_installation}
                  onChange={(e) =>
                    setBatchInstallForm((f) => ({
                      ...f,
                      km_installation: e.target.value,
                    }))
                  }
                  placeholder="Ex: 152233"
                  inputMode="decimal"
                />
              </label>
            </div>

            <Info
              label="Unité sélectionnée"
              value={
                selectedBatchUnite
                  ? `${selectedBatchUnite.no_unite || "—"} — ${[
                      selectedBatchUnite.marque,
                      selectedBatchUnite.modele,
                    ]
                      .filter(Boolean)
                      .join(" ")}`
                  : "—"
              }
            />

            <div style={styles.batchList}>
              {selectedPneus.map((p) => (
                <div key={p.id} style={styles.batchRow}>
                  <div>
                    <b>{p.numero}</b>
                    <div style={styles.mutedSmall}>{pneuDescription(p)}</div>
                  </div>

                  <select
                    style={styles.input}
                    value={batchInstallForm.positions[p.id] || ""}
                    onChange={(e) =>
                      setBatchInstallForm((f) => ({
                        ...f,
                        positions: {
                          ...f.positions,
                          [p.id]: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">Position...</option>
                    {positions.map((pos) => (
                      <option key={pos.code} value={pos.code}>
                        {pos.code} — {pos.nom}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.secondaryBtn}
                onClick={() => setBatchInstallOpen(false)}
                disabled={saving}
                type="button"
              >
                Annuler
              </button>
              <button
                style={styles.primaryBtn}
                onClick={() => void saveBatchInstallation()}
                disabled={saving}
                type="button"
              >
                {saving ? "Installation..." : "Installer les pneus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchRetireOpen && (
        <div style={styles.modalBackdrop} onMouseDown={() => setBatchRetireOpen(false)}>
          <div style={styles.modalWide} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>Retirer pneus</div>
                <div style={styles.muted}>{selectedInstallations.length} pneus sélectionnés</div>
              </div>
              <button style={styles.closeBtn} onClick={() => setBatchRetireOpen(false)} type="button">
                ×
              </button>
            </div>

            <label style={styles.label}>
              KM retrait
              <input
                style={styles.input}
                value={batchRetireForm.km_retrait}
                onChange={(e) =>
                  setBatchRetireForm((f) => ({
                    ...f,
                    km_retrait: e.target.value,
                  }))
                }
                placeholder="Ex: 178500"
                inputMode="decimal"
              />
            </label>

            <div style={styles.batchList}>
              {selectedInstallations.map((i) => (
                <div key={i.id} style={styles.batchRetireRow}>
                  <div>
                    <b>{i.pneu?.numero || "—"}</b>
                    <div style={styles.mutedSmall}>{installationDescription(i)}</div>
                  </div>
                  <div>
                    <b>{i.unite?.no_unite || "—"}</b>
                    <div style={styles.mutedSmall}>Unité</div>
                  </div>
                  <div>
                    <b>{i.position}</b>
                    <div style={styles.mutedSmall}>Position</div>
                  </div>
                  <div>
                    <b>{fmtKm(i.km_installation)}</b>
                    <div style={styles.mutedSmall}>KM installation</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.secondaryBtn}
                onClick={() => setBatchRetireOpen(false)}
                disabled={saving}
                type="button"
              >
                Annuler
              </button>
              <button
                style={styles.primaryBtn}
                onClick={() => void saveBatchRetrait()}
                disabled={saving}
                type="button"
              >
                {saving ? "Retrait..." : "Retirer les pneus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

function PneuFormModal({
  title,
  subtitle,
  form,
  setForm,
  marques,
  modeles,
  dimensions,
  saving,
  onClose,
  onSave,
  onQuantityChange,
  showQuantity,
}: {
  title: string;
  subtitle: string;
  form: PneuForm;
  setForm: Dispatch<SetStateAction<PneuForm>>;
  marques: RefRow[];
  modeles: RefRow[];
  dimensions: RefRow[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onQuantityChange?: (value: string) => void;
  showQuantity: boolean;
}) {
  const filteredModeles = form.marque_id
    ? modeles.filter((m) => m.marque_id === form.marque_id)
    : modeles;

  return (
    <div style={styles.modalBackdrop} onMouseDown={onClose}>
      <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>{title}</div>
            <div style={styles.muted}>{subtitle}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div style={styles.formGrid}>
          {showQuantity && (
            <label style={styles.label}>
              Quantité
              <input
                style={styles.input}
                value={form.quantite}
                onChange={(e) => onQuantityChange?.(e.target.value)}
                placeholder="Ex: 4"
                inputMode="numeric"
              />
            </label>
          )}

          <label style={styles.label}>
            Type pneu
            <select
              style={styles.input}
              value={form.type_usage}
              onChange={(e) => setForm((f) => ({ ...f, type_usage: e.target.value }))}
            >
              <option value="direction">Conduite</option>
              <option value="traction">Traction</option>
              <option value="mixte">Mixte</option>
              <option value="remorque">Remorque</option>
            </select>
          </label>

          <label style={styles.label}>
            Marque
            <select
              style={styles.input}
              value={form.marque_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  marque_id: e.target.value,
                  modele_id: "",
                  new_marque: "",
                }))
              }
            >
              <option value="">Nouvelle marque...</option>
              {marques.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </label>

          {!form.marque_id && (
            <label style={styles.label}>
              Nouvelle marque
              <input
                style={styles.input}
                value={form.new_marque}
                onChange={(e) => setForm((f) => ({ ...f, new_marque: e.target.value }))}
                placeholder="Ex: Michelin"
              />
            </label>
          )}

          <label style={styles.label}>
            Modèle
            <select
              style={styles.input}
              value={form.modele_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  modele_id: e.target.value,
                  new_modele: "",
                }))
              }
            >
              <option value="">Nouveau modèle...</option>
              {filteredModeles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </label>

          {!form.modele_id && (
            <label style={styles.label}>
              Nouveau modèle
              <input
                style={styles.input}
                value={form.new_modele}
                onChange={(e) => setForm((f) => ({ ...f, new_modele: e.target.value }))}
                placeholder="Ex: XDN2"
              />
            </label>
          )}

          <label style={styles.label}>
            Dimension
            <select
              style={styles.input}
              value={form.dimension_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dimension_id: e.target.value,
                  new_dimension: "",
                }))
              }
            >
              <option value="">Nouvelle dimension...</option>
              {dimensions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>

          {!form.dimension_id && (
            <label style={styles.label}>
              Nouvelle dimension
              <input
                style={styles.input}
                value={form.new_dimension}
                onChange={(e) => setForm((f) => ({ ...f, new_dimension: e.target.value }))}
                placeholder="Ex: 11R22.5"
              />
            </label>
          )}

          <label style={styles.label}>
            DOT
            <input
              style={styles.input}
              value={form.dot}
              onChange={(e) => setForm((f) => ({ ...f, dot: e.target.value }))}
              placeholder="Ex: 2525"
            />
          </label>

          <label style={styles.label}>
            Profondeur actuelle
            <input
              style={styles.input}
              value={form.profondeur_actuelle}
              onChange={(e) =>
                setForm((f) => ({ ...f, profondeur_actuelle: e.target.value }))
              }
              placeholder="Ex: 20"
              inputMode="decimal"
            />
          </label>
        </div>

        <label style={styles.label}>
          Note
          <textarea
            style={{ ...styles.input, minHeight: 84, resize: "vertical" }}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Note interne..."
          />
        </label>

        <div style={styles.modalActions}>
          <button style={styles.secondaryBtn} onClick={onClose} disabled={saving} type="button">
            Annuler
          </button>
          <button style={styles.primaryBtn} onClick={onSave} disabled={saving} type="button">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function badgeStyle(statut: string): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    color: "#111827",
  };

  if (statut === "installe") {
    return { ...base, background: "#ecfdf5", borderColor: "#a7f3d0" };
  }

  if (statut === "entrepose") {
    return { ...base, background: "#eff6ff", borderColor: "#bfdbfe" };
  }

  return base;
}

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 1280, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  title: { fontSize: 28, fontWeight: 950, color: "#111827" },
  subtitle: { color: "#6b7280", marginTop: 4 },
  actions: { display: "flex", gap: 8 },
  headerControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  closeBtn: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 10,
    width: 36,
    height: 36,
    fontSize: 22,
    lineHeight: "20px",
    cursor: "pointer",
    color: "#111827",
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontWeight: 700,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  kpi: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  kpiLabel: { color: "#6b7280", fontSize: 13, fontWeight: 800 },
  kpiValue: { marginTop: 4, fontSize: 26, fontWeight: 950, color: "#111827" },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: 950, color: "#111827" },
  historyHeader: {
    fontSize: 17,
    fontWeight: 950,
    color: "#111827",
    margin: "16px 0 10px",
  },
  muted: { color: "#6b7280", fontSize: 13 },
  mutedSmall: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  search: {
    width: 320,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
  },
  tableWrap: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 900,
    color: "#374151",
    whiteSpace: "nowrap",
  },
  thSmall: {
    width: 36,
    textAlign: "center",
    padding: "10px 8px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  thRight: {
    textAlign: "right",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 900,
    color: "#374151",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
    color: "#111827",
    verticalAlign: "middle",
  },
  tdSmall: {
    width: 36,
    textAlign: "center",
    padding: "10px 8px",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  trClickable: { cursor: "default" },
  actionSelect: {
    border: "1px solid #d1d5db",
    background: "white",
    borderRadius: 8,
    padding: "6px 8px",
    fontWeight: 800,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(17,24,39,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  },
  modal: {
    width: "min(780px, 100%)",
    maxHeight: "92vh",
    overflow: "auto",
    background: "white",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    padding: 18,
  },
  modalWide: {
    width: "min(960px, 100%)",
    maxHeight: "92vh",
    overflow: "auto",
    background: "white",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    padding: 18,
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: 950, color: "#111827" },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 850,
    color: "#374151",
    marginBottom: 12,
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    background: "white",
    color: "#111827",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  infoBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#f9fafb",
    minHeight: 42,
    marginBottom: 12,
  },
  noteBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#fff",
    marginBottom: 12,
  },
  infoLabel: { fontSize: 12, fontWeight: 850, color: "#6b7280", marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: 850, color: "#111827" },
  batchList: {
    marginTop: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  batchRow: {
    display: "grid",
    gridTemplateColumns: "1fr 260px",
    gap: 12,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
  },
  batchRetireRow: {
    display: "grid",
    gridTemplateColumns: "1fr 120px 120px 160px",
    gap: 12,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
  },
};