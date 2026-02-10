FROM python:3.11-slim AS base

WORKDIR /app

RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-dev --no-root --no-interaction

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
