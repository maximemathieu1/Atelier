import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SVGProps } from 'react';
import { supabase } from '../lib/supabaseClient';
import './TodoPersonal.css';


// Icônes SVG intégrées : aucune dépendance supplémentaire.
type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { size?: number };
function TodoIcon({ name, size = 20, ...props }: IconProps & { name: 'check' | 'list' | 'plus' | 'trash' | 'close' }) {
  const paths = {
    check: 'M20 6 9 17l-5-5',
    list: 'M3 5l1 1 2-2 M10 5h11 M3 12l1 1 2-2 M10 12h11 M3 19l1 1 2-2 M10 19h11',
    plus: 'M12 5v14 M5 12h14',
    trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    close: 'M18 6 6 18 M6 6l12 12',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
const Check = (props: IconProps) => <TodoIcon name="check" {...props} />;
const ListTodo = (props: IconProps) => <TodoIcon name="list" {...props} />;
const Plus = (props: IconProps) => <TodoIcon name="plus" {...props} />;
const Trash2 = (props: IconProps) => <TodoIcon name="trash" {...props} />;
const X = (props: IconProps) => <TodoIcon name="close" {...props} />;

// La session Atelier est celle établie par le SSO Suite GB.
export default function AtelierTodoPersonal() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let authChanged = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (live) setUserId(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (live && !authChanged) setUserId(error ? null : data.session?.user.id ?? null);
    }).catch(() => { if (live && !authChanged) setUserId(null); });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);
  return userId ? <TodoPersonal key={userId} userId={userId} /> : null;
}

type Todo = {
  id: string;
  user_id: string;
  titre: string;
  description: string | null;
  echeance_date: string | null;
  priorite: 'normale' | 'haute' | 'urgente';
  terminee_at: string | null;
  created_at: string;
};
type View = 'active' | 'completed';
const RETENTION_MS = 5 * 24 * 60 * 60 * 1000;
const errText = (e: unknown) => e instanceof Error ? e.message :
  typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
    ? e.message : 'Une erreur est survenue.';

function sortActive(a: Todo, b: Todo) {
  const rank = { urgente: 0, haute: 1, normale: 2 };
  return rank[a.priorite] - rank[b.priorite] || b.created_at.localeCompare(a.created_at);
}

