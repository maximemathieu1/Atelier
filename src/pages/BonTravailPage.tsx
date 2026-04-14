import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { type Piece } from "../components/bt/BtPiecesCard";
import BonTravailHeaderCard from "../components/bt/BonTravailHeaderCard";
import BonTravailOperations from "../components/bt/BonTravailOperations";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  km_actuel: number | null;
  statut: string;
  niv?: string | null;
  plaque?: string | null;
  client_id?: string | null;
  type_unite_id?: string | null;
};

type Client = {
  id: string;
  nom: string;
};

type ClientConfig = {
  id: string;
  client_id: string;
  taux_horaire: number | null;
  marge_pieces: number | null;
  frais_atelier_pourcentage: number | null;
  actif?: boolean | null;
  note_facturation?: string | null;
};

type ClientTauxMO = {
  id: string;
  client_id: string;
  type_unite_id: string | null;
  taux_horaire: number;
  actif: boolean;
};

type BonTravail = {
  id: string;
  numero?: string | null;
  bon_commande?: string | null;
  unite_id: string;
  statut: string;
  verrouille?: boolean | null;
  note?: string | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  km?: number | null;
  client_id?: string | null;
  client_nom?: string | null;
  taux_horaire_snapshot?: number | null;
  marge_pieces_snapshot?: number | null;
  frais_atelier_pct_snapshot?: number | null;
  tps_rate_snapshot?: number | null;
  tvq_rate_snapshot?: number | null;
  total_pieces?: number | null;
  total_main_oeuvre?: number | null;
  total_frais_atelier?: number | null;
  total_general?: number | null;
  total_tps?: number | null;
  total_tvq?: number | null;
  total_final?: number | null;
};

type ParametresEntreprise = {
  tps_rate: number | null;
  tvq_rate: number | null;
};

type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
};

type TacheEffectuee = {
  id: string;
  bt_id: string;
  unite_id: string;
  unite_note_id: string | null;
  titre: string;
  details: string | null;
  date_effectuee: string;
};

type MainOeuvreRow = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  description: string | null;
  heures: number;
  taux_horaire: number;
  created_at?: string | null;
};

type BtPointage = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  actif: boolean;
  note: string | null;
  created_at?: string | null;
};

type PointageResume = {
  mecano_nom: string;
  minutes: number;
  heures: number;
};

function isOpenStatut(statut: string | null | undefined) {
  return statut === "ouvert" || statut === "a_faire" || statut === "en_cours";
}

function isClosedStatut(statut: string | null | undefined) {
  return statut === "ferme" || statut === "termine" || statut === "a_facturer";
}

function isFacturedStatut(statut: string | null | undefined) {
  return statut === "facture";
}

function round2(v: number) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function isoToDateTimeLocal(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localToIsoOrNull(v: string) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function minutesFromPointage(p: BtPointage) {
  if (p.duration_minutes != null) return Number(p.duration_minutes || 0);
  const a = new Date(p.started_at).getTime();
  const b = new Date(p.ended_at || new Date().toISOString()).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 60000);
}

