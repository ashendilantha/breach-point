"""Shared fixtures: isolated SQLite DB + seeded data."""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("MODEL_PROVIDER", "mock")
os.environ.setdefault("SEED_ON_STARTUP", "false")
# Tests must be hermetic: never use ambient Meta credentials (incl. backend/.env,
# which python-dotenv would otherwise load). Empty values block dotenv override.
os.environ["META_API_KEY"] = ""
os.environ["LLAMA_API_KEY"] = ""
os.environ["META_MODEL"] = ""

from app import models  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture()
def db_session():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    engine = create_engine(f"sqlite:///{tmp.name}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()
    seed(db)
    yield db
    db.close()
    os.unlink(tmp.name)


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
