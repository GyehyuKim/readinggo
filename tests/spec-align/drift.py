#!/usr/bin/env python3
"""Verify Spec Drift defense (GitHub Action) is in place.

Strategy: Pattern A from [LF: Spec Drift 방어 3패턴](../../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-spec-drift-defense),
softened to *warn-only* (not block) since we are still in Phase 0.

Checks that .github/workflows/spec-drift.yml exists, parses, references both
specs and js paths, and runs on pull_request.

Exit 0 if all invariants pass. Exit 1 on failure with a punch list.
"""

import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "spec-drift.yml"


def main() -> int:
    failures: list[str] = []

    if not WORKFLOW.exists():
        failures.append(f"missing: {WORKFLOW.relative_to(ROOT)}")
        return _report(failures)

    text = WORKFLOW.read_text(encoding="utf-8")
    import yaml  # PyYAML — required, preinstalled on GitHub Actions ubuntu runners

    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as e:
        failures.append(f"YAML parse error: {e}")
        return _report(failures)

    if not isinstance(data, dict):
        failures.append("workflow root is not a mapping")
        return _report(failures)
    on = data.get("on") or data.get(True)  # bare `on:` parses as Python True
    triggers = on if isinstance(on, dict) else [on]
    if "pull_request" not in triggers:
        failures.append("missing `on.pull_request` trigger")
    if not data.get("jobs"):
        failures.append("missing `jobs` section")
    if "docs/readinggo/specs" not in text:
        failures.append("workflow does not reference `docs/readinggo/specs`")
    if "docs/readinggo/js" not in text:
        failures.append("workflow does not reference `docs/readinggo/js`")

    return _report(failures)


def _report(failures: list[str]) -> int:
    if failures:
        for f in failures:
            print(f"FAIL: {f}", file=sys.stderr)
        print(f"\n{len(failures)} check(s) failed", file=sys.stderr)
        return 1
    print("OK: spec-drift.yml present and structurally sound")
    return 0


if __name__ == "__main__":
    sys.exit(main())
