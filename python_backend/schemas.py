"""Pydantic request models (one per INSERT / UPDATE form)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Base(BaseModel):
    """HTML forms send '' for empty inputs – store them as NULL."""

    @field_validator("*", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class PatientIn(Base):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=1, le=120)
    gender: str
    phone: str = Field(min_length=3, max_length=15)
    email: Optional[str] = None
    height: float = Field(gt=0)
    weight: float = Field(gt=0)


class PatientUpdate(Base):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None


class MedicalRecordIn(Base):
    patient_id: int
    medical_history: Optional[str] = None
    existing_conditions: Optional[str] = None
    medications: Optional[str] = None
    record_date: Optional[date] = None


class MedicalRecordUpdate(Base):
    medical_history: Optional[str] = None
    existing_conditions: Optional[str] = None
    medications: Optional[str] = None
    record_date: Optional[date] = None


class GlucoseIn(Base):
    patient_id: int
    glucose_level: float = Field(ge=20, le=600)
    measurement_type: str
    record_date: Optional[datetime] = None


class LabReportIn(Base):
    patient_id: int
    hba1c: float = Field(ge=3, le=20)
    blood_pressure: Optional[str] = None      # "120/80"
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    report_date: Optional[date] = None


class MealIn(Base):
    meal_name: str
    meal_type: str
    calories: int = Field(ge=0)
    carbohydrates: float = Field(ge=0)
    description: Optional[str] = None


class MealUpdate(Base):
    meal_name: Optional[str] = None
    meal_type: Optional[str] = None
    calories: Optional[int] = None
    carbohydrates: Optional[float] = None
    description: Optional[str] = None


class MealRecordIn(Base):
    patient_id: int
    meal_id: int
    meal_date: Optional[date] = None
    status: Optional[str] = "Consumed"


class ActivityIn(Base):
    activity_name: str
    activity_type: str
    recommended_duration: int = Field(gt=0)
    description: Optional[str] = None


class ActivityUpdate(Base):
    activity_name: Optional[str] = None
    activity_type: Optional[str] = None
    recommended_duration: Optional[int] = None
    description: Optional[str] = None


class ActivityRecordIn(Base):
    patient_id: int
    activity_id: int
    duration: int = Field(gt=0)
    steps: Optional[int] = 0
    activity_date: Optional[date] = None


class PredictionIn(Base):
    patient_id: int
    generate_recommendations: Optional[bool] = False


class RecommendationIn(Base):
    patient_id: int
    recommendation_type: str
    recommendation_text: str
    recommendation_date: Optional[date] = None


class SqlIn(BaseModel):
    query: str
