import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabaseClient";

type PeriodKey = "1y" | "3y" | "5y" | "all";
type ModuleKey =
  | "durabilitePieces"
  | "coutsVehicules"
  | "piecesActives"
  | "comparaison"
  | "carburant";

type SortDurabilityKey =
  | "quality_desc"
  | "km_desc"
  | "km_asc"
  | "repl_desc"
  | "name_asc"
  | "cost_10k_asc";

type CompareField =
  | "type"
  | "motorisation"
  | "freins"
  | "type_freins"
  | "suspension";

type SuiviEvent = {
  id: string;
  unite_id: string;
  bt_id: string | null;
  inventaire_item_id: string | null;
  suivi_type: string | null;
  categorie_piece_id: string | null;
  sous_categorie_piece_id: string | null;
  localisation: string | null;
  action: string | null;
  date_evenement: string | null;
  created_at: string | null;
  km: number | null;
  actif: boolean | null;
  remplace_evenement_id: string | null;
  piece_sku: string | null;
  piece_nom: string | null;
};

type UniteOption = {
  id: string;
  categorie: string;
  libelle: string;
  ordre?: number | null;
  actif?: boolean | null;
};

type UniteRow = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  km_actuel: number | null;
  type: string | null;
  statut: string | null;
  client_id: string | null;
  type_unite_id?: string | null;
  motorisation_id?: string | null;
  freins_id?: string | null;
  type_freins_id?: string | null;
  suspension_id?: string | null;
  clients?: { nom: string | null } | null;
  type_option?: UniteOption | null;
  motorisation_option?: UniteOption | null;
  freins_option?: UniteOption | null;
  type_freins_option?: UniteOption | null;
  suspension_option?: UniteOption | null;
};

type BtRow = {
  id: string;
  numero: string | null;
  unite_id: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  km: number | null;
  statut: string | null;
  total_pieces: number | null;
  total_main_oeuvre: number | null;
  total_frais_atelier: number | null;
  total_general: number | null;
  total_final: number | null;
};

type BtPieceRow = {
  id: string;
  bt_id: string | null;
  inventaire_item_id: string | null;
  sku: string | null;
  description: string | null;
  quantite: number | null;
  prix_unitaire: number | null;
  prix_facture_unitaire_snapshot: number | null;
  total_facture_snapshot: number | null;
};

type PieceCategorie = { id: string; nom: string; actif?: boolean | null };
type PieceSousCategorie = {
  id: string;
  categorie_id: string | null;
  nom: string;
  actif?: boolean | null;
};

type DurabiliteRow = {
  key: string;
  pieceLabel: string;
  categorieKey: string;
  categorieNom: string;
  sousCategorieNom: string;
  installs: number;
  replacements: number;
  kmValues: number[];
  kmMoyen: number | null;
  kmMin: number | null;
  kmMax: number | null;
  couts: number[];
  coutMoyen: number | null;
  scoreQualitePrix: number | null;
  coutPar10000Km: number | null;
  vehicules: Set<string>;
  events: SuiviEvent[];
};

type CostRow = {
  uniteId: string;
  unite: UniteRow | null;
  total: number;
  pieces: number;
  mo: number;
  frais: number;
  kmMin: number | null;
  kmMax: number | null;
  count: number;
  kmDelta: number | null;
  coutKm: number | null;
};

type ConfigCompareRow = {
  label: string;
  events: SuiviEvent[];
  installs: number;
  replacements: number;
  kmValues: number[];
  kmMoyen: number | null;
  kmMin: number | null;
  kmMax: number | null;
};

function periodStart(period: PeriodKey) {
  if (period === "all") return null;
  const d = new Date();
  const years = period === "1y" ? 1 : period === "3y" ? 3 : 5;
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

function periodLabel(period: PeriodKey) {
  if (period === "1y") return "12 derniers mois";
  if (period === "3y") return "3 dernières années";
  if (period === "5y") return "5 dernières années";
  return "Toutes les données";
}

function money(v: number | null | undefined) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));
}

function fmtNumber(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(
    Number(v),
  );
}

