import { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import ClientsListe from "./pages/ClientsListe";
import UnitesListe from "./pages/UnitesListe";
import Login from "./pages/Login";
import ClientView from "./pages/ClientView";
import UniteView from "./pages/UniteView";
import EmployesPage from "./pages/EmployesPage";

import DashboardAtelier from "./pages/DashboardAtelier";
import BTListe from "./pages/BTListe";
import BonTravailPage from "./pages/BonTravailPage";
import BonTravailMecanoPage from "./pages/BonTravailMecanoPage";
import BtPrintPage from "./pages/BtPrintPage";
import OperationTempsReelPage from "./pages/OperationTempsReelPage";
import Inventaire from "./pages/Inventaire";
import FacturationBT from "./pages/FacturationBT";
import FacturesFournisseurs from "./pages/FacturesFournisseurs";
import AutorisationBtClientPage from "./pages/AutorisationBtClientPage";

import ParametresSysteme from "./pages/systeme/ParametresSysteme";
import ParametresConfiguration from "./pages/systeme/ParametresConfiguration";
import ParametresUnitesPage from "./pages/systeme/ParametresUnitesPage";
import ParametresPiecesPage from "./pages/systeme/ParametresPiecesPage";
import ParametresTemplatesPage from "./pages/systeme/ParametresTemplatesPage";
import ParametresDicteeVocalePage from "./pages/systeme/ParametresDicteeVocale";

import PepAccueil from "./pages/pep/PepAccueil";
import PepNouvelle from "./pages/pep/PepNouvelle";
import PepFinal from "./pages/pep/PepFinal";
import PepSuivi from "./pages/pep/PepSuivi";
import PepAdmin from "./pages/pep/PepAdmin";

import { supabase } from "./lib/supabaseClient";
import "./styles.css";

function useIsMobile(bp = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);

  return isMobile;
}

