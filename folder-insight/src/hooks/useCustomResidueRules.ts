import { useState, useCallback } from "react";
import type { StoredCustomRule } from "../analysis/residueAnalysis";

const STORAGE_KEY = "folder-insight:custom-residue-rules";

function load(): StoredCustomRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredCustomRule[]) : [];
  } catch {
    return [];
  }
}

function save(rules: StoredCustomRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function useCustomResidueRules() {
  const [rules, setRules] = useState<StoredCustomRule[]>(load);

  const addRule = useCallback((rule: StoredCustomRule) => {
    setRules((prev) => {
      const next = [...prev, rule];
      save(next);
      return next;
    });
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      save(next);
      return next;
    });
  }, []);

  const toggleEnabled = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r);
      save(next);
      return next;
    });
  }, []);

  return { rules, addRule, removeRule, toggleEnabled };
}
