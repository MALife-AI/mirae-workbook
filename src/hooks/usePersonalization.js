import { useState, useCallback } from "react";

const STORAGE_KEY = "mirae-personalization";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { deptName: "", taskDesc: "", isOnboarded: false };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export default function usePersonalization() {
  const [state, setState] = useState(loadState);

  const setDept = useCallback((deptName) => {
    setState(prev => {
      const next = { ...prev, deptName };
      saveState(next);
      return next;
    });
  }, []);

  const setTask = useCallback((taskDesc) => {
    setState(prev => {
      const next = { ...prev, taskDesc };
      saveState(next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback((deptName, taskDesc) => {
    const next = { deptName, taskDesc, isOnboarded: true };
    saveState(next);
    setState(next);
  }, []);

  const reset = useCallback(() => {
    const next = { deptName: "", taskDesc: "", isOnboarded: false };
    saveState(next);
    setState(next);
  }, []);

  const interpolate = useCallback((template) => {
    return template
      .replace(/\$\{dept\}/g, state.deptName || "우리 팀")
      .replace(/\$\{task\}/g, state.taskDesc || "문서 자동화");
  }, [state.deptName, state.taskDesc]);

  return {
    deptName: state.deptName,
    taskDesc: state.taskDesc,
    isOnboarded: state.isOnboarded,
    setDept,
    setTask,
    completeOnboarding,
    reset,
    interpolate,
  };
}