function AppShell({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const isMobile = useIsMobile(900);
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const linkClass = useMemo(
    () =>
      ({ isActive }: { isActive: boolean }) =>
        "navlink" + (isActive ? " navlink-active" : ""),
    []
  );

  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
  }, [location.pathname, location.search, drawerOpen]);

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function toggleDrawer() {
    setDrawerOpen((v) => !v);
  }

  function onNavClick() {
    if (isMobile) closeDrawer();
  }

  return (
    <div className="app-shell">
      {isMobile && drawerOpen && (
        <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
      )}

      <aside
        className={
          "sidebar" +
          (isMobile ? " sidebar-drawer" : "") +
          (isMobile && drawerOpen ? " open" : "")
        }
      >
        <div className="brand">
          <img src="/logo-groupe-breton.png" className="brand-logo" />
        </div>

        <div className="section">
          <div className="section-title">ATELIER</div>

          <NavLink to="/dashboard-atelier" className={linkClass} onClick={onNavClick}>
            Tableau de bord
          </NavLink>

          <NavLink to="/bt" className={linkClass} onClick={onNavClick}>
            Bon Travail
          </NavLink>

          <NavLink to="/operation-temps-reel" className={linkClass} onClick={onNavClick}>
            Opération Temps réel
          </NavLink>

          <NavLink to="/pep" className={linkClass} onClick={onNavClick}>
            PEP
          </NavLink>

          <NavLink to="/inventaire" className={linkClass} onClick={onNavClick}>
            Inventaire
          </NavLink>
        </div>

        <div className="section">
          <div className="section-title">ADMINISTRATION</div>

          <NavLink to="/clients" className={linkClass} onClick={onNavClick}>
            Clients
          </NavLink>

          <NavLink to="/unites" className={linkClass} onClick={onNavClick}>
            Unités
          </NavLink>

          <NavLink to="/employes" className={linkClass} onClick={onNavClick}>
            Employés
          </NavLink>
        </div>

        <div className="section">
          <div className="section-title">COMPTABILITÉ</div>

          <NavLink to="/facturation" className={linkClass} onClick={onNavClick}>
            Facturation Client
          </NavLink>

          <NavLink to="/factures-fournisseurs" className={linkClass} onClick={onNavClick}>
            Factures fournisseurs
          </NavLink>
        </div>

        <div className="section">
          <div className="section-title">SYSTÈME</div>

          <NavLink to="/parametres-systeme" className={linkClass} onClick={onNavClick}>
            Système
          </NavLink>
        </div>

        <div className="section">
          <button className="logout-btn" onClick={onLogout} type="button">
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="content">
        {isMobile && (
          <div className="mobile-topbar">
            <button
              className="mobile-menu-btn"
              onClick={toggleDrawer}
              aria-label="Ouvrir le menu"
              type="button"
            >
              ☰
            </button>
            <div className="mobile-topbar-title">Atelier</div>
            <div style={{ width: 40 }} />
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard-atelier" replace />} />

          <Route path="/clients" element={<ClientsListe />} />
          <Route path="/clients/:id" element={<ClientView />} />

          <Route path="/unites" element={<UnitesListe />} />
          <Route path="/unites/:id" element={<UniteView />} />

          <Route path="/employes" element={<EmployesPage />} />

          <Route path="/dashboard-atelier" element={<DashboardAtelier />} />

          <Route path="/bt" element={<BTListe />} />
          <Route path="/bt/:id" element={<BonTravailPage />} />
          <Route path="/bt-mecano/:id" element={<BonTravailMecanoPage />} />
          <Route path="/bt/:id/imprimer" element={<BtPrintPage />} />

          <Route path="/inventaire" element={<Inventaire />} />
          <Route path="/operation-temps-reel" element={<OperationTempsReelPage />} />

          <Route path="/pep" element={<PepAccueil />}>
            <Route index element={<Navigate to="suivi" replace />} />
            <Route path="nouvelle" element={<PepNouvelle />} />
            <Route path="suivi" element={<PepSuivi />} />
            <Route path="admin" element={<PepAdmin />} />
          </Route>

          <Route path="/pep/final" element={<PepFinal />} />

          <Route path="/facturation" element={<FacturationBT />} />
          <Route path="/factures-fournisseurs" element={<FacturesFournisseurs />} />

          <Route path="/parametres-systeme" element={<ParametresSysteme />} />
          <Route path="/parametres-systeme/configuration" element={<ParametresSysteme />} />
          <Route path="/parametres-systeme/compatibilite" element={<ParametresSysteme />} />
          <Route
            path="/parametres-systeme/entreprise-facturation"
            element={<ParametresSysteme />}
          />
          <Route path="/parametres-systeme/acomba" element={<ParametresSysteme />} />
          <Route path="/parametres-systeme/dictee-vocale" element={<ParametresSysteme />} />

          <Route path="/systeme/parametres" element={<ParametresConfiguration />} />
          <Route path="/systeme/parametres/unites" element={<ParametresUnitesPage />} />
          <Route path="/systeme/parametres/pieces" element={<ParametresPiecesPage />} />
          <Route path="/systeme/parametres/templates" element={<ParametresTemplatesPage />} />
          <Route
            path="/systeme/parametres/dictee-vocale"
            element={<ParametresDicteeVocalePage />}
          />

          <Route path="*" element={<Navigate to="/dashboard-atelier" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const pathRef = useRef(loc.pathname);
  const isPublicAutorisationRoute = loc.pathname.startsWith("/autorisation-bt/");

  useEffect(() => {
    pathRef.current = loc.pathname;
  }, [loc.pathname]);

  useEffect(() => {
    let alive = true;

    async function init() {
      const { data, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error) {
        setIsAuthed(false);
        setLoading(false);
        return;
      }

      const authed = Boolean(data.session);
      setIsAuthed(authed);
      setLoading(false);

      if (pathRef.current.startsWith("/autorisation-bt/")) {
        return;
      }

      if (authed && pathRef.current === "/login") {
        nav("/dashboard-atelier", { replace: true });
      }

      if (!authed && pathRef.current !== "/login") {
        nav("/login", { replace: true });
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const authed = Boolean(session);
      setIsAuthed(authed);

      if (pathRef.current.startsWith("/autorisation-bt/")) {
        return;
      }

      if (!authed) nav("/login", { replace: true });
      else if (pathRef.current === "/login") nav("/dashboard-atelier", { replace: true });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [nav]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  }

  if (isPublicAutorisationRoute) {
    return (
      <Routes>
        <Route path="/autorisation-bt/:token" element={<AutorisationBtClientPage />} />
        <Route path="*" element={<Navigate to="/autorisation-bt" replace />} />
      </Routes>
    );
  }

  if (loading) return <div style={{ padding: 16 }}>Chargement…</div>;

  if (!isAuthed) {
    return (
      <Routes>
        <Route
          path="/login"
          element={<Login onLoggedIn={() => nav("/dashboard-atelier", { replace: true })} />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AppShell onLogout={logout} />;
}