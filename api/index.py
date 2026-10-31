"""
Vercel serverless function entrypoint for FastAPI backend.
"""
import sys
import os
from pathlib import Path

# Add backend directory to sys.path so 'app' package can be imported
backend_path = str(Path(__file__).resolve().parent.parent / "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
