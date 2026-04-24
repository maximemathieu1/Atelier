import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type BtTachePhoto = {
  id: string;
  bt_id: string;
  unite_id: string;
  unite_note_id: string | null;
  tache_effectuee_id: string | null;
  storage_path: string;
  note: string | null;
  categorie: string | null;
  created_at: string;
  url?: string;
};

type Args = {
  btId: string;
  uniteId: string;
  uniteNoteId?: string | null;
  tacheEffectueeId?: string | null;
};

const BUCKET = "bt-photos";

export function useBtTachePhotos({
  btId,
  uniteId,
  uniteNoteId = null,
  tacheEffectueeId = null,
}: Args) {
  const [photos, setPhotos] = useState<BtTachePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canLoad = Boolean(btId && uniteId && (uniteNoteId || tacheEffectueeId));

  const queryKey = useMemo(
    () => `${btId}-${uniteId}-${uniteNoteId || ""}-${tacheEffectueeId || ""}`,
    [btId, uniteId, uniteNoteId, tacheEffectueeId]
  );

  const loadPhotos = useCallback(async () => {
    if (!canLoad) {
      setPhotos([]);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("bt_tache_photos")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (uniteNoteId) {
        query = query.eq("unite_note_id", uniteNoteId);
      } else if (tacheEffectueeId) {
        query = query.eq("tache_effectuee_id", tacheEffectueeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rows = (data || []) as BtTachePhoto[];

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

      setPhotos(withUrls);
    } catch (e) {
      console.error(e);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [btId, canLoad, uniteNoteId, tacheEffectueeId]);

  useEffect(() => {
    loadPhotos();
  }, [queryKey, loadPhotos]);

  async function uploadPhoto(file: File, note?: string) {
    if (!canLoad) return;

    setUploading(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const photoId = crypto.randomUUID();
      const path = `bt/${btId}/${uniteNoteId || tacheEffectueeId}/${photoId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("bt_tache_photos").insert({
        bt_id: btId,
        unite_id: uniteId,
        unite_note_id: uniteNoteId,
        tache_effectuee_id: tacheEffectueeId,
        storage_path: path,
        note: note?.trim() || null,
        categorie: "Général",
      });

      if (insertError) throw insertError;

      await loadPhotos();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l’ajout de la photo.");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photo: BtTachePhoto) {
    if (!window.confirm("Supprimer cette photo ?")) return;

    try {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);

      const { error } = await supabase
        .from("bt_tache_photos")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;

      await loadPhotos();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la suppression.");
    }
  }

  return {
    photos,
    loading,
    uploading,
    loadPhotos,
    uploadPhoto,
    deletePhoto,
  };
}