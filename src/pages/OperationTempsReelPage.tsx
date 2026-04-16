// src/pages/OperationTempsReelPage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getEmployeConnecte, type EmployeConnecte } from "../lib/getEmployeConnecte";

type UniteRow = {
  id: string;
  no_unite: string | null;
  marque: string | null;
  modele: string | null;
  plaque: string | null;
  client_id: string | null;
  type_unite_id?: string | null;
  km_actuel?: number | null;
  km_updated_at?: string | null;
  km_status?: "ok" | "warning" | "anomaly" | string | null;
};

type ClientRow = {
  id: string;
  nom: string;
};

type ClientConfigRow = {
  id: string;
  client_id: string;
  taux_horaire: number | null;
  marge_pieces: number | null;
  frais_atelier_pourcentage: number | null;
};

type ClientTauxMO = {
  id: string;
  client_id: string;
  type_unite_id: string | null;
  taux_horaire: number;
  actif: boolean;
};

type BtRow = {
  id: string;
  numero?: string | null;
  statut?: string | null;
  km?: number | null;
  unite_id: string;
  date_ouverture?: string | null;
  unite?: {
    id: string;
    no_unite: string | null;
    marque: string | null;
    modele: string | null;
    plaque: string | null;
    km_actuel?: number | null;
    km_updated_at?: string | null;
    km_status?: "ok" | "warning" | "anomaly" | string | null;
  } | null;
};

type Pointage = {
  id: string;
  bt_id: string;
  employe_id?: string | null;
  mecano_nom: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  actif: boolean;
  note: string | null;
  created_at: string;
  bons_travail?: BtRow | null;
};

type EmployeListRow = {
  id: string;
  nom_complet: string;
  email: string;
  actif: boolean;
};

type KmRpcResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  last_km?: number | null;
  last_bt_id?: string | null;
  last_bt_numero?: string | null;
  last_date?: string | null;
  log_id?: string | null;
};

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

