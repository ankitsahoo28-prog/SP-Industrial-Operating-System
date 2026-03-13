from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import socketio
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, client
from accounting_engine import seed_chart_of_accounts
from inventory_engine import seed_inventory_defaults
from company_engine import seed_default_companies
from websocket_service import sio

# Import route modules
from routes.auth import router as auth_router
from routes.companies import router as companies_router
from routes.tasks import router as tasks_router
from routes.accounting import router as accounting_router
from routes.inventory import router as inventory_router
from routes.director import router as director_router
from routes.uploads import router as uploads_router
from routes.odoo_accounting import router as odoo_accounting_router
from routes.ai_accounting import router as ai_accounting_router
from routes.odoo_inventory import router as odoo_inventory_router

# Create the main app
app = FastAPI(title="SP Industrial Operating System")

# Aggregate all routes under /api prefix
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(companies_router)
api_router.include_router(tasks_router)
api_router.include_router(accounting_router)
api_router.include_router(inventory_router)
api_router.include_router(director_router)
api_router.include_router(uploads_router)
api_router.include_router(odoo_accounting_router)
api_router.include_router(ai_accounting_router)
api_router.include_router(odoo_inventory_router)

app.include_router(api_router)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_seed():
    await seed_chart_of_accounts(db)
    await seed_inventory_defaults(db)
    director = await db.users.find_one({"role": "director"}, {"_id": 0})
    if director:
        await seed_default_companies(db, director["id"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
