import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const em = email.trim();
    if (!em || !pass) return alert("Courriel et mot de passe requis.");

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pass });
      if (error) throw error;
      onLoggedIn();
    } catch (err: any) {
      alert(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h1 style={{ marginTop: 0 }}>Connexion</h1>

      <form onSubmit={signIn} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Courriel</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Mot de passe</div>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        </label>

        <button disabled={busy} type="submit" style={{ fontWeight: 800 }}>
          Se connecter
        </button>
      </form>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
        Crée ton utilisateur dans Supabase → Authentication → Users.
      </div>
    </div>
  );
}