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

type CircuitDriver = {
  id: string;
  circuit: string;
  unite: string;
  nom_conducteur: string | null;
  telephone: string | null;
  compagnie: string | null;
};

// Les affectations sont lues par une fonction Edge du projet Atelier.
// Aucune clé du projet Circuits scolaires n'est exposée dans le navigateur.
const normalizeUnit = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/^0+(?=\d)/, "").toUpperCase();
const isReserveCircuit = (value: string) =>
  /SPARE|R[EÉ]SERVE/i.test(value.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
const phoneHref = (value: string) => `tel:${value.replace(/[^\d+]/g, "")}`;

type Props = { onClose?: () => void };
const kmText = (value: number | null) => value == null ? "—" : `${Number(value).toLocaleString("fr-CA")} km`;
const norm = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const activeBt = (statut: string | null) => ["en_cours", "en cours", "ouvert", "a_faire", "à faire"].includes(norm(statut));

export default function GlobalAtelierSearch({ onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 560 });
  const close = () => { setOpen(false); onClose?.(); };
  const reposition = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(580, window.innerWidth - 16);
    setPosition({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
  };
  const requestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [units, setUnits] = useState<UniteResult[]>([]);
  const [bts, setBts] = useState<BtResult[]>([]);
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [pieces, setPieces] = useState<PieceResult[]>([]);
  const [drivers, setDrivers] = useState<CircuitDriver[]>([]);
  const [driversNotice, setDriversNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    reposition();
    const update = () => reposition();
    const outside = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const search = query.trim();
    const requestId = ++requestRef.current;
    if (search.length < 2) {
      setLoading(false); setUnits([]); setBts([]); setClients([]); setPieces([]); setDrivers([]); setDriversNotice(""); setError("");
      return;
    }
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError(""); setUnits([]); setBts([]); setClients([]); setPieces([]); setDrivers([]); setDriversNotice("");
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
        foundBts.sort((a, b) =>
          (b.date_ouverture ?? "").localeCompare(a.date_ouverture ?? ""));
        // L'appel passe par la fonction Edge Atelier qui valide la session
        // avant de lire Circuits scolaires avec une clé serveur protégée.
        if (foundUnits.length) {
          try {
            const unitNumbers = [...new Set(foundUnits.map(u => u.no_unite.trim()).filter(Boolean))];
            const { data: response, error: driverError } = await supabase.functions.invoke(
              "atelier-conducteurs-unite",
              { body: { unites: unitNumbers } }
            );
            if (requestRef.current !== requestId) return;
            if (driverError) throw driverError;
            if (!response || response.ok !== true || !Array.isArray(response.conducteurs)) {
              throw new Error(response?.error || "Réponse Circuits scolaires invalide.");
            }
            const rows = response.conducteurs as CircuitDriver[];
            rows.sort((a, b) =>
              Number(isReserveCircuit(a.circuit)) - Number(isReserveCircuit(b.circuit)) ||
              a.circuit.localeCompare(b.circuit, "fr-CA", { numeric: true })
            );
            setDrivers(rows);
          } catch (driverError) {
            if (requestRef.current !== requestId) return;
            setDriversNotice("Conducteurs indisponibles : vérifier la fonction Edge Atelier.");
            console.warn("Lecture des affectations scolaires impossible", driverError);
          }
        }
        setUnits(foundUnits);
        setBts(foundBts.slice(0, 2));
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
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, onClose]);

  const go = (path: string) => { close(); setQuery(""); navigate(path); };
  const openLatestPep = async (unit: UniteResult) => {
    // Ouvrir immédiatement l’onglet pour éviter le blocage des fenêtres surgissantes.
    const pepWindow = window.open("", "_blank");
    if (!pepWindow) {
      setError("Le navigateur bloque l’ouverture du PEP. Autorise les fenêtres surgissantes pour Atelier.");
      return;
    }
    pepWindow.document.title = `Dernier PEP — ${unit.no_unite}`;
    pepWindow.document.body.textContent = "Chargement du dernier PEP…";
    try {
      const { data, error: pepError } = await supabase
        .from("pep_archives")
        .select("id,date_pep,html_complet")
        .eq("unite", unit.no_unite)
        .order("date_pep", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pepError) throw pepError;
      if (!data?.html_complet) {
        pepWindow.document.body.textContent = `Aucun PEP archivé trouvé pour l’unité ${unit.no_unite}.`;
        return;
      }
      pepWindow.document.open();
      pepWindow.document.write(String(data.html_complet));
      pepWindow.document.close();
      close();
      setQuery("");
    } catch (err) {
      pepWindow.document.body.textContent = "Impossible de charger le dernier PEP.";
      setError(err instanceof Error ? err.message : "Impossible de charger le dernier PEP.");
    }
  };

  const hasResults = units.length + bts.length + clients.length + pieces.length > 0;
  return (
    <div ref={rootRef} className="gas-inline-root">
      <div className="atelier-search gas-inline-input">
        <span className="gas-search-icon" aria-hidden="true">⌕</span>
        <input id="atelier-global-search-input" ref={inputRef}
          type="search" autoComplete="off" aria-label="Recherche globale Atelier"
          aria-expanded={open} aria-controls="atelier-global-results"
          placeholder="Recherche rapide…" value={query}
          onFocus={() => { reposition(); setOpen(true); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }} />
        {!query && <kbd aria-hidden="true">Ctrl K</kbd>}
      </div>
      {open && <div id="atelier-global-results" className="gas-dropdown" style={{ top: position.top, left: position.left, width: position.width }}>
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
              {drivers.filter(d => normalizeUnit(d.unite) === normalizeUnit(u.no_unite) && (d.nom_conducteur?.trim() || d.telephone?.trim())).map(d => (
                <div className="gas-driver" key={d.id}>
                  <span>Conducteur{d.circuit ? ` · Circuit ${d.circuit}` : ""} : <strong>{d.nom_conducteur?.trim() || "Non assigné"}</strong></span>
                  {d.telephone?.trim() && <a href={phoneHref(d.telephone)} onClick={event => event.stopPropagation()}>{d.telephone}</a>}
                </div>
              ))}
              {driversNotice && <div className="gas-driver-notice">{driversNotice}</div>}
              <div className="gas-actions">
                <button type="button" onClick={() => go(`/unites/${u.id}`)}>Fiche</button>
                <button type="button" onClick={() => go(`/unites/${u.id}?tab=kilometrage`)}>KM</button>
                <button type="button" onClick={() => void openLatestPep(u)}>PEP</button>
                <button type="button" onClick={() => go(`/unites/${u.id}?tab=entretien`)}>Entretiens</button>
                <button type="button" onClick={() => go(`/admin/dossiers-vehicules/${u.id}`)}>Dossier</button>
              </div>
            </div>)}
          </div>}
          {bts.length > 0 && <div className="gas-section"><div className="gas-section-title">Bons de travail (2 derniers maximum)</div>
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
      </div>}
    </div>
  );
}