function fmtKm(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${fmtNumber(v)} km`;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function eventDate(ev: SuiviEvent) {
  return ev.date_evenement || ev.created_at || null;
}

function eventTime(ev: SuiviEvent) {
  const d = eventDate(ev);
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function locLabel(v: string | null | undefined) {
  const map: Record<string, string> = {
    ignore: "Ignoré",
    avant: "Avant",
    arriere: "Arrière",
    avant_gauche: "Avant gauche",
    avant_droite: "Avant droite",
    arriere_gauche: "Arrière gauche",
    arriere_droite: "Arrière droite",
    tous: "Tous",
  };
  return map[String(v || "")] || v || "—";
}

function isClosedOrBillableBt(statut: string | null | undefined) {
  return ["ferme", "termine", "a_facturer", "facture"].includes(
    String(statut || ""),
  );
}

function includesSearch(
  values: Array<string | number | null | undefined>,
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return values.filter(Boolean).join(" ").toLowerCase().includes(q);
}

function normalizeKey(v: string | null | undefined) {
  return String(v || "").trim() || "—";
}

function getOptionLabel(option: UniteOption | null | undefined) {
  return String(option?.libelle || "").trim() || null;
}

function getUnitType(u: UniteRow | null | undefined) {
  return getOptionLabel(u?.type_option) || u?.type || "—";
}

function getUnitMotorisation(u: UniteRow | null | undefined) {
  return getOptionLabel(u?.motorisation_option) || "—";
}

function getUnitFreins(u: UniteRow | null | undefined) {
  return getOptionLabel(u?.freins_option) || "—";
}

function getUnitTypeFreins(u: UniteRow | null | undefined) {
  return getOptionLabel(u?.type_freins_option) || "—";
}

function getUnitSuspension(u: UniteRow | null | undefined) {
  return getOptionLabel(u?.suspension_option) || "—";
}

function getConfigValue(u: UniteRow | null | undefined, field: CompareField) {
  if (field === "motorisation") return getUnitMotorisation(u);
  if (field === "freins") return getUnitFreins(u);
  if (field === "type_freins") return getUnitTypeFreins(u);
  if (field === "suspension") return getUnitSuspension(u);
  return getUnitType(u);
}

function getCompareLabel(field: CompareField) {
  if (field === "motorisation") return "Motorisation";
  if (field === "freins") return "Freins";
  if (field === "type_freins") return "Type freins";
  if (field === "suspension") return "Suspension";
  return "Type véhicule";
}

export default function GestionAtelierPage() {
  const [period, setPeriod] = useState<PeriodKey>("3y");
  const [activeModule, setActiveModule] =
    useState<ModuleKey>("durabilitePieces");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [events, setEvents] = useState<SuiviEvent[]>([]);
  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [bts, setBts] = useState<BtRow[]>([]);
  const [btPieces, setBtPieces] = useState<BtPieceRow[]>([]);
  const [categories, setCategories] = useState<PieceCategorie[]>([]);
  const [sousCategories, setSousCategories] = useState<PieceSousCategorie[]>(
    [],
  );

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [motorisationFilter, setMotorisationFilter] = useState("all");
  const [localisationFilter, setLocalisationFilter] = useState("all");
  const [sortDurability, setSortDurability] =
    useState<SortDurabilityKey>("quality_desc");
  const [selectedPieceKey, setSelectedPieceKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [compareField, setCompareField] =
    useState<CompareField>("motorisation");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const start = periodStart(period);

      let suivisQuery = supabase
        .from("pieces_suivi_evenements")
        .select("*")
        .order("date_evenement", { ascending: false })
        .order("created_at", { ascending: false });

      if (start) suivisQuery = suivisQuery.gte("date_evenement", start);

      let btQuery = supabase
        .from("bons_travail")
        .select(
          "id,numero,unite_id,date_ouverture,date_fermeture,km,statut,total_pieces,total_main_oeuvre,total_frais_atelier,total_general,total_final",
        )
        .order("date_ouverture", { ascending: false });

      if (start) btQuery = btQuery.gte("date_ouverture", start);

      const [suivisRes, unitesRes, btRes, piecesRes, catRes, sousCatRes, optionsRes] =
        await Promise.all([
          suivisQuery,
          supabase
            .from("unites")
            .select(
              `
            id,
            no_unite,
            marque,
            modele,
            annee,
            km_actuel,
            type,
            statut,
            client_id,
            type_unite_id,
            motorisation_id,
            freins_id,
            type_freins_id,
            suspension_id,
            clients(nom)
          `,
            )
            .order("no_unite", { ascending: true }),
          btQuery,
          supabase
            .from("bt_pieces")
            .select(
              "id,bt_id,inventaire_item_id,sku,description,quantite,prix_unitaire,prix_facture_unitaire_snapshot,total_facture_snapshot",
            ),
          supabase
            .from("pieces_categories")
            .select("id,nom,actif")
            .order("nom", { ascending: true }),
          supabase
            .from("pieces_sous_categories")
            .select("id,categorie_id,nom,actif")
            .order("nom", { ascending: true }),
          supabase.from("unite_options").select("*"),
        ]);

      if (suivisRes.error) throw suivisRes.error;
      if (unitesRes.error) throw unitesRes.error;
      if (btRes.error) throw btRes.error;
      if (piecesRes.error) throw piecesRes.error;
      if (catRes.error) throw catRes.error;
      if (sousCatRes.error) throw sousCatRes.error;
      if (optionsRes.error) throw optionsRes.error;

      const optionById = new Map<string, UniteOption>(
        ((optionsRes.data || []) as unknown as UniteOption[])
          .filter((opt): opt is UniteOption => Boolean(opt?.id))
          .map((opt) => [String(opt.id), opt]),
      );

      const unitesAvecOptions = ((unitesRes.data || []) as unknown as UniteRow[]).map((u) => ({
        ...u,
        type_option: u.type_unite_id ? optionById.get(String(u.type_unite_id)) : undefined,
        motorisation_option: u.motorisation_id
          ? optionById.get(String(u.motorisation_id))
          : undefined,
        freins_option: u.freins_id ? optionById.get(String(u.freins_id)) : undefined,
        type_freins_option: u.type_freins_id
          ? optionById.get(String(u.type_freins_id))
          : undefined,
        suspension_option: u.suspension_id
          ? optionById.get(String(u.suspension_id))
          : undefined,
      }));

      setEvents((suivisRes.data || []) as SuiviEvent[]);
      setUnites(unitesAvecOptions);
      setBts((btRes.data || []) as BtRow[]);
      setBtPieces((piecesRes.data || []) as BtPieceRow[]);
      setCategories((catRes.data || []) as PieceCategorie[]);
      setSousCategories((sousCatRes.data || []) as PieceSousCategorie[]);
    } catch (e: any) {
      setErr(e?.message || "Erreur chargement gestion atelier.");
      setEvents([]);
      setUnites([]);
      setBts([]);
      setBtPieces([]);
      setCategories([]);
      setSousCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const uniteById = useMemo(
    () => new Map(unites.map((u) => [u.id, u])),
    [unites],
  );
  const btById = useMemo(() => new Map(bts.map((b) => [b.id, b])), [bts]);
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const subCategoryById = useMemo(
    () => new Map(sousCategories.map((c) => [c.id, c])),
    [sousCategories],
  );

  const availableSubCategories = useMemo(() => {
    if (categoryFilter === "all") return sousCategories;
    return sousCategories.filter((s) => s.categorie_id === categoryFilter);
  }, [sousCategories, categoryFilter]);

  const vehicleTypes = useMemo(() => {
    return Array.from(
      new Set<string>(
        unites
          .map((u) => normalizeKey(getUnitType(u)))
          .filter((v): v is string => v !== "—"),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr-CA"));
  }, [unites]);

  const motorisations = useMemo(() => {
    return Array.from(
      new Set<string>(
        unites
          .map((u) => normalizeKey(getUnitMotorisation(u)))
          .filter((v): v is string => v !== "—"),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr-CA"));
  }, [unites]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (categoryFilter !== "all" && ev.categorie_piece_id !== categoryFilter)
        return false;
      if (
        subCategoryFilter !== "all" &&
        ev.sous_categorie_piece_id !== subCategoryFilter
      )
        return false;
      if (
        localisationFilter !== "all" &&
        ev.localisation !== localisationFilter
      )
        return false;

      const u = uniteById.get(ev.unite_id);
      if (vehicleTypeFilter !== "all" && getUnitType(u) !== vehicleTypeFilter)
        return false;
      if (
        motorisationFilter !== "all" &&
        getUnitMotorisation(u) !== motorisationFilter
      )
        return false;

      const cat = ev.categorie_piece_id
        ? categoryById.get(ev.categorie_piece_id)?.nom
        : ev.suivi_type;
      const sub = ev.sous_categorie_piece_id
        ? subCategoryById.get(ev.sous_categorie_piece_id)?.nom
        : "";

      return includesSearch(
        [
          u?.no_unite,
          u?.marque,
          u?.modele,
          u?.clients?.nom,
          getUnitType(u),
          getUnitMotorisation(u),
          getUnitFreins(u),
          getUnitTypeFreins(u),
          ev.piece_sku,
          ev.piece_nom,
          ev.suivi_type,
          cat,
          sub,
          ev.localisation,
        ],
        search,
      );
    });
  }, [
    events,
    categoryFilter,
    subCategoryFilter,
    localisationFilter,
    vehicleTypeFilter,
    motorisationFilter,
    search,
    uniteById,
    categoryById,
    subCategoryById,
  ]);

  const activeEvents = useMemo(
    () => filteredEvents.filter((ev) => ev.actif),
    [filteredEvents],
  );
  const closedBts = useMemo(
    () => bts.filter((bt) => isClosedOrBillableBt(bt.statut)),
    [bts],
  );

  function getCostForEvent(ev: SuiviEvent) {
    const match = btPieces.find((p) => {
      if (ev.bt_id && p.bt_id !== ev.bt_id) return false;
      if (
        ev.inventaire_item_id &&
        p.inventaire_item_id === ev.inventaire_item_id
      )
        return true;
      if (ev.piece_sku && p.sku && p.sku === ev.piece_sku) return true;
      if (ev.piece_nom && p.description && p.description === ev.piece_nom)
        return true;
      return false;
    });

    if (!match) return null;
    const qte = Number(match.quantite || 1) || 1;
    const unitCost = Number(
      match.prix_unitaire || match.prix_facture_unitaire_snapshot || 0,
    );
    const total = Number(match.total_facture_snapshot || 0);
    if (unitCost > 0) return unitCost;
    if (total > 0) return total / qte;
    return null;
  }

  const durabiliteRows = useMemo(() => {
    const sorted = [...filteredEvents].sort(
      (a, b) => eventTime(a) - eventTime(b),
    );
    const installedByPosition = new Map<string, SuiviEvent>();
    const stats = new Map<string, DurabiliteRow>();

    function pieceKey(ev: SuiviEvent) {
      return [
        ev.suivi_type || "piece",
        ev.categorie_piece_id || "",
        ev.sous_categorie_piece_id || "",
        ev.inventaire_item_id || ev.piece_sku || ev.piece_nom || "",
      ].join("|");
    }

    function positionKey(ev: SuiviEvent) {
      return [
        ev.unite_id,
        ev.suivi_type || "piece",
        ev.categorie_piece_id || "",
        ev.sous_categorie_piece_id || "",
        ev.localisation || "ignore",
      ].join("|");
    }

    function ensure(ev: SuiviEvent) {
      const key = pieceKey(ev);
      const catName = ev.categorie_piece_id
        ? categoryById.get(ev.categorie_piece_id)?.nom || ev.suivi_type || "—"
        : ev.suivi_type || "—";
      const subName = ev.sous_categorie_piece_id
        ? subCategoryById.get(ev.sous_categorie_piece_id)?.nom || "—"
        : "—";
      const label =
        [ev.piece_sku, ev.piece_nom].filter(Boolean).join(" — ") ||
        ev.suivi_type ||
        "Pièce";

      if (!stats.has(key)) {
        stats.set(key, {
          key,
          pieceLabel: label,
          categorieKey: ev.suivi_type || "piece",
          categorieNom: catName,
          sousCategorieNom: subName,
          installs: 0,
          replacements: 0,
          kmValues: [],
          kmMoyen: null,
          kmMin: null,
          kmMax: null,
          couts: [],
          coutMoyen: null,
          scoreQualitePrix: null,
          coutPar10000Km: null,
          vehicules: new Set<string>(),
          events: [],
        });
      }

      return stats.get(key)!;
    }

    for (const ev of sorted) {
      const action = ev.action || "installation";
      const stat = ensure(ev);
      stat.events.push(ev);

      const unitNo = uniteById.get(ev.unite_id)?.no_unite;
      if (unitNo) stat.vehicules.add(unitNo);

      const eventCost = getCostForEvent(ev);
      if (eventCost != null && Number.isFinite(eventCost) && eventCost > 0) {
        stat.couts.push(eventCost);
      }

      if (action === "installation") {
        stat.installs += 1;
        installedByPosition.set(positionKey(ev), ev);
        continue;
      }

      if (action === "remplacement") {
        stat.replacements += 1;
        const old = ev.remplace_evenement_id
          ? sorted.find((x) => x.id === ev.remplace_evenement_id)
          : installedByPosition.get(positionKey(ev));

        if (old?.km != null && ev.km != null) {
          const delta = Number(ev.km) - Number(old.km);
          if (Number.isFinite(delta) && delta >= 0) stat.kmValues.push(delta);
        }

        stat.installs += 1;
        installedByPosition.set(positionKey(ev), ev);
      }

      if (action === "retrait") {
        const old = ev.remplace_evenement_id
          ? sorted.find((x) => x.id === ev.remplace_evenement_id)
          : installedByPosition.get(positionKey(ev));
        if (old?.km != null && ev.km != null) {
          const delta = Number(ev.km) - Number(old.km);
          if (Number.isFinite(delta) && delta >= 0) stat.kmValues.push(delta);
        }
        installedByPosition.delete(positionKey(ev));
      }
    }

    const rows = Array.from(stats.values()).map((r) => {
      const kmSum = r.kmValues.reduce((a, b) => a + b, 0);
      const kmMoyen = r.kmValues.length
        ? Math.round(kmSum / r.kmValues.length)
        : null;
      const coutMoyen = r.couts.length
        ? r.couts.reduce((a, b) => a + b, 0) / r.couts.length
        : null;
      const scoreQualitePrix =
        kmMoyen && coutMoyen && coutMoyen > 0
          ? Math.round(kmMoyen / coutMoyen)
          : null;
      const coutPar10000Km =
        kmMoyen && coutMoyen && kmMoyen > 0
          ? (coutMoyen / kmMoyen) * 10000
          : null;

      return {
        ...r,
        events: [...r.events].sort((a, b) => eventTime(b) - eventTime(a)),
        kmMoyen,
        kmMin: r.kmValues.length ? Math.min(...r.kmValues) : null,
        kmMax: r.kmValues.length ? Math.max(...r.kmValues) : null,
        coutMoyen,
        scoreQualitePrix,
        coutPar10000Km,
      };
    });

    return rows.sort((a, b) => {
      if (sortDurability === "quality_desc")
        return (
          Number(b.scoreQualitePrix || 0) - Number(a.scoreQualitePrix || 0)
        );
      if (sortDurability === "cost_10k_asc")
        return (
          Number(a.coutPar10000Km || 999999999) -
          Number(b.coutPar10000Km || 999999999)
        );
      if (sortDurability === "km_asc")
        return Number(a.kmMoyen || 999999999) - Number(b.kmMoyen || 999999999);
      if (sortDurability === "repl_desc")
        return b.replacements - a.replacements;
      if (sortDurability === "name_asc")
        return a.pieceLabel.localeCompare(b.pieceLabel, "fr-CA");
      return Number(b.kmMoyen || 0) - Number(a.kmMoyen || 0);
    });
  }, [
    filteredEvents,
    uniteById,
    categoryById,
    subCategoryById,
    sortDurability,
    btPieces,
  ]);

  const selectedPiece = useMemo(
    () => durabiliteRows.find((r) => r.key === selectedPieceKey) || null,
    [durabiliteRows, selectedPieceKey],
  );

  const compareRows = useMemo<ConfigCompareRow[]>(() => {
    if (!selectedPiece) return [];

    const sorted = [...selectedPiece.events].sort(
      (a, b) => eventTime(a) - eventTime(b),
    );
    const installedByPosition = new Map<string, SuiviEvent>();
    const grouped = new Map<string, ConfigCompareRow>();

    function positionKey(ev: SuiviEvent) {
      return [
        ev.unite_id,
        ev.suivi_type || "piece",
        ev.categorie_piece_id || "",
        ev.sous_categorie_piece_id || "",
        ev.localisation || "ignore",
      ].join("|");
    }

    function ensure(label: string) {
      if (!grouped.has(label)) {
        grouped.set(label, {
          label,
          events: [],
          installs: 0,
          replacements: 0,
          kmValues: [],
          kmMoyen: null,
          kmMin: null,
          kmMax: null,
        });
      }
      return grouped.get(label)!;
    }

    for (const ev of sorted) {
      const unit = uniteById.get(ev.unite_id);
      const label = normalizeKey(getConfigValue(unit, compareField));
      const row = ensure(label);
      const action = ev.action || "installation";
      row.events.push(ev);

      if (action === "installation") {
        row.installs += 1;
        installedByPosition.set(positionKey(ev), ev);
        continue;
      }

      if (action === "remplacement") {
        row.replacements += 1;
        const old = ev.remplace_evenement_id
          ? sorted.find((x) => x.id === ev.remplace_evenement_id)
          : installedByPosition.get(positionKey(ev));
        if (old?.km != null && ev.km != null) {
          const delta = Number(ev.km) - Number(old.km);
          if (Number.isFinite(delta) && delta >= 0) row.kmValues.push(delta);
        }
        row.installs += 1;
        installedByPosition.set(positionKey(ev), ev);
      }

      if (action === "retrait") {
        const old = ev.remplace_evenement_id
          ? sorted.find((x) => x.id === ev.remplace_evenement_id)
          : installedByPosition.get(positionKey(ev));
        if (old?.km != null && ev.km != null) {
          const delta = Number(ev.km) - Number(old.km);
          if (Number.isFinite(delta) && delta >= 0) row.kmValues.push(delta);
        }
        installedByPosition.delete(positionKey(ev));
      }
    }

    return Array.from(grouped.values())
      .map((r) => {
        const kmSum = r.kmValues.reduce((a, b) => a + b, 0);
        return {
          ...r,
          kmMoyen: r.kmValues.length
            ? Math.round(kmSum / r.kmValues.length)
            : null,
          kmMin: r.kmValues.length ? Math.min(...r.kmValues) : null,
          kmMax: r.kmValues.length ? Math.max(...r.kmValues) : null,
        };
      })
      .sort((a, b) => Number(b.kmMoyen || 0) - Number(a.kmMoyen || 0));
  }, [selectedPiece, uniteById, compareField]);

  const coutRows = useMemo<CostRow[]>(() => {
    const byUnit = new Map<
      string,
      Omit<CostRow, "uniteId" | "kmDelta" | "coutKm">
    >();

    for (const bt of closedBts) {
      const unitId = bt.unite_id || "";
      if (!unitId) continue;
      const cur = byUnit.get(unitId) || {
        unite: uniteById.get(unitId) || null,
        total: 0,
        pieces: 0,
        mo: 0,
        frais: 0,
        kmMin: null,
        kmMax: null,
        count: 0,
      };
      cur.total += Number(bt.total_general ?? bt.total_final ?? 0);
      cur.pieces += Number(bt.total_pieces || 0);
      cur.mo += Number(bt.total_main_oeuvre || 0);
      cur.frais += Number(bt.total_frais_atelier || 0);
      cur.count += 1;
      if (bt.km != null) {
        const km = Number(bt.km);
        if (Number.isFinite(km)) {
          cur.kmMin = cur.kmMin == null ? km : Math.min(cur.kmMin, km);
          cur.kmMax = cur.kmMax == null ? km : Math.max(cur.kmMax, km);
        }
      }
      byUnit.set(unitId, cur);
    }

    return Array.from(byUnit.entries())
      .map(([uniteId, r]) => {
        const kmDelta =
          r.kmMin != null && r.kmMax != null
            ? Math.max(0, r.kmMax - r.kmMin)
            : null;
        return {
          uniteId,
          ...r,
          kmDelta,
          coutKm: kmDelta && kmDelta > 0 ? r.total / kmDelta : null,
        };
      })
      .filter((r) =>
        includesSearch(
          [
            r.unite?.no_unite,
            r.unite?.marque,
            r.unite?.modele,
            r.unite?.clients?.nom,
          ],
          search,
        ),
      )
      .sort((a, b) => b.total - a.total);
  }, [closedBts, search, uniteById]);

  const comparisonA = useMemo(
    () => coutRows.find((r) => r.uniteId === compareA) || null,
    [coutRows, compareA],
  );
  const comparisonB = useMemo(
    () => coutRows.find((r) => r.uniteId === compareB) || null,
    [coutRows, compareB],
  );

  const styles: Record<string, CSSProperties> = {
    page: { maxWidth: 1280, margin: "24px auto", padding: "0 14px" },
    header: {
      display: "flex",
      justifyContent: "space-between",
      gap: 14,
      alignItems: "flex-start",
      marginBottom: 14,
      flexWrap: "wrap",
    },
    title: { fontSize: 26, fontWeight: 950, margin: 0, color: "#0f172a" },
    muted: { color: "rgba(15,23,42,.62)", fontSize: 13 },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    card: {
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 12px 34px rgba(15,23,42,.06)",
      marginBottom: 12,
    },
    input: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,.14)",
      background: "#fff",
      minWidth: 230,
    },
    select: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,.14)",
      background: "#fff",
      fontWeight: 800,
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,.14)",
      background: "#fff",
      fontWeight: 850,
      cursor: "pointer",
    },
    btnActive: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 12,
      marginBottom: 12,
    },
    kpi: {
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 14,
      padding: 12,
      boxShadow: "0 8px 22px rgba(15,23,42,.04)",
    },
    kpiLabel: {
      fontSize: 12,
      color: "rgba(15,23,42,.58)",
      fontWeight: 850,
      textTransform: "uppercase",
      letterSpacing: ".04em",
    },
    kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6, color: "#0f172a" },
    kpiSub: {
      fontSize: 11,
      color: "rgba(15,23,42,.55)",
      marginTop: 6,
      fontWeight: 700,
    },
    tabs: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
    toolbar: { display: "grid", gap: 12, marginBottom: 12 },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(15,23,42,.58)",
      padding: "9px 8px",
      borderBottom: "1px solid rgba(15,23,42,.08)",
    },
    td: {
      padding: "11px 8px",
      borderBottom: "1px solid rgba(15,23,42,.06)",
      verticalAlign: "top",
    },
    badge: {
      display: "inline-flex",
      padding: "4px 8px",
      borderRadius: 999,
      background: "#f1f5f9",
      border: "1px solid rgba(15,23,42,.08)",
      fontSize: 12,
      fontWeight: 850,
    },
    warn: {
      padding: 12,
      borderRadius: 14,
      background: "#fff7ed",
      border: "1px solid #fed7aa",
      color: "#92400e",
      fontWeight: 800,
    },
    note: {
      padding: 12,
      borderRadius: 14,
      background: "#f8fafc",
      border: "1px solid rgba(15,23,42,.08)",
      color: "rgba(15,23,42,.70)",
      fontSize: 13,
      fontWeight: 700,
    },
    info: {
      padding: 12,
      borderRadius: 14,
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
      fontSize: 13,
      fontWeight: 750,
    },
    miniGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      gap: 10,
      marginTop: 10,
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.45)",
      backdropFilter: "blur(3px)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "min(1180px, 100%)",
      maxHeight: "90vh",
      overflow: "auto",
      background: "#fff",
      borderRadius: 24,
      padding: 24,
      boxShadow: "0 25px 80px rgba(0,0,0,.25)",
      border: "1px solid rgba(15,23,42,.08)",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Gestion atelier</h1>
          <div style={styles.muted}>
            Rapports interactifs : durabilité des pièces, coûts, véhicules,
            carburant et comparatifs.
          </div>
        </div>

        <button
          style={styles.btn}
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Chargement..." : "Actualiser"}
        </button>
      </div>

      {err ? (
        <div
          style={{
            ...styles.card,
            borderColor: "rgba(220,38,38,.25)",
            color: "#991b1b",
            fontWeight: 800,
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={styles.tabs}>
        <button
          style={
            activeModule === "durabilitePieces" ? styles.btnActive : styles.btn
          }
          onClick={() => setActiveModule("durabilitePieces")}
        >
          Durabilité pièces
        </button>
        <button
          style={
            activeModule === "coutsVehicules" ? styles.btnActive : styles.btn
          }
          onClick={() => setActiveModule("coutsVehicules")}
        >
          Coûts véhicules
        </button>
        <button
          style={
            activeModule === "piecesActives" ? styles.btnActive : styles.btn
          }
          onClick={() => setActiveModule("piecesActives")}
        >
          Pièces actives
        </button>
        <button
          style={activeModule === "comparaison" ? styles.btnActive : styles.btn}
          onClick={() => setActiveModule("comparaison")}
        >
          Comparaison
        </button>
        <button
          style={activeModule === "carburant" ? styles.btnActive : styles.btn}
          onClick={() => setActiveModule("carburant")}
        >
          Carburant
        </button>
      </div>

      {activeModule === "durabilitePieces" && (
        <div style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 950 }}>
                Durabilité par pièce
              </div>
              <div style={styles.muted}>
                Compare les marques/SKU selon les km réels entre installation et
                remplacement • {periodLabel(period)}.
              </div>
            </div>

            <div style={styles.row}>
              <select
                style={styles.select}
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              >
                <option value="1y">1 an</option>
                <option value="3y">3 ans</option>
                <option value="5y">5 ans</option>
                <option value="all">Tout</option>
              </select>

              <input
                style={styles.input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Recherche pièce, unité, client..."
              />

              <select
                style={styles.select}
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubCategoryFilter("all");
                }}
              >
                <option value="all">Toutes catégories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={subCategoryFilter}
                onChange={(e) => setSubCategoryFilter(e.target.value)}
              >
                <option value="all">Toutes sous-catégories</option>
                {availableSubCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.nom}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
              >
                <option value="all">Tous types véhicule</option>
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={motorisationFilter}
                onChange={(e) => setMotorisationFilter(e.target.value)}
              >
                <option value="all">Toutes motorisations</option>
                {motorisations.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={localisationFilter}
                onChange={(e) => setLocalisationFilter(e.target.value)}
              >
                <option value="all">Toutes positions</option>
                <option value="avant">Avant</option>
                <option value="arriere">Arrière</option>
                <option value="avant_gauche">Avant gauche</option>
                <option value="avant_droite">Avant droite</option>
                <option value="arriere_gauche">Arrière gauche</option>
                <option value="arriere_droite">Arrière droite</option>
                <option value="tous">Tous</option>
              </select>

              <select
                style={styles.select}
                value={sortDurability}
                onChange={(e) =>
                  setSortDurability(e.target.value as SortDurabilityKey)
                }
              >
                <option value="quality_desc">
                  Meilleur rapport qualité / prix
                </option>
                <option value="cost_10k_asc">
                  Coût / 10 000 km le plus bas
                </option>
                <option value="km_desc">Meilleure durabilité</option>
                <option value="km_asc">Plus faible durabilité</option>
                <option value="repl_desc">Plus remplacées</option>
                <option value="name_asc">Nom A-Z</option>
              </select>
            </div>

            <div style={styles.info}>
              Le rapport qualité/prix est calculé avec le KM moyen divisé par le
              coût moyen de la pièce. Plus le score KM/$ est élevé, meilleur est
              le rendement.
            </div>
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Pièce</th>
                <th style={styles.th}>Catégorie</th>
                <th style={styles.th}>Sous-cat.</th>
                <th style={styles.th}>Install.</th>
                <th style={styles.th}>Rempl.</th>
                <th style={styles.th}>KM moyen</th>
                <th style={styles.th}>Min / Max</th>
                <th style={styles.th}>Coût moyen</th>
                <th style={styles.th}>KM / $</th>
                <th style={styles.th}>Coût / 10k km</th>
                <th style={styles.th}>Véhicules</th>
                <th style={styles.th}>Types</th>
              </tr>
            </thead>
            <tbody>
              {durabiliteRows.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={12}>
                    <span style={styles.muted}>
                      Aucune donnée de durabilité pour la période.
                    </span>
                  </td>
                </tr>
              ) : (
                durabiliteRows.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => {
                      setSelectedPieceKey(r.key);
                      setDetailOpen(true);
                    }}
                    style={{
                      cursor: "pointer",
                      background:
                        selectedPiece?.key === r.key
                          ? "#f8fafc"
                          : "transparent",
                    }}
                  >
                    <td style={styles.td}>
                      <b>{r.pieceLabel}</b>
                      <div style={{ ...styles.muted, marginTop: 4 }}>
                        Cliquer pour détail
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge}>{r.categorieNom}</span>
                    </td>
                    <td style={styles.td}>{r.sousCategorieNom}</td>
                    <td style={styles.td}>{fmtNumber(r.installs)}</td>
                    <td style={styles.td}>{fmtNumber(r.replacements)}</td>
                    <td style={styles.td}>
                      <b>{fmtKm(r.kmMoyen)}</b>
                    </td>
                    <td style={styles.td}>
                      {fmtKm(r.kmMin)} / {fmtKm(r.kmMax)}
                    </td>
                    <td style={styles.td}>
                      {r.coutMoyen == null ? "—" : money(r.coutMoyen)}
                    </td>
                    <td style={styles.td}>
                      <b>
                        {r.scoreQualitePrix == null
                          ? "—"
                          : `${fmtNumber(r.scoreQualitePrix)} km/$`}
                      </b>
                    </td>
                    <td style={styles.td}>
                      {r.coutPar10000Km == null ? "—" : money(r.coutPar10000Km)}
                    </td>
                    <td style={styles.td}>
                      {Array.from(r.vehicules).slice(0, 6).join(", ") || "—"}
                    </td>
                    <td style={styles.td}>
                      {Array.from(
                        new Set(
                          r.events
                            .map((ev) =>
                              getUnitType(uniteById.get(ev.unite_id)),
                            )
                            .filter((x) => x !== "—"),
                        ),
                      ).join(", ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeModule === "coutsVehicules" && (
        <div style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>
                Coûts par véhicule
              </div>
              <div style={styles.muted}>
                Le coût vient des BT fermés, terminés, à facturer ou facturés
                sur la période sélectionnée.
              </div>
            </div>
            <div style={styles.note}>
              Source : bons_travail.total_general. Détail : pièces +
              main-d’œuvre + frais d’atelier. Carburant non inclus ici.
            </div>
          </div>

          <div style={{ ...styles.row, marginBottom: 12 }}>
            <select
              style={styles.select}
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            >
              <option value="1y">1 an</option>
              <option value="3y">3 ans</option>
              <option value="5y">5 ans</option>
              <option value="all">Tout</option>
            </select>
            <input
              style={styles.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche unité, client, véhicule..."
            />
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Unité</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>BT</th>
                <th style={styles.th}>Pièces</th>
                <th style={styles.th}>Main-d’œuvre</th>
                <th style={styles.th}>Frais atelier</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>KM période</th>
                <th style={styles.th}>Coût/km</th>
              </tr>
            </thead>
            <tbody>
              {coutRows.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={9}>
                    <span style={styles.muted}>
                      Aucun coût trouvé pour la période.
                    </span>
                  </td>
                </tr>
              ) : (
                coutRows.map((r) => (
                  <tr key={r.uniteId}>
                    <td style={styles.td}>
                      <b>{r.unite?.no_unite || "—"}</b>
                      <div style={styles.muted}>
                        {[r.unite?.marque, r.unite?.modele]
                          .filter(Boolean)
                          .join(" ")}
                      </div>
                    </td>
                    <td style={styles.td}>{r.unite?.clients?.nom || "—"}</td>
                    <td style={styles.td}>{fmtNumber(r.count)}</td>
                    <td style={styles.td}>{money(r.pieces)}</td>
                    <td style={styles.td}>{money(r.mo)}</td>
                    <td style={styles.td}>{money(r.frais)}</td>
                    <td style={styles.td}>
                      <b>{money(r.total)}</b>
                    </td>
                    <td style={styles.td}>{fmtKm(r.kmDelta)}</td>
                    <td style={styles.td}>
                      {r.coutKm == null ? "—" : money(r.coutKm)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeModule === "piecesActives" && (
        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>
            Pièces suivies actuellement actives
          </div>
          <div style={{ ...styles.muted, marginBottom: 10 }}>
            Permet de voir ce qui est présentement installé sur les véhicules.
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Unité</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Pièce</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Motorisation</th>
                <th style={styles.th}>Position</th>
                <th style={styles.th}>Installée le</th>
                <th style={styles.th}>KM installation</th>
                <th style={styles.th}>KM actuel unité</th>
                <th style={styles.th}>KM roulé estimé</th>
              </tr>
            </thead>
            <tbody>
              {activeEvents.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={10}>
                    <span style={styles.muted}>Aucune pièce active.</span>
                  </td>
                </tr>
              ) : (
                activeEvents.map((ev) => {
                  const unit = uniteById.get(ev.unite_id);
                  const kmActuel = unit?.km_actuel ?? null;
                  const kmRoule =
                    kmActuel != null && ev.km != null
                      ? Math.max(0, Number(kmActuel) - Number(ev.km))
                      : null;
                  return (
                    <tr key={ev.id}>
                      <td style={styles.td}>
                        <b>{unit?.no_unite || "—"}</b>
                      </td>
                      <td style={styles.td}>{unit?.clients?.nom || "—"}</td>
                      <td style={styles.td}>
                        {[ev.piece_sku, ev.piece_nom]
                          .filter(Boolean)
                          .join(" — ") || "—"}
                      </td>
                      <td style={styles.td}>{getUnitType(unit)}</td>
                      <td style={styles.td}>{getUnitMotorisation(unit)}</td>
                      <td style={styles.td}>{locLabel(ev.localisation)}</td>
                      <td style={styles.td}>{fmtDate(eventDate(ev))}</td>
                      <td style={styles.td}>{fmtKm(ev.km)}</td>
                      <td style={styles.td}>{fmtKm(kmActuel)}</td>
                      <td style={styles.td}>
                        <b>{fmtKm(kmRoule)}</b>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeModule === "comparaison" && (
        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>
            Comparaison
          </div>
          <div style={styles.muted}>
            Comparer deux véhicules selon les coûts atelier. Le carburant sera
            ajouté dans le module Filgo.
          </div>

          <div style={{ ...styles.row, marginTop: 12 }}>
            <select
              style={styles.select}
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
            >
              <option value="">Véhicule A</option>
              {coutRows.map((r) => (
                <option key={r.uniteId} value={r.uniteId}>
                  {r.unite?.no_unite || "—"} — {money(r.total)}
                </option>
              ))}
            </select>
            <select
              style={styles.select}
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
            >
              <option value="">Véhicule B</option>
              {coutRows.map((r) => (
                <option key={r.uniteId} value={r.uniteId}>
                  {r.unite?.no_unite || "—"} — {money(r.total)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.grid, marginTop: 12 }}>
            {[comparisonA, comparisonB].map((r, idx) => (
              <div key={idx} style={styles.kpi}>
                <div style={styles.kpiLabel}>
                  Véhicule {idx === 0 ? "A" : "B"}
                </div>
                <div style={styles.kpiValue}>{r?.unite?.no_unite || "—"}</div>
                <div style={styles.kpiSub}>
                  Total : {r ? money(r.total) : "—"}
                </div>
                <div style={styles.kpiSub}>
                  Coût/km : {r?.coutKm == null ? "—" : money(r.coutKm)}
                </div>
                <div style={styles.kpiSub}>
                  BT : {r ? fmtNumber(r.count) : "—"}
                </div>
              </div>
            ))}
          </div>

          {comparisonA && comparisonB ? (
            <div style={styles.note}>
              Écart de coût total :{" "}
              <b>{money(Math.abs(comparisonA.total - comparisonB.total))}</b>.
              Le véhicule le plus coûteux est{" "}
              <b>
                {comparisonA.total >= comparisonB.total
                  ? comparisonA.unite?.no_unite
                  : comparisonB.unite?.no_unite}
              </b>
              .
            </div>
          ) : (
            <div style={styles.warn}>
              Choisis deux véhicules pour comparer leurs coûts.
            </div>
          )}
        </div>
      )}

      {activeModule === "carburant" && (
        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>
            Carburant
          </div>
          <div style={styles.warn}>
            Module prêt à brancher avec tes rapports Filgo : carburant annuel,
            coût carburant/km et coût total/km.
          </div>
          <div style={{ ...styles.note, marginTop: 10 }}>
            Prochaine intégration : importer les rapports consolidés Filgo,
            relier chaque ligne à l’unité, puis calculer coût carburant/km +
            coût total/km avec entretien.
          </div>
        </div>
      )}

      {detailOpen && selectedPiece && (
        <div style={styles.modalBackdrop} onClick={() => setDetailOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 24, fontWeight: 950 }}>
                  {selectedPiece.pieceLabel}
                </div>
                <div style={{ ...styles.muted, marginTop: 4 }}>
                  {selectedPiece.categorieNom} •{" "}
                  {selectedPiece.sousCategorieNom}
                </div>
              </div>
              <button style={styles.btn} onClick={() => setDetailOpen(false)}>
                Fermer
              </button>
            </div>

            <div style={styles.miniGrid}>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>KM moyen</div>
                <div style={styles.kpiValue}>
                  {fmtKm(selectedPiece.kmMoyen)}
                </div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Meilleur</div>
                <div style={styles.kpiValue}>{fmtKm(selectedPiece.kmMax)}</div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Pire</div>
                <div style={styles.kpiValue}>{fmtKm(selectedPiece.kmMin)}</div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Coût moyen</div>
                <div style={styles.kpiValue}>
                  {selectedPiece.coutMoyen == null
                    ? "—"
                    : money(selectedPiece.coutMoyen)}
                </div>
              </div>
              <div style={styles.kpi}>
                <div style={styles.kpiLabel}>Qualité/prix</div>
                <div style={styles.kpiValue}>
                  {selectedPiece.scoreQualitePrix == null
                    ? "—"
                    : `${fmtNumber(selectedPiece.scoreQualitePrix)} km/$`}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>
                Comparer selon la configuration de l’unité
              </div>
              <div style={{ ...styles.row, marginBottom: 10 }}>
                <select
                  style={styles.select}
                  value={compareField}
                  onChange={(e) =>
                    setCompareField(e.target.value as CompareField)
                  }
                >
                  <option value="motorisation">Motorisation</option>
                  <option value="type">Type véhicule</option>
                  <option value="freins">Freins</option>
                  <option value="type_freins">Type freins</option>
                  <option value="suspension">Suspension</option>
                </select>
              </div>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{getCompareLabel(compareField)}</th>
                    <th style={styles.th}>Installations</th>
                    <th style={styles.th}>Remplacements</th>
                    <th style={styles.th}>KM moyen</th>
                    <th style={styles.th}>Min / Max</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={5}>
                        <span style={styles.muted}>
                          Pas assez de données pour comparer.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    compareRows.map((r) => (
                      <tr key={r.label}>
                        <td style={styles.td}>
                          <b>{r.label}</b>
                        </td>
                        <td style={styles.td}>{fmtNumber(r.installs)}</td>
                        <td style={styles.td}>{fmtNumber(r.replacements)}</td>
                        <td style={styles.td}>
                          <b>{fmtKm(r.kmMoyen)}</b>
                        </td>
                        <td style={styles.td}>
                          {fmtKm(r.kmMin)} / {fmtKm(r.kmMax)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 18, fontSize: 18, fontWeight: 950 }}>
              Événements récents
            </div>
            <table style={{ ...styles.table, marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Unité</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Motorisation</th>
                  <th style={styles.th}>Action</th>
                  <th style={styles.th}>Position</th>
                  <th style={styles.th}>KM</th>
                  <th style={styles.th}>BT</th>
                </tr>
              </thead>
              <tbody>
                {selectedPiece.events.slice(0, 25).map((ev) => {
                  const unit = uniteById.get(ev.unite_id);
                  const bt = ev.bt_id ? btById.get(ev.bt_id) : null;
                  return (
                    <tr key={ev.id}>
                      <td style={styles.td}>{fmtDate(eventDate(ev))}</td>
                      <td style={styles.td}>{unit?.no_unite || "—"}</td>
                      <td style={styles.td}>{getUnitType(unit)}</td>
                      <td style={styles.td}>{getUnitMotorisation(unit)}</td>
                      <td style={styles.td}>{ev.action || "—"}</td>
                      <td style={styles.td}>{locLabel(ev.localisation)}</td>
                      <td style={styles.td}>{fmtKm(ev.km)}</td>
                      <td style={styles.td}>{bt?.numero || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
