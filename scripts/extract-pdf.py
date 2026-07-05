import json
import sys


def extract_with_pdfplumber(path):
    import pdfplumber

    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages)


def extract_with_pypdf(path):
    from pypdf import PdfReader

    reader = PdfReader(path)
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: extract-pdf.py <pdf>")

    path = sys.argv[1]
    errors = []

    for name, extractor in (
        ("pdfplumber", extract_with_pdfplumber),
        ("pypdf", extract_with_pypdf),
    ):
        try:
            text = extractor(path).replace("\x00", "")
            if len(text.strip()) >= 80:
                payload = {"extractor": name, "text": text}
                sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
                return
            errors.append(f"{name}: extracted too little text")
        except Exception as exc:
            errors.append(f"{name}: {exc}")

    payload = {"extractor": "none", "text": "", "errors": errors}
    sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    raise SystemExit(2)


if __name__ == "__main__":
    main()
