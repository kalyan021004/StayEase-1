import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = {
  tenant: [
    { to: "/tenant", label: "Home", end: true },
    { to: "/search", label: "Find a PG" },
    { to: "/tenant/bookings", label: "Requests" },
    { to: "/tenant/bills", label: "Rent" },
  ],
  owner: [
    { to: "/owner", label: "Home", end: true },
    { to: "/owner/listings", label: "My PGs" },
    { to: "/owner/requests", label: "Requests" },
    { to: "/owner/bills", label: "Rent" },
  ],
  admin: [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/owners", label: "Owners" },
    { to: "/admin/listings", label: "Listings" },
  ],
};

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="StayEase home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--auto)" />
        <path d="M7 15 16 7.5 25 15v10H7z" fill="var(--ink)" />
        <rect x="13.5" y="18" width="5" height="7" fill="var(--auto)" />
      </svg>
      <span>StayEase</span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user ? NAV[user.role] || [] : [];

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Wordmark />
          {links.length > 0 && (
            <nav className="nav-desktop" aria-label="Main">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="topbar-right">
            {user ? (
              <>
                <span className="who" title={user.email}>
                  {user.name.split(" ")[0]}
                  <small>{user.role === "admin" ? "Admin" : user.role === "owner" ? "PG owner" : "Tenant"}</small>
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/search" className="link-quiet hide-sm">
                  Find a PG
                </NavLink>
                <NavLink to="/signup?role=owner" className="link-quiet hide-sm">
                  List your PG
                </NavLink>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className={links.length ? "has-tabbar" : ""}>
        <Outlet />
      </main>

      {links.length > 0 && (
        <nav className="tabbar" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}

      {!user && (
        <footer className="footer">
          <div className="footer-inner">
            <Wordmark />
            <p>PGs and co-living in Bangalore, Hyderabad and Chennai. Every listing is checked by our team before it goes live.</p>
            <nav aria-label="Footer">
              <Link to="/search">Find a PG</Link>
              <Link to="/signup?role=owner">List your PG</Link>
              <Link to="/login">Log in</Link>
            </nav>
          </div>
        </footer>
      )}
    </div>
  );
}
