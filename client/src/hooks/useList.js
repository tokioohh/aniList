import { useQuery } from "@tanstack/react-query";
import { fetchMyList, fetchStats } from "../api/list.api.js";

export function useMyList(filters) {
  return useQuery({
    queryKey: ["myList", filters],
    queryFn: () => fetchMyList(filters),
    staleTime: 60_000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
}