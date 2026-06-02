import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type BtFusionBt = {
  id: string;
  numero?: string | null;
  unite_id: string;
  statut: string;
  verrouille?: boolean | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  created_at?: string | null;
  client_id?: string | null;
  client_nom?: string | null;
  km?: number | null;
  total_pieces?: number | null;
  total_main_oeuvre?: number | null;
  total_frais_atelier?: number | null;
  total_general?: number | null;
  total_tps?: number | null;
  total_tvq?: number | null;
  total_final?: number | null;
};

export type BtFusionUnite = {
  id: string;
  no_unite: string;
  marque?: string | null;
  modele?: string | null;
  annee?: number | null;
  client_id?: string | null;
};

export type BtFusionClient = {
  id: string;
  nom: string;
};

export type BtFusionGroup = {
  key: string;
  uniteId: string;
  clientKey: string;
  uniteLabel: string;
  clientLabel: string;
  bts: BtFusionBt[];
  destination: BtFusionBt;
  sources: BtFusionBt[];
  oldestDateOuverture: string | null;
};

type UseBtFusionArgs = {
  bts: BtFusionBt[];
  unitesById: Record<string, BtFusionUnite>;
  clientsById: Record<string, BtFusionClient>;
  resolveClientName: (bt: BtFusionBt) => string;
  onDone?: () => Promise<void> | void;
};

function isFacturedStatut(statut: string | null | undefined) {
  return statut === "facture";
}

function isMergeableBt(bt: BtFusionBt) {
  if (Boolean(bt.verrouille)) return false;
  if (isFacturedStatut(bt.statut)) return false;
  if (bt.statut === "fusionne") return false;
  return true;
}

