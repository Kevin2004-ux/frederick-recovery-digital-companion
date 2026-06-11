import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

type OwnerShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", match: ["/dashboard"] },
  { label: "Clinics", to: "/owner/clinics", match: ["/owner/clinics"] },
  { label: "Activation Codes", to: "/activation-codes", match: ["/activation-codes"] },
  { label: "Box Items", to: "/box-items", match: ["/box-items"] },
  { label: "Box Templates", to: "/box-templates", match: ["/box-templates"] },
  { label: "Education Library", to: "/education-library", match: ["/education-library", "/library"] },
  { label: "Education Bundles", to: "/education-bundles", match: ["/education-bundles"] },
  { label: "Platform Users / Clinic Logins", to: "/platform-users", match: ["/platform-users"] },
];

function isActivePath(pathname: string, matchers: string[]) {
  return matchers.some((matcher) => pathname === matcher || pathname.startsWith(`${matcher}/`));
}

export function OwnerShell({ children }: OwnerShellProps) {
  const location = useLocation();

  return (
    <div className="owner-app-shell">
      <header className="owner-top-nav">
        <div className="owner-top-nav-brand">
          <span className="owner-top-nav-mark">FR</span>
          <div>
            <strong>Factory Owner Portal</strong>
            <span>Clinic → Codes → Box items → Education</span>
          </div>
        </div>

        <nav className="owner-top-nav-tabs" aria-label="Owner workflow navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive || isActivePath(location.pathname, item.match)
                  ? "owner-top-nav-tab active"
                  : "owner-top-nav-tab"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {children}
    </div>
  );
}
