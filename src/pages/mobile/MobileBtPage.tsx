import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileBtPage() {
  const { id } = useParams();

  const [bt, setBt] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [photosByTask, setPhotosByTask] = useState<Record<string, any[]>>({});
  const [newTask, setNewTask] = useState("");
  const [photoModal, setPhotoModal] = useState<any[] | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const { data: btData, error: btErr } = await supabase
      .from("bons_travail")
      .select("*")
      .eq("id", id)
      .single();

    if (btErr) {
      alert(btErr.message);
      return;
    }

    setBt(btData);

    const { data: notes } = await supabase
      .from("unite_notes")
      .select("*")
      .eq("unite_id", btData.unite_id)
      .order("created_at", { ascending: false });

    const taskRows = notes || [];
    setTasks(taskRows);

    const { data: photos } = await supabase
      .from("bt_tache_photos")
      .select("*")
      .eq("bt_id", btData.id);

    const grouped: Record<string, any[]> = {};

    for (const p of photos || []) {
      const key = String(p.unite_note_id || p.tache_effectuee_id || "");
      if (!key) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }

    setPhotosByTask(grouped);
  }

  async function addTask() {
    const titre = newTask.trim();
    if (!titre || !bt) return;

    await supabase.from("unite_notes").insert({
      unite_id: bt.unite_id,
      titre: titre.toUpperCase(),
    });

    setNewTask("");
    await load();
  }

  async function completeTask(t: any) {
    if (!bt) return;

    const { data: done, error: doneErr } = await supabase
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

    if (doneErr) {
      alert(doneErr.message);
      return;
    }

    await supabase
      .from("bt_tache_photos")
      .update({
        unite_note_id: null,
        tache_effectuee_id: done.id,
      })
      .eq("bt_id", bt.id)
      .eq("unite_note_id", t.id);

    await supabase.from("unite_notes").delete().eq("id", t.id);

    await load();
  }

  async function uploadPhoto(t: any, file: File) {
    if (!bt || !file) return;

    const cleanName = file.name
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_");

    const path = `bt/${bt.id}/photos/${Date.now()}-${cleanName}`;

    const { error: uploadErr } = await supabase.storage
      .from("bt-documents")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadErr) {
      alert(uploadErr.message);
      return;
    }

    const { error: insertErr } = await supabase.from("bt_tache_photos").insert({
      bt_id: bt.id,
      unite_id: bt.unite_id,
      unite_note_id: t.id,
      storage_path: path,
      nom_fichier: file.name,
      mime_type: file.type || "image/jpeg",
    });

    if (insertErr) {
      alert(insertErr.message);
      return;
    }

    await load();
  }

  async function openPhotos(photos: any[]) {
    const signedPhotos = [];

    for (const photo of photos) {
      const { data, error } = await supabase.storage
        .from("bt-documents")
        .createSignedUrl(photo.storage_path, 60);

      if (!error && data?.signedUrl) {
        signedPhotos.push({
          ...photo,
          url: data.signedUrl,
        });
      }
    }

    setPhotoModal(signedPhotos);
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>BT {bt?.numero || ""}</h3>

      <div style={{ marginBottom: 18 }}>
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Nouvelle tâche"
          style={{
            width: "100%",
            padding: 12,
            fontSize: 16,
            boxSizing: "border-box",
            marginBottom: 8,
          }}
        />

        <button
          type="button"
          onClick={addTask}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          + Ajouter tâche
        </button>
      </div>

      {tasks.map((t) => {
        const photos = photosByTask[t.id] || [];

        return (
          <div
            key={t.id}
            style={{
              padding: 14,
              border: "1px solid #ddd",
              borderRadius: 12,
              marginBottom: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t.titre}</div>

            {t.details ? (
              <div style={{ marginTop: 6, opacity: 0.7 }}>{t.details}</div>
            ) : null}

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => completeTask(t)}
                style={{ padding: 12, fontWeight: 800 }}
              >
                ✓ Effectuer
              </button>

              <label
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: 12,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  fontWeight: 800,
                  background: "#f7f7f7",
                }}
              >
                📷 Ajouter photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      void uploadPhoto(t, e.target.files[0]);
                    }
                  }}
                />
              </label>

              <button
                type="button"
                disabled={photos.length === 0}
                onClick={() => openPhotos(photos)}
                style={{
                  padding: 12,
                  fontWeight: 800,
                  opacity: photos.length === 0 ? 0.45 : 1,
                }}
              >
                👁 Voir photos ({photos.length})
              </button>
            </div>
          </div>
        );
      })}

      {photoModal && (
        <div
          onClick={() => setPhotoModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            padding: 16,
            overflow: "auto",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <button
              type="button"
              onClick={() => setPhotoModal(null)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                fontWeight: 900,
              }}
            >
              Fermer
            </button>

            {photoModal.length === 0 ? (
              <div>Aucune photo disponible.</div>
            ) : (
              photoModal.map((p) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt={p.nom_fichier || "Photo tâche"}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}