import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./GlobalAtelierSearch.css";

type UniteResult = {
  id: string; no_unite: string; marque: string | null; modele: string | null;
  niv: string | null; plaque: string | null; km_actuel: number | null;
};
type BtResult = {
  id: string; numero: string | null; statut: string | null; unite_id: string | null;
  client_nom: string | null; date_ouverture: string | null;
};
type ClientResult = { id: string; nom: string };
type PieceResult = { id: string; nom: string | null; sku: string | null; quantite: number | null };

type Props = { open: boolean; onClose: () => void };
const kmText = (value: number | null) => value == null ? "—" : `${Number(value).toLocaleString("fr-CA")} km`;
const norm = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const activeBt = (statut: string | null) => ["en_cours", "en cours", "ouvert", "a_faire", "à faire"].includes(norm(statut));

export default function GlobalAtelierSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [units, setUnits] = useState<UniteResult[]>([]);
  const [bts, setBts] = useState<BtResult[]>([]);
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [pieces, setPieces] = useState<PieceResult[]>([]);

  useEffect(() => {
    if (open) {
      setQuery(""); setUnits([]); setBts([]); setClients([]); setPieces([]); setError("");
      requestRef.current += 1;
      const focus = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(focus);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const search = query.trim();
    const requestId = ++requestRef.current;
    if (search.length < 2) {
      setLoading(false); setUnits([]); setBts([]); setClients([]); setPieces([]); setError("");
      return;
    }
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError("");
      // Éviter que des caractères spéciaux modifient le filtre PostgREST .or().
      const term = search.replace(/[,().%*_]/g, " ").trim().slice(0, 70);
      if (!term) { setLoading(false); return; }
      try {
        const [uRes, btRes, clientRes, pieceRes] = await Promise.all([
          supabase.from("unites")
            .select("id,no_unite,marque,modele,niv,plaque,km_actuel")
            .or(`no_unite.ilike.%${term}%,niv.ilike.%${term}%,plaque.ilike.%${term}%,marque.ilike.%${term}%,modele.ilike.%${term}%`)
            .limit(12),
          supabase.from("bons_travail")
            .select("id,numero,statut,unite_id,client_nom,date_ouverture")
            .or(`numero.ilike.%${term}%,client_nom.ilike.%${term}%`)
            .order("date_ouverture", { ascending: false }).limit(15),
          supabase.from("clients").select("id,nom").ilike("nom", `%${term}%`).limit(8),
          supabase.from("inventaire_items").select("id,nom,sku,quantite")
            .or(`nom.ilike.%${term}%,sku.ilike.%${term}%`).limit(8),
        ]);
        if (requestRef.current !== requestId) return;
        if (uRes.error) throw uRes.error;
        if (btRes.error) throw btRes.error;
        const foundUnits = (uRes.data ?? []) as UniteResult[];
        let foundBts = (btRes.data ?? []) as BtResult[];
        if (foundUnits.length) {
          const linked = await supabase.from("bons_travail")
            .select("id,numero,statut,unite_id,client_nom,date_ouverture")
            .in("unite_id", foundUnits.map(u => u.id))
            .order("date_ouverture", { ascending: false }).limit(60);
          if (requestRef.current !== requestId) return;
          if (!linked.error) {
            const byId = new Map(foundBts.map(bt => [bt.id, bt]));
            for (const bt of (linked.data ?? []) as BtResult[]) byId.set(bt.id, bt);
            foundBts = Array.from(byId.values());
          }
        }
        foundBts.sort((a, b) => Number(activeBt(b.statut)) - Number(activeBt(a.statut)) ||
          (b.date_ouverture ?? "").localeCompare(a.date_ouverture ?? ""));
        setUnits(foundUnits);
        setBts(foundBts.slice(0, 20));
        setClients(clientRes.error ? [] : (clientRes.data ?? []) as ClientResult[]);
        setPieces(pieceRes.error ? [] : (pieceRes.data ?? []) as PieceResult[]);
      } catch (e) {
        if (requestRef.current === requestId) setError(e instanceof Error ? e.message : "Recherche indisponible.");
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, onClose]);

  const go = (path: string) => { onClose(); navigate(path); };
  if (!open) return null;
  const hasResults = units.length + bts.length + clients.length + pieces.length > 0;
  return (
    <div className="gas-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="gas-dialog" role="dialog" aria-modal="true" aria-label="Recherche globale Atelier">
        <div className="gas-header">
          <span aria-hidden="true">⌕</span>
          <input ref={inputRef} aria-label="Rechercher une unité, un BT, un NIV, un client ou une pièce"
            placeholder="Unité, BT, NIV, client, pièce…" value={query} onChange={e => setQuery(e.target.value)} />
          <button className="gas-close" type="button" onClick={onClose} aria-label="Fermer">Esc ×</button>
        </div>
        <div className="gas-results">
          {query.trim().length < 2 && <p className="gas-hint">Entrez au moins 2 caractères. Exemple : 2361, BT00353 ou un NIV.</p>}
          {loading && <p className="gas-hint">Recherche en cours…</p>}
          {error && <p className="gas-error" role="alert">{error}</p>}
          {!loading && !error && query.trim().length >= 2 && !hasResults && <p className="gas-hint">Aucun résultat trouvé.</p>}
          {units.length > 0 && <div className="gas-section">
            <div className="gas-section-title">Véhicules ({units.length})</div>
            {units.map(u => <div className="gas-unit" key={u.id}>
              <button type="button" className="gas-result gas-primary" onClick={() => go(`/unites/${u.id}`)}>
                <strong>Unité {u.no_unite}</strong><span>{[u.marque,u.modele].filter(Boolean).join(" ") || "Véhicule"}</span>
              </button>
              <div className="gas-facts"><span>KM actuel : <b>{kmText(u.km_actuel)}</b></span><span>NIV : <b>{u.niv || "—"}</b></span>{u.plaque && <span>Plaque : {u.plaque}</span>}</div>
              <div className="gas-actions">
                <button type="button" onClick={() => go(`/unites/${u.id}`)}>Fiche</button>
                <button type="button" onClick={() => go(`/unites/${u.id}?tab=kilometrage`)}>KM</button>
                <button type="button" onClick={() => go(`/unites/${u.id}?tab=pep`)}>PEP (configuration)</button>
                <button type="button" onClick={() => go(`/unites/${u.id}?tab=entretien`)}>Entretiens</button>
                <button type="button" onClick={() => go(`/admin/dossiers-vehicules/${u.id}`)}>Dossier</button>
              </div>
            </div>)}
          </div>}
          {bts.length > 0 && <div className="gas-section"><div className="gas-section-title">Bons de travail ({bts.length})</div>
            {bts.map(bt => <button type="button" className="gas-result" key={bt.id} onClick={() => go(`/bt/${bt.id}`)}>
              <strong>{bt.numero || "BT"}</strong>
              <span>{bt.client_nom || ""}{bt.client_nom && bt.statut ? " • " : ""}{bt.statut || ""}</span>
              {activeBt(bt.statut) && <em className="gas-active">En cours</em>}
            </button>)}
          </div>}
          {clients.length > 0 && <div className="gas-section"><div className="gas-section-title">Clients ({clients.length})</div>
            {clients.map(c => <button type="button" className="gas-result" key={c.id} onClick={() => go(`/clients/${c.id}`)}><strong>{c.nom}</strong><span>Fiche client</span></button>)}
          </div>}
          {pieces.length > 0 && <div className="gas-section"><div className="gas-section-title">Inventaire ({pieces.length})</div>
            {pieces.map(item => <button type="button" className="gas-result" key={item.id} onClick={() => go("/inventaire")}><strong>{item.sku || item.nom || "Pièce"}</strong><span>{item.nom || ""} • Qté : {item.quantite ?? "—"}</span></button>)}
          </div>}
        </div>
        <div className="gas-footer">Ctrl + K pour rechercher · Échap pour fermer</div>
      </section>
    </div>
  );
}
