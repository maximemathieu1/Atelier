import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";

type VoiceCorrection = {
  id: string;
  entendu: string;
  remplacement: string;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  entendu: string;
  remplacement: string;
  actif: boolean;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onstart: null | (() => void);
  onerror: null | ((event: { error?: string }) => void);
  onend: null | (() => void);
  onresult: null | ((event: any) => void);
  start: () => void;
  stop: () => void;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const EMPTY_FORM: FormState = {
  entendu: "",
  remplacement: "",
  actif: true,
};

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  const rows = aa.length + 1;
  const cols = bb.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

function isProbablySimilar(a: string, b: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  if (!aa || !bb) return false;
  if (aa === bb) return true;

  if (aa.length >= 5 && bb.length >= 5) {
    if (aa.includes(bb) || bb.includes(aa)) return true;
  }

  const dist = levenshtein(aa, bb);
  const maxLen = Math.max(aa.length, bb.length);

  if (maxLen <= 6 && dist <= 2) return true;
  if (maxLen <= 10 && dist <= 3) return true;

  const tokensA = aa.split(" ").filter(Boolean);
  const tokensB = bb.split(" ").filter(Boolean);

  if (tokensA.length > 0 && tokensB.length > 0) {
    const sameFirstToken = tokensA[0] === tokensB[0];
    const overlap = tokensA.filter((t) => tokensB.includes(t)).length;
    if (sameFirstToken && overlap >= 1) return true;
    if (overlap >= Math.min(tokensA.length, tokensB.length) && overlap >= 2) return true;
  }

  return false;
}

export default function ParametresDicteeVocalePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<VoiceCorrection[]>([]);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoiceCorrection | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechListening, setSpeechListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechInterim, setSpeechInterim] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("systeme_dictee_corrections")
        .select("*")
        .order("entendu", { ascending: true });

      if (error) throw error;
      setItems((data || []) as VoiceCorrection[]);
    } catch (e: any) {
      alert(e?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const w = window as WindowWithSpeechRecognition;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    function onDocClick() {
      setMenuOpenId(null);
    }
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!showInactive && !item.actif) return false;
      if (!q) return true;

      return (
        item.entendu.toLowerCase().includes(q) ||
        item.remplacement.toLowerCase().includes(q)
      );
    });
  }, [items, query, showInactive]);

  const duplicateAnalysis = useMemo(() => {
    const entendu = form.entendu.trim();
    if (!entendu) {
      return {
        exactDuplicate: null as VoiceCorrection | null,
        similarItems: [] as VoiceCorrection[],
      };
    }

    const currentId = editing?.id ?? null;
    const normalized = normalizeText(entendu);

    const candidates = items.filter((item) => item.id !== currentId);

    const exactDuplicate =
      candidates.find((item) => normalizeText(item.entendu) === normalized) ?? null;

    const similarItems = candidates
      .filter((item) => !exactDuplicate || item.id !== exactDuplicate.id)
      .filter((item) => isProbablySimilar(entendu, item.entendu))
      .slice(0, 5);

    return { exactDuplicate, similarItems };
  }, [form.entendu, items, editing?.id]);

  const displayEntenduValue = useMemo(() => {
    const base = form.entendu.trim();
    const interim = speechInterim.trim();
    if (!interim) return form.entendu;
    return base ? `${base} ${interim}` : interim;
  }, [form.entendu, speechInterim]);

  function stopDictation() {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }

  function startDictationForEntendu() {
    const w = window as WindowWithSpeechRecognition;
    const RecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setSpeechError("Dictée vocale non supportée sur cet appareil.");
      return;
    }

    setSpeechError(null);

    try {
      stopDictation();

      const recognition = new RecognitionCtor();
      recognition.lang = "fr-CA";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setSpeechListening(true);
      };

      recognition.onerror = (event) => {
        const errCode = event?.error || "Erreur de dictée vocale.";
        if (errCode === "not-allowed") {
          setSpeechError("Accès au micro refusé.");
        } else if (errCode === "no-speech") {
          setSpeechError("Aucune voix détectée.");
        } else if (errCode === "audio-capture") {
          setSpeechError("Microphone introuvable.");
        } else {
          setSpeechError(errCode);
        }
        setSpeechListening(false);
      };

      recognition.onend = () => {
        setSpeechListening(false);
        recognitionRef.current = null;
      };

      recognition.onresult = (e: any) => {
        let interim = "";
        let final = "";

        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const txt = e.results[i][0]?.transcript ?? "";
          if (e.results[i].isFinal) final += txt;
          else interim += txt;
        }

        setSpeechInterim(interim.trim());

        if (final.trim()) {
          setForm((prev) => {
            const base = prev.entendu.trim();
            const extra = final.trim();
            return {
              ...prev,
              entendu: base ? `${base} ${extra}` : extra,
            };
          });
          setSpeechInterim("");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setSpeechListening(false);
      setSpeechError(e?.message || "Impossible de démarrer la dictée.");
      recognitionRef.current = null;
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSpeechError(null);
    setSpeechInterim("");
    setModalOpen(true);
  }

  function openEdit(item: VoiceCorrection) {
    setEditing(item);
    setForm({
      entendu: item.entendu || "",
      remplacement: item.remplacement || "",
      actif: Boolean(item.actif),
    });
    setSpeechError(null);
    setSpeechInterim("");
    setModalOpen(true);
    setMenuOpenId(null);
  }

  function closeModal() {
    if (saving) return;
    stopDictation();
    setSpeechListening(false);
    setSpeechError(null);
    setSpeechInterim("");
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function saveItem() {
    const entendu = form.entendu.trim();
    const remplacement = form.remplacement.trim();

    if (!entendu) {
      alert("Le champ « Entendu » est obligatoire.");
      return;
    }

    if (!remplacement) {
      alert("Le champ « Remplacer par » est obligatoire.");
      return;
    }

    if (duplicateAnalysis.exactDuplicate) {
      alert(
        `Une correction existe déjà pour « ${duplicateAnalysis.exactDuplicate.entendu} ».`
      );
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("systeme_dictee_corrections")
          .update({
            entendu,
            remplacement,
            actif: form.actif,
          })
          .eq("id", editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("systeme_dictee_corrections").insert({
          entendu,
          remplacement,
          actif: form.actif,
        });

        if (error) throw error;
      }

      closeModal();
      await loadItems();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActif(item: VoiceCorrection) {
    try {
      const { error } = await supabase
        .from("systeme_dictee_corrections")
        .update({ actif: !item.actif })
        .eq("id", item.id);

      if (error) throw error;
      await loadItems();
    } catch (e: any) {
      alert(e?.message || "Erreur lors du changement d'état.");
    }
  }

  async function deleteItem(item: VoiceCorrection) {
    setMenuOpenId(null);
    if (!window.confirm(`Supprimer la correction « ${item.entendu} » ?`)) return;

    try {
      const { error } = await supabase
        .from("systeme_dictee_corrections")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      await loadItems();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la suppression.");
    }
  }

  const styles: Record<string, CSSProperties> = {
    page: { padding: 20, width: "100%" },
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
    },
    title: { margin: 0, fontSize: 24, fontWeight: 900 },
    muted: { color: "rgba(0,0,0,.6)" },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      minWidth: 220,
    },
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
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    tableWrap: {
      overflowX: "auto",
      position: "relative",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "10px 8px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "12px 8px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top",
    },
    badgeOn: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      color: "#065f46",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    },
    badgeOff: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      color: "#92400e",
      background: "#fff7ed",
      border: "1px solid #fed7aa",
    },
    dotsBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    menuWrap: {
      position: "relative",
    },
    menu: {
      position: "absolute",
      right: 0,
      top: 42,
      minWidth: 180,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.10)",
      borderRadius: 12,
      boxShadow: "0 16px 40px rgba(0,0,0,.16)",
      zIndex: 50,
      overflow: "hidden",
    },
    menuItem: {
      width: "100%",
      textAlign: "left",
      padding: "10px 12px",
      border: "none",
      borderBottom: "1px solid rgba(0,0,0,.06)",
      background: "#fff",
      cursor: "pointer",
      fontWeight: 700,
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
      maxWidth: 760,
      background: "#fff",
      borderRadius: 14,
      padding: 16,
      boxShadow: "0 20px 50px rgba(0,0,0,.20)",
      border: "1px solid rgba(0,0,0,.08)",
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: 800,
      marginBottom: 6,
      color: "rgba(0,0,0,.7)",
    },
    field: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      boxSizing: "border-box",
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
    },
    warnBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      background: "#fff7ed",
      border: "1px solid #fed7aa",
      color: "#92400e",
      fontSize: 13,
      lineHeight: 1.45,
    },
    errorBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#991b1b",
      fontSize: 13,
      lineHeight: 1.45,
      fontWeight: 700,
    },
    miniList: {
      margin: "8px 0 0 16px",
      padding: 0,
    },
    dictationWrap: {
      display: "grid",
      gridTemplateColumns: "1fr 56px",
      gap: 10,
      alignItems: "start",
    },
    micBtn: {
      height: 46,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontSize: 20,
      cursor: "pointer",
    },
    micBtnActive: {
      height: 46,
      borderRadius: 10,
      border: "2px solid #dc2626",
      background: "#fff",
      color: "#dc2626",
      fontSize: 20,
      cursor: "pointer",
    },
    helperText: {
      fontSize: 12,
      marginTop: 8,
      color: "rgba(0,0,0,.68)",
    },
    helperError: {
      fontSize: 12,
      marginTop: 6,
      color: "#dc2626",
      fontWeight: 700,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: "space-between" }}>
          <div>
            <h1 style={styles.title}>Dictée vocale</h1>
            <div style={styles.muted}>
              Corrections automatiques appliquées après la transcription du micro.
            </div>
          </div>

          <button style={styles.btnPrimary} onClick={openCreate}>
            Ajouter une correction
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: "space-between" }}>
          <div style={{ ...styles.row, flex: 1 }}>
            <input
              style={{ ...styles.input, flex: 1, minWidth: 260 }}
              placeholder="Rechercher une correction…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <label style={{ ...styles.row, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Voir les inactives
            </label>
          </div>

          <button style={styles.btn} onClick={loadItems}>
            Rafraîchir
          </button>
        </div>

        <div style={{ ...styles.muted, marginTop: 10 }}>
          Les expressions plus longues seront appliquées automatiquement en premier.
        </div>

        <div style={{ ...styles.tableWrap, marginTop: 14 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Actif</th>
                <th style={styles.th}>Entendu par la dictée</th>
                <th style={styles.th}>Remplacer par</th>
                <th style={styles.th}>Modifié</th>
                <th style={{ ...styles.th, width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={styles.td} colSpan={5}>
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={5}>
                    Aucune correction.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <span style={item.actif ? styles.badgeOn : styles.badgeOff}>
                        {item.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 900 }}>{item.entendu}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 900 }}>{item.remplacement}</div>
                    </td>
                    <td style={styles.td}>{fmtDateTime(item.updated_at)}</td>
                    <td style={styles.td}>
                      <div
                        style={styles.menuWrap}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <button
                          style={styles.dotsBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((prev) => (prev === item.id ? null : item.id));
                          }}
                        >
                          ...
                        </button>

                        {menuOpenId === item.id ? (
                          <div style={styles.menu}>
                            <button style={styles.menuItem} onClick={() => openEdit(item)}>
                              Modifier
                            </button>
                            <button style={styles.menuItem} onClick={() => toggleActif(item)}>
                              {item.actif ? "Mettre inactif" : "Mettre actif"}
                            </button>
                            <button
                              style={{ ...styles.menuItem, borderBottom: "none", color: "#b91c1c" }}
                              onClick={() => deleteItem(item)}
                            >
                              Supprimer
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 14 }}>
              {editing ? "Modifier la correction" : "Ajouter une correction"}
            </div>

            <div style={styles.grid2}>
              <div>
                <div style={styles.fieldLabel}>Entendu par la dictée</div>

                <div style={styles.dictationWrap}>
                  <input
                    style={styles.field}
                    value={displayEntenduValue}
                    onChange={(e) => {
                      setForm((s) => ({ ...s, entendu: e.target.value }));
                      setSpeechInterim("");
                    }}
                    placeholder="Ex: drague link louche"
                    autoFocus
                  />

                  <button
                    type="button"
                    style={speechListening ? styles.micBtnActive : styles.micBtn}
                    onClick={() => {
                      if (speechListening) stopDictation();
                      else startDictationForEntendu();
                    }}
                    disabled={!speechSupported}
                    title={
                      !speechSupported
                        ? "Dictée non supportée"
                        : speechListening
                        ? "Arrêter la dictée"
                        : "Démarrer la dictée"
                    }
                  >
                    {speechListening ? "⏹" : "🎤"}
                  </button>
                </div>

                {!speechSupported ? (
                  <div style={styles.helperText}>
                    Dictée vocale non disponible sur cet appareil ou navigateur.
                  </div>
                ) : speechListening ? (
                  <div style={styles.helperText}>
                    Écoute en cours… dicte la mauvaise transcription telle qu’elle sort.
                  </div>
                ) : (
                  <div style={styles.helperText}>
                    Clique sur le micro pour remplir automatiquement ce champ par dictée.
                  </div>
                )}

                {speechError ? <div style={styles.helperError}>{speechError}</div> : null}
              </div>

              <div>
                <div style={styles.fieldLabel}>Remplacer par</div>
                <input
                  style={styles.field}
                  value={form.remplacement}
                  onChange={(e) => setForm((s) => ({ ...s, remplacement: e.target.value }))}
                  placeholder="Ex: drag link lousse"
                />
              </div>

              <div>
                <div style={styles.fieldLabel}>État</div>
                <label style={{ ...styles.row, minHeight: 42, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={form.actif}
                    onChange={(e) => setForm((s) => ({ ...s, actif: e.target.checked }))}
                  />
                  Correction active
                </label>
              </div>
            </div>

            {duplicateAnalysis.exactDuplicate ? (
              <div style={styles.errorBox}>
                Une correction existe déjà pour « {duplicateAnalysis.exactDuplicate.entendu} ».
              </div>
            ) : null}

            {!duplicateAnalysis.exactDuplicate && duplicateAnalysis.similarItems.length > 0 ? (
              <div style={styles.warnBox}>
                Corrections semblables détectées :
                <ul style={styles.miniList}>
                  {duplicateAnalysis.similarItems.map((item) => (
                    <li key={item.id}>
                      <b>{item.entendu}</b> → {item.remplacement}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 16 }}>
              <button style={styles.btn} onClick={closeModal} disabled={saving}>
                Annuler
              </button>
              <button style={styles.btnPrimary} onClick={saveItem} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}