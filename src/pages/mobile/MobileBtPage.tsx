import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileBtPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [bt, setBt] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [doneTasks, setDoneTasks] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoModal, setPhotoModal] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [id]);

  const photosByOpenTask = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of photos) {
      const key = String(p.unite_note_id || "");
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [photos]);

  const photosByDoneTask = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of photos) {
      const key = String(p.tache_effectuee_id || "");
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [photos]);

  async function load() {
    if (!id) return;

    setLoading(true);

    try {
      const { data: btData, error: btErr } = await supabase
        .from("bons_travail")
        .select(`
          id,
          numero,
          statut,
          unite_id,
          client_nom,
          date_ouverture,
          km,
          unite:unites!bons_travail_unite_id_fkey(
            no_unite,
            marque,
            modele,
            plaque
          )
        `)
        .eq("id", id)
        .single();

      if (btErr) throw btErr;
      setBt(btData);

      const [notesRes, doneRes, photosRes] = await Promise.all([
        supabase
          .from("unite_notes")
          .select("*")
          .eq("unite_id", (btData as any).unite_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("bt_taches_effectuees")
          .select("*")
          .eq("bt_id", (btData as any).id)
          .order("date_effectuee", { ascending: false }),

        supabase
          .from("bt_tache_photos")
          .select("*")
          .eq("bt_id", (btData as any).id),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (doneRes.error) throw doneRes.error;
      if (photosRes.error) throw photosRes.error;

      setTasks(notesRes.data || []);
      setDoneTasks(doneRes.data || []);
      setPhotos(photosRes.data || []);
    } catch (e: any) {
      alert(e?.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  async function completeTask(t: any) {
    if (!bt?.id) return;

    setBusyId(t.id);

    try {
      const { data: inserted, error: insertErr } = await supabase
        .from("bt_taches_effectuees")
        .insert({
          bt_id: bt.id,
          unite_id: bt.unite_id,
          unite_note_id: t.id,
          titre: t.titre,
          details: t.details ?? null,
          date_effectuee: new Date().toISOString(),
          entretien_template_item_id: t.entretien_template_item_id ?? null,
          entretien_unite_item_id: t.entretien_unite_item_id ?? null,
          entretien_auto: Boolean(t.entretien_auto),
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      if (!inserted?.id) throw new Error("La tâche effectuée n'a pas été créée.");

      const { error: photoErr } = await supabase
        .from("bt_tache_photos")
        .update({
          unite_note_id: null,
          tache_effectuee_id: inserted.id,
        })
        .eq("bt_id", bt.id)
        .eq("unite_note_id", t.id);

      if (photoErr) throw photoErr;

      const { error: deleteErr } = await supabase
        .from("unite_notes")
        .delete()
        .eq("id", t.id);

      if (deleteErr) throw deleteErr;

      await load();
    } catch (e: any) {
      alert(e?.message || "Impossible de compléter la tâche.");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadPhoto(t: any, file: File) {
    if (!bt?.id || !file) return;

    setBusyId(t.id);

    try {
      const cleanName = String(file.name || "photo.jpg")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_+/g, "_");

      const path = `bt/${bt.id}/photos/${Date.now()}-${cleanName}`;

      const { error: uploadErr } = await supabase.storage
        .from("bt-documents")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("bt_tache_photos").insert({
        bt_id: bt.id,
        unite_id: bt.unite_id,
        unite_note_id: t.id,
        storage_path: path,
        nom_fichier: file.name,
        mime_type: file.type || "image/jpeg",
      });

      if (insertErr) throw insertErr;

      await load();
    } catch (e: any) {
      alert(e?.message || "Impossible d'ajouter la photo.");
    } finally {
      setBusyId(null);
    }
  }

  async function openPhotos(list: any[]) {
    const signed: string[] = [];

    for (const p of list) {
      const { data, error } = await supabase.storage
        .from("bt-documents")
        .createSignedUrl(String(p.storage_path || ""), 60);

      if (!error && data?.signedUrl) signed.push(data.signedUrl);
    }

    setPhotoModal(signed);
  }

  if (loading) {
    return <div style={styles.page}>Chargement…</div>;
  }

  return (
    <div style={styles.page}>
      <button type="button" onClick={() => nav("/mobile")} style={styles.backBtn}>
        ← Retour aux BT
      </button>

      <div style={styles.headerCard}>
        <div style={styles.kicker}>Bon de travail</div>
        <div style={styles.title}>BT {bt?.numero || "—"}</div>

        <div style={styles.meta}>
          Unité <b>{bt?.unite?.no_unite || "—"}</b>
        </div>

        <div style={styles.meta}>
          {bt?.unite?.marque || ""} {bt?.unite?.modele || ""}
        </div>

        <div style={styles.meta}>Client : {bt?.client_nom || "—"}</div>
        <div style={styles.badge}>{bt?.statut || "ouvert"}</div>
      </div>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Tâches à faire</h3>

        {tasks.length === 0 ? (
          <div style={styles.empty}>Aucune tâche à faire.</div>
        ) : (
          tasks.map((t) => {
            const taskPhotos = photosByOpenTask[t.id] || [];
            const busy = busyId === t.id;

            return (
              <div key={t.id} style={styles.taskCard}>
                <div style={styles.taskTitle}>{t.titre}</div>

                {t.details ? <div style={styles.taskDetails}>{t.details}</div> : null}

                <div style={styles.actionsGrid}>
                  <button
                    type="button"
                    onClick={() => void completeTask(t)}
                    disabled={busy}
                    style={{
                      ...styles.primaryBtn,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? "Traitement…" : "✓ Effectuer"}
                  </button>

                  <label style={styles.secondaryBtn}>
                    📷 Ajouter photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) void uploadPhoto(t, e.target.files[0]);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={taskPhotos.length === 0}
                    onClick={() => void openPhotos(taskPhotos)}
                    style={{
                      ...styles.secondaryBtn,
                      opacity: taskPhotos.length === 0 ? 0.45 : 1,
                    }}
                  >
                    👁 Photos ({taskPhotos.length})
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Tâches effectuées</h3>

        {doneTasks.length === 0 ? (
          <div style={styles.empty}>Aucune tâche effectuée.</div>
        ) : (
          doneTasks.map((t) => {
            const taskPhotos = photosByDoneTask[t.id] || [];

            return (
              <div key={t.id} style={styles.doneCard}>
                <div style={styles.doneTitle}>{t.titre}</div>

                <div style={styles.doneDate}>
                  {t.date_effectuee
                    ? new Date(t.date_effectuee).toLocaleString("fr-CA")
                    : ""}
                </div>

                <button
                  type="button"
                  disabled={taskPhotos.length === 0}
                  onClick={() => void openPhotos(taskPhotos)}
                  style={{
                    ...styles.secondaryBtn,
                    marginTop: 10,
                    opacity: taskPhotos.length === 0 ? 0.45 : 1,
                  }}
                >
                  👁 Photos ({taskPhotos.length})
                </button>
              </div>
            );
          })
        )}
      </section>

      {photoModal && (
        <div style={styles.modalBackdrop} onClick={() => setPhotoModal(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPhotoModal(null)} style={styles.closeBtn}>
              Fermer
            </button>

            {photoModal.length === 0 ? (
              <div style={styles.empty}>Aucune photo disponible.</div>
            ) : (
              photoModal.map((url, i) => (
                <img key={`${url}-${i}`} src={url} alt="Photo tâche" style={styles.photo} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 14,
    background: "#f3f4f6",
    boxSizing: "border-box",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },
  backBtn: {
    width: "100%",
    padding: "12px 14px",
    marginBottom: 12,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontWeight: 800,
    textAlign: "left",
  },
  headerCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 8px 20px rgba(15,23,42,.06)",
  },
  kicker: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#64748b",
    fontWeight: 900,
  },
  title: {
    fontSize: 24,
    fontWeight: 950,
    color: "#111827",
    marginTop: 4,
  },
  meta: {
    fontSize: 14,
    color: "#475569",
    marginTop: 4,
  },
  badge: {
    display: "inline-block",
    marginTop: 10,
    padding: "5px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#075985",
    fontSize: 12,
    fontWeight: 900,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 950,
    margin: "14px 2px 10px",
    color: "#111827",
  },
  empty: {
    padding: 14,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    color: "#64748b",
  },
  taskCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    boxShadow: "0 6px 16px rgba(15,23,42,.05)",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 950,
    color: "#111827",
    wordBreak: "break-word",
  },
  taskDetails: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
    marginTop: 12,
  },
  primaryBtn: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: "1px solid #14532d",
    background: "#166534",
    color: "#fff",
    fontWeight: 950,
    fontSize: 15,
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#f8fafc",
    color: "#111827",
    fontWeight: 900,
    fontSize: 15,
    textAlign: "center",
    boxSizing: "border-box",
  },
  doneCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  doneTitle: {
    fontWeight: 900,
    color: "#111827",
  },
  doneDate: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.78)",
    padding: 14,
    overflow: "auto",
    zIndex: 9999,
  },
  modalCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 12,
  },
  closeBtn: {
    width: "100%",
    padding: 13,
    marginBottom: 12,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontWeight: 950,
  },
  photo: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 12,
    display: "block",
  },
};