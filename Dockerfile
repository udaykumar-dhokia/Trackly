# Use a standard Python slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 8000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install dependencies using pip (or uv if preferred)
COPY pyproject.toml .
RUN pip install --no-cache-dir ".[server]"

# Copy the rest of the application
COPY app/ app/
COPY trackly/ trackly/
COPY scripts/ scripts/

# Expose the port
EXPOSE 8000

# Start the application with uvicorn
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
