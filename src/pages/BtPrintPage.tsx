import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import btPrintTemplate from "../templates/btPrintTemplate";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  km_actuel: number | null;
  statut: string;
  niv?: string | null;
  plaque?: string | null;
  client_id?: string | null;
  type_unite_id?: string | null;
};

type Client = {
  id: string;
  nom: string;
  adresse?: string | null;
  ville?: string | null;
  province?: string | null;
  code_postal?: string | null;
  telephone?: string | null;
};

type BonTravail = {
  id: string;
  numero?: string | null;
  bon_commande?: string | null;
  unite_id: string;
  statut: string;
  verrouille?: boolean | null;
  note?: string | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  km?: number | null;
  client_id?: string | null;
  client_nom?: string | null;
  total_pieces?: number | null;
  total_main_oeuvre?: number | null;
  total_frais_atelier?: number | null;
  total_general?: number | null;
};

type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
};

type TacheEffectuee = {
  id: string;
  bt_id: string;
  unite_id: string;
  unite_note_id: string | null;
  titre: string;
  details: string | null;
  date_effectuee: string;
};

type Piece = {
  id: string;
  bt_id: string;
  piece_id?: string | null;
  sku?: string | null;
  description?: string | null;
  quantite?: number | null;
  unite?: string | null;
  prix_unitaire?: number | null;
  total_facture_snapshot?: number | null;
  prix_facture_unitaire_snapshot?: number | null;
};

type MainOeuvreRow = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  description: string | null;
  heures: number;
  taux_horaire: number;
};

type BtPointage = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  actif: boolean;
  note: string | null;
};

function fillTemplate(tpl: string, data: Record<string, any>) {
  return tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, keyRaw) => {
    const key = String(keyRaw ?? "").trim();
    const v = data[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function money(v: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(v || 0));
}

function minutesFromPointage(p: BtPointage) {
  if (p.duration_minutes != null) return Number(p.duration_minutes || 0);
  const a = new Date(p.started_at).getTime();
  const b = new Date(p.ended_at || new Date().toISOString()).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 60000);
}

function statutLabel(statut?: string | null) {
  if (statut === "ouvert" || statut === "a_faire" || statut === "en_cours") return "Ouvert";
  if (statut === "a_facturer") return "À facturer";
  if (statut === "ferme" || statut === "termine") return "Fermé";
  if (statut === "facture") return "Facturé";
  if (statut === "verrouille") return "Verrouillé";
  return statut || "—";
}

