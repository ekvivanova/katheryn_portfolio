"""Check the buildless portfolio without changing its content."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re

ROOT = Path(__file__).resolve().parents[1] / "dist"
errors = []
references = 0


def check_url(source, value):
    global references
    value = value.strip()
    if not value or value.startswith(("#", "data:", "mailto:", "tel:")):
        return
    url = urlsplit(value)
    if url.scheme or url.netloc:
        if url.scheme == "file" or url.hostname in {"localhost", "127.0.0.1"}:
            errors.append(f"{source.relative_to(ROOT)}: local-only URL")
        return
    if value.startswith("/"):
        errors.append(f"{source.relative_to(ROOT)}: absolute path {value}")
        return
    target = (source.parent / unquote(url.path)).resolve()
    if not target.is_relative_to(ROOT.resolve()):
        errors.append(f"{source.relative_to(ROOT)}: path leaves site: {value}")
        return
    if target.is_dir():
        target = target / "index.html"
    references += 1
    if not target.is_file():
        errors.append(f"{source.relative_to(ROOT)}: missing {value}")


def check_css(source, text):
    for match in re.finditer(r'url\(\s*([\x22\x27]?)(.*?)\1\s*\)', text):
        check_url(source, match[2])


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source
        self.ids = set()

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        for key in ("src", "href", "poster", "data-src"):
            if attrs.get(key):
                check_url(self.source, attrs[key])
        if attrs.get("style"):
            check_css(self.source, attrs["style"])
        if attrs.get("id"):
            if attrs["id"] in self.ids:
                errors.append(f"{self.source.relative_to(ROOT)}: duplicate id {attrs['id']}")
            self.ids.add(attrs["id"])


files = sorted(path for path in ROOT.rglob("*") if path.is_file())
for source in files:
    if source.is_symlink():
        errors.append(f"Symlink in site: {source.relative_to(ROOT)}")
    if source.stat().st_size >= 100 * 1024 * 1024:
        errors.append(f"File exceeds GitHub limit: {source.relative_to(ROOT)}")
    if source.suffix == ".html":
        Page(source).feed(source.read_text())
    elif source.suffix == ".css":
        check_css(source, source.read_text())

content = ROOT / "content.js"
for url in re.findall(r"url:\s*['\"]([^'\"]+)", content.read_text()):
    check_url(content, url)
if errors:
    raise SystemExit("\n".join(errors))
print(f"OK: {len(files)} files, {len(list(ROOT.rglob('*.html')))} pages, "
      f"{references} local references, {sum(p.stat().st_size for p in files):,} bytes")