function fmtDurationMinutes(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(totalMinutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function fmtKm(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(Number(v));
}

function nowIso() {
  return new Date().toISOString();
}

function diffMinutes(startedAt: string, endedAt?: string | null) {
  const a = new Date(startedAt).getTime();
  const b = new Date(endedAt || nowIso()).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 60000);
}

function statusLabel(statut: string | null | undefined) {
  if (statut === "a_faire") return "À faire";
  if (statut === "en_cours") return "En cours";
  if (statut === "termine") return "Terminé";
  if (statut === "facture") return "Facturé";
  if (statut === "ouvert") return "Ouvert";
  if (statut === "ferme") return "Fermé";
  if (statut === "a_facturer") return "À facturer";
  return statut || "—";
}

function toNullableKm(value: string): number | null {
  const s = String(value || "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function parseDateTimeLocal(value: string) {
  const s = String(value || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function resolveClientSnapshotsForUnite(unite: UniteRow) {
  if (!unite.client_id) {
    return {
      client_id: null,
      client_nom: null,
      taux_horaire_snapshot: null,
      marge_pieces_snapshot: null,
      frais_atelier_pct_snapshot: null,
    };
  }

  const [{ data: clientData }, { data: cfgData }, { data: tauxRows }] = await Promise.all([
    supabase.from("clients").select("id,nom").eq("id", unite.client_id).maybeSingle(),
    supabase
      .from("client_configuration")
      .select("id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage")
      .eq("client_id", unite.client_id)
      .maybeSingle(),
    supabase
      .from("client_taux_main_oeuvre")
      .select("id,client_id,type_unite_id,taux_horaire,actif")
      .eq("client_id", unite.client_id),
  ]);

  const client = (clientData as ClientRow | null) ?? null;
  const cfg = (cfgData as ClientConfigRow | null) ?? null;
  const taux = ((tauxRows || []) as ClientTauxMO[]) ?? [];

  const typeId = unite.type_unite_id ?? null;
  const specific = taux.find((r) => r.actif && r.type_unite_id === typeId);

  const tauxHoraire = specific
    ? Number(specific.taux_horaire || 0)
    : Number(cfg?.taux_horaire || 0);

  return {
    client_id: unite.client_id ?? null,
    client_nom: client?.nom || null,
    taux_horaire_snapshot: Number.isFinite(tauxHoraire) ? tauxHoraire : null,
    marge_pieces_snapshot: cfg?.marge_pieces ?? null,
    frais_atelier_pct_snapshot: cfg?.frais_atelier_pourcentage ?? null,
  };
}

export default function OperationTempsReelPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [employeConnecte, setEmployeConnecte] = useState<EmployeConnecte | null>(null);
  const [mecanoNom, setMecanoNom] = useState("");

  const [uniteInput, setUniteInput] = useState("");
  const [kmInput, setKmInput] = useState("");

  const [previewUnite, setPreviewUnite] = useState<UniteRow | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [activePointage, setActivePointage] = useState<Pointage | null>(null);
  const [pointagesJour, setPointagesJour] = useState<Pointage[]>([]);
  const [tick, setTick] = useState(0);

  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);

  const [editPointage, setEditPointage] = useState<Pointage | null>(null);
  const [editStartedAt, setEditStartedAt] = useState("");
  const [editEndedAt, setEditEndedAt] = useState("");

  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [uniteMenuOpen, setUniteMenuOpen] = useState(false);

  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [employesActifs, setEmployesActifs] = useState<EmployeListRow[]>([]);
  const [selectedEmployeId, setSelectedEmployeId] = useState("");
  const [switchPassword, setSwitchPassword] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    function onDocClick() {
      setRowMenuOpenId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-unite-combobox="true"]')) {
        setUniteMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const activeElapsedMinutes = useMemo(() => {
    if (!activePointage) return 0;
    return diffMinutes(activePointage.started_at, null);
  }, [activePointage, tick]);

  const filteredUnites = useMemo(() => {
    const q = uniteInput.trim().toLowerCase();

    if (!q) return unites.slice(0, 25);

    return unites
      .filter((u) => {
        const no = String(u.no_unite || "").toLowerCase();
        const marque = String(u.marque || "").toLowerCase();
        const modele = String(u.modele || "").toLowerCase();
        const plaque = String(u.plaque || "").toLowerCase();

        return no.includes(q) || marque.includes(q) || modele.includes(q) || plaque.includes(q);
      })
      .slice(0, 25);
  }, [unites, uniteInput]);

  const selectedEmploye = useMemo(
    () => employesActifs.find((e) => e.id === selectedEmployeId) ?? null,
    [employesActifs, selectedEmployeId]
  );

  async function hydrateBtRows(rows: any[]): Promise<Pointage[]> {
    const btIds = Array.from(new Set((rows || []).map((r) => r.bt_id).filter(Boolean)));

    if (!btIds.length) {
      return (rows || []).map((r) => ({ ...r, bons_travail: null })) as Pointage[];
    }

    const { data: btRows, error: btError } = await supabase
      .from("bons_travail")
      .select("id,numero,statut,km,unite_id,date_ouverture")
      .in("id", btIds);

    if (btError) throw btError;

    const uniteIds = Array.from(new Set(((btRows || []) as any[]).map((b) => b.unite_id).filter(Boolean)));

    let uniteMap = new Map<string, any>();
    if (uniteIds.length) {
      const { data: uniteRows, error: uniteError } = await supabase
        .from("unites")
        .select("id,no_unite,marque,modele,plaque,km_actuel,km_updated_at,km_status")
        .in("id", uniteIds);

      if (uniteError) throw uniteError;
      uniteMap = new Map(((uniteRows || []) as any[]).map((u) => [u.id, u]));
    }

    const btMap = new Map(
      ((btRows || []) as any[]).map((b) => [
        b.id,
        {
          ...b,
          unite: uniteMap.get(b.unite_id) || null,
        },
      ])
    );

    return (rows || []).map((r) => ({
      ...(r as any),
      bons_travail: btMap.get(r.bt_id) || null,
    })) as Pointage[];
  }

  async function loadEmployeConnecteLocal() {
    const employe = await getEmployeConnecte();
    setEmployeConnecte(employe);
    setMecanoNom(employe?.nom_complet || "");
    return employe;
  }

  async function loadEmployesActifs() {
    const { data, error } = await supabase
      .from("employes")
      .select("id,nom_complet,email,actif")
      .eq("actif", true)
      .order("nom_complet", { ascending: true });

    if (error) throw error;
    setEmployesActifs((data || []) as EmployeListRow[]);
  }

  async function loadActivePointage(currentEmployeId: string) {
    const employeId = currentEmployeId.trim();
    if (!employeId) {
      setActivePointage(null);
      return;
    }

    const { data, error } = await supabase
      .from("bt_pointages")
      .select(`
        id,
        bt_id,
        employe_id,
        mecano_nom,
        started_at,
        ended_at,
        duration_minutes,
        actif,
        note,
        created_at
      `)
      .eq("employe_id", employeId)
      .eq("actif", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      setActivePointage(null);
      return;
    }

    const hydrated = await hydrateBtRows([data]);
    setActivePointage(hydrated[0] || null);
  }

  async function loadPointagesJour(currentEmployeId: string) {
    const employeId = currentEmployeId.trim();
    if (!employeId) {
      setPointagesJour([]);
      return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("bt_pointages")
      .select(`
        id,
        bt_id,
        employe_id,
        mecano_nom,
        started_at,
        ended_at,
        duration_minutes,
        actif,
        note,
        created_at
      `)
      .eq("employe_id", employeId)
      .gte("started_at", start.toISOString())
      .order("started_at", { ascending: false });

    if (error) throw error;
    const hydrated = await hydrateBtRows((data || []) as any[]);
    setPointagesJour(hydrated);
  }

  async function loadUnites() {
    const { data, error } = await supabase
      .from("unites")
      .select("id,no_unite,marque,modele,plaque,client_id,type_unite_id,km_actuel,km_updated_at,km_status")
      .order("no_unite", { ascending: true });

    if (error) throw error;
    setUnites((data || []) as UniteRow[]);
  }

  async function refreshAll() {
    setLoading(true);
    setErr(null);

    try {
      const employe = await loadEmployeConnecteLocal();
      const connectedEmployeId = employe?.id || "";

      await Promise.all([
        loadEmployesActifs(),
        loadActivePointage(connectedEmployeId),
        loadPointagesJour(connectedEmployeId),
        loadUnites(),
      ]);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function findUniteByNo(noUnite: string) {
    const valeur = noUnite.trim();
    if (!valeur) return null;

    const { data, error } = await supabase
      .from("unites")
      .select("id,no_unite,marque,modele,plaque,client_id,type_unite_id,km_actuel,km_updated_at,km_status")
      .eq("no_unite", valeur)
      .maybeSingle();

    if (error) throw error;
    return (data as UniteRow | null) ?? null;
  }

  async function refreshPreviewUnite(noUnite: string) {
    const valeur = noUnite.trim();

    if (!valeur) {
      setPreviewUnite(null);
      return;
    }

    setPreviewBusy(true);
    try {
      const unite = await findUniteByNo(valeur);
      setPreviewUnite(unite);
    } catch {
      setPreviewUnite(null);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function findOpenBtForUnite(uniteId: string): Promise<BtRow | null> {
    const { data, error } = await supabase
      .from("bons_travail")
      .select("id,numero,statut,date_ouverture,km,unite_id")
      .eq("unite_id", uniteId)
      .in("statut", ["a_faire", "en_cours", "ouvert"])
      .order("date_ouverture", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const bt = data as BtRow;

    const { data: uniteData, error: uniteError } = await supabase
      .from("unites")
      .select("id,no_unite,marque,modele,plaque,km_actuel,km_updated_at,km_status")
      .eq("id", bt.unite_id)
      .maybeSingle();

    if (uniteError) throw uniteError;

    return {
      ...bt,
      unite: (uniteData as any) ?? null,
    };
  }

  async function createBtForUnite(unite: UniteRow): Promise<BtRow> {
    const snapshots = await resolveClientSnapshotsForUnite(unite);

    const payload: Record<string, unknown> = {
      unite_id: unite.id,
      statut: "en_cours",
      date_ouverture: nowIso(),
      client_id: snapshots.client_id,
      client_nom: snapshots.client_nom,
      taux_horaire_snapshot: snapshots.taux_horaire_snapshot,
      marge_pieces_snapshot: snapshots.marge_pieces_snapshot,
      frais_atelier_pct_snapshot: snapshots.frais_atelier_pct_snapshot,
    };

    const { data, error } = await supabase
      .from("bons_travail")
      .insert(payload)
      .select("id,numero,statut,date_ouverture,km,unite_id")
      .single();

    if (error) throw error;

    return {
      ...(data as any),
      unite: {
        id: unite.id,
        no_unite: unite.no_unite,
        marque: unite.marque,
        modele: unite.modele,
        plaque: unite.plaque,
        km_actuel: unite.km_actuel ?? null,
        km_updated_at: unite.km_updated_at ?? null,
        km_status: unite.km_status ?? null,
      },
    };
  }

  async function enregistrerKmSurBt(btId: string, uniteId: string, km: number) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc("enregistrer_km_bt", {
      p_bt_id: btId,
      p_unite_id: uniteId,
      p_km: km,
      p_source: "bt_open",
      p_note: null,
      p_force: false,
      p_override_reason: null,
      p_created_by: user?.id ?? null,
    });

    if (error) throw error;

    const res = (data || {}) as KmRpcResponse;

    if (res.ok === false && res.code === "KM_LOWER_THAN_LAST") {
      const message =
        `Ancien KM enregistré : ${fmtKm(res.last_km)}\n` +
        `Dernier BT : ${res.last_bt_numero || "—"}\n` +
        `Date : ${fmtDateTime(res.last_date)}\n\n` +
        `Le nouveau KM est inférieur. Voulez-vous continuer ?`;

      const confirmed = window.confirm(message);
      if (!confirmed) {
        return false;
      }

      const { data: forcedData, error: forcedError } = await supabase.rpc("enregistrer_km_bt", {
        p_bt_id: btId,
        p_unite_id: uniteId,
        p_km: km,
        p_source: "bt_open",
        p_note: null,
        p_force: true,
        p_override_reason: "KM inférieur confirmé manuellement depuis Opération temps réel",
        p_created_by: user?.id ?? null,
      });

      if (forcedError) throw forcedError;

      const forcedRes = (forcedData || {}) as KmRpcResponse;
      if (forcedRes.ok === false) {
        throw new Error(forcedRes.message || "Impossible d'enregistrer le kilométrage.");
      }

      return true;
    }

    if (res.ok === false) {
      throw new Error(res.message || "Impossible d'enregistrer le kilométrage.");
    }

    return true;
  }

  async function getOrCreateBtForUnite(noUnite: string, km: number | null) {
    const unite = await findUniteByNo(noUnite);

    if (!unite) {
      throw new Error("Aucune unité trouvée avec ce numéro.");
    }

    let bt = await findOpenBtForUnite(unite.id);

    if (bt) {
      if (bt.statut === "a_faire" || bt.statut === "ouvert") {
        const { error: updateStatusErr } = await supabase
          .from("bons_travail")
          .update({ statut: "en_cours" })
          .eq("id", bt.id);

        if (updateStatusErr) throw updateStatusErr;
        bt = { ...bt, statut: "en_cours" };
      }
    } else {
      bt = await createBtForUnite(unite);
    }

    if (km != null && !Number.isNaN(km)) {
      const ok = await enregistrerKmSurBt(bt.id, unite.id, km);
      if (!ok) {
        throw new Error("Démarrage annulé.");
      }
    }

    return bt;
  }

  async function demarrerPointage() {
    const uniteNo = uniteInput.trim();
    const nom = mecanoNom.trim();
    const km = toNullableKm(kmInput);

    if (!employeConnecte) {
      alert("Aucun employé actif n'est lié au user connecté.");
      return;
    }

    if (!nom) {
      alert("Impossible d’identifier l’employé connecté.");
      return;
    }

    if (!uniteNo) {
      alert("Entre un numéro d’unité.");
      return;
    }

    if (Number.isNaN(km)) {
      alert("Le KM est invalide.");
      return;
    }

    if (activePointage) {
      alert("Un pointage est déjà actif pour cet employé.");
      return;
    }

    setBusy(true);

    try {
      const bt = await getOrCreateBtForUnite(uniteNo, km);

      const { error } = await supabase.from("bt_pointages").insert({
        bt_id: bt.id,
        employe_id: employeConnecte.id,
        mecano_nom: nom,
        started_at: nowIso(),
        ended_at: null,
        duration_minutes: null,
        actif: true,
        note: null,
      });

      if (error) throw error;

      setUniteInput("");
      setKmInput("");
      setPreviewUnite(null);
      setUniteMenuOpen(false);

      await refreshAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function arreterPointage() {
    if (!activePointage) return;

    setBusy(true);

    try {
      const endedAt = nowIso();
      const minutes = diffMinutes(activePointage.started_at, endedAt);

      const { error } = await supabase
        .from("bt_pointages")
        .update({
          ended_at: endedAt,
          duration_minutes: minutes,
          actif: false,
        })
        .eq("id", activePointage.id);

      if (error) throw error;

      await refreshAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function supprimerPointage(pointageId: string) {
    if (!confirm("Supprimer ce pointage ?")) return;

    setBusy(true);

    try {
      const { error } = await supabase.from("bt_pointages").delete().eq("id", pointageId);

      if (error) throw error;

      await refreshAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function openEditModal(pointage: Pointage) {
    setEditPointage(pointage);
    setEditStartedAt(toDateTimeLocalValue(pointage.started_at));
    setEditEndedAt(pointage.ended_at ? toDateTimeLocalValue(pointage.ended_at) : "");
    setRowMenuOpenId(null);
  }

  function closeEditModal() {
    setEditPointage(null);
    setEditStartedAt("");
    setEditEndedAt("");
  }

  async function saveEditPointage() {
    if (!editPointage) return;

    const startDate = parseDateTimeLocal(editStartedAt);
    const endDate = parseDateTimeLocal(editEndedAt);

    if (!startDate) {
      alert("L'heure de début est invalide.");
      return;
    }

    if (!endDate) {
      alert("L'heure de fin est invalide.");
      return;
    }

    if (endDate.getTime() < startDate.getTime()) {
      alert("L'heure de fin ne peut pas être avant l'heure de début.");
      return;
    }

    const startedAtIso = startDate.toISOString();
    const endedAtIso = endDate.toISOString();
    const duration = diffMinutes(startedAtIso, endedAtIso);

    setBusy(true);

    try {
      const { error } = await supabase
        .from("bt_pointages")
        .update({
          started_at: startedAtIso,
          ended_at: endedAtIso,
          duration_minutes: duration,
          actif: false,
        })
        .eq("id", editPointage.id);

      if (error) throw error;

      closeEditModal();
      await refreshAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function openSwitchModal() {
    setSelectedEmployeId("");
    setSwitchPassword("");
    setSwitchError(null);
    setSwitchModalOpen(true);
  }

  async function handleQuickSwitch() {
    if (!selectedEmploye) {
      setSwitchError("Sélectionne un employé.");
      return;
    }

    if (!selectedEmploye.email) {
      setSwitchError("Cet employé n'a pas d'email.");
      return;
    }

    if (!switchPassword.trim()) {
      setSwitchError("Entre le mot de passe.");
      return;
    }

    setSwitchBusy(true);
    setSwitchError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: selectedEmploye.email.trim(),
        password: switchPassword,
      });

      if (error) throw error;

      setSwitchModalOpen(false);
      setSelectedEmployeId("");
      setSwitchPassword("");
      setSwitchError(null);

      await refreshAll();
    } catch (e: any) {
      setSwitchError(e?.message || "Connexion impossible.");
    } finally {
      setSwitchBusy(false);
    }
  }

  async function handleQuickLogout() {
    if (activePointage) {
      const ok = window.confirm(
        "Un pointage est encore actif pour cet employé. Veux-tu vraiment te déconnecter ?"
      );
      if (!ok) return;
    }

    setSwitchBusy(true);
    setSwitchError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setEmployeConnecte(null);
      setMecanoNom("");
      setActivePointage(null);
      setPointagesJour([]);
      setSwitchModalOpen(false);
      setSelectedEmployeId("");
      setSwitchPassword("");
      setSwitchError(null);

      await refreshAll();
    } catch (e: any) {
      setSwitchError(e?.message || "Déconnexion impossible.");
    } finally {
      setSwitchBusy(false);
    }
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100%",
      padding: 24,
      width: "100%",
      maxWidth: 1200,
      margin: "0 auto",
      position: "relative",
    },
    headerWrap: {
      marginBottom: 18,
    },
    h1: {
      margin: 0,
      fontSize: 28,
      fontWeight: 950,
      letterSpacing: -0.3,
    },
    muted: {
      color: "rgba(0,0,0,.6)",
    },
    pageCenter: {
      minHeight: "calc(100vh - 210px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "10px 0 22px",
    },
    centerCard: {
      width: "100%",
      maxWidth: 860,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 22,
      boxShadow: "0 22px 60px rgba(0,0,0,.08)",
      padding: 30,
    },
    centerTitle: {
      margin: 0,
      textAlign: "center",
      fontSize: 32,
      fontWeight: 950,
      letterSpacing: -0.5,
    },
    centerSub: {
      marginTop: 8,
      textAlign: "center",
      color: "rgba(0,0,0,.6)",
      fontSize: 15,
    },
    centerMeta: {
      marginTop: 18,
      display: "flex",
      justifyContent: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    employePill: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      padding: "10px 16px",
      borderRadius: 999,
      background: "rgba(37,99,235,.08)",
      border: "1px solid rgba(37,99,235,.15)",
      color: "#1d4ed8",
      fontWeight: 900,
      fontSize: 14,
    },
    switchInlineBtn: {
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 14,
  border: "1.5px solid #ef4444",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
},
    unitFormGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) 200px",
      gap: 14,
      marginTop: 26,
      alignItems: "end",
    },
    inputBlock: {
      minWidth: 0,
    },
    fieldLabel: {
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      marginBottom: 6,
      fontWeight: 800,
      letterSpacing: 0.2,
    },
    unitInputWrap: {
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      minHeight: 78,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
    },
    unitMainInput: {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      fontSize: 24,
      fontWeight: 950,
      letterSpacing: -0.2,
      padding: 0,
      margin: 0,
      lineHeight: 1.2,
    },
    unitSubText: {
      marginTop: 4,
      fontSize: 12,
      color: "rgba(0,0,0,.58)",
      minHeight: 18,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    kmInputWrap: {
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      minHeight: 78,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    kmInput: {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      fontSize: 24,
      fontWeight: 950,
      letterSpacing: -0.2,
      padding: 0,
      margin: 0,
      lineHeight: 1.2,
    },
    kmSubText: {
      marginTop: 4,
      fontSize: 12,
      color: "rgba(0,0,0,.58)",
      minHeight: 18,
    },
    startButtonWrap: {
      marginTop: 20,
      display: "flex",
      justifyContent: "center",
    },
    bigPrimary: {
      width: "100%",
      maxWidth: 420,
      minHeight: 64,
      borderRadius: 16,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 950,
      fontSize: 19,
      cursor: "pointer",
      boxShadow: "0 12px 30px rgba(37,99,235,.24)",
    },
    activeCard: {
      width: "100%",
      maxWidth: 880,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 22,
      boxShadow: "0 22px 60px rgba(0,0,0,.08)",
      padding: 30,
    },
    activeTopTitle: {
      textAlign: "center",
      fontSize: 32,
      fontWeight: 950,
      margin: 0,
    },
    activeTopSub: {
      marginTop: 8,
      textAlign: "center",
      color: "rgba(0,0,0,.6)",
      fontSize: 15,
    },
    activeMetaRow: {
      marginTop: 16,
      display: "flex",
      justifyContent: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    activeUnitBox: {
      marginTop: 24,
      padding: 22,
      borderRadius: 18,
      background: "rgba(37,99,235,.06)",
      border: "1px solid rgba(37,99,235,.16)",
      textAlign: "center",
    },
    activeUnitLabel: {
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      marginBottom: 6,
      fontWeight: 800,
    },
    activeUnitValue: {
      fontSize: 36,
      fontWeight: 950,
      lineHeight: 1.05,
      letterSpacing: -0.5,
    },
    activeUnitSub: {
      marginTop: 8,
      fontSize: 14,
      color: "rgba(0,0,0,.68)",
      fontWeight: 700,
    },
    activeStatsRow: {
      marginTop: 18,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
    },
    statCard: {
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.08)",
      background: "#fafafa",
      padding: 16,
      textAlign: "center",
    },
    statLabel: {
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      fontWeight: 800,
      marginBottom: 6,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 950,
      lineHeight: 1.15,
    },
    centeredActions: {
      marginTop: 24,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      maxWidth: 560,
      marginLeft: "auto",
      marginRight: "auto",
    },
    bigSecondary: {
      minHeight: 76,
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      color: "#111827",
      fontWeight: 950,
      fontSize: 19,
      cursor: "pointer",
    },
    bigDanger: {
      minHeight: 76,
      borderRadius: 18,
      border: "1px solid #dc2626",
      background: "#dc2626",
      color: "#fff",
      fontWeight: 950,
      fontSize: 19,
      cursor: "pointer",
      boxShadow: "0 12px 28px rgba(220,38,38,.20)",
    },
    warn: {
      background: "rgba(245,158,11,.10)",
      border: "1px solid rgba(245,158,11,.25)",
      borderRadius: 14,
      padding: 12,
      color: "rgba(0,0,0,.78)",
      fontWeight: 700,
      fontSize: 13,
      marginTop: 14,
    },
    errorBox: {
      background: "#fff",
      border: "1px solid rgba(220,38,38,.35)",
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
    },
    tableCard: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 12px 34px rgba(0,0,0,.06)",
      marginTop: 12,
      overflowX: "auto",
    },
    tableTitle: {
      fontSize: 16,
      fontWeight: 950,
      marginBottom: 12,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 760,
    },
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    },
    td: {
      padding: "12px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top",
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    },
    btnBlue: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    actionsWrap: {
      position: "relative",
      display: "inline-block",
    },
    actionMenu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 170,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 12,
      boxShadow: "0 14px 30px rgba(0,0,0,.14)",
      padding: 6,
      zIndex: 50,
    },
    actionMenuBtn: {
      width: "100%",
      textAlign: "left",
      padding: "10px 12px",
      borderRadius: 10,
      border: "none",
      background: "transparent",
      fontWeight: 800,
      cursor: "pointer",
    },
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.35)",
      backdropFilter: "blur(5px)",
      WebkitBackdropFilter: "blur(5px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: 20,
    },
    modal: {
      width: "100%",
      maxWidth: 520,
      background: "#fff",
      borderRadius: 18,
      boxShadow: "0 20px 60px rgba(0,0,0,.22)",
      border: "1px solid rgba(0,0,0,.08)",
      overflow: "hidden",
    },
    modalHeader: {
      padding: "16px 18px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
      fontWeight: 900,
      fontSize: 18,
    },
    modalHeaderSub: {
      fontSize: 13,
      color: "rgba(0,0,0,.58)",
      fontWeight: 600,
      marginTop: 4,
    },
    modalBody: {
      padding: 18,
      display: "grid",
      gap: 14,
    },
    modalFooter: {
      padding: "16px 18px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
    },
    dateInput: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      font: "inherit",
      boxSizing: "border-box",
    },
    unitDropdown: {
      position: "absolute",
      top: "calc(100% + 6px)",
      left: 0,
      right: 0,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 14,
      boxShadow: "0 16px 40px rgba(0,0,0,.12)",
      maxHeight: 260,
      overflowY: "auto",
      zIndex: 100,
    },
    unitDropdownBtn: {
      width: "100%",
      textAlign: "left",
      padding: "12px 14px",
      border: "none",
      background: "#fff",
      cursor: "pointer",
      borderBottom: "1px solid rgba(0,0,0,.06)",
    },
    unitDropdownMain: {
      fontWeight: 900,
    },
    unitDropdownSub: {
      fontSize: 12,
      color: "rgba(0,0,0,.6)",
      marginTop: 4,
    },
    unitEmpty: {
      padding: "14px 16px",
      fontSize: 13,
      color: "rgba(0,0,0,.58)",
    },
    switchFab: {
      position: "fixed",
      right: 18,
      bottom: 18,
      zIndex: 120,
      minHeight: 54,
      padding: "0 18px",
      borderRadius: 999,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      fontSize: 14,
      cursor: "pointer",
      boxShadow: "0 14px 34px rgba(37,99,235,.28)",
    },
    modalInfoCard: {
      borderRadius: 14,
      border: "1px solid rgba(37,99,235,.14)",
      background: "rgba(37,99,235,.06)",
      padding: 12,
      fontSize: 14,
      color: "#1e3a8a",
      fontWeight: 700,
    },
    modalError: {
      borderRadius: 12,
      border: "1px solid rgba(220,38,38,.20)",
      background: "rgba(220,38,38,.06)",
      padding: 12,
      color: "#b91c1c",
      fontSize: 13,
      fontWeight: 700,
    },
    selectInput: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      font: "inherit",
      boxSizing: "border-box",
      minHeight: 46,
    },
    textInput: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      font: "inherit",
      boxSizing: "border-box",
      minHeight: 46,
    },
    btnDangerGhost: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(220,38,38,.35)",
      background: "#fff",
      color: "#b91c1c",
      fontWeight: 900,
      cursor: "pointer",
    },
  };

  const unitPreviewText = previewBusy
    ? "Chargement de l’unité..."
    : previewUnite
    ? [previewUnite.marque, previewUnite.modele, previewUnite.plaque ? `• ${previewUnite.plaque}` : null]
        .filter(Boolean)
        .join(" ")
    : uniteInput.trim()
    ? "Aucune unité trouvée"
    : "Entrer un numéro d’unité";

  return (
    <div style={styles.page}>
      <div style={styles.headerWrap}>
        <div style={styles.h1}>Opération temps réel</div>
        <div style={styles.muted}></div>
      </div>

      {err && (
        <div style={styles.errorBox}>
          <b>Erreur :</b> {err}
        </div>
      )}

      <div style={styles.pageCenter}>
        {!activePointage ? (
          <div style={styles.centerCard}>
            <h1 style={styles.centerTitle}>Démarrer une opération</h1>
            <div style={styles.centerSub}>Choisir une unité puis lancer le pointage</div>

            <div style={styles.centerMeta}>
              <div style={styles.employePill}>
                Employé connecté : {employeConnecte?.nom_complet || "Non connecté"}
              </div>

              <button type="button" style={styles.switchInlineBtn} onClick={openSwitchModal}>
                Déconnexion
              </button>
            </div>

            <div style={styles.unitFormGrid}>
              <div style={styles.inputBlock}>
                <div style={styles.fieldLabel}>Unité</div>

                <div style={{ position: "relative" }} data-unite-combobox="true">
                  <div style={styles.unitInputWrap}>
                    <input
                      style={styles.unitMainInput}
                      value={uniteInput}
                      name="atelier-unite-field"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      onFocus={() => setUniteMenuOpen(true)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUniteInput(v);
                        setUniteMenuOpen(true);
                        refreshPreviewUnite(v);
                      }}
                      placeholder="Choisis un véhicule"
                      disabled={busy}
                    />
                    <div style={styles.unitSubText}>{unitPreviewText}</div>
                  </div>

                  {uniteMenuOpen && (
                    <div style={styles.unitDropdown}>
                      {filteredUnites.length === 0 ? (
                        <div style={styles.unitEmpty}>Aucun résultat</div>
                      ) : (
                        filteredUnites.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            style={styles.unitDropdownBtn}
                            onClick={() => {
                              const val = u.no_unite || "";
                              setUniteInput(val);
                              setPreviewUnite(u);
                              setUniteMenuOpen(false);
                              refreshPreviewUnite(val);
                            }}
                          >
                            <div style={styles.unitDropdownMain}>{u.no_unite || "—"}</div>
                            <div style={styles.unitDropdownSub}>
                              {[u.marque, u.modele, u.plaque].filter(Boolean).join(" ")}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.inputBlock}>
                <div style={styles.fieldLabel}>Nouveau KM</div>
                <div style={styles.kmInputWrap}>
                  <input
                    style={styles.kmInput}
                    inputMode="numeric"
                    name="atelier-km-field"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={kmInput}
                    onChange={(e) => setKmInput(e.target.value)}
                    placeholder="Optionnel"
                    disabled={busy}
                  />
                  <div style={styles.kmSubText}>
                    Ancien KM : {previewBusy ? "..." : fmtKm(previewUnite?.km_actuel)}
                  </div>
                </div>
              </div>
            </div>

            {previewUnite?.km_actuel != null &&
              kmInput.trim() !== "" &&
              Number.isFinite(Number(kmInput)) &&
              Number(kmInput) < Number(previewUnite.km_actuel) && (
                <div style={styles.warn}>
                  Attention : le nouveau KM est inférieur à l’ancien KM enregistré de l’unité.
                  Une confirmation sera demandée au démarrage.
                </div>
              )}

            {!employeConnecte && !loading && (
              <div style={styles.warn}>Aucun employé actif n'est lié au user connecté.</div>
            )}

            <div style={styles.startButtonWrap}>
              <button
                style={styles.bigPrimary}
                onClick={demarrerPointage}
                disabled={busy || !mecanoNom.trim() || !uniteInput.trim() || !employeConnecte}
              >
                {busy ? "Démarrage..." : "Démarrer"}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.activeCard}>
            <h1 style={styles.activeTopTitle}>Opération en cours</h1>
            <div style={styles.activeTopSub}>Tu es actuellement pointé</div>

            <div style={styles.activeMetaRow}>
              <div style={styles.employePill}>
                Employé connecté : {employeConnecte?.nom_complet || "Non connecté"}
              </div>
              <button type="button" style={styles.switchInlineBtn} onClick={openSwitchModal}>
                Changer d’employé
              </button>
            </div>

            <div style={styles.activeUnitBox}>
              <div style={styles.activeUnitLabel}>Unité en cours</div>
              <div style={styles.activeUnitValue}>
                {activePointage?.bons_travail?.unite?.no_unite || "—"}
              </div>
              <div style={styles.activeUnitSub}>
                {activePointage?.bons_travail?.numero || "—"}
                {activePointage?.bons_travail?.statut
                  ? ` • ${statusLabel(activePointage.bons_travail.statut)}`
                  : ""}
              </div>
            </div>

            <div style={styles.activeStatsRow}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Début</div>
                <div style={styles.statValue}>
                  {activePointage ? fmtDateTime(activePointage.started_at) : "—"}
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Temps actif</div>
                <div style={styles.statValue}>
                  {activePointage ? fmtDurationMinutes(activeElapsedMinutes) : "—"}
                </div>
              </div>
            </div>

            <div style={styles.centeredActions}>
              <button
                style={styles.bigSecondary}
                onClick={() => nav(`/bt-mecano/${activePointage.bt_id}`)}
              >
                Ouvrir le bon de travail
              </button>

              <button style={styles.bigDanger} onClick={arreterPointage} disabled={busy}>
                {busy ? "Arrêt..." : "Arrêter"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableTitle}>Historique du jour</div>

        {loading ? (
          <div style={styles.muted}>Chargement…</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>BT</th>
                <th style={styles.th}>Unité</th>
                <th style={styles.th}>Début</th>
                <th style={styles.th}>Fin</th>
                <th style={styles.th}>Durée</th>
                <th style={{ ...styles.th, width: 140 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pointagesJour.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={6}>
                    <span style={styles.muted}>Aucun pointage aujourd’hui.</span>
                  </td>
                </tr>
              ) : (
                pointagesJour.map((p) => {
                  const btNumero = p.bons_travail?.numero || "(BT)";
                  const uniteTxt = p.bons_travail?.unite?.no_unite
                    ? `Unité ${p.bons_travail.unite.no_unite}`
                    : "—";

                  const duration = p.actif
                    ? fmtDurationMinutes(diffMinutes(p.started_at, null))
                    : fmtDurationMinutes(Number(p.duration_minutes || 0));

                  const menuOpen = rowMenuOpenId === p.id;

                  return (
                    <tr key={p.id}>
                      <td style={styles.td}>{btNumero}</td>
                      <td style={styles.td}>{uniteTxt}</td>
                      <td style={styles.td}>{fmtDateTime(p.started_at)}</td>
                      <td style={styles.td}>{fmtDateTime(p.ended_at)}</td>
                      <td style={styles.td}>{duration}</td>
                      <td style={styles.td}>
                        <div style={styles.actionsWrap} onClick={(e) => e.stopPropagation()}>
                          <button
                            style={styles.btn}
                            disabled={busy}
                            onClick={() =>
                              setRowMenuOpenId((current) => (current === p.id ? null : p.id))
                            }
                          >
                            ...
                          </button>

                          {menuOpen && (
                            <div style={styles.actionMenu}>
                              <button
                                style={styles.actionMenuBtn}
                                type="button"
                                onClick={() => {
                                  setRowMenuOpenId(null);
                                  nav(`/bt-mecano/${p.bt_id}`);
                                }}
                              >
                                Ouvrir
                              </button>

                              <button
                                style={styles.actionMenuBtn}
                                type="button"
                                onClick={() => openEditModal(p)}
                              >
                                Modifier
                              </button>

                              <button
                                style={{
                                  ...styles.actionMenuBtn,
                                  color: "#b91c1c",
                                }}
                                type="button"
                                disabled={p.actif}
                                onClick={() => {
                                  setRowMenuOpenId(null);
                                  supprimerPointage(p.id);
                                }}
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
        )}
      </div>

      <button type="button" style={styles.switchFab} onClick={openSwitchModal}>
        {employeConnecte?.nom_complet ? `Employé · ${employeConnecte.nom_complet}` : "Changer d’employé"}
      </button>

      {editPointage && (
        <div style={styles.overlay} onClick={closeEditModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>Modifier le temps du BT</div>

            <div style={styles.modalBody}>
              <div>
                <div style={styles.fieldLabel}>Heure de début</div>
                <input
                  type="datetime-local"
                  style={styles.dateInput}
                  value={editStartedAt}
                  onChange={(e) => setEditStartedAt(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>Heure de fin</div>
                <input
                  type="datetime-local"
                  style={styles.dateInput}
                  value={editEndedAt}
                  onChange={(e) => setEditEndedAt(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btn} onClick={closeEditModal} disabled={busy}>
                Annuler
              </button>
              <button style={styles.btnBlue} onClick={saveEditPointage} disabled={busy}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {switchModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div>Changer d’employé</div>
                <div style={styles.modalHeaderSub}>
                  Sélection rapide sans revenir à la page de login
                </div>
              </div>
            </div>

            <div style={styles.modalBody}>
              <div style={{ display: "none" }}>
                <input type="text" name="username" autoComplete="username" />
                <input type="password" name="password" autoComplete="current-password" />
              </div>

              <div style={styles.modalInfoCard}>
                Employé actif : {employeConnecte?.nom_complet || "Aucun"}
              </div>

              <div>
                <div style={styles.fieldLabel}>Employé</div>
                <select
                  style={styles.selectInput}
                  value={selectedEmployeId}
                  name="quick-switch-employe"
                  autoComplete="off"
                  onChange={(e) => setSelectedEmployeId(e.target.value)}
                  disabled={switchBusy}
                >
                  <option value="">Sélectionner un employé</option>
                  {employesActifs.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nom_complet}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={styles.fieldLabel}>Mot de passe</div>
                <input
                  type="password"
                  style={styles.textInput}
                  name="atelier-switch-code"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  placeholder="Entrer le mot de passe"
                  disabled={switchBusy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleQuickSwitch();
                    }
                  }}
                />
              </div>

              {selectedEmploye?.email ? (
                <div style={{ ...styles.muted, fontSize: 12 }}>
                  Compte utilisé : {selectedEmploye.email}
                </div>
              ) : null}

              {switchError && <div style={styles.modalError}>{switchError}</div>}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnDangerGhost}
                onClick={handleQuickLogout}
                disabled={switchBusy}
              >
                Déconnecter
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  style={styles.btnBlue}
                  onClick={handleQuickSwitch}
                  disabled={switchBusy}
                >
                  {switchBusy ? "Connexion..." : "Entrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}