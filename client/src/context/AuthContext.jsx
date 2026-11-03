import { createContext } from "react";
import { useMe } from "../hooks/useMe.js";
import { useLogin, useLogout, useRegister } from "../hooks/useAuthMutations.js";

/**
 * Contexto de sesión. Envuelve la única fuente de verdad (GET /api/auth/me)
 * y las mutaciones de login, registro y cierre de sesión para que cualquier
 * componente lea el usuario sin repetir consultas ni pasar props.
 */
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { data, isLoading } = useMe();
  const login = useLogin();
  const register = useRegister();
  const logout = useLogout();

  const user = data?.user ?? null;

  const value = {
    user,
    isLoggedIn: Boolean(user),
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
