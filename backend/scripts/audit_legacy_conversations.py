"""Report legacy raw-conversation table metadata without printing user data."""
from __future__ import annotations
import argparse
import hashlib
import json
from sqlalchemy import inspect, text
from app.models.orm import engine

TABLES = ("conversations", "user_messages")


def table_audit(name: str) -> dict[str, object]:
    inspector = inspect(engine)
    if not inspector.has_table(name):
        return {"table": name, "present": False, "row_count": 0, "columns": [], "checksum": None}
    columns = [{"name": item["name"], "type": str(item["type"]), "nullable": bool(item["nullable"])} for item in inspector.get_columns(name)]
    with engine.connect() as connection:
        count = int(connection.execute(text(f"SELECT COUNT(*) FROM {name}")).scalar_one())
    digest = hashlib.sha256(json.dumps(columns, sort_keys=True).encode()).hexdigest()
    return {"table": name, "present": True, "row_count": count, "columns": columns, "checksum": digest}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    print(json.dumps({"tables": [table_audit(name) for name in TABLES]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
