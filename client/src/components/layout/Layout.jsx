import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar, BottomNav } from "./Navbar.jsx";
import { Footer } from "./Footer.jsx";
import { useIsLoggedIn } from "../../hooks/useMe.js";

export function Layout() {
  const { isLoggedIn } = useIsLoggedIn();
  const location = useLocation();

  // Cada navegación arranca arriba, como en una app nativa.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isLoggedIn={isLoggedIn} />

      {/* pb-24 deja sitio a la barra inferior en móvil */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-10 md:pb-20">
        <Outlet />
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
