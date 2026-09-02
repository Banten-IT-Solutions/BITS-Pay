"""Server OCR Tesseract untuk BITS Pay.

Kontrak wajib (lihat packages/api/src/services/ocr/tesseract-vps.ts):
  POST /  body JSON {"image": "<base64>"}
  200 {"amount": int|null, "confidence": float 0-100, "merchant": str|null, "raw_text": str}
  HTTP non-2xx = gagal (provider BITS Pay throw AppError).
Auth opsional: bila env OCR_API_KEY diset, POST / wajib header
`Authorization: Bearer <OCR_API_KEY>`.
"""

import base64
import binascii
import os
import re
import tempfile

import pytesseract
from flask import Flask, jsonify, request
from pytesseract import Output

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # base64 struk jarang > 10 MB

API_KEY = os.environ.get("OCR_API_KEY", "")
# ponytail: --psm 6 (blok teks seragam) umumnya pas untuk struk kolom tunggal.
# Tune per sampel struk nyata bila akurasi jelek (coba --psm 4 atau 11).
TESSERACT_CONFIG = "--psm 6"

RP_RE = re.compile(r"\b(?:rp|idr)[.\s]*([\d.,]+)", re.IGNORECASE)
GROUPED_RE = re.compile(r"\b\d{1,3}(?:[.,]\d{3})+\b")


def _to_int(s: str) -> int:
    # Buang 2 digit desimal gaya "12.500,00"; sisanya pemisah ribuan, hapus.
    if re.search(r"[.,]\d{2}$", s) and not re.search(r"[.,]\d{3}$", s):
        s = s[:-3]
    digits = re.sub(r"[.,]", "", s)
    return int(digits) if digits else 0


def parse_amount(text: str) -> "int | None":
    # ponytail: ambil kandidat terbesar berlabel Rp/IDR; fallback angka berformat
    # ribuan terbesar. Bisa salah bila ada angka lebih besar dari total (mis.
    # nomor rekening/kembalian). Perbaiki: prioritaskan baris mengandung
    # "total"/"jumlah" setelah ada sampel struk nyata.
    cands = [_to_int(m.group(1)) for m in RP_RE.finditer(text)]
    if not cands:
        cands = [_to_int(m.group(0)) for m in GROUPED_RE.finditer(text)]
    cands = [c for c in cands if c > 0]
    return max(cands) if cands else None


def parse_merchant(text: str) -> "str | None":
    # ponytail: baris pertama >=3 char yang mengandung huruf dan bukan nominal.
    # Salah bila struk dibuka alamat/nama cabang. Perbaiki: kamus merchant atau
    # parsing blok header setelah ada data lapangan.
    for line in text.splitlines():
        s = line.strip()
        if len(s) >= 3 and re.search(r"[A-Za-z]", s) and not RP_RE.search(s):
            return s
    return None


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="payload terlalu besar"), 413


@app.post("/")
def ocr():
    if API_KEY and request.headers.get("Authorization") != f"Bearer {API_KEY}":
        return jsonify(error="unauthorized"), 401

    body = request.get_json(silent=True) or {}
    image = body.get("image")
    if not isinstance(image, str) or not image:
        return jsonify(error="field 'image' wajib base64 string"), 400

    if image.startswith("data:"):  # toleransi data URL prefix
        image = image.split(",", 1)[-1]
    try:
        blob = base64.b64decode(image, validate=True)
    except (binascii.Error, ValueError):
        return jsonify(error="image bukan base64 valid"), 400
    if not blob:
        return jsonify(error="image kosong"), 400

    fd, path = tempfile.mkstemp()
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(blob)
        data = pytesseract.image_to_data(
            path, config=TESSERACT_CONFIG, output_type=Output.DICT
        )
    except pytesseract.TesseractError as e:
        return jsonify(error=f"ocr gagal: {e}"), 500
    finally:
        os.unlink(path)

    lines: "dict[tuple, list[str]]" = {}
    confs = []
    for i, word in enumerate(data["text"]):
        conf = float(data["conf"][i])
        if conf < 0 or not word.strip():
            continue
        confs.append(conf)
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(word)

    raw_text = "\n".join(" ".join(words) for words in lines.values())
    confidence = round(sum(confs) / len(confs), 2) if confs else 0.0

    return jsonify(
        amount=parse_amount(raw_text),
        confidence=confidence,
        merchant=parse_merchant(raw_text),
        raw_text=raw_text,
    )


if __name__ == "__main__":
    # ponytail: server bawaan Flask (single process). Ganti gunicorn
    # (`gunicorn -w 2 -b 0.0.0.0:$PORT server:app`) saat butuh konkurensi.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
