require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: false
}));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth',    require('./routes/auth.routes'));
app.use('/api/predict', require('./routes/predict.routes'));
app.use('/api/history', require('./routes/history.routes'));
app.use('/api/status',  require('./routes/status.routes'));
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status:    'ok',
        service:   'thalassemia-backend',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
    console.log(`ML API expected at: ${process.env.PYTHON_API_URL}`);
});
