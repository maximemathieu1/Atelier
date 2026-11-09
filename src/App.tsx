import { useEffect, useRef, useState } from "react";
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
import CentreServicePage from "./pages/CentreServicePage";
import BonTravailPage from "./pages/BonTravailPage";
import BonTravailMecanoPage from "./pages/BonTravailMecanoPage";
import BtPrintPage from "./pages/BtPrintPage";
import OperationTempsReelPage from "./pages/OperationTempsReelPage";
import Inventaire from "./pages/Inventaire";
import PneusPage from "./pages/PneusPage";
import GestionAtelierPage from "./pages/GestionAtelierPage";
import FacturationBT from "./pages/FacturationBT";
import FacturesFournisseurs from "./pages/FacturesFournisseurs";
import RapportFacturationAtelier from "./pages/RapportFacturationAtelier";
import AutorisationBtClientPage from "./pages/AutorisationBtClientPage";
import ScannerPiecesPage from "./pages/ScannerPiecesPage";

import DossiersVehiculesPage from "./pages/admin/DossiersVehiculesPage";
import DossierVehiculeDetailPage from "./pages/admin/DossierVehiculeDetailPage";

import MobileAtelierPage from "./pages/mobile/MobileAtelierPage";
import MobileBtPage from "./pages/mobile/MobileBtPage";

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

const SUITE_GB_URL = "https://suite.groupebreton.com";
const SUITE_SUPABASE_URL =
  import.meta.env.VITE_SUITE_SUPABASE_URL ||
  "https://zvzehhzjoaehlvoraatt.supabase.co";

async function connectWithSsoTicket(ticket: string) {
  const response = await fetch(
    `${SUITE_SUPABASE_URL}/functions/v1/validate-sso-ticket`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ticket,
        module_key: "atelier",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "Ticket SSO invalide.");
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Session SSO manquante.");
  }

  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  if (error) {
    throw error;
  }
}

async function restoreSessionFromHash() {
  const hash = window.location.hash;

  if (!hash.includes("access_token") || !hash.includes("refresh_token")) {
    return;
  }

  const params = new URLSearchParams(hash.replace("#", ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return;
  }

  await supabase.auth.setSession({
    access_token: decodeURIComponent(accessToken),
    refresh_token: decodeURIComponent(refreshToken),
  });

  window.history.replaceState(null, "", window.location.pathname);
}

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

function useIsPhone(bp = 768) {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);

  return isPhone;
}

function PhoneRedirectGuard({ children }: { children: React.ReactNode }) {
  const isPhone = useIsPhone(768);
  const location = useLocation();

  const isMobileRoute = location.pathname.startsWith("/mobile");
  const isPrintRoute = location.pathname.includes("/imprimer");
  const isPepFinalRoute = location.pathname.startsWith("/pep/final");

  if (isPhone && !isMobileRoute && !isPrintRoute && !isPepFinalRoute) {
    return <Navigate to="/mobile" replace />;
  }

  return <>{children}</>;
}

type MenuIconName = "dashboard" | "work" | "vehicle" | "parts" | "accounting" | "admin" | "search" | "chevron" | "logout";

