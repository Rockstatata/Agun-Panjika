"""WCAG AA contrast check for the app's colour tokens (light and dark themes).

Every token used for text (ink, muted, accent and the alert-level colours, which label badges)
must reach 4.5:1 on the paper and card backgrounds, and white must reach 4.5:1 on the accent
(primary buttons).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

CSS = Path(__file__).resolve().parent.parent / "web" / "src" / "index.css"


def _blocks() -> dict[str, dict[str, str]]:
    css = CSS.read_text(encoding="utf-8")
    light = re.search(r":root \{(.*?)\n\}", css, re.S).group(1)
    dark = re.search(r':root\[data-theme="dark"\] \{(.*?)\n\}', css, re.S).group(1)

    def parse(b: str) -> dict[str, str]:
        return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", b))

    return {"light": parse(light), "dark": parse(dark)}


def _lum(hex_: str) -> float:
    rgb = [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(a: str, b: str) -> float:
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


THEMES = _blocks()


@pytest.mark.parametrize("theme", ["light", "dark"])
@pytest.mark.parametrize("bg", ["paper", "card"])
@pytest.mark.parametrize("fg", ["ink", "muted", "accent", "level-below", "level-normal", "level-above",
                                "level-extreme", "level-quiet"])
def test_text_contrast(theme, bg, fg):
    t = THEMES[theme]
    assert ratio(t[fg], t[bg]) >= 4.5, f"{theme} {fg} on {bg}: {ratio(t[fg], t[bg]):.2f}"


def test_white_on_primary_button():
    assert ratio("#ffffff", THEMES["light"]["accent"]) >= 4.5
