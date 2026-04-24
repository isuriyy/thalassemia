from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict

class CBCInput(BaseModel):
    age: float = Field(..., ge=1,   le=100, description="Age in years")
    mcv: float = Field(..., ge=40,  le=160, description="Mean corpuscular volume fL")
    mch: float = Field(..., ge=10,  le=50,  description="Mean corpuscular haemoglobin pg")
    hbg: float = Field(..., ge=3,   le=25,  description="Haemoglobin g/dL")
    rbc: Optional[float] = Field(None, ge=1.0, le=12.0,
                                  description="RBC count ×10¹²/L (optional)")

    @field_validator('mcv')
    @classmethod
    def mcv_range_warn(cls, v):
        if v < 40 or v > 160:
            raise ValueError(f"MCV {v} outside physiological range 40-160 fL")
        return v

    @field_validator('mch')
    @classmethod
    def mch_range_warn(cls, v):
        if v < 10 or v > 50:
            raise ValueError(f"MCH {v} outside physiological range 10-50 pg")
        return v


class SupplementaryIndices(BaseModel):
    mentzer:          float
    mentzer_flag:     str
    shine_lal:        float
    shine_lal_flag:   str
    hbg_rbc_ratio:    float


class PredictionResponse(BaseModel):
    prediction:              int
    label:                   str
    carrier_probability:     float
    non_carrier_probability: float
    referral_recommended:    bool
    confidence:              str
    threshold_used:          float
    derived_features:        dict
    supplementary_indices:   Optional[SupplementaryIndices] = None
    shap_contributions:      Dict[str, float] = {}
    clinical_note:           str
