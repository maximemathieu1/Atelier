import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  plaque: string | null;
  niv: string | null;
  km_actuel: number | null;
};

type EntretienTemplate = {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
};

type UniteEntretienTemplate = {
  id: string;
  unite_id: string;
  template_id: string;
  actif: boolean;
};

type EntretienTemplateItem = {
  id: string;
  template_id: string;
  nom: string;
  description: string | null;
  frequence_km: number | null;
  frequence_jours: number | null;
  ordre: number;
  actif: boolean;
};

type UniteEntretienItem = {
  id: string;
  unite_id: string;
  titre?: string | null;
  details?: string | null;
  periodicite_km?: number | null;
  periodicite_jours?: number | null;
  nom: string;
  description: string | null;
  frequence_km: number | null;
  frequence_jours: number | null;
  ordre: number;
  actif: boolean;
};

type EntretienHistorique = {
  id: string;
  unite_id: string;
  template_item_id: string | null;
  unite_item_id: string | null;
  bt_id: string | null;
  km_log_id: string | null;
  nom_snapshot: string;
  frequence_km_snapshot: number | null;
  frequence_jours_snapshot: number | null;
  date_effectuee: string;
  km_effectue: number | null;
  note: string | null;
  created_at: string;
};
type BonTravailLite = {
  id: string;
  numero: string | null;
};

type ItemRow = {
  sourceType: "template" | "unite";
  sourceId: string;
  nom: string;
  description: string | null;
  frequence_km: number | null;
  frequence_jours: number | null;
  templateNom?: string | null;
  templateId?: string | null;
  assignedTemplateLinkId?: string | null;
  lastDone?: EntretienHistorique | null;
};

