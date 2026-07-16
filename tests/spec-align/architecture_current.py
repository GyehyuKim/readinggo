#!/usr/bin/env python3
"""Prevent active ReadingGo architecture specs from regressing to superseded runtime claims.

Historical decisions may preserve past CDN/Netlify/web-first wording. This guard checks only
active implementation-facing assertions in the current spec surfaces.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPECS = ROOT / "docs" / "readinggo" / "specs"

checks = [
    (
        SPECS / "README.md",
        "README current-runtime section names Vite + Capacitor + Cloudflare",
        ["Vite 빌드 + Capacitor 단일 코드베이스 + Cloudflare Workers"],
        ["| 빌드 도구 | 현행 **React 18 CDN + Babel** 유지", "| 호스팅 | **Netlify**"],
    ),
    (
        SPECS / "backend.md",
        "backend current platform section names Vite and current adapter split",
        ["**현재 런타임", "**Vite** (`npm run build` → `dist/`)", "게스트는 localStorageAdapter, 로그인 사용자는 supabaseAdapter"],
        ["**web-first.** Phase 0 은 백엔드 없이 정적 웹으로", "- **빌드**: 현행 React 18 CDN + Babel standalone 유지"],
    ),
    (
        SPECS / "integrated-shelf.md",
        "integrated shelf stack lock names Vite build contract",
        ["**빌드**: Vite 빌드(`npm run build` → `dist/`)"],
        ["**빌드**: React 18 CDN + Babel 유지"],
    ),
]

failed = 0
for path, label, required, forbidden in checks:
    text = path.read_text(encoding="utf-8")
    missing = [needle for needle in required if needle not in text]
    present = [needle for needle in forbidden if needle in text]
    if missing or present:
        failed += 1
        print(f"FAIL {label}")
        for needle in missing:
            print(f"  missing: {needle}")
        for needle in present:
            print(f"  stale active assertion: {needle}")
    else:
        print(f"OK   {label}")

if failed:
    raise SystemExit(1)
print(f"{len(checks)}/{len(checks)} current-architecture spec checks passed")
