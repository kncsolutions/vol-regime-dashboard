# Use official Python image
FROM python:3.11-slim

# Create working directory
WORKDIR /app

# Copy dependency file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Cloud Run expects port 8080
ENV PORT=8080

# Run the application
CMD ["python", "app.py"]