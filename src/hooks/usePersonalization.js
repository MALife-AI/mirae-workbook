import { useState, useCallback } from "react";

const STORAGE_KEY = "mirae-personalization";

// 워크숍 공통 고정값 — 팀 이름과 주제는 모두 동일하게 (옆 사람과 비교 가능)
const FIXED_DEPT = "AI 추진 TF";
const FIXED_TASK = "AI 추진 계획 보고서";

function loadState() {
  // 항상 고정값 사용. 온보딩 스킵.
  return { deptName: FIXED_DEPT, taskDesc: FIXED_TASK, isOnboarded: true };
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
