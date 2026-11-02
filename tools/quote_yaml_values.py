"""Quote flashcard front/back values that contain YAML-sensitive characters.

A plain scalar like ``Client: backoff`` is read by YAML as a nested
mapping. This script wraps such values in double quotes so the files
stay valid without changing their content.

Usage:
    python quote_yaml_values.py <file.yaml> [...]
"""

import re
import sys
from pathlib import Path

FIELD_RE = re.compile(r"^(\s+(?:front|back):\s)(.*)$")
NEEDS_QUOTES = re.compile(r": | #|^[\"'&*!|>%@`{}\[\]]")


def quote_line(line: str) -> str:
    """Return ``line`` with its value quoted when YAML would misread it.

    Args:
        line: One line of the YAML file, without trailing newline.

    Returns:
        The same line, with the value double-quoted if needed.
    """
    match = FIELD_RE.match(line)
    if not match:
        return line
    prefix, value = match.groups()
    if value.startswith('"') or not NEEDS_QUOTES.search(value):
        return line
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'{prefix}"{escaped}"'


for name in sys.argv[1:]:
    path = Path(name)
    lines = path.read_text(encoding="utf-8").splitlines()
    fixed = [quote_line(ln) for ln in lines]
    changed = sum(1 for a, b in zip(lines, fixed) if a != b)
    path.write_text("\n".join(fixed) + "\n", encoding="utf-8")
    print(f"{path.name}: {changed} values quoted")
