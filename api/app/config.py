import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR       = Path(__file__).resolve().parent.parent
ARTEFACTS_DIR  = BASE_DIR / "artefacts"

MODEL_PATH         = ARTEFACTS_DIR / "model.pkl"
SCALER_PATH        = ARTEFACTS_DIR / "scaler.pkl"
FEATURES_PATH      = ARTEFACTS_DIR / "features.pkl"
THRESHOLD_PATH     = ARTEFACTS_DIR / "threshold.pkl"
LOG_TRANSFORM_PATH = ARTEFACTS_DIR / "log_transform_cols.pkl"
IMPUTATION_PATH    = ARTEFACTS_DIR / "imputation_values.pkl"

API_VERSION = "1.0.0"
