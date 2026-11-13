"""Build a deterministic, text-only Agensi ZIP. No external dependencies."""
from hashlib import sha256
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
files = {
    "SKILL.md": root / "skills" / "videototext" / "SKILL.md",
    "LICENSE.txt": root / "LICENSE",
}
contents = {name: file.read_text(encoding="utf-8").replace("\r\n", "\n") for name, file in files.items()}
skill = contents["SKILL.md"]
frontmatter = re.match(r"\A---\n(.*?)\n---\n", skill, re.S)
if not frontmatter or not all(re.search(rf"^{field}:\s+\S", frontmatter[1], re.M) for field in ("name", "description")):
    raise SystemExit("SKILL.md needs name and description frontmatter")
for name, text in contents.items():
    if "\x00" in text or re.search(r"[A-Za-z]:[\\/](?:Users|tmp)[\\/]|/Users/|/home/", text):
        raise SystemExit(f"Refusing binary content or a personal local path in {name}")

destination = root / "release-artifacts" / "videototext-agensi.zip"
destination.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
    for name, text in sorted(contents.items()):
        info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        archive.writestr(info, text.encode("utf-8"))
with ZipFile(destination) as archive:
    assert set(archive.namelist()) == set(files)
    assert archive.testzip() is None
    assert len(archive.infolist()) <= 1000
    assert sum(len(value) for value in contents.values()) <= 6_000_000
    for name, text in contents.items():
        assert archive.read(name).decode("utf-8") == text
assert destination.stat().st_size <= 50 * 1024 * 1024
digest = sha256(destination.read_bytes()).hexdigest()
destination.with_suffix(".zip.sha256").write_text(f"{digest}  {destination.name}\n", encoding="utf-8")
print(f"Validated {destination.name}: {len(files)} UTF-8 text files, {destination.stat().st_size} bytes; SHA-256 {digest}")
