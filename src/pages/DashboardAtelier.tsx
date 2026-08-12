import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";

type BtRow = {
  id: string;
  numero?: string | null;
  statut?: string | null;
  verrouille?: boolean | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  updated_at?: string | null;
  client_nom?: string | null;
  export_acomba_at?: string | null;
  total_final?: number | null;
  unite_id?: string | null;
  unites?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
    km_actuel?: number | null;
    actif?: boolean | null;
  } | null;
};

type StockRow = {
  id: string;
  nom?: string | null;
  sku?: string | null;
  quantite?: number | null;
  seuil_alerte?: number | null;
  unite?: string | null;
  emplacement?: string | null;
  actif?: boolean | null;
};

type PointageRow = {
  id: string;
  mecano_nom?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  actif?: boolean | null;
  bons_travail?: {
    id?: string;
    numero?: string | null;
    unites?: { no_unite?: string | null } | null;
  } | null;
};

type UniteEntretienTemplate = {
  id: string;
  unite_id: string;
  template_id: string;
  actif: boolean;
  unites?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
    km_actuel?: number | null;
    actif?: boolean | null;
  } | null;
};

type EntretienTemplate = {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
};

type EntretienTemplateItem = {
  id: string;
  template_id: string;
  nom: string;
  description: string | null;
  periodicite_km: number | null;
  periodicite_jours: number | null;
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
  unites?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
    km_actuel?: number | null;
    actif?: boolean | null;
  } | null;
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

type ActiveMecano = {
  id: string;
  nom: string;
  unite?: string | null;
  btNumero?: string | null;
};

type EmployeGestionRow = {
  id: string;
  auth_user_id?: string | null;
  nom_complet: string;
  role?: string | null;
  actif: boolean;
};

type UniteJobRow = {
  id: string;
  no_unite: string | null;
  marque: string | null;
  modele: string | null;
  actif?: boolean | null;
  client?: {
    nom: string | null;
  } | {
    nom: string | null;
  }[] | null;
};

type AtelierJobJour = {
  id: string;
  employe_id: string;
  unite_id: string | null;
  description: string;
  ordre: number;
  created_at: string;
  completed_at: string | null;
  employes?: {
    id: string;
    nom_complet: string;
  } | null;
  unites?: {
    id: string;
    no_unite: string | null;
    marque: string | null;
    modele: string | null;
  } | null;
};

type EntretienFilterKey = "tous" | "jamais_fait" | "en_retard" | "a_prevoir";

type DashboardTab =
  | "vue_generale"
  | "entretiens"
  | "suivis"
  | "taches_ouvertes"
  | "stock_bas"
  | "jobs_jour";

type SuiviTacheType = "a_planifier" | "urgent" | "hors_service";

type EntretienDashboardRow = {
  id: string;
  sourceType: "template" | "unite";
  sourceId: string;
  unite_id: string;
  nom: string;
  description: string | null;
  frequenceKm: number | null;
  frequenceJours: number | null;
  templateNom?: string | null;
  lastDone?: EntretienHistorique | null;
  unite?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
    km_actuel?: number | null;
  } | null;
  statusKey: "jamais_fait" | "en_retard" | "a_prevoir" | "ok";
  statusLabel: "Jamais fait" | "En retard" | "À prévoir" | "OK";
  prochainDuText: string;
};

type UniteNoteRow = {
  id: string;
  unite_id: string;
  bt_source_id?: string | null;
  titre: string;
  details?: string | null;
  created_at?: string | null;
  entretien_auto?: boolean | null;
  suivi_type?: SuiviTacheType | string | null;
  unites?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
  } | null;
};

type AutorisationRow = {
  id: string;
  bt_id: string;
  statut?: string | null;
  envoye_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  bons_travail?: BtRow | null;
  bt_autorisation_taches?: { id?: string; unite_note_id?: string | null }[];
};

type AutorisationBtRow = {
  bt: BtRow;
  total: number;
  pending: number;
  refused: number;
  approved: number;
  done: number;
  lastDate: string | null;
  statusLabel: string;
  statusStyle: CSSProperties;
};

type TacheOuverteParUnite = {
  unite_id: string;
  unite_no: string;
  unite_label: string;
  taches: UniteNoteRow[];
  total: number;
  entretienAutoCount: number;
  oldestCreatedAt: string | null;
};

type DashboardData = {
  allBts: BtRow[];
  btOuverts: BtRow[];
  btAFacturer: BtRow[];
  stockBas: StockRow[];
  mecanosActifs: ActiveMecano[];
  assignedTemplates: UniteEntretienTemplate[];
  templates: EntretienTemplate[];
  templateItems: EntretienTemplateItem[];
  unitItems: UniteEntretienItem[];
  historique: EntretienHistorique[];
  autorisations: AutorisationRow[];
};

