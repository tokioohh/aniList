import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerUser, loginUser, logoutUser } from "../api/auth.api.js";

/** Tras registrar o entrar, ["me"] se invalida y la app ya sabe que hay sesión. */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
      queryClient.removeQueries({ queryKey: ["myList"] });
      queryClient.removeQueries({ queryKey: ["stats"] });
    },
  });
}