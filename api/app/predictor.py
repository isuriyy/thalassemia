import numpy as np
import pandas as pd
import joblib
import logging
import shap

from app.config import (
    MODEL_PATH, SCALER_PATH, FEATURES_PATH,
    THRESHOLD_PATH, LOG_TRANSFORM_PATH, IMPUTATION_PATH
)

logger = logging.getLogger(__name__)


class ThalassemiaPredictor:
    def __init__(self):
        logger.info("Loading model artefacts...")
        self.model              = joblib.load(MODEL_PATH)
        self.scaler             = joblib.load(SCALER_PATH)
        self.features           = joblib.load(FEATURES_PATH)
        self.threshold          = joblib.load(THRESHOLD_PATH)
        self.log_transform_cols = joblib.load(LOG_TRANSFORM_PATH)
        self.imputation_values  = joblib.load(IMPUTATION_PATH)

        logger.info(f"Features: {self.features}")
        logger.info(f"Threshold: {self.threshold}")
        logger.info(f"Log transforms: {self.log_transform_cols}")

        logger.info("Initialising SHAP KernelExplainer...")
        background = self._build_background_sample(n=50)
        self.explainer = shap.KernelExplainer(
            lambda x: self.model.predict_proba(x)[:, 1],
            background,
            silent=True
        )
        logger.info("SHAP explainer ready")

    def _build_background_sample(self, n: int = 50) -> np.ndarray:
        row = []
        for feat in self.features:
            if feat in self.imputation_values:
                val = self.imputation_values[feat].get('overall', 0.0)
            else:
                val = 0.0
            row.append(float(val))
        base = np.array(row)
        rng = np.random.default_rng(42)
        noise = rng.normal(0, 0.01, size=(n, len(row)))
        background = base + noise
        background_scaled = self.scaler.transform(
            pd.DataFrame(background, columns=self.features)
        )
        return background_scaled

    def _compute_features(self, age, mcv, mch, hbg):
        gk_raw  = (mcv**2 * 0.01) / mch
        srv_raw = (mcv * mch) / (hbg * 10)
        return {
            'Age':            age,
            'MCV':            mcv,
            'MCH':            mch,
            'HBG':            hbg,
            'england_fraser': mcv - mch - 3.4,
            'green_king':     gk_raw,
            'hbg_mcv_ratio':  (hbg / mcv) * 100,
            'hbg_mch_ratio':  hbg / mch,
            'srivastava':     srv_raw,
            'flag_gk':        float(gk_raw < 65),
            'mentzer':        None,
            'shine_lal':      None,
            'hbg_rbc_ratio':  None,
            'flag_mentzer':   None,
            'flag_sl':        None,
        }

    def _apply_log_transforms(self, features: dict) -> dict:
        features = features.copy()
        for col in self.log_transform_cols:
            if col in features and features[col] is not None:
                raw_val = features[col]
                if raw_val > 0:
                    features[col] = float(np.log1p(raw_val))
                else:
                    logger.warning(
                        f"Cannot log-transform {col}={raw_val} — value <= 0"
                    )
        return features

    def _build_feature_vector(self, features: dict) -> pd.DataFrame:
        row = []
        for feat in self.features:
            val = features.get(feat)
            if val is None:
                if feat in self.imputation_values:
                    imp = self.imputation_values[feat]
                    val = imp.get('overall', 0.0)
                    logger.debug(f"Imputed {feat} = {val:.3f}")
                else:
                    val = 0.0
                    logger.warning(f"No imputation value for {feat} — using 0")
            row.append(float(val))
        return pd.DataFrame([row], columns=self.features)

    def _compute_rbc_indices(self, mcv, mch, hbg, rbc):
        mentzer   = mcv / rbc
        shine_lal = (mcv**2 * mch) / (rbc * 100)
        hbg_rbc   = hbg / rbc
        return {
            'mentzer':        round(mentzer, 2),
            'mentzer_flag':   "< 13 → β-thal likely" if mentzer < 13
                              else "> 13 → IDA likely",
            'shine_lal':      round(shine_lal, 2),
            'shine_lal_flag': "< 530 → β-thal likely" if shine_lal < 530
                              else "> 530 → less likely",
            'hbg_rbc_ratio':  round(hbg_rbc, 3),
        }

    def _get_confidence(self, probability: float) -> str:
        distance = abs(probability - self.threshold)
        if distance >= 0.20:
            return "High"
        elif distance >= 0.10:
            return "Moderate"
        else:
            return "Low"

    def _get_clinical_note(self, prediction, probability, confidence):
        if prediction == 1:
            return (
                f"CBC pattern is consistent with β-thalassemia trait "
                f"(carrier probability: {probability*100:.1f}%). "
                f"Referral recommended for confirmatory HbA2 measurement "
                f"via HPLC or haemoglobin electrophoresis. "
                f"Carrier status defined as HbA2 ≥ 3.5%."
            )
        else:
            return (
                f"CBC parameters do not strongly indicate β-thalassemia "
                f"trait (carrier probability: {probability*100:.1f}%). "
                f"Continue routine clinical management. "
                f"Re-evaluate if clinical picture changes or "
                f"family history suggests carrier risk."
            )

    def _compute_shap(self, X_scaled: np.ndarray) -> dict:
        try:
            shap_values = self.explainer.shap_values(
                X_scaled, nsamples=100, silent=True
            )
            vals = shap_values[0] if len(shap_values.shape) > 1 else shap_values

            label_map = {
                'Age':           'Age',
                'MCV':           'MCV',
                'MCH':           'MCH',
                'HBG':           'HBG',
                'england_fraser':'England–Fraser',
                'green_king':    'Green–King',
                'hbg_mcv_ratio': 'HBG/MCV ratio',
                'hbg_mch_ratio': 'HBG/MCH ratio',
                'srivastava':    'Srivastava',
                'flag_gk':       'Green–King flag',
            }

            contributions = {}
            for i, feat in enumerate(self.features):
                label = label_map.get(feat, feat)
                contributions[label] = round(float(vals[i]), 4)

            contributions = dict(
                sorted(
                    contributions.items(),
                    key=lambda x: abs(x[1]),
                    reverse=True
                )
            )
            return contributions

        except Exception as e:
            logger.error(f"SHAP computation failed: {e}")
            return {}

    def predict(self, age, mcv, mch, hbg, rbc=None):
        # Step 1 — compute raw derived features
        features = self._compute_features(age, mcv, mch, hbg)

        # Step 2 — apply log transforms
        features = self._apply_log_transforms(features)

        # Store display values before scaling
        derived_display = {
            'england_fraser': round(mcv - mch - 3.4, 2),
            'green_king_raw': round((mcv**2 * 0.01) / mch, 3),
            'hbg_mcv_ratio':  round((hbg / mcv) * 100, 3),
            'hbg_mch_ratio':  round(hbg / mch, 3),
            'srivastava_raw': round((mcv * mch) / (hbg * 10), 3),
            'flag_gk':        int(((mcv**2 * 0.01) / mch) < 65),
        }

        # Step 3 — build ordered DataFrame
        X = self._build_feature_vector(features)

        # Step 4 — scale
        X_scaled = self.scaler.transform(X)

        # Step 5 — predict
        probability   = float(self.model.predict_proba(X_scaled)[0][1])
        prediction    = int(probability >= self.threshold)
        label         = "Carrier" if prediction == 1 else "Non-carrier"
        confidence    = self._get_confidence(probability)
        clinical_note = self._get_clinical_note(
            prediction, probability, confidence
        )

        # Step 6 — SHAP explanation
        shap_contributions = self._compute_shap(X_scaled)

        # Step 7 — supplementary RBC indices
        supplementary = None
        if rbc is not None:
            supplementary = self._compute_rbc_indices(mcv, mch, hbg, rbc)

        return {
            'prediction':              prediction,
            'label':                   label,
            'carrier_probability':     round(probability, 4),
            'non_carrier_probability': round(1 - probability, 4),
            'referral_recommended':    prediction == 1,
            'confidence':              confidence,
            'threshold_used':          self.threshold,
            'derived_features':        derived_display,
            'supplementary_indices':   supplementary,
            'shap_contributions':      shap_contributions,
            'clinical_note':           clinical_note,
        }


_predictor = None

def get_predictor() -> ThalassemiaPredictor:
    global _predictor
    if _predictor is None:
        _predictor = ThalassemiaPredictor()
    return _predictor