export default function BonTravailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [bt, setBt] = useState<BonTravail | null>(null);
  const [unite, setUnite] = useState<Unite | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [clientCfg, setClientCfg] = useState<ClientConfig | null>(null);
  const [clientTauxRows, setClientTauxRows] = useState<ClientTauxMO[]>([]);
  const [paramEntreprise, setParamEntreprise] = useState<ParametresEntreprise | null>(null);

  const [notes, setNotes] = useState<NoteMeca[]>([]);
  const [tachesEffectuees, setTachesEffectuees] = useState<TacheEffectuee[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [mainOeuvre, setMainOeuvre] = useState<MainOeuvreRow[]>([]);
  const [pointages, setPointages] = useState<BtPointage[]>([]);
  const [pointagesTableAvailable, setPointagesTableAvailable] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [kmInput, setKmInput] = useState<string>("");
  const [poInput, setPoInput] = useState<string>("");
  const [dateOuvertureInput, setDateOuvertureInput] = useState<string>("");
  const [dateFermetureInput, setDateFermetureInput] = useState<string>("");

  const [piecesTableAvailable, setPiecesTableAvailable] = useState(true);
  const [mainOeuvreTableAvailable, setMainOeuvreTableAvailable] = useState(true);

  const [newMoMecano, setNewMoMecano] = useState("");
  const [newMoDesc, setNewMoDesc] = useState("");
  const [newMoHeures, setNewMoHeures] = useState("");
  const [newMoTaux, setNewMoTaux] = useState("");

  const [pointageMenuOpenId, setPointageMenuOpenId] = useState<string | null>(null);
  const [editingPointageId, setEditingPointageId] = useState<string | null>(null);
  const [editingPointageStart, setEditingPointageStart] = useState("");
  const [editingPointageEnd, setEditingPointageEnd] = useState("");

  const [mainOeuvreMenuOpenId, setMainOeuvreMenuOpenId] = useState<string | null>(null);
  const [editingMainOeuvreId, setEditingMainOeuvreId] = useState<string | null>(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalValue, setTaskModalValue] = useState("");

  const [tempsModalOpen, setTempsModalOpen] = useState(false);

  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHeaderRef = useRef<string>("");

  const [confirmTerminerOpen, setConfirmTerminerOpen] = useState(false);
  const [savingTerminer, setSavingTerminer] = useState(false);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const snapshotClientNom = useMemo(() => bt?.client_nom?.trim() || client?.nom || "—", [bt, client]);

  const dynamicTauxHoraire = useMemo(() => {
    if (!unite || !clientCfg) return Number(clientCfg?.taux_horaire || 0);
    const typeId = unite.type_unite_id ?? null;
    const specific = clientTauxRows.find((r) => r.actif && r.type_unite_id === typeId);
    if (specific) return Number(specific.taux_horaire || 0);
    return Number(clientCfg.taux_horaire || 0);
  }, [unite, clientCfg, clientTauxRows]);

  const liveTpsRate = Number(paramEntreprise?.tps_rate ?? 0.05);
  const liveTvqRate = Number(paramEntreprise?.tvq_rate ?? 0.09975);

  const isBtOpenPricing = useMemo(() => {
    if (!bt) return false;
    return isOpenStatut(bt.statut);
  }, [bt]);

  const effectiveMargePiecesPct = useMemo(() => {
    if (isBtOpenPricing) return Number(clientCfg?.marge_pieces || 0);
    if (bt?.marge_pieces_snapshot != null) return Number(bt.marge_pieces_snapshot || 0);
    return Number(clientCfg?.marge_pieces || 0);
  }, [isBtOpenPricing, bt, clientCfg]);

  const effectiveFraisAtelierPct = useMemo(() => {
    if (isBtOpenPricing) return Number(clientCfg?.frais_atelier_pourcentage || 0);
    if (bt?.frais_atelier_pct_snapshot != null) return Number(bt.frais_atelier_pct_snapshot || 0);
    return Number(clientCfg?.frais_atelier_pourcentage || 0);
  }, [isBtOpenPricing, bt, clientCfg]);

  const effectiveTauxHoraire = useMemo(() => {
    if (isBtOpenPricing) return dynamicTauxHoraire;
    if (bt?.taux_horaire_snapshot != null) return Number(bt.taux_horaire_snapshot || 0);
    return dynamicTauxHoraire;
  }, [isBtOpenPricing, bt, dynamicTauxHoraire]);

  const effectiveTpsRate = useMemo(() => {
    if (isBtOpenPricing) return liveTpsRate;
    if (bt?.tps_rate_snapshot != null) return Number(bt.tps_rate_snapshot || 0);
    return liveTpsRate;
  }, [isBtOpenPricing, bt, liveTpsRate]);

  const effectiveTvqRate = useMemo(() => {
    if (isBtOpenPricing) return liveTvqRate;
    if (bt?.tvq_rate_snapshot != null) return Number(bt.tvq_rate_snapshot || 0);
    return liveTvqRate;
  }, [isBtOpenPricing, bt, liveTvqRate]);

  const pointagesResume = useMemo<PointageResume[]>(() => {
    const map = new Map<string, number>();

    for (const p of pointages) {
      const nom = String(p.mecano_nom || "").trim() || "—";
      const mins = minutesFromPointage(p);
      map.set(nom, (map.get(nom) || 0) + mins);
    }

    return Array.from(map.entries())
      .map(([mecano_nom, minutes]) => ({
        mecano_nom,
        minutes,
        heures: minutes / 60,
      }))
      .sort((a, b) => a.mecano_nom.localeCompare(b.mecano_nom, "fr"));
  }, [pointages]);

  const totalPointagesMainOeuvre = useMemo(
    () => pointagesResume.reduce((sum, r) => sum + r.heures * effectiveTauxHoraire, 0),
    [pointagesResume, effectiveTauxHoraire]
  );

  function getPieceFactureU(p: Piece) {
    if (isBtOpenPricing) {
      const coutU = Number((p as any).prix_unitaire || 0);
      return coutU * (1 + effectiveMargePiecesPct / 100);
    }

    if ((p as any).prix_facture_unitaire_snapshot != null) {
      return Number((p as any).prix_facture_unitaire_snapshot || 0);
    }

    const coutU = Number((p as any).prix_unitaire || 0);
    const margePct =
      (p as any).marge_pct_snapshot != null
        ? Number((p as any).marge_pct_snapshot || 0)
        : effectiveMargePiecesPct;

    return coutU * (1 + margePct / 100);
  }

  function getPieceTotalFacture(p: Piece) {
    if (isBtOpenPricing) {
      return Number((p as any).quantite || 0) * getPieceFactureU(p);
    }

    if ((p as any).total_facture_snapshot != null) {
      return Number((p as any).total_facture_snapshot || 0);
    }

    return Number((p as any).quantite || 0) * getPieceFactureU(p);
  }

  const totalPiecesCout = useMemo(
    () =>
      pieces.reduce((sum, p) => {
        const q = Number((p as any).quantite || 0);
        const pu = Number((p as any).prix_unitaire || 0);
        return sum + q * pu;
      }, 0),
    [pieces]
  );

  const totalPiecesFacture = useMemo(
    () => pieces.reduce((sum, p) => sum + getPieceTotalFacture(p), 0),
    [pieces, effectiveMargePiecesPct, isBtOpenPricing]
  );

  const totalMainOeuvreManuelle = useMemo(
    () =>
      mainOeuvre.reduce((sum, row) => {
        const h = Number(row.heures || 0);
        const t = isBtOpenPricing ? effectiveTauxHoraire : Number(row.taux_horaire || 0);
        return sum + h * t;
      }, 0),
    [mainOeuvre, isBtOpenPricing, effectiveTauxHoraire]
  );

  const totalMainOeuvre = useMemo(
    () => totalPointagesMainOeuvre + totalMainOeuvreManuelle,
    [totalPointagesMainOeuvre, totalMainOeuvreManuelle]
  );

  const totalFraisAtelier = useMemo(
    () => totalMainOeuvre * (effectiveFraisAtelierPct / 100),
    [totalMainOeuvre, effectiveFraisAtelierPct]
  );

  const totalGeneral = useMemo(
    () => totalPiecesFacture + totalMainOeuvre + totalFraisAtelier,
    [totalPiecesFacture, totalMainOeuvre, totalFraisAtelier]
  );

  const totalTPS = useMemo(() => round2(totalGeneral * effectiveTpsRate), [totalGeneral, effectiveTpsRate]);

  const totalTVQ = useMemo(() => round2(totalGeneral * effectiveTvqRate), [totalGeneral, effectiveTvqRate]);

  const totalFinal = useMemo(() => round2(totalGeneral + totalTPS + totalTVQ), [totalGeneral, totalTPS, totalTVQ]);

  const hasKmColumn = useMemo(() => {
    if (!bt) return false;
    return Object.prototype.hasOwnProperty.call(bt as any, "km");
  }, [bt]);

  const isClosed = useMemo(() => {
    if (!bt) return false;
    return isClosedStatut(bt.statut) || Boolean(bt.date_fermeture);
  }, [bt]);

  const isReadOnly = useMemo(() => {
    if (!bt) return false;
    return Boolean(bt.verrouille) || isFacturedStatut(bt.statut) || isClosed;
  }, [bt, isClosed]);

  const currentHeaderSignature = useMemo(() => {
    const rawKm = kmInput.trim();
    const km = rawKm ? Number(rawKm) : null;

    return JSON.stringify({
      km: rawKm && km !== null && Number.isFinite(km) ? km : null,
      bon_commande: poInput.trim() || null,
      date_ouverture: localToIsoOrNull(dateOuvertureInput),
      date_fermeture: localToIsoOrNull(dateFermetureInput),
    });
  }, [kmInput, poInput, dateOuvertureInput, dateFermetureInput]);

  useEffect(() => {
    if (effectiveTauxHoraire > 0 && !newMoTaux.trim()) {
      setNewMoTaux(String(effectiveTauxHoraire));
    }
  }, [effectiveTauxHoraire, newMoTaux]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const inPointageMenu = target.closest('[data-menu-root="pointage"]');
      const inMainOeuvreMenu = target.closest('[data-menu-root="mainoeuvre"]');

      if (!inPointageMenu) setPointageMenuOpenId(null);
      if (!inMainOeuvreMenu) setMainOeuvreMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, []);

  async function loadPieces(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_pieces")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPieces((data || []) as Piece[]);
      setPiecesTableAvailable(true);
    } catch {
      setPieces([]);
      setPiecesTableAvailable(false);
    }
  }

  async function loadMainOeuvre(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_main_oeuvre")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMainOeuvre((data || []) as MainOeuvreRow[]);
      setMainOeuvreTableAvailable(true);
    } catch {
      setMainOeuvre([]);
      setMainOeuvreTableAvailable(false);
    }
  }

  async function loadPointages(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_pointages")
        .select("*")
        .eq("bt_id", btId)
        .order("started_at", { ascending: true });

      if (error) throw error;
      setPointages((data || []) as BtPointage[]);
      setPointagesTableAvailable(true);
    } catch {
      setPointages([]);
      setPointagesTableAvailable(false);
    }
  }

  async function recalcAndPersistTotals(btId: string) {
    const { data: btRaw, error: eBt } = await supabase
      .from("bons_travail")
      .select("*")
      .eq("id", btId)
      .single();

    if (eBt) throw eBt;

    const btRow = btRaw as BonTravail;

    const { data: uRaw, error: eU } = await supabase
      .from("unites")
      .select("*")
      .eq("id", btRow.unite_id)
      .single();

    if (eU) throw eU;

    const unitRow = uRaw as Unite;

    let liveCfg: ClientConfig | null = null;
    let liveTaux: ClientTauxMO[] = [];
    let liveParams: ParametresEntreprise | null = null;

    if (unitRow.client_id) {
      const [cfgRes, tauxRes, paramsRes] = await Promise.all([
        supabase
          .from("client_configuration")
          .select("id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage,actif,note_facturation")
          .eq("client_id", unitRow.client_id)
          .maybeSingle(),
        supabase
          .from("client_taux_main_oeuvre")
          .select("id,client_id,type_unite_id,taux_horaire,actif")
          .eq("client_id", unitRow.client_id),
        supabase
          .from("parametres_entreprise")
          .select("tps_rate,tvq_rate")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cfgRes.data) liveCfg = cfgRes.data as ClientConfig;
      if (tauxRes.data) liveTaux = (tauxRes.data || []) as ClientTauxMO[];
      if (paramsRes.data) liveParams = paramsRes.data as ParametresEntreprise;
    } else {
      const { data: paramsData } = await supabase
        .from("parametres_entreprise")
        .select("tps_rate,tvq_rate")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paramsData) liveParams = paramsData as ParametresEntreprise;
    }

    const typeId = unitRow.type_unite_id ?? null;
    const specificRate = liveTaux.find((r) => r.actif && r.type_unite_id === typeId);

    const dynamicRate = specificRate
      ? Number(specificRate.taux_horaire || 0)
      : Number(liveCfg?.taux_horaire || 0);

    const liveTps = Number(liveParams?.tps_rate ?? 0.05);
    const liveTvq = Number(liveParams?.tvq_rate ?? 0.09975);

    const btIsOpenPricing = isOpenStatut(btRow.statut);

    const recalcMargePiecesPct = btIsOpenPricing
      ? Number(liveCfg?.marge_pieces || 0)
      : Number(btRow.marge_pieces_snapshot ?? liveCfg?.marge_pieces ?? 0);

    const recalcFraisAtelierPct = btIsOpenPricing
      ? Number(liveCfg?.frais_atelier_pourcentage || 0)
      : Number(btRow.frais_atelier_pct_snapshot ?? liveCfg?.frais_atelier_pourcentage ?? 0);

    const recalcTauxHoraire = btIsOpenPricing
      ? Number(dynamicRate || 0)
      : Number(btRow.taux_horaire_snapshot ?? dynamicRate ?? 0);

    const recalcTpsRate = btIsOpenPricing ? liveTps : Number(btRow.tps_rate_snapshot ?? liveTps ?? 0);

    const recalcTvqRate = btIsOpenPricing ? liveTvq : Number(btRow.tvq_rate_snapshot ?? liveTvq ?? 0);

    const [{ data: piecesRaw, error: ePieces }, { data: moRaw, error: eMo }, { data: pointagesRaw, error: ePointages }] =
      await Promise.all([
        supabase.from("bt_pieces").select("*").eq("bt_id", btId),
        supabase.from("bt_main_oeuvre").select("*").eq("bt_id", btId),
        supabase.from("bt_pointages").select("*").eq("bt_id", btId),
      ]);

    if (ePieces) throw ePieces;
    if (eMo) throw eMo;
    if (ePointages) throw ePointages;

    const piecesRows = (piecesRaw || []) as Piece[];
    const moRows = (moRaw || []) as MainOeuvreRow[];
    const pointagesRows = (pointagesRaw || []) as BtPointage[];

    const recalcTotalPieces = piecesRows.reduce((sum, p) => {
      const q = Number((p as any).quantite || 0);

      if (btIsOpenPricing) {
        const coutU = Number((p as any).prix_unitaire || 0);
        const prixFactureU = coutU * (1 + recalcMargePiecesPct / 100);
        return sum + q * prixFactureU;
      }

      if ((p as any).total_facture_snapshot != null) {
        return sum + Number((p as any).total_facture_snapshot || 0);
      }

      const coutU = Number((p as any).prix_unitaire || 0);
      const margePct =
        (p as any).marge_pct_snapshot != null
          ? Number((p as any).marge_pct_snapshot || 0)
          : recalcMargePiecesPct;

      return sum + q * (coutU * (1 + margePct / 100));
    }, 0);

    const minutesByMecano = new Map<string, number>();
    for (const p of pointagesRows) {
      const nom = String(p.mecano_nom || "").trim() || "—";
      let mins = 0;

      if (p.duration_minutes != null) {
        mins = Number(p.duration_minutes || 0);
      } else {
        const a = new Date(p.started_at).getTime();
        const b = new Date(p.ended_at || new Date().toISOString()).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
          mins = Math.round((b - a) / 60000);
        }
      }

      minutesByMecano.set(nom, (minutesByMecano.get(nom) || 0) + mins);
    }

    const recalcTotalPointagesMainOeuvre = Array.from(minutesByMecano.values()).reduce(
      (sum, minutes) => sum + (minutes / 60) * recalcTauxHoraire,
      0
    );

    const recalcTotalMainOeuvreManuelle = moRows.reduce((sum, row) => {
      const h = Number(row.heures || 0);
      const t = btIsOpenPricing ? recalcTauxHoraire : Number(row.taux_horaire || 0);
      return sum + h * t;
    }, 0);

    const recalcTotalMainOeuvre = recalcTotalPointagesMainOeuvre + recalcTotalMainOeuvreManuelle;
    const recalcTotalFraisAtelier = recalcTotalMainOeuvre * (recalcFraisAtelierPct / 100);
    const recalcTotalGeneral = recalcTotalPieces + recalcTotalMainOeuvre + recalcTotalFraisAtelier;
    const recalcTotalTps = round2(recalcTotalGeneral * recalcTpsRate);
    const recalcTotalTvq = round2(recalcTotalGeneral * recalcTvqRate);
    const recalcTotalFinal = round2(recalcTotalGeneral + recalcTotalTps + recalcTotalTvq);

    const payload = {
      taux_horaire_snapshot: Number(recalcTauxHoraire.toFixed(2)),
      marge_pieces_snapshot: Number(recalcMargePiecesPct.toFixed(2)),
      frais_atelier_pct_snapshot: Number(recalcFraisAtelierPct.toFixed(2)),
      tps_rate_snapshot: Number(recalcTpsRate.toFixed(5)),
      tvq_rate_snapshot: Number(recalcTvqRate.toFixed(5)),
      total_pieces: Number(recalcTotalPieces.toFixed(2)),
      total_main_oeuvre: Number(recalcTotalMainOeuvre.toFixed(2)),
      total_frais_atelier: Number(recalcTotalFraisAtelier.toFixed(2)),
      total_general: Number(recalcTotalGeneral.toFixed(2)),
      total_tps: Number(recalcTotalTps.toFixed(2)),
      total_tvq: Number(recalcTotalTvq.toFixed(2)),
      total_final: Number(recalcTotalFinal.toFixed(2)),
    };

    const { error: eUpdate } = await supabase.from("bons_travail").update(payload).eq("id", btId);
    if (eUpdate) throw eUpdate;

    return payload;
  }

  async function reloadPiecesAndRecalc(btId: string) {
    await loadPieces(btId);
    const totals = await recalcAndPersistTotals(btId);
    setBt((prev) => (prev ? { ...prev, ...totals } : prev));
  }

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setErr(null);

    try {
      const { data: btData, error: eBt } = await supabase
        .from("bons_travail")
        .select("*")
        .eq("id", id)
        .single();

      if (eBt) throw eBt;

      const btRow = btData as BonTravail;

      const kmVal = (btRow as any).km ?? (btRow as any).kilometrage ?? null;
      const nextKmInput = kmVal === null || kmVal === undefined ? "" : String(kmVal);
      const nextPoInput = String(btRow.bon_commande ?? "");
      const nextDateOuvertureInput = isoToDateTimeLocal(btRow.date_ouverture);
      const nextDateFermetureInput = isoToDateTimeLocal(btRow.date_fermeture);

      setKmInput(nextKmInput);
      setPoInput(nextPoInput);
      setDateOuvertureInput(nextDateOuvertureInput);
      setDateFermetureInput(nextDateFermetureInput);

      const headerSignature = JSON.stringify({
        km: kmVal == null ? null : Number(kmVal),
        bon_commande: btRow.bon_commande?.trim() || null,
        date_ouverture: btRow.date_ouverture ?? null,
        date_fermeture: btRow.date_fermeture ?? null,
      });
      lastSavedHeaderRef.current = headerSignature;

      const { data: uData, error: eU } = await supabase
        .from("unites")
        .select("*")
        .eq("id", btRow.unite_id)
        .single();

      if (eU) throw eU;
      const unitRow = uData as Unite;
      setUnite(unitRow);

      let liveClient: Client | null = null;
      let liveCfg: ClientConfig | null = null;
      let liveTaux: ClientTauxMO[] = [];
      let liveParams: ParametresEntreprise | null = null;

      const paramsRes = await supabase
        .from("parametres_entreprise")
        .select("tps_rate,tvq_rate")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paramsRes.data) {
        liveParams = paramsRes.data as ParametresEntreprise;
      }

      if (unitRow.client_id) {
        const [clientRes, cfgRes, tauxRes] = await Promise.all([
          supabase.from("clients").select("id,nom").eq("id", unitRow.client_id).maybeSingle(),
          supabase
            .from("client_configuration")
            .select("id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage,actif,note_facturation")
            .eq("client_id", unitRow.client_id)
            .maybeSingle(),
          supabase
            .from("client_taux_main_oeuvre")
            .select("id,client_id,type_unite_id,taux_horaire,actif")
            .eq("client_id", unitRow.client_id),
        ]);

        if (!clientRes.error && clientRes.data) liveClient = clientRes.data as Client;
        if (!cfgRes.error && cfgRes.data) liveCfg = cfgRes.data as ClientConfig;
        if (!tauxRes.error && tauxRes.data) liveTaux = (tauxRes.data || []) as ClientTauxMO[];
      }

      setClient(liveClient);
      setClientCfg(liveCfg);
      setClientTauxRows(liveTaux);
      setParamEntreprise(liveParams);

      const resolvedDynamicRate = (() => {
        if (!unitRow || !liveCfg) return Number(liveCfg?.taux_horaire || 0);
        const typeId = unitRow.type_unite_id ?? null;
        const specific = liveTaux.find((r) => r.actif && r.type_unite_id === typeId);
        if (specific) return Number(specific.taux_horaire || 0);
        return Number(liveCfg.taux_horaire || 0);
      })();

      const resolvedTpsRate = Number(liveParams?.tps_rate ?? 0.05);
      const resolvedTvqRate = Number(liveParams?.tvq_rate ?? 0.09975);

      let nextBtRow = btRow;
      const needsBtSnapshotUpdate =
        btRow.client_id == null ||
        !btRow.client_nom ||
        btRow.taux_horaire_snapshot == null ||
        btRow.marge_pieces_snapshot == null ||
        btRow.frais_atelier_pct_snapshot == null ||
        btRow.tps_rate_snapshot == null ||
        btRow.tvq_rate_snapshot == null;

      if (needsBtSnapshotUpdate) {
        const btPayload = {
          client_id: btRow.client_id ?? unitRow.client_id ?? null,
          client_nom: btRow.client_nom?.trim() || liveClient?.nom || null,
          taux_horaire_snapshot:
            btRow.taux_horaire_snapshot ?? (Number.isFinite(resolvedDynamicRate) ? resolvedDynamicRate : null),
          marge_pieces_snapshot: btRow.marge_pieces_snapshot ?? liveCfg?.marge_pieces ?? null,
          frais_atelier_pct_snapshot:
            btRow.frais_atelier_pct_snapshot ?? liveCfg?.frais_atelier_pourcentage ?? null,
          tps_rate_snapshot: btRow.tps_rate_snapshot ?? (Number.isFinite(resolvedTpsRate) ? resolvedTpsRate : null),
          tvq_rate_snapshot: btRow.tvq_rate_snapshot ?? (Number.isFinite(resolvedTvqRate) ? resolvedTvqRate : null),
        };

        const { error: snapErr } = await supabase.from("bons_travail").update(btPayload).eq("id", btRow.id);
        if (snapErr) throw snapErr;

        nextBtRow = {
          ...btRow,
          ...btPayload,
        };
      }

      const { data: nData, error: eN } = await supabase
        .from("unite_notes")
        .select("id,unite_id,titre,details,created_at")
        .eq("unite_id", btRow.unite_id)
        .order("created_at", { ascending: false });

      if (eN) throw eN;
      setNotes((nData || []) as NoteMeca[]);
      setSelected({});

      const { data: teData, error: eTe } = await supabase
        .from("bt_taches_effectuees")
        .select("*")
        .eq("bt_id", btRow.id)
        .order("date_effectuee", { ascending: false });

      if (eTe) throw eTe;
      setTachesEffectuees((teData || []) as TacheEffectuee[]);

      await Promise.all([loadPieces(id), loadMainOeuvre(id), loadPointages(id)]);

      const persistedTotals = await recalcAndPersistTotals(btRow.id);

      setBt({
        ...nextBtRow,
        ...persistedTotals,
      } as BonTravail);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveBTHeaderSilently() {
    if (!bt || !hasKmColumn || loading || isReadOnly) return false;

    const rawKm = kmInput.trim();
    const km = rawKm ? Number(rawKm) : null;
    if (rawKm && (km === null || Number.isNaN(km) || km < 0)) return false;

    const bon_commande = poInput.trim() || null;
    const date_ouverture = localToIsoOrNull(dateOuvertureInput);
    const date_fermeture = localToIsoOrNull(dateFermetureInput);

    setIsAutoSaving(true);

    try {
      const { error } = await supabase
        .from("bons_travail")
        .update({ km, bon_commande, date_ouverture, date_fermeture })
        .eq("id", bt.id);

      if (error) throw error;

      const savedSignature = JSON.stringify({
        km,
        bon_commande,
        date_ouverture,
        date_fermeture,
      });

      lastSavedHeaderRef.current = savedSignature;
      setBt((prev) => (prev ? { ...prev, km, bon_commande, date_ouverture, date_fermeture } : prev));
      setErr(null);
      return true;
    } catch (e: any) {
      setErr(e?.message ?? "Erreur autosave");
      return false;
    } finally {
      setIsAutoSaving(false);
    }
  }

  useEffect(() => {
    if (!bt || loading || !hasKmColumn || isReadOnly) return;
    if (currentHeaderSignature === lastSavedHeaderRef.current) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      void saveBTHeaderSilently();
    }, 700);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [bt, loading, hasKmColumn, isReadOnly, currentHeaderSignature]);

  async function addTask() {
    if (!bt) return;

    const titre = taskModalValue.trim().toUpperCase();
    if (!titre) return;

    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    const { error } = await supabase.from("unite_notes").insert({
      unite_id: bt.unite_id,
      titre,
      details: null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTaskModalValue("");
    setTaskModalOpen(false);
    await loadAll();
  }

  async function completeSelectedTasks() {
    if (!bt || !selectedIds.length) return;
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    const selectedTasks = notes.filter((n) => selectedIds.includes(n.id));
    if (!selectedTasks.length) return;
    if (!confirm(`Marquer ${selectedTasks.length} tâche(s) comme effectuée(s) ?`)) return;

    const insertRows = selectedTasks.map((t) => ({
      bt_id: bt.id,
      unite_id: bt.unite_id,
      unite_note_id: t.id,
      titre: t.titre,
      details: t.details,
      date_effectuee: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase.from("bt_taches_effectuees").insert(insertRows);
    if (insertErr) {
      alert(insertErr.message);
      return;
    }

    const { error: deleteErr } = await supabase.from("unite_notes").delete().in("id", selectedIds);
    if (deleteErr) {
      alert(deleteErr.message);
      return;
    }

    await loadAll();
  }

  async function deleteSelectedTasks() {
    if (!selectedIds.length) return;
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!confirm(`Supprimer ${selectedIds.length} tâche(s) ?`)) return;

    const { error } = await supabase.from("unite_notes").delete().in("id", selectedIds);
    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
  }

  async function remettreTacheOuverte(t: TacheEffectuee) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    const { error: insErr } = await supabase.from("unite_notes").insert({
      unite_id: t.unite_id,
      titre: t.titre,
      details: t.details,
    });

    if (insErr) {
      alert(insErr.message);
      return;
    }

    const { error: delErr } = await supabase.from("bt_taches_effectuees").delete().eq("id", t.id);
    if (delErr) {
      alert(delErr.message);
      return;
    }

    await loadAll();
  }

  async function handleTerminerBt(mode: "facturer" | "fermer") {
    if (!bt || !unite) return;

    if (Boolean(bt.verrouille) || isFacturedStatut(bt.statut)) {
      alert("BT verrouillé / facturé : impossible de modifier.");
      return;
    }

    if (!hasKmColumn) {
      alert("La colonne 'km' n'existe pas dans la DB. Ajoute-la via la migration SQL.");
      return;
    }

    const rawKm = kmInput.trim();
    const km = rawKm ? Number(rawKm) : null;

    if (rawKm && (km === null || Number.isNaN(km) || km < 0)) {
      alert("KM invalide");
      return;
    }

    const bon_commande = poInput.trim() || null;
    const date_ouverture = localToIsoOrNull(dateOuvertureInput);
    const date_fermeture = localToIsoOrNull(dateFermetureInput) ?? new Date().toISOString();
    const nouveauStatut = mode === "facturer" ? "a_facturer" : "ferme";

    setSavingTerminer(true);

    try {
      const { error: eBt } = await supabase
        .from("bons_travail")
        .update({
          km,
          bon_commande,
          statut: nouveauStatut,
          date_ouverture,
          date_fermeture,
        })
        .eq("id", bt.id);

      if (eBt) throw eBt;

      if (km !== null) {
        const nextKm = Math.max(unite.km_actuel ?? 0, km);
        const { error: eU } = await supabase.from("unites").update({ km_actuel: nextKm }).eq("id", unite.id);

        if (eU) {
          alert(`BT fermé, mais mise à jour km unité a échoué: ${eU.message}`);
          return;
        }
      }

      const totals = await recalcAndPersistTotals(bt.id);

      setBt((prev) =>
        prev
          ? {
              ...prev,
              statut: nouveauStatut,
              km,
              bon_commande,
              date_ouverture,
              date_fermeture,
              ...totals,
            }
          : prev
      );

      setConfirmTerminerOpen(false);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Erreur fermeture BT");
    } finally {
      setSavingTerminer(false);
    }
  }

  async function reopenBT() {
    if (!bt) return;
    if (Boolean(bt.verrouille) || isFacturedStatut(bt.statut)) {
      alert("BT verrouillé / facturé : impossible de modifier.");
      return;
    }

    const { error } = await supabase
      .from("bons_travail")
      .update({ statut: "ouvert", date_fermeture: null })
      .eq("id", bt.id);

    if (error) {
      alert(error.message);
      return;
    }

    setDateFermetureInput("");
    const totals = await recalcAndPersistTotals(bt.id);
    setBt((prev) => (prev ? { ...prev, statut: "ouvert", date_fermeture: null, ...totals } : prev));
    await loadAll();
  }

  function closeTempsModal() {
    setTempsModalOpen(false);
    setNewMoMecano("");
    setNewMoDesc("");
    setNewMoHeures("");
    setNewMoTaux(String(effectiveTauxHoraire || 0));
  }

  async function addMainOeuvre() {
    if (!id) return;
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!mainOeuvreTableAvailable) {
      alert("La table bt_main_oeuvre n'existe pas encore dans la DB.");
      return;
    }

    const mecano_nom = newMoMecano.trim();
    const description = newMoDesc.trim() || null;
    const heures = Number(newMoHeures || 0);
    const taux_horaire = Number(newMoTaux || 0);

    if (!mecano_nom) {
      alert("Nom du mécano requis.");
      return;
    }
    if (!Number.isFinite(heures) || heures < 0) {
      alert("Heures invalides.");
      return;
    }
    if (!Number.isFinite(taux_horaire) || taux_horaire < 0) {
      alert("Taux horaire invalide.");
      return;
    }

    const { error } = await supabase.from("bt_main_oeuvre").insert({
      bt_id: id,
      mecano_nom,
      description,
      heures,
      taux_horaire,
    });

    if (error) {
      alert(error.message);
      return;
    }

    closeTempsModal();
    await loadMainOeuvre(id);
    const totals = await recalcAndPersistTotals(id);
    setBt((prev) => (prev ? { ...prev, ...totals } : prev));
  }

  async function saveMainOeuvreRow(row: MainOeuvreRow) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!mainOeuvreTableAvailable) return;

    const mecano_nom = String(row.mecano_nom || "").trim();
    const heures = Number(row.heures || 0);
    const taux_horaire = Number(row.taux_horaire || 0);

    if (!mecano_nom) {
      alert("Nom du mécano requis.");
      return;
    }
    if (!Number.isFinite(heures) || heures < 0) {
      alert("Heures invalides.");
      return;
    }
    if (!Number.isFinite(taux_horaire) || taux_horaire < 0) {
      alert("Taux horaire invalide.");
      return;
    }

    const { error } = await supabase
      .from("bt_main_oeuvre")
      .update({
        mecano_nom,
        description: row.description?.trim() || null,
        heures,
        taux_horaire,
      })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (id) {
      await loadMainOeuvre(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
    setMainOeuvreMenuOpenId(null);
    setEditingMainOeuvreId(null);
  }

  async function deleteMainOeuvreRow(rowId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!mainOeuvreTableAvailable) return;
    if (!confirm("Supprimer cette ligne de main-d’œuvre ?")) return;

    const { error } = await supabase.from("bt_main_oeuvre").delete().eq("id", rowId);
    if (error) {
      alert(error.message);
      return;
    }

    setMainOeuvreMenuOpenId(null);
    if (id) {
      await loadMainOeuvre(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
  }

  async function deletePointage(pointageId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!pointagesTableAvailable) return;
    if (!confirm("Supprimer ce pointage ?")) return;

    const { error } = await supabase.from("bt_pointages").delete().eq("id", pointageId);

    if (error) {
      alert(error.message);
      return;
    }

    setPointageMenuOpenId(null);
    if (id) {
      await loadPointages(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
  }

  function openEditPointage(p: BtPointage) {
    setPointageMenuOpenId(null);
    setEditingPointageId(p.id);
    setEditingPointageStart(isoToDateTimeLocal(p.started_at));
    setEditingPointageEnd(isoToDateTimeLocal(p.ended_at));
  }

  async function savePointageRow(pointageId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!pointagesTableAvailable) return;

    const started_at = localToIsoOrNull(editingPointageStart);
    const ended_at = localToIsoOrNull(editingPointageEnd);

    if (!started_at || !ended_at) {
      alert("Début et fin requis.");
      return;
    }

    const startMs = new Date(started_at).getTime();
    const endMs = new Date(ended_at).getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      alert("La fin doit être après le début.");
      return;
    }

    const duration_minutes = Math.round((endMs - startMs) / 60000);

    const { error } = await supabase
      .from("bt_pointages")
      .update({
        started_at,
        ended_at,
        duration_minutes,
      })
      .eq("id", pointageId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingPointageId(null);
    setEditingPointageStart("");
    setEditingPointageEnd("");
    setPointageMenuOpenId(null);

    if (id) {
      await loadPointages(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
  }

  function openEditMainOeuvre(rowId: string) {
    setMainOeuvreMenuOpenId(null);
    setEditingMainOeuvreId(rowId);
  }

  function updateMainOeuvreLocal(rowId: string, patch: Partial<MainOeuvreRow>) {
    setMainOeuvre((rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function handlePrint() {
    window.open(`/bt/${id}/imprimer`, "_blank", "noopener,noreferrer");
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      maxWidth: 1180,
      margin: "24px auto",
      padding: "0 14px",
      position: "relative",
      zIndex: 1,
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
    h1: { margin: 0, fontSize: 22, fontWeight: 900 },
    muted: { color: "rgba(0,0,0,.6)" },
    btn: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnDanger: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #dc2626",
      background: "#dc2626",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 9999,
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
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 900,
      margin: 0,
    },
    modalBody: {
      padding: 16,
    },
    modalFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      padding: 16,
      borderTop: "1px solid rgba(0,0,0,.08)",
    },
    iconCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
    },
  };

  if (!id) return <div style={styles.page}>BT introuvable</div>;

  return (
    <div style={styles.page}>
      <style>
        {`
          @media print {
            @page {
              size: auto;
              margin: 12mm;
            }

            body {
              background: #fff !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div
        className="no-print"
        style={{ ...styles.row, justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div style={styles.row}>
          <div>
            <div style={styles.h1}>Bon de travail</div>
            <div style={styles.muted}>
              Gestion BT
              {isAutoSaving ? " • Enregistrement..." : " • Sauvegarde auto"}
            </div>
          </div>
        </div>

        <div style={styles.row}>
          <button style={styles.btn} onClick={() => nav(-1)}>
            Retour
          </button>

          {!isClosed ? (
            <>
              <button style={styles.btn} onClick={handlePrint} disabled={loading}>
                Imprimer
              </button>
              <button
                style={styles.btnPrimary}
                onClick={() => setConfirmTerminerOpen(true)}
                disabled={loading || Boolean(bt?.verrouille) || isFacturedStatut(bt?.statut) || !hasKmColumn}
              >
                Fermer bon de travail
              </button>
            </>
          ) : (
            <>
              <button style={styles.btn} onClick={handlePrint} disabled={loading}>
                Imprimer
              </button>
              <button
                style={styles.btnPrimary}
                onClick={reopenBT}
                disabled={loading || Boolean(bt?.verrouille) || isFacturedStatut(bt?.statut)}
              >
                Réouvrir BT
              </button>
            </>
          )}
        </div>
      </div>

      {err && (
        <div style={{ ...styles.card, borderColor: "rgba(220,38,38,.35)" }}>
          <b>Erreur:</b> {err}
        </div>
      )}

      {loading || !bt || !unite ? (
        <div style={styles.card}>Chargement…</div>
      ) : (
        <>
          <BonTravailHeaderCard
            bt={bt}
            unite={unite}
            snapshotClientNom={snapshotClientNom}
            dateOuvertureInput={dateOuvertureInput}
            setDateOuvertureInput={setDateOuvertureInput}
            dateFermetureInput={dateFermetureInput}
            setDateFermetureInput={setDateFermetureInput}
            kmInput={kmInput}
            setKmInput={setKmInput}
            poInput={poInput}
            setPoInput={setPoInput}
            isReadOnly={isReadOnly}
            hasKmColumn={hasKmColumn}
            clientNoteFacturation={clientCfg?.note_facturation}
          />

          <BonTravailOperations
            btId={id}
            notes={notes}
            selected={selected}
            setSelected={setSelected}
            selectedIds={selectedIds}
            tachesEffectuees={tachesEffectuees}
            isReadOnly={isReadOnly}
            onOpenTaskModal={() => {
              setTaskModalValue("");
              setTaskModalOpen(true);
            }}
            onCompleteSelectedTasks={completeSelectedTasks}
            onDeleteSelectedTasks={deleteSelectedTasks}
            onRemettreTacheOuverte={remettreTacheOuverte}
            pieces={pieces}
            setPieces={setPieces}
            piecesTableAvailable={piecesTableAvailable}
            isBtOpenPricing={isBtOpenPricing}
            effectiveMargePiecesPct={effectiveMargePiecesPct}
            onReloadPiecesAndRecalc={reloadPiecesAndRecalc}
            pointagesTableAvailable={pointagesTableAvailable}
            pointagesResume={pointagesResume}
            pointages={pointages}
            effectiveTauxHoraire={effectiveTauxHoraire}
            pointageMenuOpenId={pointageMenuOpenId}
            setPointageMenuOpenId={setPointageMenuOpenId}
            editingPointageId={editingPointageId}
            setEditingPointageId={setEditingPointageId}
            editingPointageStart={editingPointageStart}
            setEditingPointageStart={setEditingPointageStart}
            editingPointageEnd={editingPointageEnd}
            setEditingPointageEnd={setEditingPointageEnd}
            onOpenEditPointage={openEditPointage}
            onSavePointageRow={savePointageRow}
            onDeletePointage={deletePointage}
            mainOeuvreTableAvailable={mainOeuvreTableAvailable}
            mainOeuvre={mainOeuvre}
            mainOeuvreMenuOpenId={mainOeuvreMenuOpenId}
            setMainOeuvreMenuOpenId={setMainOeuvreMenuOpenId}
            editingMainOeuvreId={editingMainOeuvreId}
            onOpenEditMainOeuvre={openEditMainOeuvre}
            onSaveMainOeuvreRow={saveMainOeuvreRow}
            onDeleteMainOeuvreRow={deleteMainOeuvreRow}
            updateMainOeuvreLocal={updateMainOeuvreLocal}
            onOpenTempsModal={() => {
              setNewMoMecano("");
              setNewMoDesc("");
              setNewMoHeures("");
              setNewMoTaux(String(effectiveTauxHoraire || 0));
              setTempsModalOpen(true);
            }}
            totalPiecesCout={totalPiecesCout}
            totalPiecesFacture={totalPiecesFacture}
            totalPointagesMainOeuvre={totalPointagesMainOeuvre}
            totalMainOeuvreManuelle={totalMainOeuvreManuelle}
            totalMainOeuvre={totalMainOeuvre}
            totalFraisAtelier={totalFraisAtelier}
            totalGeneral={totalGeneral}
            totalTPS={totalTPS}
            totalTVQ={totalTVQ}
            totalFinal={totalFinal}
            effectiveFraisAtelierPct={effectiveFraisAtelierPct}
            effectiveTpsRate={effectiveTpsRate}
            effectiveTvqRate={effectiveTvqRate}
          />
        </>
      )}

      {taskModalOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            setTaskModalOpen(false);
            setTaskModalValue("");
          }}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Nouvelle tâche</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={() => {
                  setTaskModalOpen(false);
                  setTaskModalValue("");
                }}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <input
                style={{ ...styles.input, width: "100%", minWidth: 0 }}
                placeholder="Entrer la tâche"
                value={taskModalValue}
                onChange={(e) => setTaskModalValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTask();
                }}
                autoFocus
              />
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnDanger}
                onClick={() => {
                  setTaskModalOpen(false);
                  setTaskModalValue("");
                }}
              >
                Annuler
              </button>
              <button type="button" style={styles.btnPrimary} onClick={addTask}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {tempsModalOpen && (
        <div style={styles.modalBackdrop} onClick={closeTempsModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter du temps</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeTempsModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ ...styles.row, alignItems: "flex-start" }}>
                <input
                  style={{ ...styles.input, minWidth: 220 }}
                  placeholder="Mécano"
                  value={newMoMecano}
                  onChange={(e) => setNewMoMecano(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />

                <input
                  style={{ ...styles.input, flex: 1, minWidth: 260 }}
                  placeholder="Description (optionnel)"
                  value={newMoDesc}
                  onChange={(e) => setNewMoDesc(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />
              </div>

              <div style={{ ...styles.row, marginTop: 10, alignItems: "flex-start" }}>
                <input
                  style={{ ...styles.input, width: 120, minWidth: 120 }}
                  inputMode="decimal"
                  placeholder="Heures"
                  value={newMoHeures}
                  onChange={(e) => setNewMoHeures(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />

                <input
                  style={{ ...styles.input, width: 140, minWidth: 140 }}
                  inputMode="decimal"
                  placeholder="Taux horaire"
                  value={newMoTaux}
                  onChange={(e) => setNewMoTaux(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btnDanger} onClick={closeTempsModal}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addMainOeuvre}
                disabled={isReadOnly || !mainOeuvreTableAvailable}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTerminerOpen && (
        <div style={styles.modalBackdrop} onClick={() => setConfirmTerminerOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Terminer le bon de travail</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={() => setConfirmTerminerOpen(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ marginTop: 0 }}>Que veux-tu faire avec ce bon de travail ?</p>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => handleTerminerBt("facturer")}
                  disabled={savingTerminer}
                >
                  Envoyer à facturer
                </button>

                <button
                  type="button"
                  style={styles.btn}
                  onClick={() => handleTerminerBt("fermer")}
                  disabled={savingTerminer}
                >
                  Fermer seulement
                </button>

                <button
                  type="button"
                  style={styles.btnDanger}
                  onClick={() => setConfirmTerminerOpen(false)}
                  disabled={savingTerminer}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}