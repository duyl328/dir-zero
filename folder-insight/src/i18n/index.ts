import { zh } from "./zh";
import { en } from "./en";

export type Locale = "zh" | "en";
export { zh, en };
export const locales = { zh, en } as const;
