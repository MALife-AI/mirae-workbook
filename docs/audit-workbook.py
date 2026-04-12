#!/usr/bin/env python3
"""워크북 슬라이드 정적 분석 + 챕터별 시간 추정.

src/workbook.jsx 의 SLIDES 배열에서 section/title/mission/mode 만 정규식으로 추출.
실행 가능한 코드 자체는 파싱하지 않음 — JSX 라 babel 없이는 어차피 불가.

출력:
  - 슬라이드 카운트 (web 모드 visible 기준)
  - 챕터별 분포
  - 미션 무결성 체크 (promptTemplate / hints / checklist / autoChecks)
  - 챕터별 + 슬라이드 타입별 시간 추정
"""
from __future__ import annotations
import re
import sys
from collections import OrderedDict
from pathlib import Path

JSX = Path(__file__).resolve().parent.parent / "src" / "workbook.jsx"

# ─── 시간 추정 (분) ────────────────────────────────────
TIME = {
    "intro_title":    1.0,   # 표지/섹션 타이틀
    "content":        1.8,   # 일반 콘텐츠
    "case_study":     2.5,   # 사례 슬라이드 — 데이터 많음
    "demo":           4.0,   # 시연: ... 슬라이드 (강사가 직접 보여줌)
    "concept_demo":   2.0,   # 개념 + 미니 시연
    "mission":        9.0,   # 체험: ... (학습자 본인이 수행)
    "practice_step": 12.0,   # 실습 프로젝트 Step N (본인 업무로 작성)
    "wrap":           1.5,   # 마무리·소개·전환
}


def parse_slides(text: str) -> list[dict]:
    """SLIDES 배열에서 슬라이드 메타 추출.

    JSX 안에 임의 코드가 들어있어 정규식만으로는 완벽하지 않지만,
    section/title/mode/mission 위치는 충분히 안정적이라 추출 가능.
    """
    # SLIDES = [ ... ]; 블록만 잘라내기
    start = text.find("const SLIDES = [")
    if start < 0:
        sys.exit("SLIDES 배열을 못 찾음")

    # 슬라이드 항목은 '{ section: "..."'  으로 시작
    pat = re.compile(
        r'\{\s*'
        r'section:\s*"([^"]+)",\s*'
        r'title:\s*"([^"]+)",'
        r'(?P<rest>.*?)'
        r'(?=\n\s*\},?\s*\n\s*(?:\{|//|/\*|];))',
        re.DOTALL,
    )
    slides = []
    for m in pat.finditer(text, start):
        sec = m.group(1)
        title = m.group(2)
        rest = m.group("rest")
        slide = {
            "section": sec,
            "title": title,
            "mode": None,
            "mission": False,
            "promptTemplate": False,
            "hints": False,
            "checklist": False,
            "autoChecks": False,
        }
        mm = re.search(r'mode:\s*"(\w+)"', rest)
        if mm:
            slide["mode"] = mm.group(1)
        if re.search(r'\bmission:\s*\{', rest):
            slide["mission"] = True
            if re.search(r'\bpromptTemplate:\s*[`"\']', rest):
                slide["promptTemplate"] = True
            if re.search(r'\bhints:\s*\[', rest):
                slide["hints"] = True
            if re.search(r'\bchecklist:\s*\[', rest):
                slide["checklist"] = True
            if re.search(r'\bautoChecks:\s*\[', rest):
                slide["autoChecks"] = True
        slides.append(slide)
    return slides


def classify(slide: dict) -> str:
    sec = slide["section"]
    title = slide["title"]
    if sec.startswith("3."):
        return "mission"
    if sec.startswith("4."):
        if title.startswith("Step "):
            return "practice_step"
        return "wrap"
    if title.startswith("시연"):
        return "demo"
    if "AI 코딩 어시스턴트로" in title:
        return "intro_title"
    if title.startswith("사례") or "실제 사례" in title:
        return "case_study"
    if title in ("오늘의 목표", "오늘 배울 도구 한눈에 보기"):
        return "wrap"
    return "content"


