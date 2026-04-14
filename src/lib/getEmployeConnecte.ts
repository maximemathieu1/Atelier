import { supabase } from "./supabaseClient";

export type EmployeConnecte = {
  id: string;
  auth_user_id: string | null;
  nom_complet: string;
  email: string | null;
  role: string | null;
  actif: boolean;
  created_at: string;
};

export async function getEmployeConnecte(): Promise<EmployeConnecte | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return null;
  }

  const userId = userData.user.id;
  const userEmail = (userData.user.email || "").trim().toLowerCase();

  if (userEmail) {
    const { data: byEmail, error: byEmailError } = await supabase
      .from("employes")
      .select("id, auth_user_id, nom_complet, email, role, actif, created_at")
      .eq("email", userEmail)
      .eq("actif", true)
      .maybeSingle();

    if (!byEmailError && byEmail) {
      if (!byEmail.auth_user_id || byEmail.auth_user_id !== userId) {
        await supabase
          .from("employes")
          .update({ auth_user_id: userId })
          .eq("id", byEmail.id);
      }

      return byEmail as EmployeConnecte;
    }
  }

  const { data: byAuthId, error: byAuthIdError } = await supabase
    .from("employes")
    .select("id, auth_user_id, nom_complet, email, role, actif, created_at")
    .eq("auth_user_id", userId)
    .eq("actif", true)
    .maybeSingle();

  if (byAuthIdError) {
    console.error("Erreur getEmployeConnecte:", byAuthIdError);
    return null;
  }

  return (byAuthId as EmployeConnecte | null) ?? null;
}