from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
import uvicorn
import asyncio
import logging
import time
from app.utils.file_manager import FileManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("ShapeFixer")

app = FastAPI(title="ShapeFixer API", description="Production-grade GIS Repair Engine")

# Bug 12 fix: store the task reference so we can cancel it on shutdown
_cleanup_task: asyncio.Task | None = None


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    global _cleanup_task
    logger.info("ShapeFixer Engine starting up...")

    async def cleanup_loop():
        while True:
            try:
                logger.info("Running scheduled cleanup of temporary files...")
                FileManager.cleanup_old_files()
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
            await asyncio.sleep(3600)

    _cleanup_task = asyncio.create_task(cleanup_loop())


@app.on_event("shutdown")
async def shutdown_event():
    global _cleanup_task
    if _cleanup_task and not _cleanup_task.done():
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except asyncio.CancelledError:
            pass
    logger.info("ShapeFixer Engine shut down cleanly.")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