export default function BtPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const didStartPrintRef = useRef(false);

  const [bt, setBt] = useState<BonTravail | null>(null);
  const [unite, setUnite] = useState<Unite | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<NoteMeca[]>([]);
  const [tachesEffectuees, setTachesEffectuees] = useState<TacheEffectuee[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [mainOeuvre, setMainOeuvre] = useState<MainOeuvreRow[]>([]);
  const [pointages, setPointages] = useState<BtPointage[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(true);
  const [includeOpenTasks, setIncludeOpenTasks] = useState(true);

  function handleBack() {
    navigate(-1);
  }

  function closeAfterPrint() {
    window.setTimeout(() => {
      try {
        window.close();
      } catch {}
      navigate(-1);
    }, 150);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!id) throw new Error("ID manquant.");

        setLoading(true);
        setErr(null);

        const { data: btData, error: eBt } = await supabase
          .from("bons_travail")
          .select("*")
          .eq("id", id)
          .single();

        if (eBt) throw eBt;
        if (!alive) return;

        const btRow = btData as BonTravail;
        setBt(btRow);

        const { data: uData, error: eU } = await supabase
          .from("unites")
          .select("*")
          .eq("id", btRow.unite_id)
          .single();

        if (eU) throw eU;
        if (!alive) return;
        setUnite(uData as Unite);

        if (btRow.client_id) {
          const { data: cData } = await supabase
            .from("clients")
            .select("id, nom, adresse, ville, province, code_postal, telephone")
            .eq("id", btRow.client_id)
            .maybeSingle();

          if (!alive) return;
          setClient((cData as Client) ?? null);
        } else {
          setClient(null);
        }

        const [
          { data: notesData, error: eNotes },
          { data: teData, error: eTe },
          { data: piecesData, error: ePieces },
          { data: moData, error: eMo },
          { data: pointagesData, error: ePointages },
        ] = await Promise.all([
          supabase
            .from("unite_notes")
            .select("id,unite_id,titre,details,created_at")
            .eq("unite_id", btRow.unite_id)
            .order("created_at", { ascending: false }),
          supabase
            .from("bt_taches_effectuees")
            .select("*")
            .eq("bt_id", btRow.id)
            .order("date_effectuee", { ascending: false }),
          supabase
            .from("bt_pieces")
            .select("*")
            .eq("bt_id", btRow.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("bt_main_oeuvre")
            .select("*")
            .eq("bt_id", btRow.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("bt_pointages")
            .select("*")
            .eq("bt_id", btRow.id)
            .order("started_at", { ascending: true }),
        ]);

        if (eNotes) throw eNotes;
        if (eTe) throw eTe;
        if (ePieces) throw ePieces;
        if (eMo) throw eMo;
        if (ePointages) throw ePointages;
        if (!alive) return;

        setNotes((notesData || []) as NoteMeca[]);
        setTachesEffectuees((teData || []) as TacheEffectuee[]);
        setPieces((piecesData || []) as Piece[]);
        setMainOeuvre((moData || []) as MainOeuvreRow[]);
        setPointages((pointagesData || []) as BtPointage[]);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Erreur chargement impression");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const totalHeures = useMemo(() => {
    let total = 0;

    for (const p of pointages) {
      total += minutesFromPointage(p) / 60;
    }

    for (const row of mainOeuvre) {
      total += Number(row.heures || 0);
    }

    return total;
  }, [pointages, mainOeuvre]);

  const filled = useMemo(() => {
    if (!bt || !unite) return "";

    const entreprise_nom_affiche = "Groupe Breton";
    const entreprise_adresse_l1 = "";
    const entreprise_ville = "";
    const entreprise_province = "";
    const entreprise_code_postal = "";
    const entreprise_email_facturation = "facturation@groupebreton.com";
    const entreprise_telephone = "418-228-8096";

    const client_nom = bt.client_nom?.trim() || client?.nom?.trim() || "—";
    const client_adresse_l1 = client?.adresse?.trim() || "";
    const client_ville = [client?.ville, client?.province, client?.code_postal].filter(Boolean).join(" ").trim();
    const client_telephone = client?.telephone?.trim() || "";

    const bon_commande_row = bt.bon_commande?.trim()
      ? `
        <tr>
          <td class="k">Bon de commande</td>
          <td class="v">${escapeHtml(bt.bon_commande)}</td>
        </tr>
      `
      : "";

    const taches_effectuees_rows = tachesEffectuees.length
      ? tachesEffectuees
          .map(
            (t) => `
              <tr>
                <td>${escapeHtml(t.titre || "—")}</td>
                <td class="center" style="width:160px;">${escapeHtml(formatDateTime(t.date_effectuee))}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="2">Aucune tâche effectuée.</td></tr>`;

    const taches_ouvertes_rows = notes.length
      ? notes
          .map(
            (n) => `
              <tr>
                <td>${escapeHtml(n.titre || "—")}</td>
                <td class="center" style="width:160px;">${escapeHtml(formatDateTime(n.created_at))}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="2">Aucune tâche ouverte.</td></tr>`;

    const taches_ouvertes_section = includeOpenTasks
      ? `
        <div class="section">
          <div class="section-h">Tâches à compléter</div>
          <div class="section-b">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="center" style="width:160px;">Créée le</th>
                </tr>
              </thead>
              <tbody>
                ${taches_ouvertes_rows}
              </tbody>
            </table>
          </div>
        </div>
      `
      : "";

    const pieces_rows = pieces.length
      ? pieces
          .map((p) => {
            const prixU = Number(p.prix_facture_unitaire_snapshot ?? p.prix_unitaire ?? 0);
            const total = Number(
              p.total_facture_snapshot ??
                Number(p.quantite || 0) * Number(p.prix_facture_unitaire_snapshot ?? p.prix_unitaire ?? 0)
            );

            return `
              <tr>
                <td style="width:120px;">${escapeHtml(p.sku || "-")}</td>
                <td>${escapeHtml(p.description || "-")}</td>
                <td class="center" style="width:70px;">${escapeHtml(Number(p.quantite || 0))}</td>
                <td style="width:90px;">${escapeHtml(p.unite || "-")}</td>
                <td class="amount" style="width:130px;">${escapeHtml(money(prixU))}</td>
                <td class="amount" style="width:140px;">${escapeHtml(money(total))}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="6">Aucune pièce.</td></tr>`;

    return fillTemplate(btPrintTemplate, {
      entreprise_nom_affiche,
      entreprise_adresse_l1,
      entreprise_ville,
      entreprise_province,
      entreprise_code_postal,
      entreprise_email_facturation,
      entreprise_telephone,

      bt_numero: escapeHtml(bt.numero || "—"),
      date_ouverture: escapeHtml(formatDateTime(bt.date_ouverture)),
      date_fermeture: escapeHtml(formatDateTime(bt.date_fermeture)),
      bt_statut: escapeHtml(statutLabel(bt.statut)),
      bon_commande_row,

      client_nom: escapeHtml(client_nom),
      client_adresse_l1: escapeHtml(client_adresse_l1),
      client_ville: escapeHtml(client_ville),
      client_telephone: escapeHtml(client_telephone),

      unite_no: escapeHtml(unite.no_unite || "—"),
      unite_plaque: escapeHtml(unite.plaque || "—"),
      unite_niv: escapeHtml(unite.niv || "—"),
      bt_km: escapeHtml(bt.km ?? "—"),

      taches_effectuees_rows,
      taches_ouvertes_section,
      pieces_rows,

      total_pieces: escapeHtml(money(Number(bt.total_pieces || 0))),
      total_main_oeuvre: escapeHtml(money(Number(bt.total_main_oeuvre || 0))),
      total_frais_atelier: escapeHtml(money(Number(bt.total_frais_atelier || 0))),
      total_general: escapeHtml(money(Number(bt.total_general || 0))),
      total_heures: escapeHtml(totalHeures.toFixed(2)),
    });
  }, [bt, unite, client, notes, tachesEffectuees, pieces, totalHeures, includeOpenTasks]);

  function handlePrint() {
    const w = iframeRef.current?.contentWindow;
    if (!w) {
      window.print();
      closeAfterPrint();
      return;
    }

    const done = () => {
      try {
        w.removeEventListener("afterprint", done as EventListener);
      } catch {}
      closeAfterPrint();
    };

    try {
      w.addEventListener("afterprint", done as EventListener, { once: true } as AddEventListenerOptions);
    } catch {}

    try {
      window.addEventListener(
        "afterprint",
        () => {
          closeAfterPrint();
        },
        { once: true }
      );
    } catch {}

    w.print();

    window.setTimeout(() => {
      closeAfterPrint();
    }, 2500);
  }

  function startPrint() {
    if (didStartPrintRef.current) return;
    didStartPrintRef.current = true;
    setShowPrintModal(false);

    window.setTimeout(() => {
      handlePrint();
    }, 120);
  }

  if (loading) return <div>Préparation de l’impression…</div>;
  if (err) return <div style={{ color: "crimson", padding: 16 }}>Erreur: {err}</div>;
  if (!bt) return <div style={{ padding: 16 }}>Introuvable</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setShowPrintModal(true)} style={btn}>
          Imprimer
        </button>

        <button onClick={handleBack} style={btnGhost}>
          Retour
        </button>

        <div style={{ color: "#6b7280", marginLeft: 8 }}>
          Bon de travail <strong>{String(bt.numero ?? "").trim() || "—"}</strong>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        title="Impression BT"
        srcDoc={filled}
        style={{
          width: "100%",
          height: "calc(100vh - 110px)",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
        }}
      />

      {showPrintModal && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Options d’impression</div>
            </div>

            <div style={{ padding: 16 }}>
              <label style={checkRowStyle}>
                <input
                  type="checkbox"
                  checked={includeOpenTasks}
                  onChange={(e) => setIncludeOpenTasks(e.target.checked)}
                />
                <span>Inclure les tâches à compléter</span>
              </label>
            </div>

            <div style={modalFooterStyle}>
              <button style={btnGhost} onClick={handleBack}>
                Annuler
              </button>
              <button style={btn} onClick={startPrint}>
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "#fff",
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,.08)",
  boxShadow: "0 24px 60px rgba(0,0,0,.18)",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(0,0,0,.08)",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: 16,
  borderTop: "1px solid rgba(0,0,0,.08)",
};

const checkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 600,
};