def main():
    src = JSX.read_text(encoding="utf-8")
    slides = parse_slides(src)

    # web 모드 visible — mode == "tauri" 는 제외
    visible = [s for s in slides if s["mode"] != "tauri"]
    hidden = [s for s in slides if s["mode"] == "tauri"]

    print(f"총 슬라이드 (소스): {len(slides)}")
    print(f"  ├─ web 모드 visible: {len(visible)}")
    print(f"  └─ tauri 전용 (워크숍 환경에선 hidden): {len(hidden)}")
    if hidden:
        for s in hidden:
            print(f"     - {s['section']} · {s['title']}")
    print()

    # ── 챕터별 집계 ──
    chapters = OrderedDict()
    for s in visible:
        sec = s["section"]
        cls = classify(s)
        if sec not in chapters:
            chapters[sec] = {"slides": [], "by_type": {}}
        chapters[sec]["slides"].append((s, cls))
        chapters[sec]["by_type"][cls] = chapters[sec]["by_type"].get(cls, 0) + 1

    print("=" * 70)
    print("챕터별 슬라이드 + 시간 추정")
    print("=" * 70)
    total_min = 0
    for sec, info in chapters.items():
        chap_min = sum(TIME[c] for _, c in info["slides"])
        total_min += chap_min
        n = len(info["slides"])
        print(f"\n## {sec}")
        print(f"   {n} 슬라이드   ·   추정 {chap_min:.0f} 분 ({chap_min / 60:.1f} h)")
        for typ, cnt in sorted(info["by_type"].items(), key=lambda x: -x[1]):
            label = {
                "intro_title": "표지",
                "content": "콘텐츠",
                "case_study": "사례",
                "demo": "시연",
                "concept_demo": "개념+시연",
                "mission": "체험 미션",
                "practice_step": "실습 Step",
                "wrap": "전환·요약",
            }[typ]
            print(f"     · {label:8s} {cnt:>3d}개  ({TIME[typ]:.1f}분/개  =  {cnt * TIME[typ]:.0f}분)")

    print("\n" + "=" * 70)
    print(f"전체 합계   :  {total_min:.0f} 분  ({total_min / 60:.1f} h)")
    print(f"권장 진행 시간:  300 분 (5 h)")
    diff = total_min - 300
    if diff > 0:
        print(f"⚠️  추정이 권장보다 {diff:.0f} 분 초과 — 휴식 / Q&A 시간 빼면 빡빡함")
    else:
        print(f"✓  추정이 권장보다 {-diff:.0f} 분 여유 — 휴식 / Q&A 가능")
    print("=" * 70)

    # ── 미션 무결성 ──
    print("\n## 미션 무결성 체크")
    issues = []
    for s in slides:
        if not s["mission"]:
            continue
        miss_fields = [
            f for f in ("promptTemplate", "hints", "checklist")
            if not s[f]
        ]
        if miss_fields:
            # promptTemplate 비어 있는 건 의도적인 케이스도 있으니 경고만
            issues.append((s, miss_fields))

    if not issues:
        print("   ✓ 모든 미션에 promptTemplate / hints / checklist 존재")
    else:
        for s, fields in issues:
            print(f"   ⚠️  {s['title']} → 누락: {', '.join(fields)}")

    # autoChecks 없는 미션 (수동 체크) 확인
    no_auto = [s for s in slides if s["mission"] and not s["autoChecks"]]
    if no_auto:
        print(f"\n## 자동 체크 없는 미션 ({len(no_auto)}개) — 수동 체크 또는 15초 타이머:")
        for s in no_auto:
            print(f"   · {s['title']}")

    # ── 섹션별 sequencing 확인 ──
    print("\n## 섹션 흐름 확인")
    prev_sec = None
    transitions = []
    for s in visible:
        if s["section"] != prev_sec:
            transitions.append(s["section"])
            prev_sec = s["section"]
    print("   섹션 진행 순서:")
    for i, t in enumerate(transitions, 1):
        print(f"     {i:>2}. {t}")
    if transitions != sorted(set(transitions), key=transitions.index):
        print("   ✓ 섹션이 비연속적으로 섞임 — 의도된 경우 (예: 도입↔개념 교차)면 OK")

    # ── 시연 슬라이드 위치 검증 ──
    demo_slides = [s for s in visible if s["title"].startswith("시연")]
    print(f"\n## 시연 슬라이드 ({len(demo_slides)}개) — 발표자 우측 터미널 표시 대상:")
    for s in demo_slides:
        print(f"   · {s['section']:25s} {s['title']}")


if __name__ == "__main__":
    main()
