from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import time

from app.schemas import CBCInput, PredictionResponse
from app.predictor import get_predictor, ThalassemiaPredictor
from app.config import API_VERSION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="β-Thalassemia Carrier Screening API",
    description=(
        "ML-based CBC screening for β-thalassemia carrier status. "
        "Uses SVM classifier trained on 1073 Sri Lankan patient records. "
        "Primary metric: recall (sensitivity) = 0.750, AUC-ROC = 0.829."
    ),
    version=API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Loading model artefacts at startup...")
    get_predictor()
    logger.info("API ready")


@app.get("/health")
def health():
    predictor = get_predictor()
    return {
        "status":    "ok",
        "model":     "SVM (tuned)",
        "features":  predictor.features,
        "threshold": predictor.threshold,
        "version":   API_VERSION,
    }


@app.post("/predict")
def predict(
    payload: CBCInput,
    predictor: ThalassemiaPredictor = Depends(get_predictor)
):
    start = time.time()
    try:
        result = predictor.predict(
            age=payload.age,
            mcv=payload.mcv,
            mch=payload.mch,
            hbg=payload.hbg,
            rbc=payload.rbc,
        )
        elapsed = round((time.time() - start) * 1000, 1)
        logger.info(
            f"Prediction: {result['label']} "
            f"prob={result['carrier_probability']:.3f} "
            f"time={elapsed}ms"
        )
        return result

    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch")
def predict_batch(
    payloads: list[CBCInput],
    predictor: ThalassemiaPredictor = Depends(get_predictor)
):
    if len(payloads) > 500:
        raise HTTPException(
            status_code=400,
            detail="Batch size limited to 500 records"
        )
    results = []
    for p in payloads:
        try:
            r = predictor.predict(
                age=p.age, mcv=p.mcv,
                mch=p.mch, hbg=p.hbg, rbc=p.rbc
            )
            results.append({"status": "ok", **r})
        except Exception as e:
            results.append({"status": "error", "detail": str(e)})
    return {"total": len(results), "results": results}
