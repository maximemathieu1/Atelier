// src/hooks/useEmployes.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type EmployeRow = {
  id: string;
  auth_user_id: string | null;
  nom_complet: string;
  role: string | null;
  actif: boolean;
  created_at: string;
};

type SaveEmployeInput = {
  nom_complet: string;
  role?: string | null;
  actif?: boolean;
  auth_user_id?: string | null;
};

export function useEmployes() {
  const [employes, setEmployes] = useState<EmployeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchEmployes = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("employes")
      .select("*")
      .order("nom_complet", { ascending: true });

    if (error) {
      setError(error.message || "Erreur lors du chargement des employés.");
      setEmployes([]);
    } else {
      setEmployes((data || []) as EmployeRow[]);
    }

    setLoading(false);
  }, []);

  const addEmploye = useCallback(async (input: SaveEmployeInput) => {
    setSaving(true);
    setError("");

    const payload = {
      nom_complet: input.nom_complet.trim(),
      role: (input.role ?? "mecano")?.trim() || "mecano",
      actif: input.actif ?? true,
      auth_user_id: input.auth_user_id ?? null,
    };

    const { error } = await supabase.from("employes").insert(payload);

    if (error) {
      setError(error.message || "Erreur lors de l’ajout.");
      setSaving(false);
      return false;
    }

    await fetchEmployes();
    setSaving(false);
    return true;
  }, [fetchEmployes]);

  const updateEmploye = useCallback(
    async (id: string, values: Partial<SaveEmployeInput>) => {
      setSaving(true);
      setError("");

      const payload: Record<string, unknown> = {};

      if (values.nom_complet !== undefined) {
        payload.nom_complet = values.nom_complet.trim();
      }
      if (values.role !== undefined) {
        payload.role = values.role?.trim() || null;
      }
      if (values.actif !== undefined) {
        payload.actif = values.actif;
      }
      if (values.auth_user_id !== undefined) {
        payload.auth_user_id = values.auth_user_id;
      }

      const { error } = await supabase.from("employes").update(payload).eq("id", id);

      if (error) {
        setError(error.message || "Erreur lors de la modification.");
        setSaving(false);
        return false;
      }

      await fetchEmployes();
      setSaving(false);
      return true;
    },
    [fetchEmployes]
  );

  const deleteEmploye = useCallback(
    async (id: string) => {
      setSaving(true);
      setError("");

      const { error } = await supabase.from("employes").delete().eq("id", id);

      if (error) {
        setError(error.message || "Erreur lors de la suppression.");
        setSaving(false);
        return false;
      }

      await fetchEmployes();
      setSaving(false);
      return true;
    },
    [fetchEmployes]
  );

  useEffect(() => {
    fetchEmployes();
  }, [fetchEmployes]);

  return {
    employes,
    loading,
    saving,
    error,
    fetchEmployes,
    addEmploye,
    updateEmploye,
    deleteEmploye,
  };
}