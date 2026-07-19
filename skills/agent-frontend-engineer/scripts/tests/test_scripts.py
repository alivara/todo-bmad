#!/usr/bin/env python3
"""Unit tests for Pixel's wake.py and init-sanctum.py.

Run: uv run scripts/tests/test_scripts.py
Exercises the two runtime paths that matter — First Breath routing before a
sanctum exists, deterministic scaffolding, and Waking after birth.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
SKILL = SCRIPTS.parent


def _run(script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPTS / script), *args],
        capture_output=True, text=True,
    )


def test_lifecycle() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        bmad = root / "_bmad"
        bmad.mkdir()
        (bmad / "config.user.yaml").write_text(
            "user_name: Tester\ncommunication_language: English\n"
        )

        # 1. No sanctum yet -> First Breath.
        r = _run("wake.py", str(root))
        assert r.returncode == 0, r.stderr
        assert "MODE: FIRST_BREATH" in r.stdout, r.stdout

        # 2. Scaffold the sanctum.
        r = _run("init-sanctum.py", str(root), str(SKILL))
        assert r.returncode == 0, r.stderr

        sanctum = bmad / "memory" / "agent-frontend-engineer"
        for name in ("INDEX.md", "PERSONA.md", "CREED.md", "BOND.md",
                     "MEMORY.md", "CAPABILITIES.md"):
            assert (sanctum / name).is_file(), f"missing {name}"

        # Config substituted, no runtime tokens leaked, capability discovered.
        persona = (sanctum / "PERSONA.md").read_text()
        assert "Tester" in persona and "{user_name}" not in persona
        assert "[FR]" in (sanctum / "CAPABILITIES.md").read_text()

        # 3. Sanctum exists -> Waking.
        r = _run("wake.py", str(root))
        assert r.returncode == 0, r.stderr
        assert "MODE: WAKING" in r.stdout, r.stdout

        # 4. Init is idempotent.
        r = _run("init-sanctum.py", str(root), str(SKILL))
        assert r.returncode == 0 and "already exists" in r.stdout


if __name__ == "__main__":
    test_lifecycle()
    print("ok - all script tests passed")
