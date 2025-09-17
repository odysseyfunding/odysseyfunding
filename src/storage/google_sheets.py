from __future__ import annotations

import json
from typing import Dict, Iterable, List

import gspread
from google.oauth2.service_account import Credentials


class GoogleSheetsStorage:
    """Append rows to a Google Sheet using a service account JSON string."""

    def __init__(self, service_account_json: str, spreadsheet_id: str, worksheet: str) -> None:
        self.service_account_json = service_account_json
        self.spreadsheet_id = spreadsheet_id
        self.worksheet_name = worksheet

    def _client(self) -> gspread.Client:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]
        info = json.loads(self.service_account_json)
        creds = Credentials.from_service_account_info(info, scopes=scopes)
        return gspread.authorize(creds)

    def append_rows(self, rows: Iterable[Dict[str, object]]) -> None:
        client = self._client()
        sh = client.open_by_key(self.spreadsheet_id)
        try:
            ws = sh.worksheet(self.worksheet_name)
        except gspread.WorksheetNotFound:
            ws = sh.add_worksheet(self.worksheet_name, rows=100, cols=20)

        headers = [
            "company",
            "domain",
            "source",
            "role_title",
            "location",
            "post_age_days",
            "num_open_roles",
            "repeat_flag",
            "establishment_flag",
            "contacts",
            "score",
        ]

        # Ensure headers
        existing = ws.row_values(1)
        if not existing:
            ws.append_row(headers)

        values = []
        for r in rows:
            values.append([
                r.get("company"),
                r.get("domain"),
                r.get("source"),
                r.get("role_title"),
                r.get("location"),
                r.get("post_age_days"),
                r.get("num_open_roles"),
                r.get("repeat_flag"),
                r.get("establishment_flag"),
                r.get("contacts"),
                r.get("score"),
            ])
        if values:
            ws.append_rows(values)