function TodoPersonal({ userId }: { userId: string }) {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('active');
  const [titre, setTitre] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('gb_todos')
      .select('id,user_id,titre,description,echeance_date,priorite,terminee_at,created_at')
      .eq('user_id', userId)
      .or(`terminee_at.is.null,terminee_at.gt.${new Date(Date.now() - RETENTION_MS).toISOString()}`)
      .order('created_at', { ascending: false });
    if (loadError) throw loadError;
    setItems((data ?? []) as Todo[]);
    setNow(Date.now());
  }, [userId]);

  useEffect(() => {
    let live = true;
    setItems([]);
    setLoading(true);
    setError('');
    void load().catch(e => { if (live) setError(errText(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [load]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load().catch(() => undefined); };
    const timer = window.setInterval(() => { setNow(Date.now()); refresh(); }, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load().catch(e => setError(errText(e)));
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, load]);

  const active = useMemo(() => items.filter(t => !t.terminee_at).sort(sortActive), [items]);
  const completed = useMemo(() => items.filter(t => t.terminee_at && Date.parse(t.terminee_at) > now - RETENTION_MS)
    .sort((a,b) => (b.terminee_at ?? '').localeCompare(a.terminee_at ?? '')), [items, now]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = titre.trim();
    if (!name || busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: e } = await supabase.from('gb_todos')
        .insert({ user_id: userId, titre: name })
        .select('id,user_id,titre,description,echeance_date,priorite,terminee_at,created_at').single();
      if (e) throw e;
      setItems(prev => [data as Todo, ...prev]);
      setTitre(''); setView('active');
    } catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  }

  async function changeCompletion(todo: Todo, complete: boolean) {
    if (pendingId) return;
    setPendingId(todo.id); setError('');
    try {
      // La restauration s'effectue au plus tard 5 jours après complétion.
      if (!complete && (!todo.terminee_at || Date.parse(todo.terminee_at) <= Date.now() - RETENTION_MS)) {
        throw new Error('Le délai de restauration de 5 jours est expiré.');
      }
      const timestamp = complete ? new Date().toISOString() : null;
      // Disparition instantanée; restauration locale si l'enregistrement échoue.
      setItems(prev => prev.map(x => x.id === todo.id ? { ...x, terminee_at: timestamp } : x));
      let query = supabase.from('gb_todos').update({ terminee_at: timestamp })
        .eq('id', todo.id).eq('user_id', userId);
      if (!complete) query = query.gt('terminee_at', new Date(Date.now() - RETENTION_MS).toISOString());
      const { data, error: e } = await query.select('id,terminee_at').maybeSingle();
      if (e) throw e;
      if (!data) throw new Error('Tâche introuvable ou délai de restauration expiré.');
      setItems(prev => prev.map(x => x.id === todo.id ? { ...x, terminee_at: data.terminee_at } : x));
    } catch (e) {
      setItems(prev => prev.map(x => x.id === todo.id ? todo : x));
      setError(errText(e));
    } finally { setPendingId(null); }
  }

  async function deleteSelected() {
    const ids = selectedForDelete.filter(id => completed.some(t => t.id === id));
    if (!ids.length || busy) return;
    if (!window.confirm(`Supprimer définitivement ${ids.length} tâche${ids.length > 1 ? 's' : ''} ?`)) return;
    setBusy(true); setError('');
    try {
      const { data, error: e } = await supabase.from('gb_todos').delete()
        .eq('user_id', userId).in('id', ids).not('terminee_at', 'is', null)
        .select('id');
      if (e) throw e;
      const deleted = new Set((data ?? []).map(row => row.id));
      if (deleted.size !== ids.length) throw new Error('Certaines tâches n’ont pas été supprimées. Rechargez la liste.');
      setItems(prev => prev.filter(t => !deleted.has(t.id)));
      setSelectedForDelete([]);
    } catch (e) { setError(errText(e)); void load().catch(() => undefined); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="gb-todo-launch" onClick={() => setOpen(true)}
        aria-expanded={open} aria-controls={open ? 'atelier-todo-panel' : undefined}
        aria-label={`Ouvrir mes tâches${active.length ? ` (${active.length})` : ''}`}>
        <ListTodo size={21} aria-hidden="true" />
        {active.length > 0 && <span className="gb-todo-count">{active.length}</span>}
      </button>

      {open && (
        <div className="gb-todo-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section id="atelier-todo-panel" className="gb-todo-panel" role="dialog" aria-modal="true" aria-label="Mes tâches">
            <header className="gb-todo-panel-head">
              <h2>Mes tâches</h2>
              <button type="button" className="gb-todo-close" onClick={() => setOpen(false)} aria-label="Fermer"><X size={22} /></button>
            </header>
            <nav className="gb-todo-tabs" aria-label="Liste des tâches">
              <button type="button" className={view === 'active' ? 'selected' : ''} onClick={() => setView('active')}>Mes tâches ({active.length})</button>
              <button type="button" className={view === 'completed' ? 'selected' : ''} onClick={() => { setSelectedForDelete([]); setView('completed'); }}>Complétées ({completed.length})</button>
            </nav>
            {view === 'completed' && selectedForDelete.length > 0 && (
              <div className="gb-todo-deletebar">
                <span>{selectedForDelete.length} sélectionnée{selectedForDelete.length > 1 ? 's' : ''}</span>
                <button type="button" disabled={busy} onClick={() => void deleteSelected()}><Trash2 size={17}/> Supprimer</button>
              </div>
            )}
            {error && <p className="gb-todo-error" role="alert">{error} <button onClick={() => { setError(''); void load().catch(e => setError(errText(e))); }}>Réessayer</button></p>}
            <div className="gb-todo-scroll">
              {loading && <p className="gb-todo-empty">Chargement…</p>}
              {!loading && view === 'active' && active.length === 0 && <p className="gb-todo-empty">Aucune tâche en attente.</p>}
              {!loading && view === 'completed' && completed.length === 0 && <p className="gb-todo-empty">Aucune tâche complétée depuis 5 jours.</p>}
              {(view === 'active' ? active : completed).map(t => (
                <div className="gb-todo-list-row" key={t.id}>
                  {view === 'active' ? (
                    <button type="button" className="gb-todo-circle" disabled={pendingId !== null}
                      aria-label={`Terminer ${t.titre}`} onClick={() => void changeCompletion(t, true)}/>
                  ) : (
                    <button type="button" className="gb-todo-circle gb-todo-circle-done"
                      disabled={pendingId !== null || busy} title="Remettre dans Mes tâches"
                      aria-label={`Remettre ${t.titre} dans Mes tâches`}
                      onClick={() => { setSelectedForDelete(prev => prev.filter(id => id !== t.id)); void changeCompletion(t, false); }}>
                      <Check size={17} aria-hidden="true" />
                    </button>
                  )}
                  <div className="gb-todo-list-copy">
                    <span>{t.titre}</span>
                    {view === 'completed' && <small>Restaurable pendant 5 jours</small>}
                  </div>
                  {view === 'completed' && (
                    <label className="gb-todo-select" title="Sélectionner pour supprimer">
                      <input type="checkbox" checked={selectedForDelete.includes(t.id)}
                        disabled={busy || pendingId !== null}
                        onChange={e => setSelectedForDelete(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))} />
                      <span className="gb-todo-select-label">Supprimer</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
            <form className="gb-todo-add" onSubmit={e => void add(e)}>
              <label htmlFor="gb-todo-new">Nouvelle tâche</label>
              <input id="gb-todo-new" maxLength={200} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Que dois-je faire ?" />
              <div className="gb-todo-add-bottom">
                <button type="submit" disabled={!titre.trim() || busy}><Plus size={18}/> Ajouter</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
