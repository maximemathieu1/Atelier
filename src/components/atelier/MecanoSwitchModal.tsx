import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAtelierSession } from "../../hooks/useAtelierSession";

type Mecano = {
  id: string;
  nom: string;
  actif?: boolean | null;
  pin_code?: string | null;
  mot_de_passe?: string | null;
};

type Props = {
  open: boolean;
  onClose?: () => void;
  force?: boolean;
};

export default function MecanoSwitchModal({ open, onClose, force = false }: Props) {
  const { setMecano, session, clearMecano } = useAtelierSession();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mecanos, setMecanos] = useState<Mecano[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("mecanos")
        .select("id, nom, actif, pin_code, mot_de_passe")
        .or("actif.is.null,actif.eq.true")
        .order("nom", { ascending: true });

      if (cancelled) return;

      if (error) {
        setError("Impossible de charger les mécanos.");
        setMecanos([]);
      } else {
        setMecanos((data as Mecano[]) ?? []);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSecret("");
    setSelectedId(session?.mecanoId ?? "");
  }, [open, session?.mecanoId]);

  const selectedMecano = useMemo(
    () => mecanos.find((m) => m.id === selectedId) ?? null,
    [mecanos, selectedId]
  );

  async function handleConfirm() {
    if (!selectedMecano) {
      setError("Sélectionne un mécano.");
      return;
    }

    const expected = selectedMecano.pin_code ?? selectedMecano.mot_de_passe ?? "";

    if (expected && secret.trim() !== expected.trim()) {
      setError("Code ou mot de passe invalide.");
      return;
    }

    setSaving(true);
    setError("");

    setMecano({
      mecanoId: selectedMecano.id,
      mecanoNom: selectedMecano.nom,
    });

    setSaving(false);
    onClose?.();
  }

  function handleExitCurrent() {
    clearMecano();
    setSelectedId("");
    setSecret("");
    setError("");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Changer de mécano</div>
            <div className="text-sm text-slate-500">
              Sélection rapide sans fermer la session atelier
            </div>
          </div>

          {!force && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>

        <div className="space-y-4 px-5 py-5">
          {session?.mecanoNom ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Mécano actif : <span className="font-semibold">{session.mecanoNom}</span>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Aucun mécano actif.
            </div>
          )}

          {loading ? (
            <div className="text-sm text-slate-500">Chargement des mécanos…</div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Mécano
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-0 focus:border-blue-500"
                >
                  <option value="">Sélectionner un mécano</option>
                  {mecanos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Code / mot de passe
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Entrer le code"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                  }}
                />
              </div>
            </>
          )}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <div>
            {!!session && !force && (
              <button
                type="button"
                onClick={handleExitCurrent}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sortir le mécano actif
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!force && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || loading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Validation..." : "Entrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}