import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
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
  nom_snapshot: string;
  frequence_km_snapshot: number | null;
  frequence_jours_snapshot: number | null;
  date_effectuee: string;
  km_effectue: number | null;
  note: string | null;
  created_at: string;
};

type ItemRow = {
  sourceType: "template" | "unite";
  sourceId: string;
  nom: string;
  description: string | null;
  frequence_km: number | null;
  frequence_jours: number | null;
  templateNom?: string | null;
  lastDone?: EntretienHistorique | null;
};

function fmtKm(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toLocaleString("fr-CA")} km`;
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

function dueStatus(row: ItemRow, currentKm: number | null) {
  const h = row.lastDone;
  const today = new Date();

  let overdue = false;
  let soon = false;

  if (row.frequence_km != null && h?.km_effectue != null && currentKm != null) {
    const nextKm = Number(h.km_effectue) + Number(row.frequence_km);
    const remainingKm = nextKm - Number(currentKm);
    if (remainingKm <= 0) overdue = true;
    else if (remainingKm <= 1000) soon = true;
  }

  if (row.frequence_jours != null && h?.date_effectuee) {
    const dueDate = addDays(h.date_effectuee, Number(row.frequence_jours));
    if (dueDate) {
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      if (diffDays <= 0) overdue = true;
      else if (diffDays <= 30) soon = true;
    }
  }

  if (!h) return { label: "Jamais fait", tone: "#92400e", bg: "#fff7ed", border: "#fed7aa" };
  if (overdue) return { label: "En retard", tone: "#991b1b", bg: "#fef2f2", border: "#fecaca" };
  if (soon) return { label: "À prévoir", tone: "#92400e", bg: "#fff7ed", border: "#fed7aa" };
  return { label: "OK", tone: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" };
}

function nextDueText(row: ItemRow) {
  const h = row.lastDone;
  if (!h) return "Jamais effectué";

  const parts: string[] = [];

  if (row.frequence_km != null && h.km_effectue != null) {
    parts.push(`KM: ${fmtKm(Number(h.km_effectue) + Number(row.frequence_km))}`);
  }

  if (row.frequence_jours != null && h.date_effectuee) {
    const d = addDays(h.date_effectuee, Number(row.frequence_jours));
    parts.push(`Date: ${d ? d.toLocaleDateString("fr-CA") : "—"}`);
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

export default function UniteEntretienTab({
  uniteId,
}: {
  uniteId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [unite, setUnite] = useState<Unite | null>(null);
  const [templates, setTemplates] = useState<EntretienTemplate[]>([]);
  const [assignedTemplates, setAssignedTemplates] = useState<UniteEntretienTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<EntretienTemplateItem[]>([]);
  const [unitItems, setUnitItems] = useState<UniteEntretienItem[]>([]);
  const [historique, setHistorique] = useState<EntretienHistorique[]>([]);

  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [localNom, setLocalNom] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localFreqKm, setLocalFreqKm] = useState("");
  const [localFreqJours, setLocalFreqJours] = useState("");

  const [doneOpen, setDoneOpen] = useState(false);
  const [doneRow, setDoneRow] = useState<ItemRow | null>(null);
  const [doneDate, setDoneDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [doneKm, setDoneKm] = useState("");
  const [doneNote, setDoneNote] = useState("");

  async function loadAll() {
    setLoading(true);

    try {
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
          .select("id,no_unite,marque,modele,km_actuel")
          .eq("id", uniteId)
          .single(),

        supabase
          .from("entretien_templates")
          .select("id,nom,description,actif")
          .eq("actif", true)
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_templates")
          .select("id,unite_id,template_id,actif")
          .eq("unite_id", uniteId)
          .eq("actif", true),

        supabase
          .from("entretien_template_items")
          .select("id,template_id,nom,description,frequence_km,frequence_jours,ordre,actif")
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_items")
          .select("id,unite_id,nom,description,frequence_km,frequence_jours,ordre,actif")
          .eq("unite_id", uniteId)
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_historique")
          .select("id,unite_id,template_item_id,unite_item_id,bt_id,nom_snapshot,frequence_km_snapshot,frequence_jours_snapshot,date_effectuee,km_effectue,note,created_at")
          .eq("unite_id", uniteId)
          .order("date_effectuee", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (uniteRes.error) throw uniteRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (assignedRes.error) throw assignedRes.error;
      if (templateItemsRes.error) throw templateItemsRes.error;
      if (unitItemsRes.error) throw unitItemsRes.error;
      if (historiqueRes.error) throw historiqueRes.error;

      setUnite(uniteRes.data as Unite);
      setTemplates((templatesRes.data as any[]) ?? []);
      setAssignedTemplates((assignedRes.data as any[]) ?? []);
      setTemplateItems((templateItemsRes.data as any[]) ?? []);
      setUnitItems((unitItemsRes.data as any[]) ?? []);
      setHistorique((historiqueRes.data as any[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [uniteId]);

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
        lastDone: hByTemplateItem.get(it.id) ?? null,
      }));

    const fromUnit: ItemRow[] = unitItems.map((it) => ({
      sourceType: "unite",
      sourceId: it.id,
      nom: it.nom,
      description: it.description,
      frequence_km: it.frequence_km,
      frequence_jours: it.frequence_jours,
      templateNom: null,
      lastDone: hByUnitItem.get(it.id) ?? null,
    }));

    return [...fromTemplates, ...fromUnit].sort((a, b) => a.nom.localeCompare(b.nom, "fr-CA"));
  }, [assignedTemplates, templateItems, unitItems, historique, templates]);

  async function assignTemplate() {
    if (!assignTemplateId || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("unite_entretien_templates").insert({
        unite_id: uniteId,
        template_id: assignTemplateId,
        actif: true,
      });
      if (error) throw error;

      setAssignTemplateId("");
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addLocalItem() {
    if (!localNom.trim() || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("unite_entretien_items").insert({
        unite_id: uniteId,
        nom: localNom.trim(),
        description: localDescription.trim() || null,
        frequence_km: numOrNull(localFreqKm),
        frequence_jours: numOrNull(localFreqJours),
        actif: true,
      });
      if (error) throw error;

      setLocalNom("");
      setLocalDescription("");
      setLocalFreqKm("");
      setLocalFreqJours("");
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function openDone(row: ItemRow) {
    setDoneRow(row);
    setDoneDate(new Date().toISOString().slice(0, 10));
    setDoneKm(unite?.km_actuel != null ? String(unite.km_actuel) : "");
    setDoneNote("");
    setDoneOpen(true);
  }

  async function markDone() {
    if (!doneRow || busy) return;
    setBusy(true);
    try {
      const payload = {
        unite_id: uniteId,
        template_item_id: doneRow.sourceType === "template" ? doneRow.sourceId : null,
        unite_item_id: doneRow.sourceType === "unite" ? doneRow.sourceId : null,
        bt_id: null,
        nom_snapshot: doneRow.nom,
        frequence_km_snapshot: doneRow.frequence_km,
        frequence_jours_snapshot: doneRow.frequence_jours,
        date_effectuee: doneDate,
        km_effectue: numOrNull(doneKm),
        note: doneNote.trim() || null,
      };

      const { error } = await supabase.from("unite_entretien_historique").insert(payload);
      if (error) throw error;

      setDoneOpen(false);
      setDoneRow(null);
      await loadAll();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
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
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top" as const,
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
      maxWidth: 520,
      background: "#fff",
      borderRadius: 14,
      padding: 16,
      boxShadow: "0 20px 50px rgba(0,0,0,.20)",
      border: "1px solid rgba(0,0,0,.08)",
    },
  };

  if (loading || !unite) {
    return <div className="card">Chargement…</div>;
  }

  return (
    <>
      <div style={styles.card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <Panel title="Unité">
            <div style={{ fontWeight: 900, fontSize: 22 }}>{unite.no_unite}</div>
            <div style={{ color: "rgba(0,0,0,.65)" }}>{[unite.marque, unite.modele].filter(Boolean).join(" ") || "—"}</div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={styles.card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Assigner un template</div>
          <div style={styles.row}>
            <select
              style={styles.input}
              value={assignTemplateId}
              onChange={(e) => setAssignTemplateId(e.target.value)}
            >
              <option value="">Choisir un template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom}
                </option>
              ))}
            </select>

            <button style={styles.btnPrimary} type="button" onClick={assignTemplate} disabled={busy}>
              Ajouter
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Ajouter un entretien propre à l’unité</div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
            <input
              style={styles.input}
              placeholder="Nom"
              value={localNom}
              onChange={(e) => setLocalNom(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Fréquence km"
              value={localFreqKm}
              onChange={(e) => setLocalFreqKm(e.target.value)}
              inputMode="numeric"
            />
            <input
              style={styles.input}
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

          <div style={{ marginTop: 10 }}>
            <button style={styles.btnPrimary} type="button" onClick={addLocalItem} disabled={busy}>
              Ajouter l’entretien
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Entretiens applicables</div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Entretien</th>
              <th style={styles.th}>Origine</th>
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
                <td style={styles.td} colSpan={7}>
                  <span style={{ color: "rgba(0,0,0,.6)" }}>Aucun entretien configuré pour cette unité.</span>
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

                return (
                  <tr key={`${row.sourceType}-${row.sourceId}`}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 900 }}>{row.nom}</div>
                      {row.description ? (
                        <div style={{ color: "rgba(0,0,0,.6)", fontSize: 13 }}>{row.description}</div>
                      ) : null}
                    </td>

                    <td style={styles.td}>
                      {row.sourceType === "template" ? row.templateNom || "Template" : "Unité"}
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

                    <td style={styles.td}>{nextDueText(row)}</td>

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

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.btnPrimary} type="button" onClick={() => openDone(row)}>
                        Effectué
                      </button>
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
              <th style={styles.th}>KM</th>
              <th style={styles.th}>Note</th>
            </tr>
          </thead>
          <tbody>
            {historique.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={4}>
                  <span style={{ color: "rgba(0,0,0,.6)" }}>Aucun historique pour cette unité.</span>
                </td>
              </tr>
            ) : (
              historique.map((h) => (
                <tr key={h.id}>
                  <td style={styles.td}>{fmtDate(h.date_effectuee)}</td>
                  <td style={{ ...styles.td, fontWeight: 900 }}>{h.nom_snapshot}</td>
                  <td style={styles.td}>{fmtKm(h.km_effectue)}</td>
                  <td style={styles.td}>{h.note || ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {doneOpen && doneRow && (
        <div style={styles.modalBackdrop} onClick={() => setDoneOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>
              Marquer comme effectué
            </div>

            <div style={{ color: "rgba(0,0,0,.7)", marginBottom: 12 }}>
              <b>{doneRow.nom}</b>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Date</div>
                <input
                  type="date"
                  style={{ ...styles.input, width: "100%" }}
                  value={doneDate}
                  onChange={(e) => setDoneDate(e.target.value)}
                />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>KM</div>
                <input
                  style={{ ...styles.input, width: "100%" }}
                  value={doneKm}
                  onChange={(e) => setDoneKm(e.target.value)}
                  inputMode="numeric"
                  placeholder="KM au moment de l’entretien"
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Note</div>
              <input
                style={{ ...styles.input, width: "100%" }}
                value={doneNote}
                onChange={(e) => setDoneNote(e.target.value)}
                placeholder="Optionnel"
              />
            </div>

            <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 14 }}>
              <button style={styles.btn} type="button" onClick={() => setDoneOpen(false)} disabled={busy}>
                Annuler
              </button>
              <button style={styles.btnPrimary} type="button" onClick={markDone} disabled={busy}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}