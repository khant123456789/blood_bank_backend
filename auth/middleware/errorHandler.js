const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
    }

    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)[0];
        message = `Duplicate value for ${field}: ${err.keyValue[field]}`;
    }

    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    console.error(`❌ ${statusCode} - ${message}`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        stack: err.stack
    });

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} not found`
    });
};

module.exports = { errorHandler, notFound };