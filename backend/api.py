import os

# Disable MQTT and background telemetry for Vercel serverless
os.environ["ENABLE_MQTT_CONSUMER"] = "0"
os.environ["ENABLE_BACKGROUND_TELEMETRY"] = "0"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import main app
from main import app

# CORS already configured in main.py

