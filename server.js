// server.js - Blood Bank System (ပြီးပြည့်စုံသော ဗားရှင်း)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { securityHeaders, apiSecurity, disablePoweredBy, limiter } = require('./auth/middleware/security');

// Database
const database = require('./config/db');

// ============================================
// DATABASE CONNECTION
// ============================================
(async () => {
    try {
        await database.connect();
        console.log('✅ Database connected successfully');
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
})();

const app = express();

// ============================================
// SECURITY HEADERS
// ============================================
app.use(securityHeaders);
app.use(apiSecurity);
app.use(disablePoweredBy);

// ============================================
// RATE LIMITING
// ============================================
app.use(limiter);

// ============================================
// PROXY & HTTPS
// ============================================
app.set('trust proxy', 1);

// ============================================
// LOGGING
// ============================================
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
);

if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined', { stream: accessLogStream }));
} else {
    app.use(morgan('dev'));
}

// ============================================
// REQUEST ID
// ============================================
app.use((req, res, next) => {
    req.requestId = crypto.randomBytes(16).toString('hex');
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// ============================================
// COMPRESSION
// ============================================
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// ============================================
// REQUEST TIMEOUT
// ============================================
app.use((req, res, next) => {
    req.setTimeout(30000, () => {
        res.status(408).json({
            success: false,
            message: 'Request timeout',
            requestId: req.requestId
        });
    });
    next();
});

// ============================================
// CORS
// ============================================
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            return callback(null, true);
        }
        
        // Development
        if (origin.includes('localhost')) {
            return callback(null, true);
        }
        if (origin.includes('10.0.2.2')) {
            return callback(null, true);
        }
        if (origin.includes('127.0.0.1')) {
            return callback(null, true);
        }
        
        // Production
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',')
            : ['http://localhost:6001'];
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        console.log(`❌ CORS blocked: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Cookie',
        'Accept',
        'Origin'
    ],
    exposedHeaders: ['Set-Cookie'],
};

app.use(cors(corsOptions));

// ============================================
// BODY PARSERS
// ============================================
const REQUEST_LIMIT = process.env.REQUEST_LIMIT || '50mb';
app.use(express.json({ limit: REQUEST_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_LIMIT }));

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ============================================
// ROUTES
// ============================================
try {
    // Blood Routes
    try {
        const bloodRoutes = require('./blood_bank/routes/bloodRoutes');
        app.use('/blood-stock', bloodRoutes);
        console.log("✅ Blood routes loaded successfully");
    } catch (error) {
        console.error("❌ Failed to load blood routes:", error.message);
        process.exit(1);
    }

    // Auth Routes
    try {
        const authRoutes = require('./auth/routes/userRoutes');
        app.use('/auth', authRoutes);
        console.log("✅ Auth routes loaded successfully");
    } catch (error) {
        console.error("❌ Failed to load auth routes:", error.message);
        process.exit(1);
    }

} catch (error) {
    console.error("❌ Error loading routes:", error.message);
    process.exit(1);
}

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", async (req, res) => {
    const dbStatus = database.getStatus();
    
    res.json({
        success: true,
        message: "OK",
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        services: {
            mongodb: dbStatus.status,
        }
    });
});

// ============================================
// ERROR HANDLING
// ============================================
// 404 Not Found
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot find ${req.originalUrl} on this server!`,
        requestId: req.requestId
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        requestId: req.requestId,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 6001;

const startServer = async () => {
    const dbStatus = database.getStatus();
    
    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ BLOOD BANK SYSTEM`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🚀 Port: ${PORT}`);
        console.log(`🔗 Health: http://localhost:${PORT}/health`);
        console.log(`🔗 Blood API: http://localhost:${PORT}/blood-stock`);
        console.log(`🔗 Auth API: http://localhost:${PORT}/auth`);
        console.log(`🔗 MongoDB: ${dbStatus.status}`);
        console.log(`${'='.repeat(60)}\n`);
    });

    // Graceful Shutdown
    let isShuttingDown = false;

    const shutdown = async (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log(`\n🛑 Received ${signal} signal, starting graceful shutdown...`);

        server.close(async () => {
            console.log('✅ HTTP server closed');
            
            try {
                await database.disconnect();
                console.log('✅ MongoDB connection closed');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });

        setTimeout(() => {
            console.error('⚠️ Force shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (err) => {
        console.error('❌ Unhandled Rejection:', err);
    });

    process.on('uncaughtException', (err) => {
        console.error('❌ Uncaught Exception:', err);
        shutdown('uncaughtException');
    });

    return server;
};

startServer().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

module.exports = app;