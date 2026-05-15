# ThalaPredict

> Machine learning–based beta thalassemia carrier detection system from Complete Blood Count Parameters for Sri Lankan primary care.

Built as a final year Computing project — University of Plymouth.

---

## Overview

ThalaPredict screens patients for beta thalassemia carrier status using routine CBC (Complete Blood Count) results. It runs a trained SVM model, explains every prediction with SHAP, generates MOH-format referral letters, and tracks outcomes — all in a clinical web interface designed for Sri Lankan primary care settings.

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML Service | Python · FastAPI · scikit-learn · SHAP |
| Backend | Node.js · Express · MongoDB Atlas |
| Frontend | React · Vite |

**Ports:** ML → `5001` · Backend → `3001` · Frontend → `5173`

---

## Dataset

- **Source:** Iraqi HPLC dataset, Ibn Al-Baladi Hospital, Baghdad
- **Size:** 1,073 records → 1,067 after cleaning
- **Class distribution:** 709 non-carriers / 358 carriers (~2:1)
- **Label:** HBA2 ≥ 3.5% (HPLC gold standard) — used for labelling only, not as a model input

---

## ML Model

| Parameter | Value |
|---|---|
| Algorithm | SVM, RBF kernel |
| C | 2.190 |
| gamma | 0.1 |
| class_weight | balanced |
| Decision threshold | 0.49 (custom tuned) |
| AUC-ROC | 0.829 |
| Carrier Recall | 75% |
| Carrier F1 | 0.735 |
| Cross-val AUC | 0.821 ± 0.031 |

### Feature Engineering

Six haematological indices derived from raw CBC inputs:

- England-Fraser
- Green-King *(log-transformed)*
- HBG/MCV ratio
- HBG/MCH ratio
- Srivastava *(log-transformed)*
- Flag-GK *(binary)*

All 10 features standardised with `StandardScaler`. RBC excluded (86% missing).

### Explainability

SHAP `KernelExplainer` used (model-agnostic). Every prediction generates a per-patient SHAP waterfall chart. Global explanations include bar chart and beeswarm plot.

**Top features:** `england_fraser`, `green_king`, `hbg_mch_ratio`, `MCV`, `MCH`

---

## Features

### Core Screening
- JWT-authenticated login
- Single-patient CBC input form with prediction result page
- Result page: probability gauge, confidence badge, derived indices, SHAP waterfall
- PDF screening report download (jsPDF 2.5.1)
- Batch CSV upload for multiple patients
- History page with search, filter, pagination, and CSV export

### Analytics Dashboard
- Age distribution bar chart
- Sex breakdown donut chart
- Screening trend line chart (7-day / 30-day toggle)
- Referral completion rate
- All charts rendered as pure SVG from live MongoDB data

### Couple Screening
- Side-by-side CBC input for two partners
- Simultaneous ML prediction for both
- Mendelian 25% risk calculator with Punnett square
- Risk tiles: affected / carrier / unaffected breakdown
- Couple PDF report and couple MOH referral letter

### Outcome Tracking
- Outcome states: Pending · Confirmed Carrier · Not Confirmed · Lost to Follow-up
- Inline editing panel on History page with clinical notes
- Outcome badge on every history row
- Pending follow-up filter and stat card
- `PATCH /api/history/:id/outcome` endpoint

### MOH Referral Letter
- Government-format A4 referral letter
- MOH letterhead with FROM/TO blocks
- Urgency banner (Urgent / Priority / Routine)
- CBC findings table, screening result, and derived indices
- Clinician signature block and official stamp box
- Accessible from result page, history page, and couple screening

### Voice Wizard
- Hands-free CBC input guided by text-to-speech prompts
- App speaks each field, listens, confirms, and auto-advances
- Retry up to 3 attempts per field; optional field skipping
- Implemented via `useVoiceWizard.js` using the Web Speech API

### Settings
- Clinic name, district, and contact details (applied to all PDF headers)
- Unit display preferences
- District defaults for referral routing
- Dark / Light theme toggle across all pages

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.9
- MongoDB Atlas connection string

### 1. Clone the repository

```bash
git clone https://github.com/isuriyy/thalassemia.git
cd thalassemia
```

### 2. ML Service (FastAPI)

```bash
cd ml
pip install -r requirements.txt
uvicorn main:app --port 5001 --reload
```

### 3. Backend (Express)

```bash
cd backend
npm install
# Create .env with your MongoDB URI and JWT secret
npm run dev
```

### 4. Frontend (React / Vite)

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

Create a `.env` file in `/backend`:

```
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret
PORT=3001
```

---

## Known Limitations

- **Voice recognition** — reliability may vary with Sri Lankan English accent variations. Documented as a known issue; mitigation applied, full resolution is future work.
- **Offline / PWA** — deferred. The ML inference API requires a locally running server, making a true offline mode impractical in the current architecture.
- **Dataset** — trained on an Iraqi HPLC dataset. Clinical validation on a Sri Lankan population cohort is recommended before deployment.

---

## Project Structure

```
thalassemia/
├── ml/              # FastAPI ML service + trained SVM model + SHAP
├── backend/         # Express API + MongoDB models + JWT auth
└── frontend/        # React / Vite app
```

---

## Academic Context

**Degree:** BSc (Hons) Computer Science  
**Institution:** University of Plymouth  
**Purpose:** Final year project — not yet validated for clinical use

---

## License

This project is submitted for academic assessment. Contact the author before reuse.
