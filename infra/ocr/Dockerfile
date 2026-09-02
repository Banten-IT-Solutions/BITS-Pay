FROM python:3.12-slim

# tesseract-ocr-osd tidak dipasang: --psm 6 tidak memakai OSD.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .

RUN useradd --system --no-create-home ocr
USER ocr

ENV PORT=8080
EXPOSE 8080
CMD ["python", "server.py"]
