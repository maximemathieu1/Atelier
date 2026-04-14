import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { exportBatchBtToAcomba, exportBtToAcomba } from "../lib/acombaExport.bt";

type BtFacturationRow = {
  id: string;
  numero: string | null;
  unite_id: string | null;
  client_id: string | null;
  client_nom: string | null;
  statut: string;
  date_fermeture: string | null;
  total_pieces: number | null;
  total_main_oeuvre: number | null;
  total_frais_atelier: number | null;
  total_general: number | null;
  total_tps: number | null;
  total_tvq: number | null;
  total_final: number | null;
  facture_email_sent_at: string | null;
  facture_email_sent_to: string | null;
  export_acomba_at: string | null;
};

type TabKey = "a_facturer" | "facture";

type ClientContact = {
  id: string;
  client_id: string;
  nom: string;
  poste: string | null;
  telephone: string | null;
  courriel: string | null;
  principal: boolean | null;
  type_facturation: boolean | null;
};

type SavedEmail = {
  id: string;
  email: string;
  label: string;
  name?: string;
  contactId?: string | null;
  isFacturation?: boolean;
  isPrincipal?: boolean;
  source?: "client" | "contact";
};

const EMAIL_FUNCTION_NAME = "smart-function";

function money(v: number | null | undefined) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(v || 0));
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA");
}

