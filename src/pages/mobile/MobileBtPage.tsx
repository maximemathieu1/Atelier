import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileBtPage() {
  const { id } = useParams();

  const [bt, setBt] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [doneTasks, setDoneTasks] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoModal, setPhotoModal] = useState<any[] | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const { data: btData } = await supabase
      .from("bons_travail")
      .select("*")
      .eq("id", id)
      .single();

    setBt(btData);

    const { data: notes } = await supabase
      .from("unite_notes")
      .select("*")
      .eq("unite_id", btData.unite_id);

    setTasks(notes || []);

    const { data: done } = await supabase
      .from("bt_taches_effectuees")
      .select("*")
      .eq("bt_id", btData.id)
      .order("date_effectuee", { ascending: false });

    setDoneTasks(done || []);

    const { data: ph } = await supabase
      .from("bt_tache_photos")
      .select("*")
      .eq("bt_id", btData.id);

    setPhotos(ph || []);
  }

  async function completeTask(t: any) {
    const { data: inserted } = await supabase
      .from("bt_taches_effectuees")
      .insert({
        bt_id: bt.id,
        unite_id: bt.unite_id,
        unite_note_id: t.id,
        titre: t.titre,
        date_effectuee: new Date().toISOString(),
      })
      .select("id")
      .single();

    await supabase
      .from("bt_tache_photos")
      .update({
        unite_note_id: null,
        tache_effectuee_id: inserted.id,
      })
      .eq("unite_note_id", t.id);

    await supabase.from("unite_notes").delete().eq("id", t.id);

    load();
  }

  async function uploadPhoto(t: any, file: File) {
    const path = `bt/${bt.id}/photos/${Date.now()}-${file.name}`;

    await supabase.storage.from("bt-documents").upload(path, file);

    await supabase.from("bt_tache_photos").insert({
      bt_id: bt.id,
      unite_id: bt.unite_id,
      unite_note_id: t.id,
      storage_path: path,
    });

    load();
  }

  async function openPhotos(taskId: string) {
    const taskPhotos = photos.filter((p) => p.unite_note_id === taskId);

    const signed = [];

    for (const p of taskPhotos) {
      const { data } = await supabase.storage
        .from("bt-documents")
        .createSignedUrl(p.storage_path, 60);

      if (data?.signedUrl) {
        signed.push(data.signedUrl);
      }
    }

    setPhotoModal(signed);
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>BT {bt?.numero}</h3>

      {/* TACHES A FAIRE */}
      <h4>Tâches à faire</h4>

      {tasks.map((t) => (
        <div
          key={t.id}
          style={{
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 800 }}>{t.titre}</div>

          <button onClick={() => completeTask(t)}>✓</button>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                uploadPhoto(t, e.target.files[0]);
              }
            }}
          />

          <button onClick={() => openPhotos(t.id)}>👁</button>
        </div>
      ))}

      {/* TACHES EFFECTUÉES */}
      <h4>Tâches effectuées</h4>

      {doneTasks.map((t) => (
        <div
          key={t.id}
          style={{
            padding: 10,
            border: "1px solid #ccc",
            marginBottom: 8,
            background: "#f5f5f5",
          }}
        >
          {t.titre}
        </div>
      ))}

      {/* MODAL PHOTOS */}
      {photoModal && (
        <div
          onClick={() => setPhotoModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.8)",
            padding: 20,
          }}
        >
          {photoModal.map((url, i) => (
            <img key={i} src={url} style={{ width: "100%" }} />
          ))}
        </div>
      )}
    </div>
  );
}