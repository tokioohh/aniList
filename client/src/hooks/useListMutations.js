import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createListEntry, updateListEntry, deleteListEntry } from "../api/list.api.js";

/**
 * Toda mutación de la lista invalida la lista, las estadísticas y el detalle
 * afectado, para que la UI refleje el cambio sin recargar.
 */
function useInvalidateList(source, externalId) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["myList"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    if (source && externalId) {
      // La clave incluye el estado de sesión: hay que invalidar todas sus variantes.
      queryClient.invalidateQueries({ queryKey: ["catalog", "detail", source, externalId] });
    }
  };
}

export function useCreateEntry(source, externalId) {
  const invalidate = useInvalidateList(source, externalId);
  return useMutation({
    mutationFn: createListEntry,
    onSuccess: invalidate,
  });
}

export function useUpdateEntry(source, externalId) {
  const invalidate = useInvalidateList(source, externalId);
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateListEntry(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteEntry(source, externalId) {
  const invalidate = useInvalidateList(source, externalId);
  return useMutation({
    mutationFn: deleteListEntry,
    onSuccess: invalidate,
  });
}