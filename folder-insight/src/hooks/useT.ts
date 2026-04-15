import { useAppStore } from "../store/appStore";
import { locales } from "../i18n";

export function useT() {
  const locale = useAppStore((s) => s.locale);
  return locales[locale];
}
