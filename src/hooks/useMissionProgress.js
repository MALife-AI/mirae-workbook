import { useState, useCallback } from "react";

const STORAGE_KEY = "mirae-mission-progress";

function loadCompleted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (_) {}
  return new Set();
}

function saveCompleted(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (_) {}
}

export default function useMissionProgress() {
  const [completedMissions, setCompleted] = useState(loadCompleted);

  const completeMission = useCallback((id) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.add(id);
      saveCompleted(next);
      return next;
    });
  }, []);

  const isCompleted = useCallback((id) => {
    return completedMissions.has(id);
  }, [completedMissions]);

  const reset = useCallback(() => {
    const empty = new Set();
    saveCompleted(empty);
    setCompleted(empty);
  }, []);

  return {
    completedMissions,
    completeMission,
    isCompleted,
    completedCount: completedMissions.size,
    reset,
  };
}
