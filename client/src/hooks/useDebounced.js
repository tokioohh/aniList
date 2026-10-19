import { useEffect, useState } from "react";

/** Retrasa la propagación de un valor: evita una request por cada tecla. */
export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}