FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-impress ffmpeg fonts-dejavu-core fonts-liberation2 fonts-crosextra-carlito fonts-noto-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV HOME=/tmp PORT=8080
CMD ["gunicorn","--bind","0.0.0.0:8080","--workers","1","--threads","2","--timeout","600","app:app"]
