# Entorno de los pipelines y notebooks. Corre en Linux para que funcione igual en
# cualquier máquina (en Windows, Smart App Control bloquea las DLL de psycopg y pandas).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements.txt