function MenuIcon({ name }: { name: MenuIconName }) {
  const paths: Record<MenuIconName, string> = {
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    work: "M14.5 6.5l3 3 4-4a7 7 0 0 1-9 9L6 21a2.12 2.12 0 0 1-3-3l6.5-6.5a7 7 0 0 1 9-9z",
    vehicle: "M5 17h14V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z M5 10h14 M8 3v7 M16 3v7 M8 14h.01 M16 14h.01 M7 17v3 M17 17v3",
    parts: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 7v5l4 3 M12 12l-4 3",
    accounting: "M3 6c0-3 12-3 12 0s-12 3-12 0z M3 6v5c0 3 12 3 12 0V6 M3 11v5c0 3 12 3 12 0v-5 M18 9c4 0 5 2 3 3 M21 12v6c0 2-3 3-6 3",
    admin: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
    search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M16 16l5 5",
    chevron: "M9 5l7 7-7 7",
    logout: "M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4",
  };
  return (
    <svg className="atelier-menu-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

const MENU_GROUPS: { id: string; label: string; icon: MenuIconName; items: { to: string; label: string; keywords?: string }[] }[] = [
  { id: "travaux", label: "Travaux", icon: "work", items: [
    { to: "/bt", label: "Bons de travail", keywords: "BT travaux réparation" },
    { to: "/centre-service", label: "Centre de service", keywords: "CS garantie Lion" },
    { to: "/operation-temps-reel", label: "Opérations en temps réel", keywords: "mécaniciens" },
  ] },
  { id: "vehicules", label: "Véhicules", icon: "vehicle", items: [
    { to: "/unites", label: "Unités", keywords: "véhicules autobus" },
    { to: "/admin/dossiers-vehicules", label: "Dossiers véhicules", keywords: "CVM conformité documents" },
    { to: "/pep", label: "PEP", keywords: "inspection entretien préventif" },
  ] },
  { id: "pieces", label: "Pièces et pneus", icon: "parts", items: [
    { to: "/inventaire", label: "Inventaire", keywords: "pièces stock" },
    { to: "/pneus", label: "Pneus" },
  ] },
  { id: "comptabilite", label: "Comptabilité", icon: "accounting", items: [
    { to: "/facturation", label: "Facturation clients", keywords: "facture BT Acomba" },
    { to: "/factures-fournisseurs", label: "Factures fournisseurs", keywords: "achats réception" },
    { to: "/rapport-facturation-atelier", label: "Rapport de facturation atelier" },
  ] },
  { id: "administration", label: "Administration", icon: "admin", items: [
    { to: "/clients", label: "Clients" },
    { to: "/employes", label: "Employés", keywords: "personnel mécaniciens" },
    { to: "/gestion-atelier", label: "Gestion atelier" },
    { to: "/parametres-systeme", label: "Système", keywords: "paramètres configuration" },
  ] },
];

function matchesMenuPath(path: string, target: string) {
  return path === target || path.startsWith(target + "/") ||
    (target === "/bt" && path.startsWith("/bt-mecano/")) ||
    (target === "/parametres-systeme" && path.startsWith("/systeme/"));
}

function normalizeMenuText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function AppShell({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const isMobile = useIsMobile(900);
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeGroup = MENU_GROUPS.find((group) => group.items.some((item) => matchesMenuPath(location.pathname, item.to)))?.id ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  const [menuQuery, setMenuQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const query = normalizeMenuText(menuQuery.trim());
  const queryWords = query.split(/\s+/).filter(Boolean);
  const matchesQuery = (text: string) => queryWords.every((word) => normalizeMenuText(text).includes(word));
  const visibleGroups = MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => matchesQuery(`${group.label} ${item.label} ${item.keywords ?? ""}`)),
  })).filter((group) => group.items.length > 0);
  const showDashboard = matchesQuery("Tableau de bord accueil dashboard");
  const linkClass = ({ isActive }: { isActive: boolean }) => "navlink" + (isActive ? " navlink-active" : "");

  // Fermer seulement lors d'une navigation, jamais à l'ouverture du tiroir.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuQuery("");
    setOpenGroup(activeGroup);
  }, [location.pathname, location.search, activeGroup]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isMobile) setDrawerOpen(true);
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setMenuQuery("");
        setDrawerOpen(false);
        if (isMobile && drawerOpen) menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, drawerOpen]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    searchRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
      const focusable = Array.from(elements ?? []).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [isMobile, drawerOpen]);

  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }

  function toggleDrawer() {
    setDrawerOpen((value) => !value);
  }

  function onNavClick() {
    setMenuQuery("");
    if (isMobile) closeDrawer();
  }

  return (
    <PhoneRedirectGuard>
      <div className="app-shell">
        {isMobile && drawerOpen && (
          <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
        )}

        <aside
          ref={sidebarRef}
          id="atelier-sidebar"
          className={"sidebar atelier-sidebar" + (isMobile ? " sidebar-drawer" : "") + (isMobile && drawerOpen ? " open" : "")}
          style={isMobile && !drawerOpen ? { visibility: "hidden" } : undefined}
          role={isMobile && drawerOpen ? "dialog" : undefined}
          aria-modal={isMobile && drawerOpen ? true : undefined}
          aria-label="Navigation Atelier"
        >
          <div className="brand">
            <a href={SUITE_GB_URL} title="Retour au portail Suite GB">
              <img src="/logo-gb-suite.svg" className="brand-logo" alt="Groupe Breton — Suite" />
            </a>
            {isMobile && <button type="button" className="atelier-close-menu" onClick={closeDrawer} aria-label="Fermer le menu">×</button>}
          </div>

          <div className="atelier-search">
            <MenuIcon name="search" />
            <input ref={searchRef} type="search" aria-label="Rechercher une page du menu" placeholder="Recherche rapide…" value={menuQuery} onChange={(event) => setMenuQuery(event.target.value)} aria-controls="atelier-navigation" />
            {!menuQuery && <kbd aria-hidden="true">Ctrl K</kbd>}
          </div>

          <nav id="atelier-navigation" className="atelier-navigation" aria-label="Menu principal">
            {showDashboard && (
              <NavLink to="/dashboard-atelier" className={linkClass} onClick={onNavClick}>
                <MenuIcon name="dashboard" /><span>Tableau de bord</span>
              </NavLink>
            )}
            {visibleGroups.map((group) => {
              const expanded = Boolean(query) || openGroup === group.id;
              return (
                <div className="atelier-menu-group" key={group.id}>
                  <button type="button" className={"atelier-group-toggle" + (activeGroup === group.id ? " is-current" : "")} aria-expanded={expanded} aria-controls={`atelier-group-${group.id}`} onClick={() => {
                    if (query) setMenuQuery("");
                    setOpenGroup(expanded ? null : group.id);
                  }}>
                    <MenuIcon name={group.icon} /><span>{group.label}</span>
                    <span className={"atelier-chevron" + (expanded ? " is-open" : "")}><MenuIcon name="chevron" /></span>
                  </button>
                  <div id={`atelier-group-${group.id}`} className="atelier-submenu" hidden={!expanded}>
                    {group.items.map((item) => (
                      <NavLink key={item.to} to={item.to} className={matchesMenuPath(location.pathname, item.to) ? "navlink navlink-active" : "navlink"} onClick={onNavClick}>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
            {!showDashboard && visibleGroups.length === 0 && <p className="atelier-menu-empty" role="status">Aucune page trouvée.</p>}
          </nav>

          <div className="atelier-sidebar-footer">
            <span className="atelier-footer-label">ATELIER · SUITE GB</span>
            <button className="logout-btn" onClick={onLogout} type="button"><MenuIcon name="logout" />Se déconnecter</button>
          </div>
        </aside>

        <main className="content">
          {isMobile && (
            <div className="mobile-topbar">
              <button
                className="mobile-menu-btn"
                ref={menuButtonRef}
                aria-controls="atelier-sidebar"
                aria-expanded={drawerOpen}
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

            <Route path="/mobile" element={<MobileAtelierPage />} />
            <Route path="/mobile/bt/:id" element={<MobileBtPage />} />

            <Route path="/clients" element={<ClientsListe />} />
            <Route path="/clients/:id" element={<ClientView />} />

            <Route path="/unites" element={<UnitesListe />} />
            <Route path="/unites/:id" element={<UniteView />} />

            <Route path="/employes" element={<EmployesPage />} />

            <Route path="/admin/dossiers-vehicules" element={<DossiersVehiculesPage />} />
            <Route
              path="/admin/dossiers-vehicules/:uniteId"
              element={<DossierVehiculeDetailPage />}
            />

            <Route path="/dashboard-atelier" element={<DashboardAtelier />} />

            <Route path="/bt" element={<BTListe />} />
            <Route path="/centre-service" element={<CentreServicePage />} />
            <Route path="/bt/:id" element={<BonTravailPage />} />
            <Route path="/bt-mecano/:id" element={<BonTravailMecanoPage />} />
            <Route path="/bt/:id/imprimer" element={<BtPrintPage />} />

            <Route path="/inventaire" element={<Inventaire />} />
            <Route path="/pneus" element={<PneusPage />} />
            <Route path="/gestion-atelier" element={<GestionAtelierPage />} />
            <Route path="/operation-temps-reel" element={<OperationTempsReelPage />} />

            <Route path="/pep" element={<PepAccueil />}>
              <Route index element={<Navigate to="suivi" replace />} />
              <Route path="nouvelle" element={<PepNouvelle />} />
              <Route path="suivi" element={<PepSuivi />} />
              <Route path="admin" element={<PepAdmin />} />
            </Route>

            <Route path="/pep/final" element={<PepFinal />} />

            <Route path="/facturation" element={<FacturationBT />} />
            <Route path="/rapport-facturation-atelier" element={<RapportFacturationAtelier />} />
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
    </PhoneRedirectGuard>
  );
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [ssoError, setSsoError] = useState("");

  const pathRef = useRef(loc.pathname);
  const isPublicAutorisationRoute = loc.pathname.startsWith("/autorisation-bt/");
  const isPublicScannerRoute = loc.pathname === "/scanner-pieces";
  const isBackupLoginRoute = loc.pathname === "/login";

  // Mode développement : bypass complet de l’authentification
  const DEV_BYPASS =
    import.meta.env.DEV &&
    import.meta.env.VITE_DEV_BYPASS === "true";

  useEffect(() => {
    pathRef.current = loc.pathname;
  }, [loc.pathname]);

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const params = new URLSearchParams(window.location.search);
        const ssoTicket = params.get("sso");

        if (ssoTicket) {
          await connectWithSsoTicket(ssoTicket);

          if (!alive) return;

          window.history.replaceState(null, "", "/dashboard-atelier");
          nav("/dashboard-atelier", { replace: true });

          setIsAuthed(true);
          setLoading(false);
          return;
        }

        await restoreSessionFromHash();

        await new Promise((resolve) => setTimeout(resolve, 300));

        const { data, error } = await supabase.auth.getSession();

        if (!alive) return;

        if (error || !data.session) {
          setIsAuthed(false);
          setLoading(false);

          if (
            !pathRef.current.startsWith("/autorisation-bt/") &&
            pathRef.current !== "/scanner-pieces" &&
            pathRef.current !== "/login"
          ) {
            setTimeout(() => {
              window.location.href = SUITE_GB_URL;
            }, 500);
          }

          return;
        }

        setIsAuthed(true);
        setLoading(false);

        if (pathRef.current.startsWith("/autorisation-bt/")) return;

        if (pathRef.current === "/login") {
          nav("/dashboard-atelier", { replace: true });
        }
      } catch (error) {
        console.error(error);

        if (!alive) return;

        setSsoError(
          error instanceof Error
            ? error.message
            : "Connexion SSO impossible."
        );
        setIsAuthed(false);
        setLoading(false);

        if (
          !pathRef.current.startsWith("/autorisation-bt/") &&
          pathRef.current !== "/scanner-pieces" &&
          pathRef.current !== "/login"
        ) {
          setTimeout(() => {
            window.location.href = SUITE_GB_URL;
          }, 1800);
        }
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (pathRef.current.startsWith("/autorisation-bt/")) return;

      if (!session) {
        setIsAuthed(false);
        return;
      }

      setIsAuthed(true);
      setLoading(false);

      if (pathRef.current === "/login") {
        nav("/dashboard-atelier", { replace: true });
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [nav]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = SUITE_GB_URL;
  }

  if (isPublicAutorisationRoute) {
    return (
      <Routes>
        <Route path="/autorisation-bt/:token" element={<AutorisationBtClientPage />} />
        <Route path="*" element={<Navigate to="/autorisation-bt" replace />} />
      </Routes>
    );
  }

  if (isPublicScannerRoute) {
    return (
      <Routes>
        <Route path="/scanner-pieces" element={<ScannerPiecesPage />} />
        <Route path="*" element={<Navigate to="/scanner-pieces" replace />} />
      </Routes>
    );
  }

  if (DEV_BYPASS) {
    return <AppShell onLogout={() => {}} />;
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Connexion en cours…</div>;
  }

  if (!isAuthed && isBackupLoginRoute) {
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

  if (!isAuthed) {
    return (
      <div style={{ padding: 16 }}>
        {ssoError || "Redirection vers Suite GB…"}
      </div>
    );
  }

  return <AppShell onLogout={logout} />;
}