export default function DashboardAtelier() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [entretienFilter, setEntretienFilter] =
    useState<EntretienFilterKey>("jamais_fait");
  const [activeTab, setActiveTab] = useState<DashboardTab>("vue_generale");

  const [data, setData] = useState<DashboardData>({
    allBts: [],
    btOuverts: [],
    btAFacturer: [],
    stockBas: [],
    mecanosActifs: [],
    assignedTemplates: [],
    templates: [],
    templateItems: [],
    unitItems: [],
    historique: [],
    autorisations: [],
  });

  const [openTasks, setOpenTasks] = useState<UniteNoteRow[]>([]);
  const [btModalId, setBtModalId] = useState<string | null>(null);
  const [expandedSuiviGroups, setExpandedSuiviGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const [employeConnecte, setEmployeConnecte] =
    useState<EmployeGestionRow | null>(null);
  const [employesJobs, setEmployesJobs] = useState<EmployeGestionRow[]>([]);
  const [unitesJobs, setUnitesJobs] = useState<UniteJobRow[]>([]);
  const [jobsJour, setJobsJour] = useState<AtelierJobJour[]>([]);
  const [jobEmployeId, setJobEmployeId] = useState("");
  const [jobUniteId, setJobUniteId] = useState("");
  const [jobUniteSearch, setJobUniteSearch] = useState("");
  const [jobUniteMenuOpen, setJobUniteMenuOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobBusy, setJobBusy] = useState(false);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);

  const horsServiceTasks = useMemo(
    () => openTasks.filter((task) => task.suivi_type === "hors_service"),
    [openTasks],
  );

  const urgentTasks = useMemo(
    () => openTasks.filter((task) => task.suivi_type === "urgent"),
    [openTasks],
  );

  const planifierTasks = useMemo(
    () => openTasks.filter((task) => task.suivi_type === "a_planifier"),
    [openTasks],
  );

  const suiviTasksCount =
    horsServiceTasks.length + urgentTasks.length + planifierTasks.length;

  async function loadGestionContext() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setEmployeConnecte(null);
      setEmployesJobs([]);
      setUnitesJobs([]);
      setJobsJour([]);
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("employes")
      .select("id,auth_user_id,nom_complet,role,actif")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (meError) throw meError;

    const current = (me as EmployeGestionRow | null) ?? null;
    setEmployeConnecte(current);

    if ((current?.role || "").trim().toLowerCase() !== "gestion") {
      setEmployesJobs([]);
      setUnitesJobs([]);
      setJobsJour([]);
      if (activeTab === "jobs_jour") setActiveTab("vue_generale");
      return;
    }

    const [employesRes, unitesRes, jobsRes] = await Promise.all([
      supabase
        .from("employes")
        .select("id,auth_user_id,nom_complet,role,actif")
        .eq("actif", true)
        .order("nom_complet", { ascending: true }),
      supabase
        .from("unites")
        .select("id,no_unite,marque,modele,actif,client:clients!unites_client_id_fkey(nom)")
        .eq("actif", true)
        .order("no_unite", { ascending: true }),
      supabase
        .from("atelier_jobs_jour")
        .select(`
          id,
          employe_id,
          unite_id,
          description,
          ordre,
          created_at,
          completed_at,
          employes:employe_id (
            id,
            nom_complet
          ),
          unites:unite_id (
            id,
            no_unite,
            marque,
            modele
          )
        `)
        .is("completed_at", null)
        .order("employe_id", { ascending: true })
        .order("ordre", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (employesRes.error) throw employesRes.error;
    if (unitesRes.error) throw unitesRes.error;
    if (jobsRes.error) throw jobsRes.error;

    setEmployesJobs((employesRes.data || []) as EmployeGestionRow[]);
    setUnitesJobs((unitesRes.data || []) as UniteJobRow[]);
    setJobsJour((jobsRes.data || []) as unknown as AtelierJobJour[]);
  }

  async function ajouterJobJour() {
    const description = jobDescription.trim();
    if (!jobEmployeId || !description || jobBusy) return;

    setJobBusy(true);
    try {
      const sameEmployee = jobsJour.filter(
        (job) => job.employe_id === jobEmployeId && !job.completed_at,
      );
      const nextOrder =
        sameEmployee.reduce((max, job) => Math.max(max, Number(job.ordre || 0)), 0) + 1;

      const { error } = await supabase.from("atelier_jobs_jour").insert({
        employe_id: jobEmployeId,
        unite_id: jobUniteId || null,
        description,
        ordre: nextOrder,
        created_by: employeConnecte?.id || null,
      });

      if (error) throw error;

      setJobDescription("");
      setJobUniteId("");
      setJobUniteSearch("");
      setJobUniteMenuOpen(false);
      await loadGestionContext();
    } catch (err: any) {
      alert(err?.message ?? "Impossible d'ajouter la tâche.");
    } finally {
      setJobBusy(false);
    }
  }

  async function supprimerJobJour(jobId: string) {
    if (!confirm("Supprimer cette tâche ?")) return;

    setJobBusy(true);
    try {
      const { error } = await supabase
        .from("atelier_jobs_jour")
        .delete()
        .eq("id", jobId);

      if (error) throw error;
      await loadGestionContext();
    } catch (err: any) {
      alert(err?.message ?? "Impossible de supprimer la tâche.");
    } finally {
      setJobBusy(false);
    }
  }

  async function reorderEmployeeJobs(
    employeId: string,
    draggedId: string,
    targetId: string,
  ) {
    if (draggedId === targetId || jobBusy) return;

    const employeeJobs = jobsJour
      .filter((job) => job.employe_id === employeId && !job.completed_at)
      .sort((a, b) => Number(a.ordre) - Number(b.ordre));

    const fromIndex = employeeJobs.findIndex((job) => job.id === draggedId);
    const toIndex = employeeJobs.findIndex((job) => job.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...employeeJobs];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setJobsJour((current) => {
      const other = current.filter((job) => job.employe_id !== employeId);
      return [
        ...other,
        ...next.map((job, index) => ({ ...job, ordre: index + 1 })),
      ];
    });

    setJobBusy(true);
    try {
      for (let index = 0; index < next.length; index += 1) {
        const { error } = await supabase
          .from("atelier_jobs_jour")
          .update({ ordre: index + 1 })
          .eq("id", next[index].id);

        if (error) throw error;
      }
    } catch (err: any) {
      alert(err?.message ?? "Impossible de réordonner les tâches.");
      await loadGestionContext();
    } finally {
      setJobBusy(false);
      setDraggedJobId(null);
    }
  }

  async function loadDashboard(isRefresh = false) {
    try {
      setErrorMsg("");
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [
        btRes,
        stockRes,
        pointagesRes,
        assignedTemplatesRes,
        templatesRes,
        templateItemsRes,
        unitItemsRes,
        historiqueRes,
        openTasksRes,
        autorisationsRes,
      ] = await Promise.all([
        supabase
          .from("bons_travail")
          .select(
            `
            id,
            numero,
            unite_id,
            statut,
            verrouille,
            date_ouverture,
            date_fermeture,
            updated_at,
            client_nom,
            export_acomba_at,
            total_final,
            unites:unite_id (
              id,
              no_unite,
              marque,
              modele,
              km_actuel,
              actif
            )
          `,
          )
          .order("updated_at", { ascending: false })
          .limit(200),

        supabase
          .from("inventaire_items")
          .select(
            `
            id,
            nom,
            sku,
            quantite,
            seuil_alerte,
            unite,
            emplacement,
            actif
          `,
          )
          .eq("actif", true)
          .order("nom", { ascending: true })
          .limit(200),

        supabase
          .from("bt_pointages")
          .select(
            `
            id,
            mecano_nom,
            started_at,
            ended_at,
            actif,
            bons_travail:bt_id (
              id,
              numero,
              unites:unite_id (
                no_unite
              )
            )
          `,
          )
          .or("ended_at.is.null,actif.eq.true")
          .order("started_at", { ascending: false })
          .limit(50),

        supabase
          .from("unite_entretien_templates")
          .select(
            `
            id,
            unite_id,
            template_id,
            actif,
            unites:unite_id (
              id,
              no_unite,
              marque,
              modele,
              km_actuel,
              actif
            )
          `,
          )
          .eq("actif", true),

        supabase
          .from("entretien_templates")
          .select("id,nom,description,actif")
          .eq("actif", true),

        supabase
          .from("entretien_template_items")
          .select(
            "id,template_id,nom,description,periodicite_km,periodicite_jours,ordre,actif",
          )
          .eq("actif", true),

        supabase
          .from("unite_entretien_items")
          .select(
            `
            id,
            unite_id,
            titre,
            details,
            periodicite_km,
            periodicite_jours,
            nom,
            description,
            frequence_km,
            frequence_jours,
            ordre,
            actif,
            unites:unite_id (
              id,
              no_unite,
              marque,
              modele,
              km_actuel,
              actif
            )
          `,
          )
          .eq("actif", true),

        supabase
          .from("unite_entretien_historique")
          .select(
            `
            id,
            unite_id,
            template_item_id,
            unite_item_id,
            bt_id,
            km_log_id,
            nom_snapshot,
            frequence_km_snapshot,
            frequence_jours_snapshot,
            date_effectuee,
            km_effectue,
            note,
            created_at
          `,
          )
          .order("date_effectuee", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("unite_notes")
          .select(
            `
            id,
            unite_id,
            bt_source_id,
            titre,
            details,
            created_at,
            entretien_auto,
            suivi_type,
            unites:unite_id (
              id,
              no_unite,
              marque,
              modele
            )
          `,
          )
          .order("created_at", { ascending: true }),

        supabase
          .from("bt_autorisations")
          .select(
            `
            id,
            bt_id,
            statut,
            envoye_at,
            created_at,
            updated_at,
            bt_autorisation_taches (
              id,
              unite_note_id
            ),
            bons_travail:bt_id (
              id,
              numero,
              statut,
              verrouille,
              date_ouverture,
              date_fermeture,
              updated_at,
              client_nom,
              export_acomba_at,
              total_final,
              unites:unite_id (
                id,
                no_unite,
                marque,
                modele,
                km_actuel,
                actif
              )
            )
          `,
          )
          .order("updated_at", { ascending: false })
          .limit(500),
      ]);

      if (btRes.error)
        console.error("Dashboard bons_travail error:", btRes.error);
      if (stockRes.error)
        console.error("Dashboard inventaire_items error:", stockRes.error);
      if (pointagesRes.error)
        console.error("Dashboard bt_pointages error:", pointagesRes.error);
      if (assignedTemplatesRes.error)
        console.error(
          "Dashboard unite_entretien_templates error:",
          assignedTemplatesRes.error,
        );
      if (templatesRes.error)
        console.error(
          "Dashboard entretien_templates error:",
          templatesRes.error,
        );
      if (templateItemsRes.error)
        console.error(
          "Dashboard entretien_template_items error:",
          templateItemsRes.error,
        );
      if (unitItemsRes.error)
        console.error(
          "Dashboard unite_entretien_items error:",
          unitItemsRes.error,
        );
      if (historiqueRes.error)
        console.error(
          "Dashboard unite_entretien_historique error:",
          historiqueRes.error,
        );
      if (openTasksRes.error)
        console.error("Dashboard unite_notes error:", openTasksRes.error);
      if (autorisationsRes.error)
        console.error(
          "Dashboard bt_autorisations error:",
          autorisationsRes.error,
        );

      const btRows = (btRes.data ?? []) as BtRow[];
      const stockRows = (stockRes.data ?? []) as StockRow[];
      const pointageRows = (pointagesRes.data ?? []) as PointageRow[];
      const assignedTemplates = ((assignedTemplatesRes.data ??
        []) as UniteEntretienTemplate[]).filter(
          (row) => row.unites?.actif !== false,
        );
      const templates = (templatesRes.data ?? []) as EntretienTemplate[];
      const templateItems = (templateItemsRes.data ??
        []) as EntretienTemplateItem[];
      const unitItems = ((unitItemsRes.data ?? []) as UniteEntretienItem[]).filter(
        (row) => row.unites?.actif !== false,
      );
      const historique = (historiqueRes.data ?? []) as EntretienHistorique[];
      const openTasksRows = (openTasksRes.data ?? []) as UniteNoteRow[];

      const autorisations = (
        (autorisationsRes.data ?? []) as unknown as AutorisationRow[]
      ).map((a) => ({
        ...a,
        bons_travail: Array.isArray(a.bons_travail)
          ? (a.bons_travail[0] ?? null)
          : a.bons_travail,
      }));

      const normalize = (value: string | null | undefined) =>
        (value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();

      const btOuverts = btRows.filter((bt) => {
        const s = normalize(bt.statut);
        return (
          s === "a_faire" ||
          s === "a faire" ||
          s === "ouvert" ||
          s === "ouverte" ||
          s === "en_cours" ||
          s === "en cours"
        );
      });

      const btAFacturer = btRows.filter((bt) => {
        const s = normalize(bt.statut);
        return (
          (s === "a_facturer" || s === "a facturer" || s === "à facturer") &&
          !bt.export_acomba_at
        );
      });

      const mecanosMap = new Map<string, ActiveMecano>();

      for (const row of pointageRows) {
        const isActive = row.ended_at == null || row.actif === true;
        if (!isActive) continue;

        const nom = row.mecano_nom?.trim() || "Mécano";
        const key = `${nom}-${row.bons_travail?.id ?? row.id}`;

        if (!mecanosMap.has(key)) {
          mecanosMap.set(key, {
            id: key,
            nom,
            unite: row.bons_travail?.unites?.no_unite ?? null,
            btNumero: row.bons_travail?.numero ?? null,
          });
        }
      }

      const stockBas = stockRows
        .filter((item) => {
          const q = Number(item.quantite ?? 0);
          const seuil = Number(item.seuil_alerte ?? 0);
          return seuil > 0 && q <= seuil;
        })
        .sort(
          (a, b) =>
            Number(a.quantite ?? 0) - Number(b.quantite ?? 0) ||
            (a.nom ?? "").localeCompare(b.nom ?? "", "fr"),
        )
        .slice(0, 20);

      setData({
        allBts: btRows,
        btOuverts,
        btAFacturer,
        stockBas,
        mecanosActifs: Array.from(mecanosMap.values()),
        assignedTemplates,
        templates,
        templateItems,
        unitItems,
        historique,
        autorisations,
      });

      setOpenTasks(openTasksRows);

      if (
        btRes.error ||
        stockRes.error ||
        pointagesRes.error ||
        assignedTemplatesRes.error ||
        templatesRes.error ||
        templateItemsRes.error ||
        unitItemsRes.error ||
        historiqueRes.error ||
        openTasksRes.error ||
        autorisationsRes.error
      ) {
        setErrorMsg(
          "Certaines données n'ont pas pu être chargées. Vérifie la console pour le détail.",
        );
      }
    } catch (err: any) {
      console.error("Dashboard fatal error:", err);
      setErrorMsg(err?.message ?? "Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadDashboard(), loadGestionContext()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-autorisations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bt_autorisations" },
        () => loadDashboard(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bt_autorisation_taches" },
        () => loadDashboard(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bons_travail" },
        () => loadDashboard(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "unite_notes" },
        () => loadDashboard(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atelier_jobs_jour" },
        () => void loadGestionContext(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const entretiensComputed = useMemo<EntretienDashboardRow[]>(() => {
    const today = new Date();

    function fmtNumberLocal(v: number | null | undefined) {
      if (v == null || Number.isNaN(Number(v))) return "—";
      return Number(v).toLocaleString("fr-CA");
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

    const assignedSet = new Set(
      data.assignedTemplates.map((x) => x.template_id),
    );
    const templateMap = new Map(data.templates.map((t) => [t.id, t]));

    const uniteMap = new Map<string, EntretienDashboardRow["unite"]>();

    for (const assigned of data.assignedTemplates) {
      if (assigned.unites) uniteMap.set(assigned.unite_id, assigned.unites);
    }

    for (const unitItem of data.unitItems) {
      if (unitItem.unites) uniteMap.set(unitItem.unite_id, unitItem.unites);
    }

    const hByTemplateItemAndUnit = new Map<string, EntretienHistorique>();
    const hByUnitItem = new Map<string, EntretienHistorique>();

    for (const h of data.historique) {
      if (h.template_item_id && h.unite_id) {
        const key = `${h.template_item_id}::${h.unite_id}`;
        if (!hByTemplateItemAndUnit.has(key))
          hByTemplateItemAndUnit.set(key, h);
      }

      if (h.unite_item_id && !hByUnitItem.has(h.unite_item_id)) {
        hByUnitItem.set(h.unite_item_id, h);
      }
    }

    const fromTemplates: EntretienDashboardRow[] = data.templateItems
      .filter((it) => assignedSet.has(it.template_id))
      .flatMap((it) => {
        const unitLinks = data.assignedTemplates.filter(
          (x) => x.template_id === it.template_id,
        );

        return unitLinks.map((unitLink) => {
          const unite =
            uniteMap.get(unitLink.unite_id) ?? unitLink.unites ?? null;
          const histKey = `${it.id}::${unitLink.unite_id}`;
          const lastDone = hByTemplateItemAndUnit.get(histKey) ?? null;

          let overdue = false;
          let soon = false;

          if (
            it.periodicite_km != null &&
            lastDone?.km_effectue != null &&
            unite?.km_actuel != null
          ) {
            const nextKm =
              Number(lastDone.km_effectue) + Number(it.periodicite_km);
            const remainingKm = nextKm - Number(unite.km_actuel);
            if (remainingKm <= 0) overdue = true;
            else if (remainingKm <= 2500) soon = true;
          }

          if (it.periodicite_jours != null && lastDone?.date_effectuee) {
            const dueDate = addDays(
              lastDone.date_effectuee,
              Number(it.periodicite_jours),
            );
            if (dueDate) {
              const diffDays = daysBetween(today, dueDate);
              if (diffDays <= 0) overdue = true;
              else if (diffDays <= 30) soon = true;
            }
          }

          let statusKey: EntretienDashboardRow["statusKey"] = "ok";
          let statusLabel: EntretienDashboardRow["statusLabel"] = "OK";

          if (!lastDone) {
            statusKey = "jamais_fait";
            statusLabel = "Jamais fait";
          } else if (overdue) {
            statusKey = "en_retard";
            statusLabel = "En retard";
          } else if (soon) {
            statusKey = "a_prevoir";
            statusLabel = "À prévoir";
          }

          let prochainDuText = "—";

          if (!lastDone) {
            const parts: string[] = [];
            if (it.periodicite_km != null)
              parts.push(`${fmtNumberLocal(it.periodicite_km)} km`);
            if (it.periodicite_jours != null)
              parts.push(`${fmtNumberLocal(it.periodicite_jours)} jours`);
            prochainDuText = parts.length ? parts.join(" • ") : "—";
          } else {
            const parts: string[] = [];

            if (
              it.periodicite_km != null &&
              lastDone.km_effectue != null &&
              unite?.km_actuel != null
            ) {
              const nextKm =
                Number(lastDone.km_effectue) + Number(it.periodicite_km);
              const remainingKm = nextKm - Number(unite.km_actuel);
              parts.push(
                remainingKm <= 0 ? "0 km" : `${fmtNumberLocal(remainingKm)} km`,
              );
            } else if (it.periodicite_km != null) {
              parts.push(`${fmtNumberLocal(it.periodicite_km)} km`);
            }

            if (it.periodicite_jours != null && lastDone.date_effectuee) {
              const dueDate = addDays(
                lastDone.date_effectuee,
                Number(it.periodicite_jours),
              );
              if (dueDate) {
                const remainingDays = daysBetween(today, dueDate);
                parts.push(
                  remainingDays <= 0
                    ? "0 jour"
                    : `${fmtNumberLocal(remainingDays)} jours`,
                );
              }
            } else if (it.periodicite_jours != null) {
              parts.push(`${fmtNumberLocal(it.periodicite_jours)} jours`);
            }

            prochainDuText = parts.length ? parts.join(" • ") : "—";
          }

          return {
            id: `template-${it.id}-${unitLink.unite_id}`,
            sourceType: "template" as const,
            sourceId: it.id,
            unite_id: unitLink.unite_id,
            nom: it.nom,
            description: it.description,
            frequenceKm: it.periodicite_km,
            frequenceJours: it.periodicite_jours,
            templateNom: templateMap.get(it.template_id)?.nom ?? null,
            lastDone,
            unite,
            statusKey,
            statusLabel,
            prochainDuText,
          };
        });
      });

    const fromUnit: EntretienDashboardRow[] = data.unitItems.map((it) => {
      const lastDone = hByUnitItem.get(it.id) ?? null;
      const frequenceKm = it.frequence_km ?? it.periodicite_km ?? null;
      const frequenceJours = it.frequence_jours ?? it.periodicite_jours ?? null;

      let overdue = false;
      let soon = false;

      if (
        frequenceKm != null &&
        lastDone?.km_effectue != null &&
        it.unites?.km_actuel != null
      ) {
        const nextKm = Number(lastDone.km_effectue) + Number(frequenceKm);
        const remainingKm = nextKm - Number(it.unites.km_actuel);
        if (remainingKm <= 0) overdue = true;
        else if (remainingKm <= 2500) soon = true;
      }

      if (frequenceJours != null && lastDone?.date_effectuee) {
        const dueDate = addDays(
          lastDone.date_effectuee,
          Number(frequenceJours),
        );
        if (dueDate) {
          const diffDays = daysBetween(today, dueDate);
          if (diffDays <= 0) overdue = true;
          else if (diffDays <= 30) soon = true;
        }
      }

      let statusKey: EntretienDashboardRow["statusKey"] = "ok";
      let statusLabel: EntretienDashboardRow["statusLabel"] = "OK";

      if (!lastDone) {
        statusKey = "jamais_fait";
        statusLabel = "Jamais fait";
      } else if (overdue) {
        statusKey = "en_retard";
        statusLabel = "En retard";
      } else if (soon) {
        statusKey = "a_prevoir";
        statusLabel = "À prévoir";
      }

      let prochainDuText = "—";

      if (!lastDone) {
        const parts: string[] = [];
        if (frequenceKm != null)
          parts.push(`${fmtNumberLocal(frequenceKm)} km`);
        if (frequenceJours != null)
          parts.push(`${fmtNumberLocal(frequenceJours)} jours`);
        prochainDuText = parts.length ? parts.join(" • ") : "—";
      } else {
        const parts: string[] = [];

        if (
          frequenceKm != null &&
          lastDone.km_effectue != null &&
          it.unites?.km_actuel != null
        ) {
          const nextKm = Number(lastDone.km_effectue) + Number(frequenceKm);
          const remainingKm = nextKm - Number(it.unites.km_actuel);
          parts.push(
            remainingKm <= 0 ? "0 km" : `${fmtNumberLocal(remainingKm)} km`,
          );
        } else if (frequenceKm != null) {
          parts.push(`${fmtNumberLocal(frequenceKm)} km`);
        }

        if (frequenceJours != null && lastDone.date_effectuee) {
          const dueDate = addDays(
            lastDone.date_effectuee,
            Number(frequenceJours),
          );
          if (dueDate) {
            const remainingDays = daysBetween(today, dueDate);
            parts.push(
              remainingDays <= 0
                ? "0 jour"
                : `${fmtNumberLocal(remainingDays)} jours`,
            );
          }
        } else if (frequenceJours != null) {
          parts.push(`${fmtNumberLocal(frequenceJours)} jours`);
        }

        prochainDuText = parts.length ? parts.join(" • ") : "—";
      }

      return {
        id: `unite-${it.id}`,
        sourceType: "unite" as const,
        sourceId: it.id,
        unite_id: it.unite_id,
        nom: it.nom || it.titre || "Entretien",
        description: it.description || it.details || null,
        frequenceKm,
        frequenceJours,
        templateNom: null,
        lastDone,
        unite: it.unites ?? null,
        statusKey,
        statusLabel,
        prochainDuText,
      };
    });

    return [...fromTemplates, ...fromUnit].sort((a, b) => {
      const rank = (x: EntretienDashboardRow) => {
        if (x.statusKey === "jamais_fait") return 0;
        if (x.statusKey === "en_retard") return 1;
        if (x.statusKey === "a_prevoir") return 2;
        return 3;
      };

      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;

      return a.nom.localeCompare(b.nom, "fr-CA");
    });
  }, [
    data.assignedTemplates,
    data.templates,
    data.templateItems,
    data.unitItems,
    data.historique,
  ]);

  const entretiensFiltered = useMemo(() => {
    const visibles = entretiensComputed.filter(
      (item) => item.statusKey !== "ok",
    );
    if (entretienFilter === "tous") return visibles;
    return visibles.filter((item) => item.statusKey === entretienFilter);
  }, [entretiensComputed, entretienFilter]);

  const tasksByUnit = useMemo<TacheOuverteParUnite[]>(() => {
    const map = new Map<string, TacheOuverteParUnite>();

    for (const task of openTasks) {
      const uniteId = task.unite_id;
      const uniteNo = task.unites?.no_unite ?? "—";
      const uniteLabel =
        [task.unites?.marque, task.unites?.modele].filter(Boolean).join(" ") ||
        "—";

      if (!map.has(uniteId)) {
        map.set(uniteId, {
          unite_id: uniteId,
          unite_no: uniteNo,
          unite_label: uniteLabel,
          taches: [],
          total: 0,
          entretienAutoCount: 0,
          oldestCreatedAt: task.created_at ?? null,
        });
      }

      const group = map.get(uniteId)!;
      group.taches.push(task);
      group.total += 1;

      if (task.entretien_auto) group.entretienAutoCount += 1;

      if (
        task.created_at &&
        (!group.oldestCreatedAt || task.created_at < group.oldestCreatedAt)
      ) {
        group.oldestCreatedAt = task.created_at;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.entretienAutoCount !== a.entretienAutoCount)
        return b.entretienAutoCount - a.entretienAutoCount;
      return (a.oldestCreatedAt || "").localeCompare(b.oldestCreatedAt || "");
    });
  }, [openTasks]);

  const autorisationsDashboard = useMemo<AutorisationBtRow[]>(() => {
    const normalize = (value: string | null | undefined) =>
      (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const isClosedBt = (bt?: BtRow | null) => {
      if (!bt) return true;
      const s = normalize(bt.statut);
      return Boolean(
        bt.date_fermeture ||
        s === "ferme" ||
        s === "fermé" ||
        s === "facture" ||
        s === "facturé" ||
        s === "a_facturer" ||
        s === "a facturer" ||
        s === "à facturer",
      );
    };

    const getAuthDate = (auth: AutorisationRow, hasResponse: boolean) => {
      if (hasResponse)
        return auth.updated_at || auth.created_at || auth.envoye_at || null;
      return auth.envoye_at || auth.created_at || auth.updated_at || null;
    };

    type InternalRow = AutorisationBtRow & {
      taskIds: Set<string>;
      latestStatus: string;
      latestHasResponse: boolean;
    };

    const map = new Map<string, InternalRow>();

    for (const auth of data.autorisations) {
      const bt = auth.bons_travail;
      if (!bt?.id) continue;
      if (isClosedBt(bt)) continue;

      const statut = normalize(auth.statut);
      const isPending = !statut || statut === "envoyee" || statut === "envoye";
      const hasResponse = !isPending;

      const isRefused =
        statut === "refusee" ||
        statut === "refusée" ||
        statut === "refuse" ||
        statut === "refusé";
      const isApproved =
        statut === "approuvee" ||
        statut === "approuvée" ||
        statut === "approuve" ||
        statut === "approuvé" ||
        statut === "autorisee" ||
        statut === "autorisée" ||
        statut === "autorise" ||
        statut === "autorisé";
      const isPartial = statut === "reponse_partielle";
      const isDiscuss = statut === "a_discuter";
      const isDone =
        statut === "effectuee" ||
        statut === "effectuée" ||
        statut === "effectue" ||
        statut === "effectué" ||
        statut === "terminee" ||
        statut === "terminée" ||
        statut === "termine" ||
        statut === "terminé";

      if (!map.has(bt.id)) {
        map.set(bt.id, {
          bt,
          total: 0,
          pending: 0,
          refused: 0,
          approved: 0,
          done: 0,
          lastDate: null,
          statusLabel: "En attente client",
          statusStyle: styles.badgeWarning,
          taskIds: new Set<string>(),
          latestStatus: statut,
          latestHasResponse: hasResponse,
        });
      }

      const row = map.get(bt.id)!;
      const tasks = auth.bt_autorisation_taches ?? [];

      for (const task of tasks) {
        if (task.unite_note_id) row.taskIds.add(task.unite_note_id);
      }

      if (isPending) row.pending += 1;
      if (isRefused || isDiscuss) row.refused += 1;
      if (isApproved) row.approved += 1;
      if (isPartial) {
        row.refused += 1;
        row.approved += 1;
      }
      if (isDone) row.done += 1;

      const d = getAuthDate(auth, hasResponse);
      if (d && (!row.lastDate || d > row.lastDate)) {
        row.lastDate = d;
        row.latestStatus = statut;
        row.latestHasResponse = hasResponse;
      }
    }

    return (
      Array.from(map.values())
        .map((row) => {
          row.total = row.taskIds.size;
          if (row.total <= 0) return null;

          const latest = row.latestStatus;

          if (!row.latestHasResponse) {
            row.statusLabel = "En attente client";
            row.statusStyle = styles.badgeWarning;
          } else if (latest === "a_discuter") {
            row.statusLabel = "À discuter";
            row.statusStyle = styles.badgeWarning;
          } else if (latest === "reponse_partielle") {
            row.statusLabel = "Réponse partielle";
            row.statusStyle = styles.badgeInfo;
          } else if (
            latest === "refusee" ||
            latest === "refusée" ||
            latest === "refuse" ||
            latest === "refusé"
          ) {
            row.statusLabel = "Refusé";
            row.statusStyle = styles.badgeDanger;
          } else if (
            latest === "approuvee" ||
            latest === "approuvée" ||
            latest === "approuve" ||
            latest === "approuvé" ||
            latest === "autorisee" ||
            latest === "autorisée" ||
            latest === "autorise" ||
            latest === "autorisé"
          ) {
            row.statusLabel = "Autorisé";
            row.statusStyle = styles.badgeSuccess;
          } else {
            row.statusLabel = "Réponse reçue";
            row.statusStyle = styles.badgeInfo;
          }

          return row;
        })
        .filter(Boolean) as AutorisationBtRow[]
    ).sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
  }, [data.autorisations]);

  const autorisationsEnAttenteCount = useMemo(
    () =>
      autorisationsDashboard.filter(
        (row) => row.statusLabel === "En attente client",
      ).length,
    [autorisationsDashboard],
  );

  const stats = useMemo(
    () => ({
      suivis: suiviTasksCount,
      horsService: horsServiceTasks.length,
      urgent: urgentTasks.length,
      aPlanifier: planifierTasks.length,
      autorisations: autorisationsEnAttenteCount,
      btAFacturer: data.btAFacturer.length,
      entretiensAVenir: entretiensComputed.filter(
        (x) =>
          x.statusKey === "jamais_fait" ||
          x.statusKey === "en_retard" ||
          x.statusKey === "a_prevoir",
      ).length,
      mecanosActifs: data.mecanosActifs.length,
    }),
    [
      suiviTasksCount,
      horsServiceTasks.length,
      urgentTasks.length,
      planifierTasks.length,
      autorisationsEnAttenteCount,
      data.btAFacturer.length,
      data.mecanosActifs.length,
      entretiensComputed,
    ],
  );

  function goTo(path: string) {
    window.location.href = path;
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-CA");
  }

  function formatMoney(value?: number | null) {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(Number(value ?? 0));
  }

  function formatNumber(value?: number | null) {
    return new Intl.NumberFormat("fr-CA").format(Number(value ?? 0));
  }

  function getEntretienBadge(statusKey: EntretienDashboardRow["statusKey"]) {
    if (statusKey === "jamais_fait")
      return { label: "Jamais fait", style: styles.badgeWarning };
    if (statusKey === "en_retard")
      return { label: "En retard", style: styles.badgeDanger };
    if (statusKey === "a_prevoir")
      return { label: "À prévoir", style: styles.badgeInfo };
    return { label: "OK", style: styles.badgeSuccess };
  }

  function getFrequenceText(item: EntretienDashboardRow) {
    const parts: string[] = [];
    if (item.frequenceKm != null)
      parts.push(`${formatNumber(item.frequenceKm)} km`);
    if (item.frequenceJours != null)
      parts.push(`${formatNumber(item.frequenceJours)} jours`);
    return parts.length ? parts.join(" ou ") : "—";
  }

  function getBtForTask(task: UniteNoteRow) {
    const btSourceId = String(task.bt_source_id || "").trim();

    if (btSourceId) {
      return (
        data.allBts.find((bt) => bt.id === btSourceId) ||
        data.btOuverts.find((bt) => bt.id === btSourceId) ||
        data.btAFacturer.find((bt) => bt.id === btSourceId) ||
        ({ id: btSourceId, numero: "BT" } as BtRow)
      );
    }

    return (
      data.btOuverts.find(
        (bt) =>
          bt.unite_id === task.unite_id || bt.unites?.id === task.unite_id,
      ) ||
      data.allBts.find(
        (bt) =>
          bt.unite_id === task.unite_id || bt.unites?.id === task.unite_id,
      ) ||
      null
    );
  }

  function openBtModalFromTask(task: UniteNoteRow) {
    const bt = getBtForTask(task);

    if (!bt?.id) {
      alert("Aucun BT lié à cette tâche. Ouvre l'unité ou le BT manuellement.");
      return;
    }

    setBtModalId(bt.id);
  }

  function groupSuiviTasksByUnit(tasks: UniteNoteRow[]) {
    const groups = new Map<string, UniteNoteRow[]>();

    for (const task of tasks) {
      const key = task.unite_id || task.unites?.id || task.id;
      const current = groups.get(key) ?? [];
      current.push(task);
      groups.set(key, current);
    }

    return Array.from(groups.entries()).map(([uniteId, groupedTasks]) => ({
      uniteId,
      tasks: groupedTasks,
    }));
  }

  function toggleSuiviGroup(groupKey: string) {
    setExpandedSuiviGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function renderSuiviGroup(
    tasks: UniteNoteRow[],
    groupType: SuiviTacheType,
    badgeLabel: string,
    badgeStyle: CSSProperties,
  ) {
    const firstTask = tasks[0];
    if (!firstTask) return null;

    const groupKey = `${groupType}:${firstTask.unite_id || firstTask.unites?.id || firstTask.id}`;
    const isExpanded = expandedSuiviGroups.has(groupKey);
    const visibleTasks = isExpanded ? tasks : tasks.slice(0, 1);
    const hiddenCount = Math.max(0, tasks.length - 1);

    return (
      <div key={groupKey} style={styles.suiviTaskGroup}>
        <div style={styles.suiviTaskGroupHeader}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={styles.rowTitle}>
              Unité {firstTask.unites?.no_unite ?? "—"}
            </div>
            <div style={styles.rowSub}>
              {[firstTask.unites?.marque, firstTask.unites?.modele]
                .filter(Boolean)
                .join(" ") || "—"}
            </div>
          </div>
          <span style={{ ...styles.badge, ...badgeStyle }}>{badgeLabel}</span>
        </div>

        <div style={styles.suiviTaskItems}>
          {visibleTasks.map((task, index) => {
            const linkedBt = getBtForTask(task);
            const canOpenBt = Boolean(linkedBt?.id);
            const btLabel = linkedBt?.numero ? `${linkedBt.numero} — ` : "";

            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                style={{
                  ...styles.suiviTaskInnerRow,
                  ...(index > 0 ? styles.suiviTaskInnerRowDivider : {}),
                  cursor: canOpenBt ? "pointer" : "default",
                }}
                title={
                  canOpenBt
                    ? "Double-cliquer pour ouvrir le bon de travail"
                    : "Aucun BT lié à cette tâche"
                }
                onDoubleClick={() => openBtModalFromTask(task)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openBtModalFromTask(task);
                }}
              >
                <div style={styles.rowTitle}>
                  {btLabel}
                  {task.titre}
                </div>
                <div style={styles.rowMeta}>
                  <span>Créé le : {formatDate(task.created_at)}</span>
                  {task.details ? (
                    <>
                      <span style={styles.metaDivider}>•</span>
                      <span>{task.details}</span>
                    </>
                  ) : null}
                  {canOpenBt ? (
                    <>
                      <span style={styles.metaDivider}>•</span>
                      <span style={styles.doubleClickHint}>
                        Double-cliquer pour ouvrir le BT
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {hiddenCount > 0 ? (
          <button
            type="button"
            style={styles.suiviSeeMoreBtn}
            onClick={() => toggleSuiviGroup(groupKey)}
          >
            {isExpanded
              ? "Voir moins"
              : `Voir plus (${hiddenCount} autre${hiddenCount > 1 ? "s" : ""})`}
          </button>
        ) : null}
      </div>
    );
  }

  const isGestion =
    (employeConnecte?.role || "").trim().toLowerCase() === "gestion";

  const jobsByEmployee = useMemo(() => {
    return employesJobs
      .map((employe) => ({
        employe,
        jobs: jobsJour
          .filter((job) => job.employe_id === employe.id && !job.completed_at)
          .sort((a, b) => Number(a.ordre) - Number(b.ordre)),
      }))
      .filter((group) => group.jobs.length > 0);
  }, [employesJobs, jobsJour]);

  function getJobUniteClientNom(unite: UniteJobRow) {
    const client = unite.client;
    if (Array.isArray(client)) return client[0]?.nom || "";
    return client?.nom || "";
  }

  const filteredJobUnites = useMemo(() => {
    const q = jobUniteSearch.trim().toLowerCase();

    if (!q) return unitesJobs.slice(0, 30);

    return unitesJobs
      .filter((u) => {
        const haystack = [
          u.no_unite,
          u.marque,
          u.modele,
          getJobUniteClientNom(u),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice(0, 30);
  }, [unitesJobs, jobUniteSearch]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Tableau de bord Atelier</h1>
            <p style={styles.subtitle}>
              Gérer efficacement la journée, prioriser les BT et anticiper les
              entretiens
            </p>
          </div>
        </div>
        <div style={styles.loadingCard}>Chargement du tableau de bord…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Tableau de bord Atelier</h1>
          <p style={styles.subtitle}>
            Gérer efficacement la journée, prioriser les BT et anticiper les
            entretiens
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            {refreshing ? "Actualisation..." : "Actualiser"}
          </button>

          <button
            type="button"
            style={styles.btnPrimary}
            onClick={() => goTo("/bt")}
          >
            Ouvrir les BT
          </button>
        </div>
      </div>

      <div style={styles.tabsBar}>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === "vue_generale" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("vue_generale")}
        >
          Vue générale
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === "entretiens" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("entretiens")}
        >
          Entretien à venir
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === "suivis" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("suivis")}
        >
          Suivis ({suiviTasksCount})
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === "taches_ouvertes" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("taches_ouvertes")}
        >
          Tâches ouvertes
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === "stock_bas" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("stock_bas")}
        >
          Stock bas
        </button>

        {isGestion ? (
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              ...(activeTab === "jobs_jour" ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab("jobs_jour")}
          >
            Jobs du jour
          </button>
        ) : null}
      </div>

      {errorMsg ? <div style={styles.errorBox}>{errorMsg}</div> : null}

      {activeTab === "vue_generale" && (
        <>
          <div style={styles.summarySplit}>
            <div style={styles.summaryPanel}>
              <div style={styles.summaryPanelTitle}>
                Véhicules / Tâches critiques
              </div>
              <div style={styles.summaryCardsThree}>
                <StatCard
                  label="Hors service"
                  value={stats.horsService}
                  tone="red"
                  onClick={() => setActiveTab("suivis")}
                />
                <StatCard
                  label="Urgent"
                  value={stats.urgent}
                  tone="orange"
                  onClick={() => setActiveTab("suivis")}
                />
                <StatCard
                  label="À planifier"
                  value={stats.aPlanifier}
                  tone="blue"
                  onClick={() => setActiveTab("suivis")}
                />
              </div>
            </div>

            <div style={styles.summaryPanel}>
              <div style={styles.summaryPanelTitle}>📊 Opérations</div>
              <div style={styles.summaryCardsFour}>
                <StatCard
                  label="Autorisations"
                  value={stats.autorisations}
                  tone="orange"
                  onClick={() => goTo("/bt")}
                />
                <StatCard
                  label="BT à facturer"
                  value={stats.btAFacturer}
                  tone="green"
                  onClick={() => goTo("/facturation")}
                />
                <StatCard
                  label="Entretiens à venir"
                  value={stats.entretiensAVenir}
                  tone="orange"
                  onClick={() => setActiveTab("entretiens")}
                />
                <StatCard
                  label="Mécanos actifs"
                  value={stats.mecanosActifs}
                  tone="purple"
                  onClick={() => goTo("/operation-temps-reel")}
                />
              </div>
            </div>
          </div>

          <div style={styles.gridTwo}>
            <SectionCard
              title="BT à facturer"
              subtitle="BT fermés non encore exportés"
              actionLabel="Voir tout"
              onAction={() => goTo("/facturation")}
              scrollable
            >
              {data.btAFacturer.length === 0 ? (
                <EmptyState text="Aucun BT à facturer pour le moment." />
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>BT</th>
                        <th style={styles.th}>Unité</th>
                        <th style={styles.th}>Client</th>
                        <th style={styles.th}>Fermé le</th>
                        <th style={styles.thRight}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.btAFacturer.map((bt) => (
                        <tr key={bt.id}>
                          <td style={styles.tdStrong}>{bt.numero ?? "—"}</td>
                          <td style={styles.td}>
                            {bt.unites?.no_unite ?? "—"}
                          </td>
                          <td style={styles.td}>{bt.client_nom ?? "—"}</td>
                          <td style={styles.td}>
                            {formatDate(bt.date_fermeture ?? bt.updated_at)}
                          </td>
                          <td style={styles.tdRight}>
                            {formatMoney(bt.total_final)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Mécanos actifs"
              subtitle="Vue opérationnelle en temps réel"
              actionLabel="Temps réel"
              onAction={() => goTo("/operation-temps-reel")}
              scrollable
            >
              {data.mecanosActifs.length === 0 ? (
                <EmptyState text="Aucun mécano actif détecté." />
              ) : (
                <div style={styles.listStack}>
                  {data.mecanosActifs.map((m) => (
                    <div key={m.id} style={styles.listRow}>
                      <div>
                        <div style={styles.rowTitle}>{m.nom}</div>
                        <div style={styles.rowSub}>
                          {m.unite ? `Unité ${m.unite}` : "Aucune unité"}
                          {m.btNumero ? ` • BT ${m.btNumero}` : ""}
                        </div>
                      </div>
                      <span style={{ ...styles.badge, ...styles.badgeSuccess }}>
                        Actif
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div style={styles.gridTwo}>
            <SectionCard
              title="Entretiens à venir"
              subtitle="Filtrer rapidement les entretiens critiques, à prévoir ou jamais faits"
              actionLabel="Voir tout"
              onAction={() => setActiveTab("entretiens")}
              scrollable
            >
              <EntretienFilterBar
                entretienFilter={entretienFilter}
                setEntretienFilter={setEntretienFilter}
                entretiensComputed={entretiensComputed}
              />
              <EntretienList
                items={entretiensFiltered}
                getEntretienBadge={getEntretienBadge}
                getFrequenceText={getFrequenceText}
                formatDate={formatDate}
                formatNumber={formatNumber}
              />
            </SectionCard>

            <SectionCard
              title="Autorisations en attente"
              subtitle="BT ouverts qui attendent une réponse ou une action"
              actionLabel="Voir BT"
              onAction={() => goTo("/bt")}
              scrollable
            >
              {autorisationsDashboard.length === 0 ? (
                <EmptyState text="Aucune autorisation en attente." />
              ) : (
                <div style={styles.listStack}>
                  {autorisationsDashboard.map((row) => (
                    <div key={row.bt.id} style={styles.listRow}>
                      <div>
                        <div style={styles.rowTitle}>
                          {row.bt.numero ?? "BT"} — Unité{" "}
                          {row.bt.unites?.no_unite ?? "—"}
                        </div>
                        <div style={styles.rowSub}>
                          {row.bt.client_nom ?? "Sans client"}
                        </div>
                        <div style={styles.rowMeta}>
                          <span>Demandé le : {formatDate(row.lastDate)}</span>
                          <span style={styles.metaDivider}>•</span>
                          <span>
                            {row.total} tâche{row.total > 1 ? "s" : ""} touchée
                          </span>
                        </div>
                      </div>
                      <span style={{ ...styles.badge, ...row.statusStyle }}>
                        {row.statusLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div style={styles.gridOne}>
            <SectionCard
              title="Stock bas"
              subtitle="Pièces sous le seuil d’alerte"
              actionLabel="Voir tout"
              onAction={() => setActiveTab("stock_bas")}
              scrollable
            >
              <StockTable
                stockBas={data.stockBas}
                formatNumber={formatNumber}
              />
            </SectionCard>
          </div>
        </>
      )}

      {activeTab === "entretiens" && (
        <SectionCard
          title="Entretien à venir"
          subtitle="Vue complète des entretiens à traiter"
          actionLabel="Voir unités"
          onAction={() => goTo("/unites")}
          scrollable
        >
          <EntretienFilterBar
            entretienFilter={entretienFilter}
            setEntretienFilter={setEntretienFilter}
            entretiensComputed={entretiensComputed}
          />
          <EntretienList
            items={entretiensFiltered}
            getEntretienBadge={getEntretienBadge}
            getFrequenceText={getFrequenceText}
            formatDate={formatDate}
            formatNumber={formatNumber}
          />
        </SectionCard>
      )}

      {activeTab === "suivis" && (
        <div style={styles.suiviColumns}>
          <SectionCard
            title="🔴 Hors service"
            subtitle="Unités à ne pas sortir"
            scrollable
          >
            {horsServiceTasks.length === 0 ? (
              <EmptyState text="Aucune tâche hors service." />
            ) : (
              <div style={styles.listStack}>
                {groupSuiviTasksByUnit(horsServiceTasks).map((group) =>
                  renderSuiviGroup(
                    group.tasks,
                    "hors_service",
                    "Hors service",
                    styles.badgeDanger,
                  ),
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="🟠 Urgent"
            subtitle="À traiter rapidement"
            scrollable
          >
            {urgentTasks.length === 0 ? (
              <EmptyState text="Aucune tâche urgente." />
            ) : (
              <div style={styles.listStack}>
                {groupSuiviTasksByUnit(urgentTasks).map((group) =>
                  renderSuiviGroup(
                    group.tasks,
                    "urgent",
                    "Urgent",
                    styles.badgeWarning,
                  ),
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="🔵 À planifier"
            subtitle="Rendez-vous, garantie ou suivi administratif"
            scrollable
          >
            {planifierTasks.length === 0 ? (
              <EmptyState text="Aucune tâche à planifier." />
            ) : (
              <div style={styles.listStack}>
                {groupSuiviTasksByUnit(planifierTasks).map((group) =>
                  renderSuiviGroup(
                    group.tasks,
                    "a_planifier",
                    "À planifier",
                    styles.badgeInfo,
                  ),
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === "taches_ouvertes" && (
        <SectionCard
          title="Tâches ouvertes"
          subtitle="Toutes les tâches ouvertes classées par unité"
          actionLabel="Voir BT"
          onAction={() => goTo("/bt")}
          scrollable
        >
          {tasksByUnit.length === 0 ? (
            <EmptyState text="Aucune tâche ouverte." />
          ) : (
            <div style={styles.listStack}>
              {tasksByUnit.map((group) => (
                <div key={group.unite_id} style={styles.listRow}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={styles.rowTitle}>
                      {group.unite_no} — {group.unite_label}
                    </div>
                    <div style={styles.rowSub}>
                      {group.total} tâche{group.total > 1 ? "s" : ""}
                      {group.entretienAutoCount > 0
                        ? ` • ${group.entretienAutoCount} entretien auto`
                        : ""}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {group.taches.map((task) => {
                        const suiviLabel =
                          task.suivi_type === "hors_service"
                            ? "Hors service"
                            : task.suivi_type === "urgent"
                              ? "Urgent"
                              : task.suivi_type === "a_planifier"
                                ? "À planifier"
                                : null;
                        const suiviStyle =
                          task.suivi_type === "hors_service"
                            ? styles.badgeDanger
                            : task.suivi_type === "urgent"
                              ? styles.badgeWarning
                              : task.suivi_type === "a_planifier"
                                ? styles.badgeInfo
                                : null;

                        return (
                          <div
                            key={task.id}
                            style={{ ...styles.rowMeta, marginTop: 4 }}
                          >
                            <span>• {task.titre}</span>
                            {suiviLabel && suiviStyle ? (
                              <span
                                style={{ ...styles.miniBadge, ...suiviStyle }}
                              >
                                {suiviLabel}
                              </span>
                            ) : null}
                            {task.created_at ? (
                              <>
                                <span style={styles.metaDivider}>•</span>
                                <span>{formatDate(task.created_at)}</span>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <span style={{ ...styles.badge, ...styles.badgeInfo }}>
                    {group.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "stock_bas" && (
        <SectionCard
          title="Stock bas"
          subtitle="Vue complète des pièces sous le seuil d’alerte"
          actionLabel="Inventaire"
          onAction={() => goTo("/inventaire")}
          scrollable
        >
          <StockTable stockBas={data.stockBas} formatNumber={formatNumber} />
        </SectionCard>
      )}

      {activeTab === "jobs_jour" && isGestion && (
        <div style={styles.jobsLayout}>
          <SectionCard
            title="Ajouter une job"
            subtitle="La tâche apparaîtra seulement à l'employé sélectionné"
            overflowVisible
          >
            <div style={styles.jobsForm}>
              <div>
                <div style={styles.jobsFieldLabel}>Employé</div>
                <select
                  style={styles.jobsInput}
                  value={jobEmployeId}
                  onChange={(e) => setJobEmployeId(e.target.value)}
                  disabled={jobBusy}
                >
                  <option value="">Sélectionner</option>
                  {employesJobs.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nom_complet}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ position: "relative" }}>
                <div style={styles.jobsFieldLabel}>Unité</div>

                <input
                  style={styles.jobsInput}
                  value={jobUniteSearch}
                  onFocus={() => setJobUniteMenuOpen(true)}
                  onChange={(e) => {
                    setJobUniteSearch(e.target.value);
                    setJobUniteId("");
                    setJobUniteMenuOpen(true);
                  }}
                  placeholder="Unité, client, marque ou modèle"
                  autoComplete="off"
                  disabled={jobBusy}
                />

                {jobUniteMenuOpen ? (
                  <div style={styles.jobsUnitDropdown}>
                    <button
                      type="button"
                      style={styles.jobsUnitOption}
                      onClick={() => {
                        setJobUniteId("");
                        setJobUniteSearch("");
                        setJobUniteMenuOpen(false);
                      }}
                    >
                      <div style={styles.jobsUnitOptionMain}>Sans unité</div>
                      <div style={styles.jobsUnitOptionSub}>Tâche générale d’atelier</div>
                    </button>

                    {filteredJobUnites.length === 0 ? (
                      <div style={styles.jobsUnitEmpty}>Aucune unité trouvée.</div>
                    ) : (
                      filteredJobUnites.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          style={{
                            ...styles.jobsUnitOption,
                            ...(jobUniteId === u.id ? styles.jobsUnitOptionSelected : {}),
                          }}
                          onClick={() => {
                            setJobUniteId(u.id);
                            setJobUniteSearch(
                              `${u.no_unite || "—"} — ${[u.marque, u.modele]
                                .filter(Boolean)
                                .join(" ")}${
                                  getJobUniteClientNom(u)
                                    ? ` • ${getJobUniteClientNom(u)}`
                                    : ""
                                }`.trim(),
                            );
                            setJobUniteMenuOpen(false);
                          }}
                        >
                          <div style={styles.jobsUnitOptionMain}>{u.no_unite || "—"}</div>
                          <div style={styles.jobsUnitOptionSub}>
                            {[u.marque, u.modele].filter(Boolean).join(" ") || "—"}
                            {getJobUniteClientNom(u)
                              ? ` • Client : ${getJobUniteClientNom(u)}`
                              : ""}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={styles.jobsFieldLabel}>Tâche</div>
                <div style={styles.jobsDescriptionRow}>
                  <input
                    style={styles.jobsInput}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Ex. Changer les pneus avant"
                    disabled={jobBusy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void ajouterJobJour();
                    }}
                  />
                  <button
                    type="button"
                    style={styles.btnPrimary}
                    onClick={() => void ajouterJobJour()}
                    disabled={jobBusy || !jobEmployeId || !jobDescription.trim()}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Ordre de travail"
            subtitle="Glisse-dépose les tâches pour modifier l'ordre de chaque employé"
          >
            {jobsByEmployee.length === 0 ? (
              <EmptyState text="Aucune tâche active." />
            ) : (
              <div style={styles.jobsEmployeeStack}>
                {jobsByEmployee.map(({ employe, jobs }) => (
                  <div key={employe.id} style={styles.jobsEmployeeCard}>
                    <div style={styles.jobsEmployeeHeader}>
                      <div style={styles.rowTitle}>{employe.nom_complet}</div>
                      <span style={{ ...styles.badge, ...styles.badgeInfo }}>
                        {jobs.length}
                      </span>
                    </div>

                    <div>
                      {jobs.map((job, index) => (
                        <div
                          key={job.id}
                          draggable={!jobBusy}
                          onDragStart={() => setDraggedJobId(job.id)}
                          onDragEnd={() => setDraggedJobId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedJobId) {
                              void reorderEmployeeJobs(
                                employe.id,
                                draggedJobId,
                                job.id,
                              );
                            }
                          }}
                          style={{
                            ...styles.jobsDragRow,
                            ...(draggedJobId === job.id
                              ? styles.jobsDragRowActive
                              : {}),
                          }}
                        >
                          <div style={styles.jobsHandle}>☰</div>
                          <div style={styles.jobsOrderNumber}>{index + 1}</div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={styles.rowTitle}>
                              {job.unites?.no_unite
                                ? `${job.unites.no_unite} — `
                                : ""}
                              {job.description}
                            </div>
                            <div style={styles.rowSub}>
                              {job.unites
                                ? [job.unites.marque, job.unites.modele]
                                    .filter(Boolean)
                                    .join(" ") || "Unité liée"
                                : "Sans unité"}
                            </div>
                          </div>
                          <button
                            type="button"
                            style={styles.jobsDeleteBtn}
                            onClick={() => void supprimerJobJour(job.id)}
                            disabled={jobBusy}
                          >
                            Supprimer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {btModalId && (
        <div style={styles.modalBackdrop} onClick={() => setBtModalId(null)}>
          <div style={styles.btModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.btModalHeader}>
              <div>
                <div style={styles.btModalTitle}>Bon de travail</div>
                <div style={styles.btModalSub}>
                  Ouvert depuis l’onglet Suivis
                </div>
              </div>
              <div style={styles.rowActions}>
                <button
                  type="button"
                  style={styles.btnGhost}
                  onClick={() => goTo(`/bt/${btModalId}`)}
                >
                  Ouvrir pleine page
                </button>
                <button
                  type="button"
                  style={styles.iconCloseBtn}
                  onClick={() => setBtModalId(null)}
                >
                  ×
                </button>
              </div>
            </div>

            <iframe
              src={`/bt/${btModalId}`}
              title="Bon de travail"
              onLoad={(e) => {
                try {
                  const doc = e.currentTarget.contentDocument;
                  if (!doc) return;

                  const style = doc.createElement("style");
                  style.innerHTML = `
                    aside,
                    nav,
                    .sidebar,
                    [data-sidebar],
                    .app-sidebar,
                    [class*="Sidebar"],
                    [class*="sidebar"] {
                      display: none !important;
                    }

                    main,
                    .main,
                    .content,
                    .app-content,
                    [class*="Content"],
                    [class*="content"] {
                      margin-left: 0 !important;
                      width: 100% !important;
                      max-width: none !important;
                    }

                    body {
                      overflow-x: hidden !important;
                    }
                  `;
                  doc.head.appendChild(style);
                } catch {}
              }}
              style={styles.btModalFrame}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EntretienFilterBar({
  entretienFilter,
  setEntretienFilter,
  entretiensComputed,
}: {
  entretienFilter: EntretienFilterKey;
  setEntretienFilter: (value: EntretienFilterKey) => void;
  entretiensComputed: EntretienDashboardRow[];
}) {
  return (
    <div style={styles.filterBar}>
      <FilterChip
        label={`Tous (${entretiensComputed.filter((x) => x.statusKey !== "ok").length})`}
        active={entretienFilter === "tous"}
        onClick={() => setEntretienFilter("tous")}
      />
      <FilterChip
        label={`Jamais fait (${entretiensComputed.filter((x) => x.statusKey === "jamais_fait").length})`}
        active={entretienFilter === "jamais_fait"}
        onClick={() => setEntretienFilter("jamais_fait")}
      />
      <FilterChip
        label={`En retard (${entretiensComputed.filter((x) => x.statusKey === "en_retard").length})`}
        active={entretienFilter === "en_retard"}
        onClick={() => setEntretienFilter("en_retard")}
      />
      <FilterChip
        label={`À prévoir (${entretiensComputed.filter((x) => x.statusKey === "a_prevoir").length})`}
        active={entretienFilter === "a_prevoir"}
        onClick={() => setEntretienFilter("a_prevoir")}
      />
    </div>
  );
}

function EntretienList({
  items,
  getEntretienBadge,
  getFrequenceText,
  formatDate,
  formatNumber,
}: {
  items: EntretienDashboardRow[];
  getEntretienBadge: (statusKey: EntretienDashboardRow["statusKey"]) => {
    label: string;
    style: CSSProperties;
  };
  getFrequenceText: (item: EntretienDashboardRow) => string;
  formatDate: (value?: string | null) => string;
  formatNumber: (value?: number | null) => string;
}) {
  if (items.length === 0)
    return <EmptyState text="Aucun entretien pour ce filtre." />;

  return (
    <div style={styles.listStack}>
      {items.map((item) => {
        const badge = getEntretienBadge(item.statusKey);

        return (
          <div key={item.id} style={styles.listRow}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={styles.rowTitle}>
                {item.unite?.no_unite ?? "—"} — {item.nom}
              </div>
              <div style={styles.rowSub}>
                {item.unite?.marque ?? ""} {item.unite?.modele ?? ""}
              </div>
              <div style={styles.rowMeta}>
                <span>
                  Fréquence : <strong>{getFrequenceText(item)}</strong>
                </span>
                <span style={styles.metaDivider}>•</span>
                <span>
                  Dernier fait :{" "}
                  <strong>
                    {item.lastDone?.date_effectuee
                      ? formatDate(item.lastDone.date_effectuee)
                      : "—"}
                  </strong>
                </span>
                {item.lastDone?.km_effectue != null ? (
                  <>
                    <span style={styles.metaDivider}>•</span>
                    <span>
                      Dernier km :{" "}
                      <strong>
                        {formatNumber(item.lastDone.km_effectue)} km
                      </strong>
                    </span>
                  </>
                ) : null}
              </div>
              <div style={styles.rowMeta}>
                <span>
                  Prochain dû : <strong>{item.prochainDuText}</strong>
                </span>
                {item.templateNom ? (
                  <>
                    <span style={styles.metaDivider}>•</span>
                    <span>
                      Source : <strong>{item.templateNom}</strong>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <span style={{ ...styles.badge, ...badge.style }}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StockTable({
  stockBas,
  formatNumber,
}: {
  stockBas: StockRow[];
  formatNumber: (value?: number | null) => string;
}) {
  if (stockBas.length === 0)
    return <EmptyState text="Aucune pièce sous le seuil d’alerte." />;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Pièce</th>
            <th style={styles.th}>SKU</th>
            <th style={styles.thRight}>Qté</th>
            <th style={styles.thRight}>Seuil</th>
            <th style={styles.th}>Emplacement</th>
          </tr>
        </thead>
        <tbody>
          {stockBas.map((item) => (
            <tr key={item.id}>
              <td style={styles.tdStrong}>{item.nom ?? "—"}</td>
              <td style={styles.td}>{item.sku ?? "—"}</td>
              <td style={styles.tdRight}>
                {formatNumber(item.quantite)} {item.unite ?? ""}
              </td>
              <td style={styles.tdRight}>{formatNumber(item.seuil_alerte)}</td>
              <td style={styles.td}>{item.emplacement ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.filterChip,
        ...(active ? styles.filterChipActive : {}),
      }}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "orange" | "purple" | "red";
  onClick?: () => void;
}) {
  const toneStyle =
    tone === "red"
      ? styles.statToneRed
      : tone === "green"
        ? styles.statToneGreen
        : tone === "orange"
          ? styles.statToneOrange
          : tone === "purple"
            ? styles.statTonePurple
            : styles.statToneBlue;

  return (
    <button type="button" style={styles.statCard} onClick={onClick}>
      <div style={{ ...styles.statAccent, ...toneStyle }} />
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
  scrollable = false,
  overflowVisible = false,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  scrollable?: boolean;
  overflowVisible?: boolean;
}) {
  return (
    <section
      style={{
        ...styles.card,
        ...(overflowVisible ? styles.cardOverflowVisible : {}),
      }}
    >
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.cardTitle}>{title}</div>
          {subtitle ? <div style={styles.cardSubtitle}>{subtitle}</div> : null}
        </div>
        {actionLabel && onAction ? (
          <button type="button" style={styles.btnGhost} onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div style={scrollable ? styles.cardBodyScrollable : styles.cardBody}>
        {children}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={styles.emptyState}>{text}</div>;
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 24,
    background: "#f5f7fb",
    minHeight: "100%",
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#162033",
  },
  subtitle: {
    margin: "6px 0 0 0",
    color: "#60708a",
    fontSize: 14,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  tabsBar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  tabBtn: {
    height: 38,
    borderRadius: 999,
    border: "1px solid #d5dce8",
    background: "#fff",
    color: "#1b2840",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBtnActive: {
    border: "1px solid #2f6fed",
    background: "#eef4ff",
    color: "#2159d6",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  summarySplit: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, .95fr) minmax(520px, 1.45fr)",
    gap: 16,
    marginBottom: 16,
  },
  summaryPanel: {
    border: "1px solid #d9e1ee",
    background: "rgba(255,255,255,.92)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
  },
  summaryPanelTitle: {
    fontSize: 16,
    fontWeight: 850,
    color: "#162033",
    marginBottom: 12,
  },
  summaryCardsThree: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  summaryCardsFour: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  statCard: {
    border: "1px solid #d9e1ee",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfcff 100%)",
    borderRadius: 16,
    padding: 18,
    textAlign: "left",
    position: "relative",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
    cursor: "pointer",
  },
  statAccent: {
    height: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  statToneRed: { background: "#ef4444" },
  statToneBlue: { background: "#2f6fed" },
  statToneGreen: { background: "#16a34a" },
  statToneOrange: { background: "#f59e0b" },
  statTonePurple: { background: "#7c3aed" },
  statValue: {
    fontSize: 34,
    fontWeight: 800,
    color: "#162033",
    lineHeight: 1,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#60708a",
    fontWeight: 600,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  gridOne: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
  },

  jobsLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, .75fr) minmax(520px, 1.25fr)",
    gap: 16,
    alignItems: "start",
  },
  jobsForm: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  jobsFieldLabel: {
    fontSize: 12,
    color: "#60708a",
    fontWeight: 800,
    marginBottom: 6,
  },
  jobsInput: {
    width: "100%",
    minHeight: 42,
    borderRadius: 10,
    border: "1px solid #d5dce8",
    background: "#fff",
    padding: "0 12px",
    font: "inherit",
    boxSizing: "border-box",
  },
  jobsUnitDropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 5000,
    maxHeight: 320,
    overflowY: "auto",
    border: "1px solid #d5dce8",
    borderRadius: 12,
    background: "#fff",
    boxShadow: "0 16px 36px rgba(15,23,42,.16)",
  },
  jobsUnitOption: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid #edf1f6",
    background: "#fff",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
  },
  jobsUnitOptionSelected: {
    background: "#eef4ff",
  },
  jobsUnitOptionMain: {
    fontSize: 14,
    fontWeight: 850,
    color: "#162033",
  },
  jobsUnitOptionSub: {
    fontSize: 12,
    color: "#60708a",
    marginTop: 3,
  },
  jobsUnitEmpty: {
    padding: "12px",
    color: "#74839b",
    fontSize: 13,
  },
  jobsDescriptionRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    gap: 10,
  },
  jobsEmployeeStack: {
    display: "grid",
    gap: 14,
  },
  jobsEmployeeCard: {
    border: "1px solid #e4e9f2",
    borderRadius: 14,
    background: "#fbfcfe",
    overflow: "hidden",
  },
  jobsEmployeeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "11px 12px",
    background: "#f3f6fb",
    borderBottom: "1px solid #e4e9f2",
  },
  jobsDragRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    borderBottom: "1px solid #edf1f6",
    background: "#fff",
    cursor: "grab",
  },
  jobsDragRowActive: {
    opacity: 0.5,
    background: "#eef4ff",
  },
  jobsHandle: {
    color: "#94a3b8",
    fontWeight: 900,
    fontSize: 18,
    cursor: "grab",
    userSelect: "none",
  },
  jobsOrderNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eef2f7",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    flexShrink: 0,
  },
  jobsDeleteBtn: {
    height: 34,
    borderRadius: 9,
    border: "1px solid #f2c2c2",
    background: "#fff",
    color: "#c93f3f",
    padding: "0 10px",
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  suiviColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  suiviTaskGroup: {
    border: "1px solid #e4e9f2",
    borderRadius: 14,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.035)",
    overflow: "hidden",
  },
  suiviTaskGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    padding: 12,
  },
  suiviTaskItems: {
    borderTop: "1px solid #edf1f6",
  },
  suiviTaskInnerRow: {
    padding: "10px 12px",
    outline: "none",
  },
  suiviTaskInnerRowDivider: {
    borderTop: "1px solid #edf1f6",
  },
  suiviSeeMoreBtn: {
    width: "100%",
    minHeight: 36,
    border: "none",
    borderTop: "1px solid #e4e9f2",
    background: "#f8fafc",
    color: "#2159d6",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  suiviTaskRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    padding: 12,
    border: "1px solid #e4e9f2",
    borderRadius: 14,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.035)",
    transition:
      "transform .12s ease, box-shadow .12s ease, border-color .12s ease",
  },
  suiviTaskRowClickable: {
    borderColor: "#cfe0ff",
    boxShadow: "0 6px 18px rgba(47, 111, 237, 0.10)",
  },
  doubleClickHint: {
    color: "#2159d6",
    fontWeight: 800,
  },
  card: {
    border: "1px solid #d9e1ee",
    background: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
  },
  cardOverflowVisible: {
    overflow: "visible",
    position: "relative",
    zIndex: 20,
  },
  cardHeader: {
    background: "#eaf0fb",
    borderBottom: "1px solid #d9e1ee",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#162033",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#60708a",
    marginTop: 4,
  },
  cardBody: { padding: 14 },
  cardBodyScrollable: {
    padding: 14,
    maxHeight: 420,
    overflowY: "auto",
    paddingRight: 6,
  },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #e4e9f2",
    color: "#5c6c86",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "10px 12px",
    borderBottom: "1px solid #e4e9f2",
    color: "#5c6c86",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 12px",
    borderBottom: "1px solid #eef2f7",
    color: "#1f2a3d",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "12px 12px",
    borderBottom: "1px solid #eef2f7",
    color: "#162033",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "12px 12px",
    borderBottom: "1px solid #eef2f7",
    color: "#1f2a3d",
    verticalAlign: "middle",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  listStack: { display: "flex", flexDirection: "column", gap: 10 },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    padding: 12,
    border: "1px solid #e4e9f2",
    borderRadius: 14,
    background: "#fbfcfe",
  },
  rowTitle: { fontSize: 14, fontWeight: 800, color: "#162033" },
  rowSub: { fontSize: 13, color: "#60708a", marginTop: 3 },
  rowMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 12,
    color: "#60708a",
    marginTop: 6,
  },
  metaDivider: { opacity: 0.65 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
    height: 30,
    borderRadius: 999,
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
    border: "1px solid transparent",
    flexShrink: 0,
  },
  miniBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 999,
    padding: "0 8px",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
    border: "1px solid transparent",
  },
  badgeInfo: {
    background: "#eef4ff",
    color: "#2159d6",
    borderColor: "#cfe0ff",
  },
  badgeSuccess: {
    background: "#edf9f0",
    color: "#1f8a43",
    borderColor: "#cfead8",
  },
  badgeWarning: {
    background: "#fff6e8",
    color: "#b66a00",
    borderColor: "#ffe2b8",
  },
  badgeDanger: {
    background: "#fff0f0",
    color: "#c93f3f",
    borderColor: "#f2c2c2",
  },
  btnPrimary: {
    height: 42,
    borderRadius: 12,
    border: "1px solid #2f6fed",
    background: "#2f6fed",
    color: "#fff",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSecondary: {
    height: 42,
    borderRadius: 12,
    border: "1px solid #d5dce8",
    background: "#fff",
    color: "#1b2840",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnGhost: {
    height: 34,
    borderRadius: 10,
    border: "1px solid #d5dce8",
    background: "#fff",
    color: "#1b2840",
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  rowActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  iconCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid #d5dce8",
    background: "#fff",
    color: "#1b2840",
    fontSize: 22,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  btModalCard: {
    width: "min(1500px, 96vw)",
    height: "92vh",
    borderRadius: 18,
    background: "#fff",
    border: "1px solid rgba(15, 23, 42, 0.16)",
    boxShadow: "0 30px 90px rgba(0,0,0,.28)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  btModalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "14px 16px",
    borderBottom: "1px solid #e4e9f2",
    background: "#f8fafc",
  },
  btModalTitle: {
    fontSize: 17,
    fontWeight: 850,
    color: "#162033",
  },
  btModalSub: {
    fontSize: 12,
    color: "#60708a",
    marginTop: 3,
  },
  btModalFrame: {
    border: "none",
    width: "100%",
    flex: "1 1 auto",
    background: "#f5f7fb",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    height: 34,
    borderRadius: 999,
    border: "1px solid #d5dce8",
    background: "#fff",
    color: "#1b2840",
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  filterChipActive: {
    border: "1px solid #2f6fed",
    background: "#eef4ff",
    color: "#2159d6",
  },
  loadingCard: {
    border: "1px solid #d9e1ee",
    background: "#fff",
    borderRadius: 18,
    padding: 24,
    color: "#60708a",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
  },
  errorBox: {
    marginBottom: 16,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#fff1f1",
    color: "#b42318",
    border: "1px solid #f3c4c4",
    fontSize: 14,
    fontWeight: 600,
  },
  emptyState: {
    padding: 18,
    textAlign: "center",
    color: "#74839b",
    border: "1px dashed #d8dfeb",
    borderRadius: 14,
    background: "#fbfcfe",
    fontSize: 14,
  },
};