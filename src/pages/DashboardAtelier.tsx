import { useEffect, useMemo, useState } from "react";
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
  unites?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
    km_actuel?: number | null;
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
    unites?: {
      no_unite?: string | null;
    } | null;
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

type EntretienFilterKey =
  | "tous"
  | "jamais_fait"
  | "en_retard"
  | "a_prevoir";

type DashboardTab =
  | "vue_generale"
  | "entretiens"
  | "taches_ouvertes"
  | "stock_bas";

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
  titre: string;
  details?: string | null;
  created_at?: string | null;
  entretien_auto?: boolean | null;
  unites?: {
    id?: string;
    no_unite?: string | null;
    marque?: string | null;
    modele?: string | null;
  } | null;
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
  btOuverts: BtRow[];
  btAFacturer: BtRow[];
  stockBas: StockRow[];
  mecanosActifs: ActiveMecano[];
  assignedTemplates: UniteEntretienTemplate[];
  templates: EntretienTemplate[];
  templateItems: EntretienTemplateItem[];
  unitItems: UniteEntretienItem[];
  historique: EntretienHistorique[];
};

export default function DashboardAtelier() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [entretienFilter, setEntretienFilter] =
    useState<EntretienFilterKey>("jamais_fait");
  const [activeTab, setActiveTab] = useState<DashboardTab>("vue_generale");

  const [data, setData] = useState<DashboardData>({
    btOuverts: [],
    btAFacturer: [],
    stockBas: [],
    mecanosActifs: [],
    assignedTemplates: [],
    templates: [],
    templateItems: [],
    unitItems: [],
    historique: [],
  });

  const [openTasks, setOpenTasks] = useState<UniteNoteRow[]>([]);

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
      ] = await Promise.all([
        supabase
          .from("bons_travail")
          .select(`
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
              km_actuel
            )
          `)
          .order("updated_at", { ascending: false })
          .limit(200),

        supabase
          .from("inventaire_items")
          .select(`
            id,
            nom,
            sku,
            quantite,
            seuil_alerte,
            unite,
            emplacement,
            actif
          `)
          .eq("actif", true)
          .order("nom", { ascending: true })
          .limit(200),

        supabase
          .from("bt_pointages")
          .select(`
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
          `)
          .or("ended_at.is.null,actif.eq.true")
          .order("started_at", { ascending: false })
          .limit(50),

        supabase
          .from("unite_entretien_templates")
          .select(`
            id,
            unite_id,
            template_id,
            actif,
            unites:unite_id (
              id,
              no_unite,
              marque,
              modele,
              km_actuel
            )
          `)
          .eq("actif", true),

        supabase
          .from("entretien_templates")
          .select("id,nom,description,actif")
          .eq("actif", true),

        supabase
          .from("entretien_template_items")
          .select("id,template_id,nom,description,periodicite_km,periodicite_jours,ordre,actif")
          .eq("actif", true),

        supabase
          .from("unite_entretien_items")
          .select(`
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
              km_actuel
            )
          `)
          .eq("actif", true),

        supabase
          .from("unite_entretien_historique")
          .select(`
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
          `)
          .order("date_effectuee", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("unite_notes")
          .select(`
            id,
            unite_id,
            titre,
            details,
            created_at,
            entretien_auto,
            unites:unite_id (
              id,
              no_unite,
              marque,
              modele
            )
          `)
          .order("created_at", { ascending: true }),
      ]);

      if (btRes.error) console.error("Dashboard bons_travail error:", btRes.error);
      if (stockRes.error) console.error("Dashboard inventaire_items error:", stockRes.error);
      if (pointagesRes.error) console.error("Dashboard bt_pointages error:", pointagesRes.error);
      if (assignedTemplatesRes.error) console.error("Dashboard unite_entretien_templates error:", assignedTemplatesRes.error);
      if (templatesRes.error) console.error("Dashboard entretien_templates error:", templatesRes.error);
      if (templateItemsRes.error) console.error("Dashboard entretien_template_items error:", templateItemsRes.error);
      if (unitItemsRes.error) console.error("Dashboard unite_entretien_items error:", unitItemsRes.error);
      if (historiqueRes.error) console.error("Dashboard unite_entretien_historique error:", historiqueRes.error);
      if (openTasksRes.error) console.error("Dashboard unite_notes error:", openTasksRes.error);

      const btRows = (btRes.data ?? []) as BtRow[];
      const stockRows = (stockRes.data ?? []) as StockRow[];
      const pointageRows = (pointagesRes.data ?? []) as PointageRow[];
      const assignedTemplates = (assignedTemplatesRes.data ?? []) as UniteEntretienTemplate[];
      const templates = (templatesRes.data ?? []) as EntretienTemplate[];
      const templateItems = (templateItemsRes.data ?? []) as EntretienTemplateItem[];
      const unitItems = (unitItemsRes.data ?? []) as UniteEntretienItem[];
      const historique = (historiqueRes.data ?? []) as EntretienHistorique[];
      const openTasksRows = (openTasksRes.data ?? []) as UniteNoteRow[];

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
        const closedLike =
          s === "ferme" ||
          s === "fermee" ||
          s === "fermé" ||
          s === "fermée" ||
          s === "termine" ||
          s === "terminé" ||
          s === "a_facturer" ||
          s === "a facturer" ||
          s === "à facturer" ||
          bt.date_fermeture != null;

        const notExported = !bt.export_acomba_at;
        return closedLike && notExported;
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
            (a.nom ?? "").localeCompare(b.nom ?? "", "fr")
        )
        .slice(0, 20);

      setData({
        btOuverts,
        btAFacturer,
        stockBas,
        mecanosActifs: Array.from(mecanosMap.values()),
        assignedTemplates,
        templates,
        templateItems,
        unitItems,
        historique,
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
        openTasksRes.error
      ) {
        setErrorMsg(
          "Certaines données n'ont pas pu être chargées. Vérifie la console pour le détail."
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
    loadDashboard();
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

    const assignedSet = new Set(data.assignedTemplates.map((x) => x.template_id));
    const templateMap = new Map(data.templates.map((t) => [t.id, t]));

    const uniteMap = new Map<
      string,
      {
        id?: string;
        no_unite?: string | null;
        marque?: string | null;
        modele?: string | null;
        km_actuel?: number | null;
      } | null
    >();

    for (const assigned of data.assignedTemplates) {
      if (assigned.unites) {
        uniteMap.set(assigned.unite_id, assigned.unites);
      }
    }

    for (const unitItem of data.unitItems) {
      if (unitItem.unites) {
        uniteMap.set(unitItem.unite_id, unitItem.unites);
      }
    }

    const hByTemplateItemAndUnit = new Map<string, EntretienHistorique>();
    const hByUnitItem = new Map<string, EntretienHistorique>();

    for (const h of data.historique) {
      if (h.template_item_id && h.unite_id) {
        const key = `${h.template_item_id}::${h.unite_id}`;
        if (!hByTemplateItemAndUnit.has(key)) {
          hByTemplateItemAndUnit.set(key, h);
        }
      }

      if (h.unite_item_id) {
        if (!hByUnitItem.has(h.unite_item_id)) {
          hByUnitItem.set(h.unite_item_id, h);
        }
      }
    }

    const fromTemplates: EntretienDashboardRow[] = data.templateItems
      .filter((it) => assignedSet.has(it.template_id))
      .flatMap((it) => {
        const unitLinks = data.assignedTemplates.filter(
          (x) => x.template_id === it.template_id
        );

        return unitLinks.map((unitLink) => {
          const unite =
            uniteMap.get(unitLink.unite_id) ??
            unitLink.unites ??
            null;

          const histKey = `${it.id}::${unitLink.unite_id}`;
          const lastDone = hByTemplateItemAndUnit.get(histKey) ?? null;

          let overdue = false;
          let soon = false;

          if (
            it.periodicite_km != null &&
            lastDone?.km_effectue != null &&
            unite?.km_actuel != null
          ) {
            const nextKm = Number(lastDone.km_effectue) + Number(it.periodicite_km);
            const remainingKm = nextKm - Number(unite.km_actuel);
            if (remainingKm <= 0) overdue = true;
            else if (remainingKm <= 2500) soon = true;
          }

          if (it.periodicite_jours != null && lastDone?.date_effectuee) {
            const dueDate = addDays(lastDone.date_effectuee, Number(it.periodicite_jours));
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
            if (it.periodicite_km != null) {
              parts.push(`${fmtNumberLocal(it.periodicite_km)} km`);
            }
            if (it.periodicite_jours != null) {
              parts.push(`${fmtNumberLocal(it.periodicite_jours)} jours`);
            }
            prochainDuText = parts.length ? parts.join(" • ") : "—";
          } else {
            const parts: string[] = [];

            if (
              it.periodicite_km != null &&
              lastDone.km_effectue != null &&
              unite?.km_actuel != null
            ) {
              const nextKm = Number(lastDone.km_effectue) + Number(it.periodicite_km);
              const remainingKm = nextKm - Number(unite.km_actuel);
              parts.push(
                remainingKm <= 0 ? "0 km" : `${fmtNumberLocal(remainingKm)} km`
              );
            } else if (it.periodicite_km != null) {
              parts.push(`${fmtNumberLocal(it.periodicite_km)} km`);
            }

            if (it.periodicite_jours != null && lastDone.date_effectuee) {
              const dueDate = addDays(lastDone.date_effectuee, Number(it.periodicite_jours));
              if (dueDate) {
                const remainingDays = daysBetween(today, dueDate);
                parts.push(
                  remainingDays <= 0
                    ? "0 jour"
                    : `${fmtNumberLocal(remainingDays)} jours`
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
        const dueDate = addDays(lastDone.date_effectuee, Number(frequenceJours));
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
        if (frequenceKm != null) parts.push(`${fmtNumberLocal(frequenceKm)} km`);
        if (frequenceJours != null) {
          parts.push(`${fmtNumberLocal(frequenceJours)} jours`);
        }
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
            remainingKm <= 0 ? "0 km" : `${fmtNumberLocal(remainingKm)} km`
          );
        } else if (frequenceKm != null) {
          parts.push(`${fmtNumberLocal(frequenceKm)} km`);
        }

        if (frequenceJours != null && lastDone.date_effectuee) {
          const dueDate = addDays(lastDone.date_effectuee, Number(frequenceJours));
          if (dueDate) {
            const remainingDays = daysBetween(today, dueDate);
            parts.push(
              remainingDays <= 0
                ? "0 jour"
                : `${fmtNumberLocal(remainingDays)} jours`
            );
          }
        } else if (frequenceJours != null) {
          parts.push(`${fmtNumberLocal(frequenceJours)} jours`);
        }

        prochainDuText = parts.length ? parts.join(" • ") : "—";
      }

      return {
        id: `unite-${it.id}`,
        sourceType: "unite",
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
    const visibles = entretiensComputed.filter((item) => item.statusKey !== "ok");

    if (entretienFilter === "tous") return visibles;
    return visibles.filter((item) => item.statusKey === entretienFilter);
  }, [entretiensComputed, entretienFilter]);

  const tasksByUnit = useMemo<TacheOuverteParUnite[]>(() => {
    const map = new Map<string, TacheOuverteParUnite>();

    for (const task of openTasks) {
      const uniteId = task.unite_id;
      const uniteNo = task.unites?.no_unite ?? "—";
      const uniteLabel =
        [task.unites?.marque, task.unites?.modele].filter(Boolean).join(" ") || "—";

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

      if (task.entretien_auto) {
        group.entretienAutoCount += 1;
      }

      if (
        task.created_at &&
        (!group.oldestCreatedAt || task.created_at < group.oldestCreatedAt)
      ) {
        group.oldestCreatedAt = task.created_at;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.entretienAutoCount !== a.entretienAutoCount) {
        return b.entretienAutoCount - a.entretienAutoCount;
      }
      return (a.oldestCreatedAt || "").localeCompare(b.oldestCreatedAt || "");
    });
  }, [openTasks]);

  const stats = useMemo(
    () => ({
      btOuverts: data.btOuverts.length,
      btAFacturer: data.btAFacturer.length,
      entretiensAVenir: entretiensComputed.filter(
        (x) =>
          x.statusKey === "jamais_fait" ||
          x.statusKey === "en_retard" ||
          x.statusKey === "a_prevoir"
      ).length,
      mecanosActifs: data.mecanosActifs.length,
    }),
    [
      data.btOuverts.length,
      data.btAFacturer.length,
      data.mecanosActifs.length,
      entretiensComputed,
    ]
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
    if (statusKey === "jamais_fait") {
      return { label: "Jamais fait", style: styles.badgeWarning };
    }
    if (statusKey === "en_retard") {
      return { label: "En retard", style: styles.badgeDanger };
    }
    if (statusKey === "a_prevoir") {
      return { label: "À prévoir", style: styles.badgeInfo };
    }
    return { label: "OK", style: styles.badgeSuccess };
  }

  function getFrequenceText(item: EntretienDashboardRow) {
    const parts: string[] = [];
    if (item.frequenceKm != null) parts.push(`${formatNumber(item.frequenceKm)} km`);
    if (item.frequenceJours != null) {
      parts.push(`${formatNumber(item.frequenceJours)} jours`);
    }
    return parts.length ? parts.join(" ou ") : "—";
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Tableau de bord Atelier</h1>
            <p style={styles.subtitle}>
              Gérer efficacement la journée, prioriser les BT et anticiper les entretiens
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
            Gérer efficacement la journée, prioriser les BT et anticiper les entretiens
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
      </div>

      {errorMsg ? <div style={styles.errorBox}>{errorMsg}</div> : null}

      {activeTab === "vue_generale" && (
        <>
          <div style={styles.statsGrid}>
            <StatCard
              label="BT ouverts"
              value={stats.btOuverts}
              tone="blue"
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
            />
            <StatCard
              label="Mécanos actifs"
              value={stats.mecanosActifs}
              tone="purple"
              onClick={() => goTo("/operation-temps-reel")}
            />
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
                          <td style={styles.td}>{bt.unites?.no_unite ?? "—"}</td>
                          <td style={styles.td}>{bt.client_nom ?? "—"}</td>
                          <td style={styles.td}>
                            {formatDate(bt.date_fermeture ?? bt.updated_at)}
                          </td>
                          <td style={styles.tdRight}>{formatMoney(bt.totalFinal ?? bt.total_final)}</td>
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

              {entretiensFiltered.length === 0 ? (
                <EmptyState text="Aucun entretien pour ce filtre." />
              ) : (
                <div style={styles.listStack}>
                  {entretiensFiltered.map((item) => {
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
                                  <strong>{formatNumber(item.lastDone.km_effectue)} km</strong>
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
              )}
            </SectionCard>

            <SectionCard
              title="BT ouverts"
              subtitle="Travaux actuellement en cours"
              actionLabel="Voir tout"
              onAction={() => goTo("/bt")}
              scrollable
            >
              {data.btOuverts.length === 0 ? (
                <EmptyState text="Aucun BT ouvert actuellement." />
              ) : (
                <div style={styles.listStack}>
                  {data.btOuverts.map((bt) => (
                    <div key={bt.id} style={styles.listRow}>
                      <div>
                        <div style={styles.rowTitle}>
                          {bt.numero ?? "BT"} — Unité {bt.unites?.no_unite ?? "—"}
                        </div>
                        <div style={styles.rowSub}>
                          {bt.client_nom ? bt.client_nom : "Sans client"}
                        </div>
                        <div style={styles.rowMeta}>
                          Dernière activité : {formatDate(bt.updated_at)}
                        </div>
                      </div>

                      <span style={{ ...styles.badge, ...styles.badgeInfo }}>
                        {bt.statut ?? "Ouvert"}
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
              {data.stockBas.length === 0 ? (
                <EmptyState text="Aucune pièce sous le seuil d’alerte." />
              ) : (
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
                      {data.stockBas.map((item) => (
                        <tr key={item.id}>
                          <td style={styles.tdStrong}>{item.nom ?? "—"}</td>
                          <td style={styles.td}>{item.sku ?? "—"}</td>
                          <td style={styles.tdRight}>
                            {formatNumber(item.quantite)} {item.unite ?? ""}
                          </td>
                          <td style={styles.tdRight}>
                            {formatNumber(item.seuil_alerte)}
                          </td>
                          <td style={styles.td}>{item.emplacement ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

          {entretiensFiltered.length === 0 ? (
            <EmptyState text="Aucun entretien pour ce filtre." />
          ) : (
            <div style={styles.listStack}>
              {entretiensFiltered.map((item) => {
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
                              <strong>{formatNumber(item.lastDone.km_effectue)} km</strong>
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
          )}
        </SectionCard>
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
                      {group.taches.map((task) => (
                        <div key={task.id} style={{ ...styles.rowMeta, marginTop: 4 }}>
                          <span>• {task.titre}</span>
                          {task.created_at ? (
                            <>
                              <span style={styles.metaDivider}>•</span>
                              <span>{formatDate(task.created_at)}</span>
                            </>
                          ) : null}
                        </div>
                      ))}
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
          {data.stockBas.length === 0 ? (
            <EmptyState text="Aucune pièce sous le seuil d’alerte." />
          ) : (
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
                  {data.stockBas.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.tdStrong}>{item.nom ?? "—"}</td>
                      <td style={styles.td}>{item.sku ?? "—"}</td>
                      <td style={styles.tdRight}>
                        {formatNumber(item.quantite)} {item.unite ?? ""}
                      </td>
                      <td style={styles.tdRight}>
                        {formatNumber(item.seuil_alerte)}
                      </td>
                      <td style={styles.td}>{item.emplacement ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
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
  tone: "blue" | "green" | "orange" | "purple";
  onClick?: () => void;
}) {
  const toneStyle =
    tone === "green"
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
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <section style={styles.card}>
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

const styles: Record<string, React.CSSProperties> = {
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
  statCard: {
    border: "1px solid #d9e1ee",
    background: "#fff",
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

  card: {
    border: "1px solid #d9e1ee",
    background: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
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
  cardBody: {
    padding: 14,
  },
  cardBodyScrollable: {
    padding: 14,
    maxHeight: 420,
    overflowY: "auto",
    paddingRight: 6,
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
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

  listStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
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
  rowTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#162033",
  },
  rowSub: {
    fontSize: 13,
    color: "#60708a",
    marginTop: 3,
  },
  rowMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 12,
    color: "#60708a",
    marginTop: 6,
  },
  metaDivider: {
    opacity: 0.65,
  },

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