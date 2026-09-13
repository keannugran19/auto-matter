FROM python:3.12-slim

# Install LibreOffice + Poppler (pdftoppm) for preview rendering (step 9).
# Install here so the image is ready; they are not exercised until render.py.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice \
        poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Smoke-test: confirm headless LibreOffice is callable
RUN soffice --headless --version

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
