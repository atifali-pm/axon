########################################################################
# Axon Agents (Python 3.12 + FastAPI + LangGraph) — multi-arch image
########################################################################

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

FROM base AS dev
ENV ENV=development
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]"
COPY src ./src
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
ENV ENV=production
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .
COPY src ./src
EXPOSE 8000
# uvicorn workers tuned for a 4-core ARM VM; override via UVICORN_WORKERS.
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2}"]
