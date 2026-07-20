"""Response shapes for the medicine-scanner API."""
from typing import List, Optional

from pydantic import BaseModel, Field


class GenericAlternative(BaseModel):
    name: str = Field(description="Generic/alternative medicine name")
    composition: Optional[str] = Field(None, description="Active ingredient(s)")
    estimatedPrice: Optional[float] = Field(None, description="Approximate price (estimate)")
    currency: str = "INR"
    note: Optional[str] = None


class IdentifiedMedicine(BaseModel):
    brandName: Optional[str] = None
    genericName: Optional[str] = None
    composition: Optional[str] = None
    estimatedBrandPrice: Optional[float] = None
    currency: str = "INR"


class ScanResponse(BaseModel):
    identified: IdentifiedMedicine
    alternatives: List[GenericAlternative]
    cached: bool
    disclaimer: str


class GenericsRequest(BaseModel):
    brandName: str = Field(..., description="Brand medicine name to find generics for")


class GenericsResponse(BaseModel):
    brandName: str
    alternatives: List[GenericAlternative]
    cached: bool
    disclaimer: str