function btDateMs(bt: BtFusionBt) {
  const raw = bt.date_ouverture || bt.created_at || "";
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function oldestDate(bts: BtFusionBt[]) {
  const dates = bts
    .map((bt) => bt.date_ouverture || bt.created_at || null)
    .filter(Boolean)
    .sort((a, b) => new Date(String(a)).getTime() - new Date(String(b)).getTime());
  return dates[0] ? String(dates[0]) : null;
}

function clientKeyOf(bt: BtFusionBt, resolveClientName: (bt: BtFusionBt) => string) {
  if (bt.client_id) return `id:${bt.client_id}`;
  const name = String(bt.client_nom || resolveClientName(bt) || "")
    .trim()
    .toLowerCase();
  return `nom:${name || "sans-client"}`;
}

function normalizeTaskTitle(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function safeUpdateTable(
  table: string,
  sourceIds: string[],
  destinationId: string,
  label: string,
) {
  if (!sourceIds.length) return;

  const { error } = await supabase
    .from(table)
    .update({ bt_id: destinationId })
    .in("bt_id", sourceIds);

  if (error) {
    const msg = String(error.message || "");
    if (
      msg.toLowerCase().includes("does not exist") ||
      msg.toLowerCase().includes("schema cache") ||
      msg.toLowerCase().includes("could not find")
    ) {
      console.warn(`Table ignorée pendant la fusion (${label})`, error);
      return;
    }
    throw error;
  }
}

async function safeDeleteUniteNotes(noteIds: string[]) {
  const ids = Array.from(new Set(noteIds.filter(Boolean)));
  if (!ids.length) return;

  const { error } = await supabase.from("unite_notes").delete().in("id", ids);
  if (error) throw error;
}

async function safeRelinkTaskPhotosToDoneTask(args: {
  sourceNoteId: string;
  destinationBtId: string;
  doneTaskId: string;
}) {
  try {
    const { error } = await supabase
      .from("bt_tache_photos")
      .update({
        bt_id: args.destinationBtId,
        unite_note_id: null,
        tache_effectuee_id: args.doneTaskId,
      })
      .eq("unite_note_id", args.sourceNoteId);

    if (error) throw error;
  } catch (e) {
    console.warn("Relink photos tâche ignoré", e);
  }
}

function sumNumbers(rows: BtFusionBt[], key: keyof BtFusionBt) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

export function useBtFusion({
  bts,
  unitesById,
  clientsById,
  resolveClientName,
  onDone,
}: UseBtFusionArgs) {
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo<BtFusionGroup[]>(() => {
    const map = new Map<string, BtFusionBt[]>();

    for (const bt of bts) {
      if (!isMergeableBt(bt)) continue;

      const clientKey = clientKeyOf(bt, resolveClientName);
      const key = `${bt.unite_id}|||${clientKey}`;

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(bt);
    }

    return Array.from(map.entries())
      .map(([key, rows]) => {
        const sorted = [...rows].sort((a, b) => btDateMs(b) - btDateMs(a));
        const destination = sorted[0];
        const sources = sorted.slice(1);
        const unite = unitesById[destination.unite_id];
        const clientLabel = resolveClientName(destination);
        const clientKey = clientKeyOf(destination, resolveClientName);

        return {
          key,
          uniteId: destination.unite_id,
          clientKey,
          uniteLabel: unite?.no_unite || "—",
          clientLabel: clientLabel || clientsById[destination.client_id || ""]?.nom || "—",
          bts: sorted,
          destination,
          sources,
          oldestDateOuverture: oldestDate(sorted),
        };
      })
      .filter((group) => group.bts.length >= 2)
      .sort((a, b) => a.uniteLabel.localeCompare(b.uniteLabel, "fr", { numeric: true }));
  }, [bts, unitesById, clientsById, resolveClientName]);

  const selectedGroup = useMemo(() => {
    if (!groups.length) return null;
    return groups.find((g) => g.key === selectedGroupKey) || groups[0];
  }, [groups, selectedGroupKey]);

  async function mergeGroup(group: BtFusionGroup) {
    if (!group.destination?.id || group.sources.length === 0) return;

    setBusy(true);
    setError(null);

    const destinationId = group.destination.id;
    const sourceIds = group.sources.map((bt) => bt.id);
    const allRows = [group.destination, ...group.sources];

    try {
      const { data: destinationDoneRows, error: doneErr } = await supabase
        .from("bt_taches_effectuees")
        .select("id,titre")
        .eq("bt_id", destinationId);

      if (doneErr) throw doneErr;

      const doneByTitle = new Map<string, string>();
      for (const row of destinationDoneRows || []) {
        const key = normalizeTaskTitle((row as any).titre);
        if (key && !doneByTitle.has(key)) doneByTitle.set(key, String((row as any).id));
      }

      const { data: sourceAuthTasks, error: authTasksErr } = await supabase
        .from("bt_autorisation_taches")
        .select("id,unite_note_id,titre")
        .in("bt_id", sourceIds);

      if (authTasksErr) throw authTasksErr;

      const authTaskIdsToDelete: string[] = [];
      const uniteNoteIdsToDelete: string[] = [];

      for (const row of sourceAuthTasks || []) {
        const titleKey = normalizeTaskTitle((row as any).titre);
        const doneTaskId = titleKey ? doneByTitle.get(titleKey) : null;
        const uniteNoteId = String((row as any).unite_note_id || "").trim();

        if (doneTaskId) {
          authTaskIdsToDelete.push(String((row as any).id));
          if (uniteNoteId) {
            uniteNoteIdsToDelete.push(uniteNoteId);
            await safeRelinkTaskPhotosToDoneTask({
              sourceNoteId: uniteNoteId,
              destinationBtId: destinationId,
              doneTaskId,
            });
          }
        }
      }

      if (authTaskIdsToDelete.length) {
        const { error: delAuthTasksErr } = await supabase
          .from("bt_autorisation_taches")
          .delete()
          .in("id", authTaskIdsToDelete);
        if (delAuthTasksErr) throw delAuthTasksErr;
      }

      await safeDeleteUniteNotes(uniteNoteIdsToDelete);

      await safeUpdateTable("bt_pieces", sourceIds, destinationId, "pièces");
      await safeUpdateTable("bt_main_oeuvre", sourceIds, destinationId, "main-d'œuvre");
      await safeUpdateTable("bt_pointages", sourceIds, destinationId, "pointages");
      await safeUpdateTable("bt_taches_effectuees", sourceIds, destinationId, "tâches effectuées");
      await safeUpdateTable("bt_documents", sourceIds, destinationId, "documents");
      await safeUpdateTable("bt_autorisations", sourceIds, destinationId, "autorisations client");
      await safeUpdateTable("bt_autorisation_taches", sourceIds, destinationId, "tâches d'autorisation");
      await safeUpdateTable("bt_tache_photos", sourceIds, destinationId, "photos de tâches");
      await safeUpdateTable("unite_entretien_historique", sourceIds, destinationId, "historique entretien");

      const oldestOpening = group.oldestDateOuverture || group.destination.date_ouverture || group.destination.created_at || null;
      const maxKm = Math.max(
        ...allRows
          .map((row) => Number(row.km || 0))
          .filter((n) => Number.isFinite(n)),
        0,
      );

      const destinationTotals = {
        date_ouverture: oldestOpening,
        km: maxKm > 0 ? maxKm : group.destination.km ?? null,
        total_pieces: Number(sumNumbers(allRows, "total_pieces").toFixed(2)),
        total_main_oeuvre: Number(sumNumbers(allRows, "total_main_oeuvre").toFixed(2)),
        total_frais_atelier: Number(sumNumbers(allRows, "total_frais_atelier").toFixed(2)),
        total_general: Number(sumNumbers(allRows, "total_general").toFixed(2)),
        total_tps: Number(sumNumbers(allRows, "total_tps").toFixed(2)),
        total_tvq: Number(sumNumbers(allRows, "total_tvq").toFixed(2)),
        total_final: Number(sumNumbers(allRows, "total_final").toFixed(2)),
      };

      const { error: updateDestinationErr } = await supabase
        .from("bons_travail")
        .update(destinationTotals)
        .eq("id", destinationId);
      if (updateDestinationErr) throw updateDestinationErr;

      const destinationNumero = group.destination.numero || "BT destination";
      const now = new Date().toISOString();

      const { error: updateSourcesErr } = await supabase
        .from("bons_travail")
        .update({
          statut: "fusionne",
          fusionne_vers_bt_id: destinationId,
          fusionne_le: now,
          fusionne_note: `Fusionné dans ${destinationNumero}`,
          date_fermeture: now,
        })
        .in("id", sourceIds);
      if (updateSourcesErr) throw updateSourcesErr;

      await onDone?.();
      setSelectedGroupKey("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Erreur pendant la fusion des BT.");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return {
    groups,
    selectedGroup,
    selectedGroupKey,
    setSelectedGroupKey,
    busy,
    error,
    setError,
    mergeGroup,
  };
}
