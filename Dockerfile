# Use official Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    mpg123 \
 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application files
COPY app.py .
COPY static/ ./static/

# Create directory for database
RUN mkdir -p /app/data

# Run the application on container start
CMD ["python", "app.py"]