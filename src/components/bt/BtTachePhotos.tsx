import { useRef, useState, type CSSProperties } from "react";
import { useBtTachePhotos, type BtTachePhoto } from "../../hooks/useBtTachePhotos";

type Props = {
  btId: string;
  uniteId: string;
  uniteNoteId?: string | null;
  tacheEffectueeId?: string | null;
  isReadOnly?: boolean;
};

export default function BtTachePhotos({
  btId,
  uniteId,
  uniteNoteId = null,
  tacheEffectueeId = null,
  isReadOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<BtTachePhoto | null>(null);

  const { photos, loading, uploading, uploadPhoto, deletePhoto } = useBtTachePhotos({
    btId,
    uniteId,
    uniteNoteId,
    tacheEffectueeId,
  });

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Le fichier doit être une image.");
      return;
    }

    await uploadPhoto(file);

    if (inputRef.current) inputRef.current.value = "";
  }

  const styles: Record<string, CSSProperties> = {
    btnPhoto: {
      border: "1px solid rgba(37,99,235,.25)",
      background: "rgba(37,99,235,.08)",
      color: "#1d4ed8",
      borderRadius: 999,
      padding: "8px 12px",
      fontSize: 13,
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 2500,
    },
    modalCard: {
      width: "100%",
      maxWidth: 720,
      maxHeight: "85vh",
      overflow: "auto",
      background: "#fff",
      borderRadius: 16,
      padding: 18,
      boxShadow: "0 24px 70px rgba(0,0,0,.25)",
      border: "1px solid rgba(0,0,0,.08)",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
      marginBottom: 14,
    },
    title: {
      fontSize: 18,
      fontWeight: 950,
      margin: 0,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontSize: 22,
      fontWeight: 900,
      cursor: "pointer",
    },
    btnPrimary: {
      border: "1px solid rgba(37,99,235,.35)",
      background: "#2563eb",
      color: "#fff",
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 14,
      fontWeight: 900,
      cursor: "pointer",
    },
    gallery: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
      gap: 12,
      marginTop: 14,
    },
    photoCard: {
      position: "relative",
      border: "1px solid rgba(0,0,0,.10)",
      borderRadius: 14,
      overflow: "hidden",
      background: "#f8fafc",
    },
    thumb: {
      width: "100%",
      height: 130,
      objectFit: "cover",
      display: "block",
      cursor: "pointer",
    },
    deleteBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,.18)",
      background: "#fff",
      color: "#dc2626",
      fontWeight: 950,
      cursor: "pointer",
    },
    empty: {
      marginTop: 14,
      padding: 18,
      borderRadius: 14,
      border: "1px dashed rgba(0,0,0,.18)",
      color: "rgba(0,0,0,.55)",
      fontWeight: 800,
      textAlign: "center",
    },
    lightbox: {
      position: "fixed",
      inset: 0,
      zIndex: 3500,
      background: "rgba(0,0,0,.9)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
    },
    lightboxImg: {
      maxWidth: "100%",
      maxHeight: "88vh",
      borderRadius: 12,
      objectFit: "contain",
      background: "#111",
    },
    lightboxClose: {
      position: "fixed",
      top: 16,
      right: 16,
      width: 42,
      height: 42,
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.35)",
      background: "rgba(255,255,255,.12)",
      color: "#fff",
      fontSize: 24,
      fontWeight: 900,
      cursor: "pointer",
    },
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
  type="button"
  onClick={() => setModalOpen(true)}
  style={{
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 18,
    color: "#111",
    padding: 4,
  }}
  title={photos.length > 0 ? "Voir les photos" : "Ajouter une photo"}
>
  {loading ? "…" : photos.length > 0 ? "👁" : "+"}
</button>

      {modalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.title}>Photos de la tâche</h3>

              <button type="button" style={styles.closeBtn} onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                style={styles.btnPrimary}
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? "Ajout en cours..." : "Ajouter une photo"}
              </button>
            )}

            {photos.length === 0 ? (
              <div style={styles.empty}>Aucune photo ajoutée pour cette tâche.</div>
            ) : (
              <div style={styles.gallery}>
                {photos.map((p) => (
                  <div key={p.id} style={styles.photoCard}>
                    <img
                      src={p.url}
                      alt="Photo tâche"
                      style={styles.thumb}
                      onClick={() => setActivePhoto(p)}
                    />

                    {!isReadOnly && (
                      <button
                        type="button"
                        style={styles.deleteBtn}
                        onClick={() => deletePhoto(p)}
                        title="Supprimer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activePhoto && (
        <div style={styles.lightbox} onClick={() => setActivePhoto(null)}>
          <button type="button" style={styles.lightboxClose}>
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
    </>
  );
}