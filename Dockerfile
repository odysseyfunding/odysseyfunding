FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY signal_to_lead/ signal_to_lead/
COPY configs/ configs/

EXPOSE 8000
CMD ["python", "-m", "signal_to_lead.service", "--host", "0.0.0.0", "--port", "8000"]