async function fetchClientContacts(client_id: string) {
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id,client_id,nom,poste,telephone,courriel,principal,type_facturation")
    .eq("client_id", client_id)
    .order("type_facturation", { ascending: false })
    .order("principal", { ascending: false })
    .order("nom", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClientContact[];
}

export default function FacturationBT() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<BtFacturationRow[]>([]);
  const [tab, setTab] = useState<TabKey>("a_facturer");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [sendComment, setSendComment] = useState("");

  const [pendingSendBt, setPendingSendBt] = useState<BtFacturationRow | null>(null);
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([]);
  const [savedEmailsLoading, setSavedEmailsLoading] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [sendTo, setSendTo] = useState("");
  const [sendToName, setSendToName] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("bons_travail")
        .select(`
          id,
          numero,
          unite_id,
          client_id,
          client_nom,
          statut,
          date_fermeture,
          total_pieces,
          total_main_oeuvre,
          total_frais_atelier,
          total_general,
          total_tps,
          total_tvq,
          total_final,
          facture_email_sent_at,
          facture_email_sent_to,
          export_acomba_at
        `)
        .in("statut", ["a_facturer", "facture"])
        .order("date_fermeture", { ascending: false });

      if (error) throw error;
      setRows((data as BtFacturationRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("facturation-bt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bons_travail" }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const inMenu = target.closest('[data-menu-root="facturation-bt"]');
      if (!inMenu) setMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const aFacturer = useMemo(
    () => rows.filter((r) => r.statut === "a_facturer"),
    [rows]
  );

  const factures = useMemo(
    () => rows.filter((r) => r.statut === "facture"),
    [rows]
  );

  const visibleRows = tab === "a_facturer" ? aFacturer : factures;
  const selectedRows = useMemo(
    () => aFacturer.filter((r) => selectedIds.includes(r.id)),
    [aFacturer, selectedIds]
  );
  const allVisibleSelected =
    tab === "a_facturer" &&
    aFacturer.length > 0 &&
    aFacturer.every((r) => selectedIds.includes(r.id));

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const visibleIds = aFacturer.map((r) => r.id);
      if (checked) {
        return Array.from(new Set([...prev, ...visibleIds]));
      }
      return prev.filter((id) => !visibleIds.includes(id));
    });
  }

  async function exporterAcomba(bt: BtFacturationRow) {
    try {
      await exportBtToAcomba(bt);

      const { error } = await supabase
        .from("bons_travail")
        .update({
          statut: "facture",
          export_acomba_at: new Date().toISOString(),
        })
        .eq("id", bt.id);

      if (error) {
        alert(error.message);
        return;
      }

      setMenuOpenId(null);
      setSelectedIds((prev) => prev.filter((x) => x !== bt.id));
      await load();

      alert("Export Acomba généré ✅");
    } catch (e: any) {
      alert(e?.message ?? "Erreur export Acomba");
    }
  }

  async function exporterAcombaBatch() {
    if (!selectedRows.length) {
      alert("Aucun bon de travail sélectionné.");
      return;
    }

    try {
      setBatchBusy(true);
      await exportBatchBtToAcomba(selectedRows);
      setSelectedIds([]);
      await load();
      alert(`Export batch terminé ✅ (${selectedRows.length} BT)`);
    } catch (e: any) {
      alert(e?.message ?? "Erreur export batch");
    } finally {
      setBatchBusy(false);
    }
  }

  async function loadSavedBillingEmails(clientId: string | null): Promise<SavedEmail[]> {
    setSavedEmails([]);
    if (!clientId) return [];

    setSavedEmailsLoading(true);

    try {
      const found: SavedEmail[] = [];

      try {
        const { data: c } = await supabase
          .from("clients")
          .select("courriel, nom")
          .eq("id", clientId)
          .maybeSingle();

        if (c) {
          const nom = String((c as any).nom ?? "").trim() || undefined;
          const em = String((c as any).courriel ?? "").trim();

          if (em) {
            found.push({
              id: `client|${em.toLowerCase()}`,
              email: em,
              label: nom ? `Client — ${nom}` : "Client",
              name: nom,
              contactId: null,
              isFacturation: false,
              isPrincipal: false,
              source: "client",
            });
          }
        }
      } catch {}

      try {
        const contacts = await fetchClientContacts(clientId);

        const withEmail: SavedEmail[] = contacts
          .filter((x) => String(x.courriel ?? "").trim().length > 0)
          .map((x) => {
            const em = String(x.courriel ?? "").trim();
            const nm = String(x.nom ?? "").trim() || undefined;
            const isFacturation = Boolean(x.type_facturation);
            const isPrincipal = Boolean(x.principal);

            let label = "Contact";
            if (isFacturation) label = "Facturation";
            if (!isFacturation && isPrincipal) label = "Principal";
            if (isFacturation && isPrincipal) label = "Facturation • Principal";
            if (nm) label += ` — ${nm}`;

            return {
              id: `contact|${x.id}`,
              email: em,
              label,
              name: nm,
              contactId: x.id,
              isFacturation,
              isPrincipal,
              source: "contact",
            };
          });

        withEmail.sort((a, b) => {
          const score = (x: SavedEmail) => {
            if (x.isFacturation) return 0;
            if (x.isPrincipal) return 1;
            if (x.source === "client") return 2;
            return 3;
          };

          const s = score(a) - score(b);
          if (s !== 0) return s;
          return a.label.localeCompare(b.label, "fr-CA", { sensitivity: "base" });
        });

        found.push(...withEmail);
      } catch {}

      const uniq = Array.from(new Map(found.map((x) => [x.id, x])).values());
      setSavedEmails(uniq);
      return uniq;
    } finally {
      setSavedEmailsLoading(false);
    }
  }

  function prefillFromSavedEmails(emails: SavedEmail[]) {
    if (!emails.length) {
      setSelectedEmailId("");
      setSelectedContactId("");
      setSendTo("");
      setSendToName("");
      return;
    }

    const preferred =
      emails.find((x) => x.isFacturation && x.contactId) ??
      emails.find((x) => x.isPrincipal && x.contactId) ??
      emails.find((x) => x.source === "client") ??
      emails[0];

    setSelectedEmailId(preferred.id);
    setSelectedContactId(preferred.contactId ?? "");
    setSendTo(preferred.email);
    setSendToName(preferred.name ?? "");
  }

  function closeSendModal() {
    if (sendBusy) return;
    setSendOpen(false);
    setSendBusy(false);
    setSendMsg(null);
    setSendComment("");
    setPendingSendBt(null);
    setSavedEmails([]);
    setSavedEmailsLoading(false);
    setSelectedEmailId("");
    setSelectedContactId("");
    setSendTo("");
    setSendToName("");
  }

  async function envoyerFacture(bt: BtFacturationRow) {
    if (!bt.client_id) {
      alert("Aucun client lié à ce bon de travail.");
      return;
    }

    if (!bt.numero?.trim()) {
      alert("Le numéro du bon de travail est manquant.");
      return;
    }

    if (!Number(bt.total_final || 0)) {
      const ok = confirm("Le total final est à 0 $. Voulez-vous quand même préparer l’envoi ?");
      if (!ok) return;
    }

    setPendingSendBt(bt);
    setSendMsg(null);
    setSendBusy(false);
    setSelectedEmailId("");
    setSelectedContactId("");
    setSendTo("");
    setSendToName("");

    const emails = await loadSavedBillingEmails(bt.client_id);
    setSendOpen(true);
    prefillFromSavedEmails(emails);

    if (!emails.length) {
      setSendMsg(
        "Aucun courriel trouvé (client + contacts). Ajoute un email dans la fiche client ou un contact."
      );
    }
  }

  async function doSendInvoiceEmail(customTo?: string) {
    if (!pendingSendBt || sendBusy) return;

    let to = String(customTo ?? sendTo ?? "").trim();

    if (!to) {
      const first = savedEmails[0]?.email ?? "";
      to = String(first).trim();
      if (to) setSendTo(to);
    }

    if (!to || !to.includes("@")) {
      setSendMsg("Entre un courriel destinataire valide.");
      return;
    }

    try {
      setSendBusy(true);
      setSendMsg(null);

      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || "";

      const url = `${supabaseUrl}/functions/v1/${EMAIL_FUNCTION_NAME}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: anon,
      };

      if (token) headers.Authorization = `Bearer ${token}`;

      const payload: any = {
        bon_travail_id: pendingSendBt.id,
        email_facturation: to,
        client_contact_id: selectedContactId || undefined,
        client_contact_nom: String(sendToName ?? "").trim() || undefined,
        kind: "facture_bt",
        commentaire: String(sendComment ?? "").trim() || null,
      };

      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const txt = await r.text().catch(() => "");

      if (!r.ok) {
        setSendMsg(`❌ Erreur d’envoi : HTTP ${r.status}\n${txt || "(body vide)"}`);
        return;
      }

      const sentAt = new Date().toISOString();

      const { error: markErr } = await supabase
        .from("bons_travail")
        .update({
          facture_email_sent_at: sentAt,
          facture_email_sent_to: to,
        })
        .eq("id", pendingSendBt.id);

      if (markErr) {
        setSendMsg(`❌ Envoi effectué, mais impossible d’enregistrer le statut: ${markErr.message}`);
        return;
      }

      setRows((prev) =>
        prev.map((x) =>
          x.id === pendingSendBt.id
            ? {
                ...x,
                facture_email_sent_at: sentAt,
                facture_email_sent_to: to,
              }
            : x
        )
      );

      setSendMsg("✅ Facture envoyée.");

      setTimeout(() => {
        closeSendModal();
      }, 400);
    } catch (e: any) {
      setSendMsg("❌ Erreur d’envoi : " + (e?.message ?? "Erreur inconnue"));
    } finally {
      setSendBusy(false);
    }
  }

  const styles: Record<string, CSSProperties | ((active: boolean) => CSSProperties)> = {
    page: {
      maxWidth: 1280,
      margin: "24px auto",
      padding: "0 14px",
    },
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
      overflow: "visible",
      position: "relative",
      zIndex: 1,
    },
    row: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },
    muted: {
      color: "rgba(0,0,0,.6)",
    },
    btn: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
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
    input: {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "10px 12px",
      background: "#fff",
      outline: "none",
    },
    tableWrap: {
      width: "100%",
      overflowX: "auto",
      overflowY: "visible",
      position: "relative",
      zIndex: 1,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 1040,
      overflow: "visible",
    },
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top",
    },
    dotSent: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      display: "inline-block",
      background: "#16a34a",
    },
    dotNotSent: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      display: "inline-block",
      background: "#9ca3af",
    },
    tabBtn: (active: boolean): CSSProperties => ({
      padding: "8px 14px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      background: active ? "#2563eb" : "#fff",
      color: active ? "#fff" : "#111827",
      fontWeight: 900,
      cursor: "pointer",
      textDecoration: "none",
    }),
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    menuWrap: {
      position: "relative",
      display: "inline-block",
      overflow: "visible",
    },
    menu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 180,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 10,
      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
      zIndex: 9999,
      overflow: "hidden",
    },
    menuItem: {
      width: "100%",
      padding: "10px 12px",
      textAlign: "left",
      background: "#fff",
      border: "none",
      borderBottom: "1px solid rgba(0,0,0,.06)",
      cursor: "pointer",
      fontWeight: 700,
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
      padding: 16,
    },
    modalBox: {
      width: "min(620px, 96vw)",
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #e5e7eb",
      boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      padding: 14,
    },
  };

  return (
    <div style={styles.page as CSSProperties}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Facturation</div>
        <div style={styles.muted as CSSProperties}>
          Gestion des bons de travail à facturer et facturés.
        </div>
      </div>

      <div style={{ ...(styles.row as CSSProperties), marginBottom: 12, justifyContent: "space-between" }}>
        <div style={{ ...(styles.row as CSSProperties) }}>
          <button
            type="button"
            style={(styles.tabBtn as (active: boolean) => CSSProperties)(tab === "a_facturer")}
            onClick={() => setTab("a_facturer")}
          >
            À facturer ({aFacturer.length})
          </button>

          <button
            type="button"
            style={(styles.tabBtn as (active: boolean) => CSSProperties)(tab === "facture")}
            onClick={() => setTab("facture")}
          >
            Facturé ({factures.length})
          </button>
        </div>

        {tab === "a_facturer" && (
          <button
            type="button"
            style={{
              ...(styles.btnPrimary as CSSProperties),
              opacity: selectedRows.length === 0 || batchBusy ? 0.7 : 1,
            }}
            onClick={exporterAcombaBatch}
            disabled={selectedRows.length === 0 || batchBusy}
          >
            {batchBusy
              ? "Export..."
              : `Exporter Acomba${selectedRows.length ? ` (${selectedRows.length})` : ""}`}
          </button>
        )}
      </div>

      {err && (
        <div style={{ ...(styles.card as CSSProperties), borderColor: "rgba(220,38,38,.35)" }}>
          <b>Erreur:</b> {err}
        </div>
      )}

      <div style={styles.card as CSSProperties}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>
            {tab === "a_facturer"
              ? `À facturer (${aFacturer.length})`
              : `Facturé (${factures.length})`}
          </div>

          <div style={styles.muted as CSSProperties}>
            {tab === "a_facturer"
              ? "La date affichée correspond à la date de fermeture du bon de travail et servira de date de facture."
              : "Historique des bons de travail déjà facturés."}
          </div>
        </div>

        <div style={styles.tableWrap as CSSProperties}>
          <table style={styles.table as CSSProperties}>
            <thead>
              {tab === "a_facturer" ? (
                <tr>
                  <th style={{ ...(styles.th as CSSProperties), width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                    />
                  </th>
                  <th style={{ ...(styles.th as CSSProperties), width: 140 }}>Date facture</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 130 }}>#</th>
                  <th style={styles.th as CSSProperties}>Client</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 130 }}>Pièces</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 150 }}>Main-d’œuvre</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 140 }}>Frais atelier</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 150 }}>Total (taxes incl.)</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 90, textAlign: "center" }}>Email</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 90, textAlign: "right" }}>Action</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ ...(styles.th as CSSProperties), width: 140 }}>Date</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 130 }}>#</th>
                  <th style={styles.th as CSSProperties}>Client</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 150 }}>Total (taxes incl.)</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 90, textAlign: "center" }}>Email</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 180 }}>Export Acomba</th>
                  <th style={{ ...(styles.th as CSSProperties), width: 120, textAlign: "right" }}>Action</th>
                </tr>
              )}
            </thead>

            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td style={styles.td as CSSProperties} colSpan={tab === "a_facturer" ? 10 : 7}>
                    <span style={styles.muted as CSSProperties}>
                      {tab === "a_facturer"
                        ? "Aucun bon de travail à facturer."
                        : "Aucun bon de travail facturé."}
                    </span>
                  </td>
                </tr>
              ) : tab === "a_facturer" ? (
                aFacturer.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...(styles.td as CSSProperties), textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => toggleRow(r.id, e.target.checked)}
                      />
                    </td>
                    <td style={styles.td as CSSProperties}>{fmtDate(r.date_fermeture)}</td>
                    <td style={{ ...(styles.td as CSSProperties), fontWeight: 900 }}>{r.numero || "—"}</td>
                    <td style={styles.td as CSSProperties}>{r.client_nom || "—"}</td>
                    <td style={styles.td as CSSProperties}>{money(r.total_pieces)}</td>
                    <td style={styles.td as CSSProperties}>{money(r.total_main_oeuvre)}</td>
                    <td style={styles.td as CSSProperties}>{money(r.total_frais_atelier)}</td>
                    <td
                      style={{ ...(styles.td as CSSProperties), fontWeight: 900 }}
                      title={`Sous-total: ${money(r.total_general)} | TPS: ${money(r.total_tps)} | TVQ: ${money(r.total_tvq)}`}
                    >
                      {money(r.total_final)}
                    </td>
                    <td style={{ ...(styles.td as CSSProperties), textAlign: "center" }}>
                      <span
                        title={
                          r.facture_email_sent_at
                            ? `Envoyé le ${fmtDateTime(r.facture_email_sent_at)}`
                            : "Non envoyé"
                        }
                        style={r.facture_email_sent_at ? (styles.dotSent as CSSProperties) : (styles.dotNotSent as CSSProperties)}
                      />
                    </td>
                    <td
                      style={{
                        ...(styles.td as CSSProperties),
                        textAlign: "right",
                        position: "relative",
                        overflow: "visible",
                      }}
                    >
                      <div style={styles.menuWrap as CSSProperties} data-menu-root="facturation-bt">
                        <button
                          type="button"
                          style={styles.iconBtn as CSSProperties}
                          onClick={() => setMenuOpenId((cur) => (cur === r.id ? null : r.id))}
                        >
                          ...
                        </button>

                        {menuOpenId === r.id && (
                          <div style={styles.menu as CSSProperties}>
                            <button
                              type="button"
                              style={styles.menuItem as CSSProperties}
                              onClick={() => {
                                setMenuOpenId(null);
                                nav(`/bt/${r.id}`);
                              }}
                            >
                              Ouvrir
                            </button>

                            <button
                              type="button"
                              style={styles.menuItem as CSSProperties}
                              onClick={() => {
                                setMenuOpenId(null);
                                envoyerFacture(r);
                              }}
                            >
                              Envoyer
                            </button>

                            <button
                              type="button"
                              style={{ ...(styles.menuItem as CSSProperties), borderBottom: "none" }}
                              onClick={() => exporterAcomba(r)}
                            >
                              Exporter Acomba
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                factures.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td as CSSProperties}>{fmtDate(r.date_fermeture)}</td>
                    <td style={{ ...(styles.td as CSSProperties), fontWeight: 900 }}>{r.numero || "—"}</td>
                    <td style={styles.td as CSSProperties}>{r.client_nom || "—"}</td>
                    <td
                      style={{ ...(styles.td as CSSProperties), fontWeight: 900 }}
                      title={`Sous-total: ${money(r.total_general)} | TPS: ${money(r.total_tps)} | TVQ: ${money(r.total_tvq)}`}
                    >
                      {money(r.total_final)}
                    </td>
                    <td style={{ ...(styles.td as CSSProperties), textAlign: "center" }}>
                      <span
                        title={
                          r.facture_email_sent_at
                            ? `Envoyé le ${fmtDateTime(r.facture_email_sent_at)}`
                            : "Non envoyé"
                        }
                        style={r.facture_email_sent_at ? (styles.dotSent as CSSProperties) : (styles.dotNotSent as CSSProperties)}
                      />
                    </td>
                    <td style={styles.td as CSSProperties}>{fmtDateTime(r.export_acomba_at)}</td>
                    <td style={{ ...(styles.td as CSSProperties), textAlign: "right" }}>
                      <button
                        type="button"
                        style={styles.btn as CSSProperties}
                        onClick={() => nav(`/bt/${r.id}`)}
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <div style={styles.card as CSSProperties}>Chargement…</div>}

      {sendOpen && pendingSendBt && (
        <div style={styles.modalBackdrop as CSSProperties} onMouseDown={closeSendModal}>
          <div style={styles.modalBox as CSSProperties} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Envoyer la facture</div>
              <button style={styles.btn as CSSProperties} onClick={closeSendModal} disabled={sendBusy}>
                Fermer
              </button>
            </div>

            <div style={{ marginTop: 10, color: "#6b7280" }}>
              BT: <b>{pendingSendBt.numero ?? "—"}</b> — <b>{pendingSendBt.client_nom ?? ""}</b>
            </div>

            <div style={{ marginTop: 6, color: "#111827", fontWeight: 800 }}>
              Total facture: {money(pendingSendBt.total_final)}
            </div>

            <div style={{ marginTop: 2, color: "#6b7280", fontSize: 13 }}>
              Sous-total: {money(pendingSendBt.total_general)} • TPS: {money(pendingSendBt.total_tps)} • TVQ: {money(pendingSendBt.total_tvq)}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Contact</div>

              <select
                style={styles.input as CSSProperties}
                value={selectedEmailId}
                onChange={(e) => {
                  const picked = savedEmails.find((x) => x.id === e.target.value);
                  if (!picked) return;

                  setSelectedEmailId(picked.id);
                  setSendTo(picked.email);
                  setSendToName(picked.name ?? "");
                  setSelectedContactId(String(picked.contactId ?? "") || "");
                }}
                disabled={savedEmailsLoading || savedEmails.length === 0 || sendBusy}
              >
                <option value="">
                  {savedEmailsLoading
                    ? "Chargement…"
                    : savedEmails.length === 0
                    ? "— Aucun email enregistré —"
                    : "— Choisir —"}
                </option>

                {savedEmails.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} — {x.email}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
                Le contact de facturation est sélectionné automatiquement par défaut.
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Courriel</div>
              <input
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="client@exemple.com"
                style={styles.input as CSSProperties}
                disabled={sendBusy}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Nom</div>
              <input
                value={sendToName}
                onChange={(e) => setSendToName(e.target.value)}
                placeholder="Nom du contact"
                style={styles.input as CSSProperties}
                disabled={sendBusy}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Commentaire (optionnel)</div>
              <textarea
                value={sendComment}
                onChange={(e) => setSendComment(e.target.value)}
                placeholder="Ex: Merci! Paiement 30 jours. etc."
                style={{
                  ...(styles.input as CSSProperties),
                  minHeight: 90,
                  resize: "vertical",
                }}
                disabled={sendBusy}
              />
            </div>

            {sendMsg && (
              <div
                style={{
                  marginTop: 12,
                  fontWeight: 800,
                  color: sendMsg.startsWith("✅") ? "#065f46" : "#991b1b",
                  whiteSpace: "pre-wrap",
                }}
              >
                {sendMsg}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={styles.btn as CSSProperties} onClick={closeSendModal} disabled={sendBusy}>
                Annuler
              </button>

              <button
                style={styles.btnPrimary as CSSProperties}
                onClick={() => doSendInvoiceEmail(undefined)}
                disabled={sendBusy}
              >
                {sendBusy ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}