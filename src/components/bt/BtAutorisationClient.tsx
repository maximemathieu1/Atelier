import { useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";

type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
};

type Props = {
  btId: string;
  notes: NoteMeca[];
  isReadOnly: boolean;
  onSent?: () => void;
};

function makeToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export default function BtAutorisationClient({ btId, notes, isReadOnly, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);

  const selectedTasks = notes.filter((t) => selected[t.id]);

  async function envoyerAutorisation() {
    const email = clientEmail.trim();
    const nom = clientNom.trim();

    if (!email) {
      alert("Courriel client requis.");
      return;
    }

    if (selectedTasks.length === 0) {
      alert("Sélectionne au moins une tâche.");
      return;
    }

    setSending(true);

    try {
      const token = makeToken();
      const lienAutorisation = `${window.location.origin}/autorisation-bt/${token}`;

      const { data: auth, error: authErr } = await supabase
        .from("bt_autorisations")
        .insert({
          bt_id: btId,
          token,
          client_nom: nom || null,
          client_email: email,
          message: message.trim() || null,
          statut: "envoyee",
        })
        .select("id")
        .single();

      if (authErr) throw authErr;

      const rows = selectedTasks.map((t) => ({
        autorisation_id: auth.id,
        bt_id: btId,
        unite_note_id: t.id,
        titre: t.titre,
        details: t.details,
      }));

      const { error: taskErr } = await supabase.from("bt_autorisation_taches").insert(rows);
      if (taskErr) throw taskErr;

      const { error: fnErr } = await supabase.functions.invoke("bt-autorisation-email", {
        body: {
          type: "send_demande",
          bt_id: btId,
          autorisation_id: auth.id,
          client_email: email,
          client_nom: nom || null,
          lien_autorisation: lienAutorisation,
          message: message.trim() || null,
          taches: selectedTasks.map((t) => ({
            id: t.id,
            titre: t.titre,
            details: t.details,
          })),
        },
      });

      if (fnErr) throw fnErr;

      alert("Demande d’autorisation envoyée au client.");

      setOpen(false);
      setClientEmail("");
      setClientNom("");
      setMessage("");
      setSelected({});
      onSent?.();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l’envoi de l’autorisation.");
    } finally {
      setSending(false);
    }
  }

  const styles: Record<string, CSSProperties> = {
    btn: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    backdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 9999,
    },
    card: {
      width: "100%",
      maxWidth: 760,
      maxHeight: "88vh",
      background: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 24px 60px rgba(0,0,0,.18)",
      border: "1px solid rgba(0,0,0,.08)",
      display: "flex",
      flexDirection: "column",
    },
    header: {
      padding: "14px 16px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexShrink: 0,
    },
    title: { margin: 0, fontSize: 18, fontWeight: 950 },
    body: {
      padding: 16,
      overflowY: "auto",
      minHeight: 0,
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      marginBottom: 10,
      boxSizing: "border-box",
      fontFamily: "inherit",
    },
    taskList: {
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 12,
      overflow: "hidden",
      background: "#fff",
    },
    rowTask: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      padding: "10px 12px",
      borderTop: "1px solid rgba(0,0,0,.08)",
    },
    rowTaskFirst: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      padding: "10px 12px",
    },
    footer: {
      padding: 16,
      borderTop: "1px solid rgba(0,0,0,.08)",
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      flexShrink: 0,
      background: "#fff",
    },
    btnCancel: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #dc2626",
      background: "#dc2626",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    close: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
    },
    muted: {
      color: "rgba(0,0,0,.6)",
      fontSize: 13,
      marginBottom: 10,
    },
  };

  return (
    <>
      <button
        type="button"
        style={styles.btn}
        disabled={isReadOnly || notes.length === 0}
        onClick={() => {
          const next: Record<string, boolean> = {};
          notes.forEach((t) => (next[t.id] = true));
          setSelected(next);
          setOpen(true);
        }}
      >
        Envoyer au client
      </button>

      {open && (
        <div style={styles.backdrop} onClick={() => setOpen(false)}>
          <div style={styles.card} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h3 style={styles.title}>Autorisation client</h3>
              <button type="button" style={styles.close} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div style={styles.body}>
              <input
                style={styles.input}
                placeholder="Nom du client / contact"
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Courriel du client"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />

              <textarea
                style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
                placeholder="Message optionnel"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <div style={{ fontWeight: 950, marginBottom: 6 }}>Tâches à envoyer</div>
              <div style={styles.muted}>
                {selectedTasks.length} tâche(s) sélectionnée(s) sur {notes.length}.
              </div>

              <div style={styles.taskList}>
                {notes.map((t, index) => (
                  <label key={t.id} style={index === 0 ? styles.rowTaskFirst : styles.rowTask}>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[t.id])}
                      onChange={(e) =>
                        setSelected((s) => ({
                          ...s,
                          [t.id]: e.target.checked,
                        }))
                      }
                    />
                    <span style={{ fontWeight: 800, textTransform: "uppercase" }}>{t.titre}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={styles.footer}>
              <button type="button" style={styles.btnCancel} onClick={() => setOpen(false)}>
                Annuler
              </button>

              <button
                type="button"
                style={styles.btnPrimary}
                disabled={sending}
                onClick={envoyerAutorisation}
              >
                {sending ? "Envoi..." : "Envoyer au client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}