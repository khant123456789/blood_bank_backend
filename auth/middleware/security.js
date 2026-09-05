// auth/middleware/security.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

// ============================================
// RATE LIMITING
// ============================================
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ✅ Register Limiter - အသစ်ထည့်ပါ
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 registrations per hour
    message: {
        success: false,
        message: 'Too many registration attempts, please try again after 1 hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================
// SECURITY HEADERS (Helmet)
// ============================================
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
});

// ============================================
// XSS PROTECTION
// ============================================
const xssProtection = (req, res, next) => {
    try {
        if (req.body) {
            for (let key in req.body) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = xss(req.body[key]);
                }
            }
        }
        next();
    } catch (error) {
        console.error('XSS Protection Error:', error);
        next();
    }
};

// ============================================
// API SECURITY HEADERS
// ============================================
const apiSecurity = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
};

// ============================================
// DISABLE X-POWERED-BY
// ============================================
const disablePoweredBy = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
};

// ============================================
// MONGO SANITIZE - Safe Version
// ============================================
const mongoSanitizeMiddleware = (req, res, next) => {
    try {
        // Only sanitize if there's body data
        if (req.body && typeof req.body === 'object') {
            // Deep sanitize for nested objects
            const sanitizeObject = (obj) => {
                if (!obj || typeof obj !== 'object') return obj;
                
                for (let key in obj) {
                    if (typeof obj[key] === 'string') {
                        // ✅ Email အတွက် . (dot) ကိုမဖယ်ပါနဲ့
                        // ဒါပေမယ့် MongoDB operators ($) ကိုတော့ ဖယ်ပါ
                        if (key === 'email') {
                            // Email အတွက် $ ကိုပဲဖယ်ပါ
                            obj[key] = obj[key].replace(/\$/g, '');
                        } else {
                            // တခြား fields အတွက် $ နဲ့ . ကိုဖယ်ပါ
                            obj[key] = obj[key].replace(/[$.]/g, '');
                        }
                    } else if (typeof obj[key] === 'object') {
                        sanitizeObject(obj[key]);
                    }
                }
                return obj;
            };
            
            sanitizeObject(req.body);
        }
        
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            for (let key in req.query) {
                if (typeof req.query[key] === 'string') {
                    // Query parameters အတွက် $ နဲ့ . ကိုဖယ်ပါ
                    req.query[key] = req.query[key].replace(/[$.]/g, '');
                }
            }
        }
        
        next();
    } catch (error) {
        console.error('Mongo Sanitize Error:', error);
        next();
    }
};


module.exports = {
    limiter,
    loginLimiter,
    registerLimiter, 
    securityHeaders,
    xssProtection,
    apiSecurity,
    disablePoweredBy,
    mongoSanitize: mongoSanitizeMiddleware
};