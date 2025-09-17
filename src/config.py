from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


@dataclass
class AppConfig:
    serpapi_api_key: str
    zerobounce_api_key: str
    google_service_account_json: str
    google_sheets_spreadsheet_id: Optional[str] = None
    google_sheets_worksheet: str = "Leads"


def load_config() -> AppConfig:
    load_dotenv(override=False)
    return AppConfig(
        serpapi_api_key=os.getenv("SERPAPI_API_KEY", ""),
        zerobounce_api_key=os.getenv("ZERObounce_API_KEY", ""),
        google_service_account_json=os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", ""),
        google_sheets_spreadsheet_id=os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID"),
        google_sheets_worksheet=os.getenv("GOOGLE_SHEETS_WORKSHEET", "Leads"),
    )
