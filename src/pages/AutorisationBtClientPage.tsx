import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Autorisation = {
  id: string;
  bt_id: string;
  token: string;
  client_nom: string | null;
  client_email: string | null;
  statut: string;
  message: string | null;
  created_at: string;
  submitted_at: string | null;
};

type AutorisationTache = {
  id: string;
  autorisation_id: string;
  bt_id: string;
  unite_note_id: string;
  titre: string;
  details: string | null;
  decision: string | null;
  note_client: string | null;
};

type Photo = {
  id: string;
  bt_id: string;
  unite_note_id: string | null;
  tache_effectuee_id: string | null;
  storage_path: string;
  note: string | null;
  categorie: string | null;
  url?: string;
};

const BUCKET = "bt-photos";

export default function AutorisationBtClientPage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autorisation, setAutorisation] = useState<Autorisation | null>(null);
  const [taches, setTaches] = useState<AutorisationTache[]>([]);
  const [photosByTask, setPhotosByTask] = useState<Record<string, Photo[]>>({});
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = useMemo(
    () => taches.length > 0 && taches.every((t) => t.decision === "autorise" || t.decision === "refuse"),
    [taches]
  );

  async function loadData() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const { data: auth, error: authErr } = await supabase
        .from("bt_autorisations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (authErr) throw authErr;
      if (!auth) {
        setError("Lien invalide ou expiré.");
        return;
      }

      setAutorisation(auth as Autorisation);

      const { data: taskRows, error: taskErr } = await supabase
        .from("bt_autorisation_taches")
        .select("*")
        .eq("autorisation_id", auth.id)
        .order("created_at", { ascending: true });

      if (taskErr) throw taskErr;

      const loadedTasks = (taskRows || []) as AutorisationTache[];
      setTaches(loadedTasks);

      const noteIds = loadedTasks.map((t) => t.unite_note_id).filter(Boolean);

      if (noteIds.length > 0) {
        const { data: photos, error: photosErr } = await supabase
          .from("bt_tache_photos")
          .select("*")
          .in("unite_note_id", noteIds);

        if (photosErr) throw photosErr;

        const rows = (photos || []) as Photo[];

        const withUrls = await Promise.all(
          rows.map(async (p) => {
            const { data: signed } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(p.storage_path, 60 * 60);

            return {
              ...p,
              url: signed?.signedUrl || "",
            };
          })
        );

        const map: Record<string, Photo[]> = {};
        for (const p of withUrls) {
          if (!p.unite_note_id) continue;
          if (!map[p.unite_note_id]) map[p.unite_note_id] = [];
          map[p.unite_note_id].push(p);
        }

        setPhotosByTask(map);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  function setDecision(tacheId: string, decision: "autorise" | "refuse") {
    setTaches((rows) =>
      rows.map((t) =>
        t.id === tacheId
          ? {
              ...t,
              decision,
            }
          : t
      )
    );
  }

  function setNote(tacheId: string, note: string) {
    setTaches((rows) =>
      rows.map((t) =>
        t.id === tacheId
          ? {
              ...t,
              note_client: note,
            }
          : t
      )
    );
  }

  async function submit() {
    if (!autorisation) return;

    if (!allAnswered) {
      alert("Veuillez autoriser ou refuser chaque tâche avant de confirmer.");
      return;
    }

    setSaving(true);

    try {
      for (const t of taches) {
        const { error } = await supabase
          .from("bt_autorisation_taches")
          .update({
            decision: t.decision,
            note_client: t.note_client?.trim() || null,
          })
          .eq("id", t.id);

        if (error) throw error;
      }

      const hasRefus = taches.some((t) => t.decision === "refuse");

      const { error: authErr } = await supabase
        .from("bt_autorisations")
        .update({
          statut: hasRefus ? "reponse_partielle" : "autorisee",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", autorisation.id);

      if (authErr) throw authErr;

      await loadData();
      alert("Votre réponse a bien été transmise. Merci.");
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l’envoi de la réponse.");
    } finally {
      setSaving(false);
    }
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#f3f4f6",
      padding: 16,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      color: "#0f172a",
    },
    shell: {
      maxWidth: 860,
      margin: "0 auto",
    },
    card: {
      background: "#fff",
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 18px 60px rgba(15,23,42,.10)",
      overflow: "hidden",
    },
    header: {
      padding: 20,
      borderBottom: "1px solid rgba(0,0,0,.08)",
    },
    title: {
      margin: 0,
      fontSize: 24,
      fontWeight: 950,
    },
    subtitle: {
      marginTop: 6,
      color: "rgba(15,23,42,.65)",
      fontWeight: 700,
    },
    body: {
      padding: 18,
    },
    alertDone: {
      padding: 14,
      borderRadius: 14,
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
      color: "#065f46",
      fontWeight: 900,
      marginBottom: 14,
    },
    message: {
      padding: 14,
      borderRadius: 14,
      background: "#f8fafc",
      border: "1px solid rgba(0,0,0,.08)",
      marginBottom: 14,
      color: "#334155",
      fontWeight: 700,
      whiteSpace: "pre-wrap",
    },
    task: {
      border: "1px solid rgba(0,0,0,.09)",
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      background: "#fff",
    },
    taskTitle: {
      fontSize: 17,
      fontWeight: 950,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    photos: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      padding: "6px 0 12px",
    },
    thumb: {
      width: 86,
      height: 86,
      objectFit: "cover",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.10)",
      cursor: "pointer",
      flex: "0 0 auto",
      background: "#f1f5f9",
    },
    actions: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginTop: 8,
    },
    yes: {
      padding: "12px 10px",
      borderRadius: 12,
      border: "1px solid #16a34a",
      background: "#fff",
      color: "#166534",
      fontWeight: 950,
      cursor: "pointer",
    },
    yesActive: {
      padding: "12px 10px",
      borderRadius: 12,
      border: "1px solid #16a34a",
      background: "#16a34a",
      color: "#fff",
      fontWeight: 950,
      cursor: "pointer",
    },
    no: {
      padding: "12px 10px",
      borderRadius: 12,
      border: "1px solid #dc2626",
      background: "#fff",
      color: "#991b1b",
      fontWeight: 950,
      cursor: "pointer",
    },
    noActive: {
      padding: "12px 10px",
      borderRadius: 12,
      border: "1px solid #dc2626",
      background: "#dc2626",
      color: "#fff",
      fontWeight: 950,
      cursor: "pointer",
    },
    textarea: {
      width: "100%",
      minHeight: 70,
      marginTop: 10,
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.14)",
      padding: 10,
      boxSizing: "border-box",
      fontFamily: "inherit",
      resize: "vertical",
    },
    footer: {
      position: "sticky",
      bottom: 0,
      padding: 14,
      background: "#fff",
      borderTop: "1px solid rgba(0,0,0,.08)",
    },
    submit: {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 14,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontSize: 16,
      fontWeight: 950,
      cursor: "pointer",
    },
    submitDisabled: {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 14,
      border: "1px solid #cbd5e1",
      background: "#cbd5e1",
      color: "#64748b",
      fontSize: 16,
      fontWeight: 950,
      cursor: "not-allowed",
    },
    lightbox: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.92)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    lightboxImg: {
      maxWidth: "100%",
      maxHeight: "90vh",
      borderRadius: 12,
      objectFit: "contain",
    },
    close: {
      position: "fixed",
      top: 14,
      right: 14,
      width: 42,
      height: 42,
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.3)",
      background: "rgba(255,255,255,.12)",
      color: "#fff",
      fontSize: 24,
      fontWeight: 900,
      cursor: "pointer",
    },
  };

  if (loading) {
    return <div style={styles.page}>Chargement...</div>;
  }

  if (error || !autorisation) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.card}>
            <div style={styles.body}>
              <b>Erreur :</b> {error || "Autorisation introuvable."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const submitted = Boolean(autorisation.submitted_at);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Autorisation de travaux</h1>
            <div style={styles.subtitle}>
              Veuillez autoriser ou refuser les tâches proposées.
            </div>
          </div>

          <div style={styles.body}>
            {submitted && (
              <div style={styles.alertDone}>
                Réponse déjà transmise. Merci.
              </div>
            )}

            {autorisation.message && (
              <div style={styles.message}>{autorisation.message}</div>
            )}

            {taches.map((t) => {
              const photos = photosByTask[t.unite_note_id] || [];

              return (
                <div key={t.id} style={styles.task}>
                  <div style={styles.taskTitle}>{t.titre}</div>

                  {t.details && (
                    <div style={{ color: "#64748b", fontWeight: 700, marginBottom: 8 }}>
                      {t.details}
                    </div>
                  )}

                  {photos.length > 0 && (
                    <div style={styles.photos}>
                      {photos.map((p) => (
                        <img
                          key={p.id}
                          src={p.url}
                          alt="Photo tâche"
                          style={styles.thumb}
                          onClick={() => setActivePhoto(p)}
                        />
                      ))}
                    </div>
                  )}

                  <div style={styles.actions}>
                    <button
                      type="button"
                      disabled={submitted}
                      style={t.decision === "autorise" ? styles.yesActive : styles.yes}
                      onClick={() => setDecision(t.id, "autorise")}
                    >
                      Autoriser
                    </button>

                    <button
                      type="button"
                      disabled={submitted}
                      style={t.decision === "refuse" ? styles.noActive : styles.no}
                      onClick={() => setDecision(t.id, "refuse")}
                    >
                      Refuser
                    </button>
                  </div>

                  <textarea
                    style={styles.textarea}
                    disabled={submitted}
                    placeholder="Note optionnelle"
                    value={t.note_client || ""}
                    onChange={(e) => setNote(t.id, e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          {!submitted && (
            <div style={styles.footer}>
              <button
                type="button"
                style={allAnswered && !saving ? styles.submit : styles.submitDisabled}
                disabled={!allAnswered || saving}
                onClick={submit}
              >
                {saving ? "Envoi..." : "Confirmer mes réponses"}
              </button>
            </div>
          )}
        </div>
      </div>

      {activePhoto && (
        <div style={styles.lightbox} onClick={() => setActivePhoto(null)}>
          <button type="button" style={styles.close} onClick={() => setActivePhoto(null)}>
            ×
          </button>

          <img
            src={activePhoto.url}
            alt="Photo agrandie"
            style={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}