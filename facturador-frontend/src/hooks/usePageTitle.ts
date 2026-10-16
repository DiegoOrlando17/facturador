import { useEffect } from "react";
import { BRAND } from "@/config/brand";

/** Título de la pestaña: "<página> · <marca>". Sin título, solo la marca. */
export function formatPageTitle(title?: string | null) {
  const clean = title?.trim();
  return clean ? `${clean} · ${BRAND.name}` : BRAND.name;
}

export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = formatPageTitle(title);
  }, [title]);
}
