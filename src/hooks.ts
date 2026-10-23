import { useEffect, useState } from "react";

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}

/** Phones and small tablets get the vertical chronicle and the bottom sheet. */
export const NARROW = "(max-width: 760px)";
export const useNarrow = () => useMedia(NARROW);
