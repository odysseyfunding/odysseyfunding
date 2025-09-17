from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class JobPosting:
    source: str
    company: str
    role_title: str
    location: Optional[str] = None
    posted_at: Optional[datetime] = None
    post_age_days: Optional[int] = None


@dataclass
class CompanyProfile:
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    employees: Optional[int] = None
    revenue: Optional[float] = None
    years_active: Optional[int] = None
    departments: List[str] = field(default_factory=list)


@dataclass
class Contact:
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None


@dataclass
class Lead:
    company: str
    domain: Optional[str]
    source: str
    role_title: str
    location: Optional[str]
    post_age_days: Optional[int]
    num_open_roles: int
    repeat_flag: bool
    establishment_flag: bool
    contacts: List[Contact] = field(default_factory=list)
    metadata: Dict[str, str] = field(default_factory=dict)
    score: Optional[float] = None