function fmtKm(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toLocaleString("fr-CA")} km`;
}

function fmtNumber(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("fr-CA");
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("fr-CA");
}

function numOrNull(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function dueStatus(row: ItemRow, currentKm: number | null) {
  const h = row.lastDone;
  const today = new Date();

  let overdue = false;
  let soon = false;

  if (row.frequence_km != null && h?.km_effectue != null && currentKm != null) {
    const nextKm = Number(h.km_effectue) + Number(row.frequence_km);
    const remainingKm = nextKm - Number(currentKm);
    if (remainingKm <= 0) overdue = true;
    else if (remainingKm <= 2500) soon = true;
  }

  if (row.frequence_jours != null && h?.date_effectuee) {
    const dueDate = addDays(h.date_effectuee, Number(row.frequence_jours));
    if (dueDate) {
      const diffDays = daysBetween(today, dueDate);
      if (diffDays <= 0) overdue = true;
      else if (diffDays <= 30) soon = true;
    }
  }

  if (!h) return { label: "Jamais fait", tone: "#92400e", bg: "#fff7ed", border: "#fed7aa" };
  if (overdue) return { label: "En retard", tone: "#991b1b", bg: "#fef2f2", border: "#fecaca" };
  if (soon) return { label: "À prévoir", tone: "#92400e", bg: "#fff7ed", border: "#fed7aa" };
  return { label: "OK", tone: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" };
}

function nextDueText(row: ItemRow, currentKm: number | null) {
  const h = row.lastDone;
  const today = new Date();

  if (!h) {
    const parts: string[] = [];
    if (row.frequence_km != null) parts.push(`${fmtNumber(row.frequence_km)} km`);
    if (row.frequence_jours != null) parts.push(`${fmtNumber(row.frequence_jours)} jours`);
    return parts.length ? parts.join(" • ") : "—";
  }

  const parts: string[] = [];

  if (row.frequence_km != null && h.km_effectue != null && currentKm != null) {
    const nextKm = Number(h.km_effectue) + Number(row.frequence_km);
    const remainingKm = nextKm - Number(currentKm);
    if (remainingKm <= 0) parts.push("0 km");
    else parts.push(`${fmtNumber(remainingKm)} km`);
  } else if (row.frequence_km != null) {
    parts.push(`${fmtNumber(row.frequence_km)} km`);
  }

  if (row.frequence_jours != null && h.date_effectuee) {
    const dueDate = addDays(h.date_effectuee, Number(row.frequence_jours));
    if (dueDate) {
      const remainingDays = daysBetween(today, dueDate);
      if (remainingDays <= 0) parts.push("0 jour");
      else parts.push(`${fmtNumber(remainingDays)} jours`);
    }
  } else if (row.frequence_jours != null) {
    parts.push(`${fmtNumber(row.frequence_jours)} jours`);
  }

  return parts.length ? parts.join(" • ") : "—";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function UniteEntretienPage({
  embedded = false,
  uniteId,
}: {
  embedded?: boolean;
  uniteId?: string;
}) {
  const { id: routeId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const id = uniteId ?? routeId ?? "";

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [unite, setUnite] = useState<Unite | null>(null);
  const [templates, setTemplates] = useState<EntretienTemplate[]>([]);
  const [assignedTemplates, setAssignedTemplates] = useState<UniteEntretienTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<EntretienTemplateItem[]>([]);
  const [unitItems, setUnitItems] = useState<UniteEntretienItem[]>([]);
  const [historique, setHistorique] = useState<EntretienHistorique[]>([]);
  const [btMap, setBtMap] = useState<Record<string, BonTravailLite>>({});

  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<"create" | "edit">("create");
  const [manualRow, setManualRow] = useState<ItemRow | null>(null);
  const [editingHistory, setEditingHistory] = useState<EntretienHistorique | null>(null);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualKm, setManualKm] = useState("");
  const [manualNote, setManualNote] = useState("");

  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  const [histMenuOpenId, setHistMenuOpenId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"template" | "manual">("template");
  const [assignTemplateId, setAssignTemplateId] = useState("");

  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [itemEditorMode, setItemEditorMode] = useState<"create" | "edit">("create");
  const [editingUnitItemId, setEditingUnitItemId] = useState<string | null>(null);
  const [localNom, setLocalNom] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localFreqKm, setLocalFreqKm] = useState("");
  const [localFreqJours, setLocalFreqJours] = useState("");

  async function loadAll() {
    if (!id) return;
    setLoading(true);

    try {
      await supabase.rpc("sync_entretien_historique_km", {
        p_unite_id: id,
      });

      const [
        uniteRes,
        templatesRes,
        assignedRes,
        templateItemsRes,
        unitItemsRes,
        historiqueRes,
      ] = await Promise.all([
        supabase
          .from("unites")
          .select("id,no_unite,marque,modele,plaque,niv,km_actuel")
          .eq("id", id)
          .single(),

        supabase
          .from("entretien_templates")
          .select("id,nom,description,actif")
          .eq("actif", true)
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_templates")
          .select("id,unite_id,template_id,actif")
          .eq("unite_id", id)
          .eq("actif", true),

        supabase
          .from("entretien_template_items")
          .select("id,template_id,nom,description,frequence_km,frequence_jours,ordre,actif")
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_items")
          .select("id,unite_id,titre,details,periodicite_km,periodicite_jours,nom,description,frequence_km,frequence_jours,ordre,actif")
          .eq("unite_id", id)
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),

        supabase
  .from("unite_entretien_historique")
  .select("id,unite_id,template_item_id,unite_item_id,bt_id,km_log_id,nom_snapshot,frequence_km_snapshot,frequence_jours_snapshot,date_effectuee,km_effectue,note,created_at")
  .eq("unite_id", id)
  .order("date_effectuee", { ascending: false })
  .order("created_at", { ascending: false }),
      ]);

      if (uniteRes.error) throw uniteRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (assignedRes.error) throw assignedRes.error;
      if (templateItemsRes.error) throw templateItemsRes.error;
      if (unitItemsRes.error) throw unitItemsRes.error;
      if (historiqueRes.error) throw historiqueRes.error;

      const hist = ((historiqueRes.data as any[]) ?? []) as EntretienHistorique[];
      const btIds = Array.from(new Set(hist.map((h) => h.bt_id).filter(Boolean) as string[]));

      let btMapObj: Record<string, BonTravailLite> = {};
      if (btIds.length > 0) {
        const btRes = await supabase
          .from("bons_travail")
          .select("id,numero")
          .in("id", btIds);

        if (btRes.error) throw btRes.error;

        btMapObj = Object.fromEntries(
          (((btRes.data as any[]) ?? []) as BonTravailLite[]).map((bt) => [bt.id, bt])
        );
      }

      setBtMap(btMapObj);
      setUnite(uniteRes.data as Unite);
      setTemplates((templatesRes.data as any[]) ?? []);
      setAssignedTemplates((assignedRes.data as any[]) ?? []);
      setTemplateItems((templateItemsRes.data as any[]) ?? []);
      setUnitItems((unitItemsRes.data as any[]) ?? []);
      setHistorique(hist);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  useEffect(() => {
    const closeMenus = () => {
      setRowMenuOpenId(null);
      setHistMenuOpenId(null);
    };
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  const assignedTemplateIds = useMemo(
    () => new Set(assignedTemplates.map((x) => x.template_id)),
    [assignedTemplates]
  );

  const assignedTemplateByTemplateId = useMemo(
    () => new Map(assignedTemplates.map((x) => [x.template_id, x])),
    [assignedTemplates]
  );

  const availableTemplates = useMemo(
    () => templates.filter((t) => !assignedTemplateIds.has(t.id)),
    [templates, assignedTemplateIds]
  );

  const rows = useMemo(() => {
    const assignedSet = new Set(assignedTemplates.map((x) => x.template_id));
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    const hByTemplateItem = new Map<string, EntretienHistorique>();
    const hByUnitItem = new Map<string, EntretienHistorique>();

    for (const h of historique) {
      if (h.template_item_id && !hByTemplateItem.has(h.template_item_id)) {
        hByTemplateItem.set(h.template_item_id, h);
      }
      if (h.unite_item_id && !hByUnitItem.has(h.unite_item_id)) {
        hByUnitItem.set(h.unite_item_id, h);
      }
    }

    const fromTemplates: ItemRow[] = templateItems
      .filter((it) => assignedSet.has(it.template_id))
      .map((it) => ({
        sourceType: "template",
        sourceId: it.id,
        nom: it.nom,
        description: it.description,
        frequence_km: it.frequence_km,
        frequence_jours: it.frequence_jours,
        templateNom: templateMap.get(it.template_id)?.nom ?? null,
        templateId: it.template_id,
        assignedTemplateLinkId: assignedTemplateByTemplateId.get(it.template_id)?.id ?? null,
        lastDone: hByTemplateItem.get(it.id) ?? null,
      }));

    const fromUnit: ItemRow[] = unitItems.map((it) => ({
      sourceType: "unite",
      sourceId: it.id,
      nom: it.nom || it.titre || "",
      description: it.description || it.details || null,
      frequence_km: it.frequence_km ?? it.periodicite_km ?? null,
      frequence_jours: it.frequence_jours ?? it.periodicite_jours ?? null,
      templateNom: null,
      templateId: null,
      assignedTemplateLinkId: null,
      lastDone: hByUnitItem.get(it.id) ?? null,
    }));

    return [...fromTemplates, ...fromUnit].sort((a, b) => a.nom.localeCompare(b.nom, "fr-CA"));
  }, [assignedTemplates, assignedTemplateByTemplateId, templateItems, unitItems, historique, templates]);

  async function assignTemplate() {
    if (!id || !assignTemplateId || busy) return;

    if (assignedTemplateIds.has(assignTemplateId)) {
      alert("Ce template est déjà assigné à cette unité.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_entretien_templates").insert({
        unite_id: id,
        template_id: assignTemplateId,
        actif: true,
      });

      if (error) throw error;

      setAssignTemplateId("");
      setAddOpen(false);
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function resetItemEditor() {
    setEditingUnitItemId(null);
    setLocalNom("");
    setLocalDescription("");
    setLocalFreqKm("");
    setLocalFreqJours("");
  }

  function openEditUnitItem(row: ItemRow) {
    if (row.sourceType !== "unite") return;
    const item = unitItems.find((x) => x.id === row.sourceId);
    if (!item) return;

    setItemEditorMode("edit");
    setEditingUnitItemId(item.id);
    setLocalNom(item.nom || item.titre || "");
    setLocalDescription(item.description || item.details || "");
    setLocalFreqKm(item.frequence_km != null ? String(item.frequence_km) : "");
    setLocalFreqJours(item.frequence_jours != null ? String(item.frequence_jours) : "");
    setItemEditorOpen(true);
    setRowMenuOpenId(null);
  }

  async function saveUnitItem() {
    if (!id || !localNom.trim() || busy) return;
    setBusy(true);

    try {
      const nom = localNom.trim();
      const description = localDescription.trim() || null;
      const freqKm = numOrNull(localFreqKm);
      const freqJours = numOrNull(localFreqJours);

      if (itemEditorMode === "create") {
        const { error } = await supabase.from("unite_entretien_items").insert({
          unite_id: id,
          titre: nom,
          details: description,
          periodicite_km: freqKm,
          periodicite_jours: freqJours,
          nom,
          description,
          frequence_km: freqKm,
          frequence_jours: freqJours,
          actif: true,
        });
        if (error) throw error;
      } else {
        if (!editingUnitItemId) return;
        const { error } = await supabase
          .from("unite_entretien_items")
          .update({
            titre: nom,
            details: description,
            periodicite_km: freqKm,
            periodicite_jours: freqJours,
            nom,
            description,
            frequence_km: freqKm,
            frequence_jours: freqJours,
          })
          .eq("id", editingUnitItemId);
        if (error) throw error;
      }

      setItemEditorOpen(false);
      resetItemEditor();
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

async function syncUniteKmFromLastLog() {
  if (!id) return null;

  const { data: latest, error: latestError } = await supabase
    .from("unites_km_log")
    .select("id,km,created_at")
    .eq("unite_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  const km = latest?.km ?? null;

  const { error: updateError } = await supabase
    .from("unites")
    .update({ km_actuel: km })
    .eq("id", id);

  if (updateError) throw updateError;

  setUnite((prev) => (prev ? { ...prev, km_actuel: km } : prev));
  return km;
}

  async function createManualUnitItemFromAddModal() {
    if (!id || !localNom.trim() || busy) return;
    setBusy(true);

    try {
      const nom = localNom.trim();
      const description = localDescription.trim() || null;
      const freqKm = numOrNull(localFreqKm);
      const freqJours = numOrNull(localFreqJours);

      const { error } = await supabase.from("unite_entretien_items").insert({
        unite_id: id,
        titre: nom,
        details: description,
        periodicite_km: freqKm,
        periodicite_jours: freqJours,
        nom,
        description,
        frequence_km: freqKm,
        frequence_jours: freqJours,
        actif: true,
      });

      if (error) throw error;

      setAddOpen(false);
      resetItemEditor();
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRowItem(row: ItemRow) {
    if (busy) return;

    if (row.sourceType === "unite") {
      const ok = window.confirm(`Supprimer l'entretien "${row.nom}" ?`);
      if (!ok) return;

      setBusy(true);
      try {
        const { error } = await supabase
          .from("unite_entretien_items")
          .delete()
          .eq("id", row.sourceId);

        if (error) throw error;

        setRowMenuOpenId(null);
        await loadAll();
      } catch (e: any) {
        alert(e?.message ?? String(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    const linkId = row.assignedTemplateLinkId;
    if (!linkId) {
      alert("Impossible de retirer ce template de l’unité.");
      return;
    }

    const ok = window.confirm(
      `Retirer le template "${row.templateNom || "Template"}" de cette unité ?`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("unite_entretien_templates")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      setRowMenuOpenId(null);
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function openManualCreate(row: ItemRow) {
    setManualMode("create");
    setManualRow(row);
    setEditingHistory(null);
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualKm(unite?.km_actuel != null ? String(unite.km_actuel) : "");
    setManualNote("");
    setManualOpen(true);
    setRowMenuOpenId(null);
  }

  function openManualEdit(h: EntretienHistorique) {
    const linkedRow =
      rows.find((r) =>
        h.template_item_id
          ? r.sourceType === "template" && r.sourceId === h.template_item_id
          : r.sourceType === "unite" && r.sourceId === h.unite_item_id
      ) ?? null;

    setManualMode("edit");
    setManualRow(linkedRow);
    setEditingHistory(h);
    setManualDate(h.date_effectuee?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setManualKm(h.km_effectue != null ? String(h.km_effectue) : "");
    setManualNote(h.note ?? "");
    setManualOpen(true);
    setHistMenuOpenId(null);
  }

 async function saveManual() {
  if (!id || busy) return;

  if (manualMode === "create" && !manualRow) return;
  if (manualMode === "edit" && !editingHistory) return;

  setBusy(true);
  try {
    if (manualMode === "create" && manualRow) {
      const km = numOrNull(manualKm);

      let kmLogId: string | null = null;

      if (km != null) {
        const { data: kmLogRow, error: kmLogError } = await supabase
          .from("unites_km_log")
          .insert({
            unite_id: id,
            km,
            source: "entretien_manuel",
            note: manualNote.trim() || `Entretien manuel - ${manualRow.nom}`,
            bt_id: null,
          })
          .select("id")
          .single();

        if (kmLogError) throw kmLogError;
        kmLogId = kmLogRow?.id ?? null;
      }

      const payload = {
        unite_id: id,
        template_item_id: manualRow.sourceType === "template" ? manualRow.sourceId : null,
        unite_item_id: manualRow.sourceType === "unite" ? manualRow.sourceId : null,
        bt_id: null,
        km_log_id: kmLogId,
        nom_snapshot: manualRow.nom,
        frequence_km_snapshot: manualRow.frequence_km,
        frequence_jours_snapshot: manualRow.frequence_jours,
        date_effectuee: manualDate,
        km_effectue: km,
        note: manualNote.trim() || null,
      };

      const { error } = await supabase.from("unite_entretien_historique").insert(payload);
      if (error) throw error;

      if (kmLogId) {
        await syncUniteKmFromLastLog();

        const { error: syncError } = await supabase.rpc("sync_entretien_items_for_unite", {
          p_unite_id: id,
        });

        if (syncError) throw syncError;
      }
    }

    if (manualMode === "edit" && editingHistory) {
      const km = numOrNull(manualKm);

      // 1) Si on a déjà une ligne KM liée, on la met à jour
      if (editingHistory.km_log_id) {
        const { error: kmLogError } = await supabase
          .from("unites_km_log")
          .update({
            km,
            note: manualNote.trim() || null,
          })
          .eq("id", editingHistory.km_log_id);

        if (kmLogError) throw kmLogError;
      } else if (km != null) {
  // 2) Si aucune ligne KM n’existait encore, on tente d’abord de retrouver
  // une ligne existante liée au même BT
  let resolvedKmLogId: string | null = null;

  if (editingHistory.bt_id) {
    const { data: existingKmLog, error: existingKmLogError } = await supabase
      .from("unites_km_log")
      .select("id")
      .eq("unite_id", id)
      .eq("bt_id", editingHistory.bt_id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingKmLogError) throw existingKmLogError;

    if (existingKmLog?.id) {
      resolvedKmLogId = existingKmLog.id;

      const { error: updateExistingKmLogError } = await supabase
        .from("unites_km_log")
        .update({
          km,
          note: manualNote.trim() || null,
        })
        .eq("id", resolvedKmLogId);

      if (updateExistingKmLogError) throw updateExistingKmLogError;
    }
  }

  // 3) Si aucune ligne BT existante n’a été trouvée, on en crée une nouvelle
  if (!resolvedKmLogId) {
    const { data: kmLogRow, error: kmLogError } = await supabase
      .from("unites_km_log")
      .insert({
        unite_id: id,
        km,
        source: editingHistory.bt_id ? "bt" : "entretien_manuel",
        note: manualNote.trim() || null,
        bt_id: editingHistory.bt_id ?? null,
      })
      .select("id")
      .single();

    if (kmLogError) throw kmLogError;
    resolvedKmLogId = kmLogRow?.id ?? null;
  }

  const { error: histLinkError } = await supabase
    .from("unite_entretien_historique")
    .update({
      km_log_id: resolvedKmLogId,
    })
    .eq("id", editingHistory.id);

  if (histLinkError) throw histLinkError;
}

      // 3) Si l’historique est lié à un BT, le BT suit aussi
      if (editingHistory.bt_id) {
        const { error: btError } = await supabase
          .from("bons_travail")
          .update({
            km,
          })
          .eq("id", editingHistory.bt_id);

        if (btError) throw btError;
      }

      // 4) Mise à jour de l’historique d’entretien
      const { error: histError } = await supabase
        .from("unite_entretien_historique")
        .update({
          date_effectuee: manualDate,
          km_effectue: km,
          note: manualNote.trim() || null,
        })
        .eq("id", editingHistory.id);

      if (histError) throw histError;

      // 5) Resync global comme dans la logique KM unité
      await supabase.rpc("sync_entretien_historique_km", {
        p_unite_id: id,
      });

      await syncUniteKmFromLastLog();

      const { error: syncError } = await supabase.rpc("sync_entretien_items_for_unite", {
        p_unite_id: id,
      });

      if (syncError) throw syncError;
    }

    setManualOpen(false);
    setManualRow(null);
    setEditingHistory(null);
    await loadAll();
  } catch (e: any) {
    alert(e?.message ?? String(e));
  } finally {
    setBusy(false);
  }
}

  async function deleteHistory(h: EntretienHistorique) {
    const ok = window.confirm(`Supprimer l'historique "${h.nom_snapshot}" ?`);
    if (!ok || busy) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("unite_entretien_historique")
        .delete()
        .eq("id", h.id);

      if (error) throw error;
      setHistMenuOpenId(null);
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addToBt(row: ItemRow) {
    if (!id || busy) return;
    setBusy(true);

    try {
      const { error } = await supabase.rpc("ajouter_entretien_au_bt", {
        p_unite_id: id,
        p_source_type: row.sourceType,
        p_source_id: row.sourceId,
        p_nom: row.nom,
        p_description: row.description ?? null,
        p_frequence_km: row.frequence_km,
        p_frequence_jours: row.frequence_jours,
      });

      if (error) throw error;

      setRowMenuOpenId(null);
      await loadAll();
      alert(`"${row.nom}" a été ajouté au BT / tâches actives.`);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function openBt(btId: string | null) {
    if (!btId) return;
    nav(`/bt/${btId}`);
  }

  const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: embedded ? "100%" : 1180,
    margin: embedded ? "0" : "24px auto",
    padding: embedded ? "0" : "0 14px",
  },
  card: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,.08)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,.05)",
    marginBottom: 12,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

  btn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.14)",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.14)",
    background: "#111827",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  btnMini: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.14)",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
  },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.14)",
    minWidth: 220,
    background: "#fff",
  },

  table: { width: "100%", borderCollapse: "collapse" },

  th: {
    textAlign: "left",
    fontSize: 12,
    color: "rgba(0,0,0,.55)",
    padding: "8px 6px",
  },

  td: {
    padding: "10px 6px",
    borderTop: "1px solid rgba(0,0,0,.08)",
    verticalAlign: "top",
  },

  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(0,0,0,.08)",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  },

  modalCard: {
    width: "100%",
    maxWidth: 920,
    background: "#fff",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,.20)",
    border: "1px solid rgba(0,0,0,.08)",
  },

  menuWrap: {
    position: "relative",
    display: "inline-block",
  },

  menu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 520,
    background: "#fff",
    border: "1px solid rgba(0,0,0,.08)",
    borderRadius: 12,
    boxShadow: "0 16px 40px rgba(0,0,0,.12)",
    padding: 6,
    zIndex: 50,
  },

  menuGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 6,
  },

  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },

  // ✅ VERSION FINALE CORRIGÉE (UNE SEULE)
  menuItemMuted: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "#f9fafb",
    color: "#6b7280",
    cursor: "default",
    fontWeight: 700,
    fontSize: 13,
  },

  histRowClickable: {
    cursor: "pointer",
  },

  tabsWrap: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },

  tabBtn: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.14)",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  helperBox: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.08)",
    background: "#f8fafc",
    color: "rgba(0,0,0,.7)",
    fontSize: 13,
  },
};

  if (!id) return <div style={styles.page}>ID unité manquant.</div>;

  return (
    <div style={styles.page}>
      {!embedded && (
        <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Entretien périodique</h1>
            <div style={{ color: "rgba(0,0,0,.6)" }}>
              {unite
                ? `Unité ${unite.no_unite} • ${[unite.marque, unite.modele].filter(Boolean).join(" ") || "—"}`
                : "Chargement..."}
            </div>
          </div>

          <div style={styles.row}>
            <button style={styles.btn} type="button" onClick={() => nav(`/unites/${id}`)}>
              Retour à la fiche unité
            </button>
          </div>
        </div>
      )}

      {loading || !unite ? (
        <div style={styles.card}>Chargement…</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              <Panel title="Unité">
                <div style={{ fontWeight: 900, fontSize: 22 }}>{unite.no_unite}</div>
                <div style={{ color: "rgba(0,0,0,.65)" }}>
                  {[unite.marque, unite.modele].filter(Boolean).join(" ") || "—"}
                </div>
              </Panel>

              <Panel title="KM actuel">
                <div style={{ fontWeight: 900, fontSize: 22 }}>{fmtKm(unite.km_actuel)}</div>
              </Panel>

              <Panel title="Résumé">
                <div style={{ fontWeight: 800 }}>Entretiens actifs : {rows.length}</div>
                <div style={{ color: "rgba(0,0,0,.65)" }}>Historique : {historique.length} entrée(s)</div>
              </Panel>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Entretiens applicables</div>

              <button
                style={styles.btnPrimary}
                type="button"
                onClick={() => {
                  setAddMode("template");
                  setAddOpen(true);
                }}
              >
                Ajouter entretien périodique
              </button>
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Entretien</th>
                  <th style={styles.th}>Fréquence</th>
                  <th style={styles.th}>Dernier fait</th>
                  <th style={styles.th}>Prochain dû</th>
                  <th style={styles.th}>Statut</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={6}>
                      <span style={{ color: "rgba(0,0,0,.6)" }}>
                        Aucun entretien configuré pour cette unité.
                      </span>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const status = dueStatus(row, unite.km_actuel);
                    const freq =
                      [
                        row.frequence_km != null ? fmtKm(row.frequence_km) : null,
                        row.frequence_jours != null ? `${row.frequence_jours} jours` : null,
                      ]
                        .filter(Boolean)
                        .join(" ou ") || "—";

                    const rowMenuId = `${row.sourceType}-${row.sourceId}`;

                    return (
                      <tr key={rowMenuId}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{row.nom}</div>
                          {row.description ? (
                            <div style={{ color: "rgba(0,0,0,.6)", fontSize: 13 }}>{row.description}</div>
                          ) : null}
                          <div style={{ color: "rgba(0,0,0,.5)", fontSize: 12, marginTop: 4 }}>
                            {row.sourceType === "template"
                              ? `Template${row.templateNom ? ` • ${row.templateNom}` : ""}`
                              : "Entretien propre à l’unité"}
                          </div>
                        </td>

                        <td style={styles.td}>{freq}</td>

                        <td style={styles.td}>
                          {row.lastDone ? (
                            <>
                              <div>{fmtDate(row.lastDone.date_effectuee)}</div>
                              <div style={{ color: "rgba(0,0,0,.6)", fontSize: 13 }}>
                                {fmtKm(row.lastDone.km_effectue)}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td style={styles.td}>{nextDueText(row, unite.km_actuel)}</td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              color: status.tone,
                              background: status.bg,
                              borderColor: status.border,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                          <div
                            style={styles.menuWrap}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <button
                              style={styles.btnMini}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRowMenuOpenId((v) => (v === rowMenuId ? null : rowMenuId));
                                setHistMenuOpenId(null);
                              }}
                            >
                              ...
                            </button>

                            {rowMenuOpenId === rowMenuId && (
  <div style={styles.menu}>
    <div style={styles.menuGrid}>
      
      <button
        style={styles.menuItem}
        type="button"
        onClick={() => addToBt(row)}
      >
        Ajouter au BT
      </button>

      <button
        style={styles.menuItem}
        type="button"
        onClick={() => openManualCreate(row)}
      >
        Saisie manuelle
      </button>

      {row.sourceType === "unite" ? (
        <>
          <button
            style={styles.menuItem}
            type="button"
            onClick={() => openEditUnitItem(row)}
          >
            Modifier
          </button>

          <button
            style={{ ...styles.menuItem, color: "#991b1b" }}
            type="button"
            onClick={() => deleteRowItem(row)}
          >
            Supprimer
          </button>
        </>
      ) : (
        <>
          <div style={styles.menuItemMuted}>
            Template (lecture seule)
          </div>

          <button
            style={{ ...styles.menuItem, color: "#991b1b" }}
            type="button"
            onClick={() => deleteRowItem(row)}
          >
            Retirer de l’unité
          </button>
        </>
      )}
    </div>
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

          <div style={styles.card}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Historique</div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Entretien</th>
                  <th style={styles.th}>BT</th>
                  <th style={styles.th}>KM</th>
                  <th style={styles.th}>Note</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {historique.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={6}>
                      <span style={{ color: "rgba(0,0,0,.6)" }}>
                        Aucun historique pour cette unité.
                      </span>
                    </td>
                  </tr>
                ) : (
                  historique.map((h) => {
                    const bt = h.bt_id ? btMap[h.bt_id] : null;
                    const histMenuId = h.id;

                    return (
                      <tr
                        key={h.id}
                        style={h.bt_id ? styles.histRowClickable : undefined}
                        onDoubleClick={() => openBt(h.bt_id)}
                        title={h.bt_id ? "Double-clique pour ouvrir le BT" : undefined}
                      >
                        <td style={styles.td}>{fmtDate(h.date_effectuee)}</td>
                        <td style={{ ...styles.td, fontWeight: 900 }}>{h.nom_snapshot}</td>
                        <td style={styles.td}>{bt?.numero || (h.bt_id ? "BT lié" : "—")}</td>
                        <td style={styles.td}>{fmtKm(h.km_effectue)}</td>
                        <td style={styles.td}>{h.note || ""}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <div
                            style={styles.menuWrap}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <button
                              style={styles.btnMini}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistMenuOpenId((v) => (v === histMenuId ? null : histMenuId));
                                setRowMenuOpenId(null);
                              }}
                            >
                              ...
                            </button>

                            {histMenuOpenId === histMenuId && (
                              <div style={styles.menu}>
                                <div style={styles.menuGrid}>
                                  <button
                                    style={styles.menuItem}
                                    type="button"
                                    onClick={() => openManualEdit(h)}
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    style={styles.menuItem}
                                    type="button"
                                    onClick={() => deleteHistory(h)}
                                  >
                                    Supprimer
                                  </button>
                                  {h.bt_id ? (
                                    <button
                                      style={styles.menuItem}
                                      type="button"
                                      onClick={() => openBt(h.bt_id)}
                                    >
                                      Ouvrir le BT
                                    </button>
                                  ) : (
                                    <div />
                                  )}
                                </div>
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
        </>
      )}

      {addOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            if (busy) return;
            setAddOpen(false);
          }}
        >
          <div
            style={styles.modalCard}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>
              Ajouter entretien périodique
            </div>

            <div style={styles.tabsWrap}>
              <button
                style={{
                  ...styles.tabBtn,
                  background: addMode === "template" ? "#111827" : "#fff",
                  color: addMode === "template" ? "#fff" : "#111827",
                }}
                type="button"
                onClick={() => setAddMode("template")}
              >
                À partir d’un template
              </button>

              <button
                style={{
                  ...styles.tabBtn,
                  background: addMode === "manual" ? "#111827" : "#fff",
                  color: addMode === "manual" ? "#fff" : "#111827",
                }}
                type="button"
                onClick={() => setAddMode("manual")}
              >
                Manuel
              </button>
            </div>

            {addMode === "template" ? (
              <>
                <select
                  style={{ ...styles.input, width: "100%" }}
                  value={assignTemplateId}
                  onChange={(e) => setAssignTemplateId(e.target.value)}
                >
                  <option value="">Choisir un template</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                    </option>
                  ))}
                </select>

                {availableTemplates.length === 0 && (
                  <div style={styles.helperBox}>
                    Tous les templates disponibles sont déjà assignés à cette unité.
                  </div>
                )}

                <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    style={styles.btn}
                    type="button"
                    onClick={() => setAddOpen(false)}
                    disabled={busy}
                  >
                    Annuler
                  </button>
                  <button
                    style={styles.btnPrimary}
                    type="button"
                    onClick={assignTemplate}
                    disabled={busy || !assignTemplateId}
                  >
                    Ajouter
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
                  <input
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    placeholder="Nom"
                    value={localNom}
                    onChange={(e) => setLocalNom(e.target.value)}
                  />
                  <input
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    placeholder="Fréquence km"
                    value={localFreqKm}
                    onChange={(e) => setLocalFreqKm(e.target.value)}
                    inputMode="numeric"
                  />
                  <input
                    style={{ ...styles.input, width: "100%", minWidth: 0 }}
                    placeholder="Fréquence jours"
                    value={localFreqJours}
                    onChange={(e) => setLocalFreqJours(e.target.value)}
                    inputMode="numeric"
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <input
                    style={{ ...styles.input, width: "100%" }}
                    placeholder="Description (optionnel)"
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                  />
                </div>

                <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    style={styles.btn}
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      resetItemEditor();
                    }}
                    disabled={busy}
                  >
                    Annuler
                  </button>
                  <button
                    style={styles.btnPrimary}
                    type="button"
                    onClick={createManualUnitItemFromAddModal}
                    disabled={busy || !localNom.trim()}
                  >
                    Enregistrer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {itemEditorOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            if (busy) return;
            setItemEditorOpen(false);
            resetItemEditor();
          }}
        >
          <div
            style={styles.modalCard}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>
              Modifier l’entretien
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
              <input
                style={{ ...styles.input, width: "100%", minWidth: 0 }}
                placeholder="Nom"
                value={localNom}
                onChange={(e) => setLocalNom(e.target.value)}
              />
              <input
                style={{ ...styles.input, width: "100%", minWidth: 0 }}
                placeholder="Fréquence km"
                value={localFreqKm}
                onChange={(e) => setLocalFreqKm(e.target.value)}
                inputMode="numeric"
              />
              <input
                style={{ ...styles.input, width: "100%", minWidth: 0 }}
                placeholder="Fréquence jours"
                value={localFreqJours}
                onChange={(e) => setLocalFreqJours(e.target.value)}
                inputMode="numeric"
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                style={{ ...styles.input, width: "100%" }}
                placeholder="Description (optionnel)"
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
              />
            </div>

            <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                style={styles.btn}
                type="button"
                onClick={() => {
                  setItemEditorOpen(false);
                  resetItemEditor();
                }}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                style={styles.btnPrimary}
                type="button"
                onClick={saveUnitItem}
                disabled={busy || !localNom.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            if (busy) return;
            setManualOpen(false);
            setManualRow(null);
            setEditingHistory(null);
          }}
        >
          <div
            style={styles.modalCard}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>
              {manualMode === "create" ? "Saisie manuelle" : "Modifier l’historique"}
            </div>

            <div style={{ color: "rgba(0,0,0,.7)", marginBottom: 12 }}>
              <b>
                {manualMode === "create"
                  ? manualRow?.nom || "Entretien"
                  : editingHistory?.nom_snapshot || "Historique"}
              </b>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Date</div>
                <input
                  type="date"
                  style={{ ...styles.input, width: "100%" }}
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>KM</div>
                <input
                  style={{ ...styles.input, width: "100%" }}
                  value={manualKm}
                  onChange={(e) => setManualKm(e.target.value)}
                  inputMode="numeric"
                  placeholder="KM au moment de l’entretien"
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Note</div>
              <input
                style={{ ...styles.input, width: "100%" }}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Optionnel"
              />
            </div>

            {manualMode === "edit" && editingHistory?.bt_id ? (
              <div style={styles.helperBox}>
                Cet historique est lié à un BT. La date, le km et la note restent modifiables ici.
              </div>
            ) : null}

            <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                style={styles.btn}
                type="button"
                onClick={() => {
                  setManualOpen(false);
                  setManualRow(null);
                  setEditingHistory(null);
                }}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                style={styles.btnPrimary}
                type="button"
                onClick={saveManual}
                disabled={busy}
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