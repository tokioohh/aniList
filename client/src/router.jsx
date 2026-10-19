import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/layout/Layout.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Home } from "./pages/Home.jsx";
import { Register } from "./pages/Register.jsx";
import { Login } from "./pages/Login.jsx";
import { Explore } from "./pages/Explore.jsx";
import { TitleDetail } from "./pages/TitleDetail.jsx";
import { MyList } from "./pages/MyList.jsx";
import { Stats } from "./pages/Stats.jsx";
import { About } from "./pages/About.jsx";
import { NotFound } from "./pages/NotFound.jsx";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/registro", element: <Register /> },
      { path: "/login", element: <Login /> },
      { path: "/explorar", element: <Explore /> },
      { path: "/titulo/:source/:externalId", element: <TitleDetail /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/mi-lista", element: <MyList /> },
          { path: "/perfil", element: <Stats /> },
        ],
      },
      { path: "/acerca", element: <About /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);