from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List
from datetime import datetime, timezone
import uuid
import os
import shutil
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/ogg"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), category: str = "general"):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    unique_name = f"{category}_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    with open(file_path, "wb") as f:
        f.write(content)

    url = f"/api/files/{unique_name}"
    logger.info(f"File uploaded: {unique_name} ({len(content)} bytes)")
    return {"url": url, "filename": unique_name, "size": len(content), "original_name": file.filename}


@router.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...), category: str = "general"):
    results = []
    for file in files:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        unique_name = f"{category}_{uuid.uuid4().hex[:12]}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append({"error": f"{file.filename} too large", "original_name": file.filename})
            continue
        with open(file_path, "wb") as f:
            f.write(content)
        results.append({"url": f"/api/files/{unique_name}", "filename": unique_name, "size": len(content), "original_name": file.filename})
    return {"files": results}


@router.get("/files/{filename}")
async def serve_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
