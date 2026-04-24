const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token    = header.split(' ')[1];
        const decoded  = jwt.verify(token, process.env.JWT_SECRET);
        req.clinician  = await User.findById(decoded.id).select('-password');

        if (!req.clinician) {
            return res.status(401).json({ message: 'User not found' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = protect;
