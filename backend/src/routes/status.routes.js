const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:5001';

router.get('/', async (req, res) => {
  const result = { timestamp: new Date().toISOString(), services: {} };

  // Check ML Model API
  try {
    const start = Date.now();
    await axios.get(`${PYTHON_API}/health`, { timeout: 4000 });
    result.services.ml_api = { status: 'operational', latency: Date.now() - start };
  } catch {
    result.services.ml_api = { status: 'down', error: 'Python API unreachable on port 5001' };
  }

  const allOk = Object.values(result.services).every(s => s.status === 'operational');
  res.status(allOk ? 200 : 207).json(result);
});

module.exports = router;