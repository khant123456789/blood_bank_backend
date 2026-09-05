// utils/helper.js

const crypto = require('crypto');
const { getUserDevice, getLocationFromIP, timeAgo } = require('./sessionHelper');

// ============================================
// PASSWORD FUNCTIONS
// ============================================
const isStrongPassword = (password) => {
    if (!password || password.length < 8) return false;
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
};

const getPasswordStrength = (password) => {
    if (!password) return { score: 0, level: 'Weak', color: '#ff4444' };
    
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[@$!%*?&]/.test(password)) score += 1;
    
    let level, color;
    if (score <= 2) { level = 'Weak'; color = '#ff4444'; }
    else if (score <= 4) { level = 'Fair'; color = '#ffa500'; }
    else if (score <= 6) { level = 'Good'; color = '#4caf50'; }
    else { level = 'Strong'; color = '#00c853'; }
    
    return { score, level, color, maxScore: 8 };
};

// ============================================
// TOKEN GENERATION
// ============================================
const generateToken = (length = 32, format = 'hex') => {
    if (format === 'base64') {
        return crypto.randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    }
    if (format === 'url') {
        return crypto.randomBytes(length).toString('base64url');
    }
    return crypto.randomBytes(length).toString('hex');
};

// ============================================
// DATA MASKING
// ============================================
const maskEmail = (email) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const maskedName = name.length <= 2 ? name : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
};

const maskPhone = (phone) => {
    if (!phone) return '';
    if (phone.length <= 4) return phone;
    const visibleStart = phone.slice(0, 3);
    const visibleEnd = phone.slice(-4);
    const maskLength = phone.length - 7;
    return `${visibleStart}${'*'.repeat(maskLength)}${visibleEnd}`;
};

// ============================================
// IP & DEVICE
// ============================================
const getClientIP = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp;
    
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.ip ||
           'Unknown';
};

const getUserAgent = (req) => {
    return req.headers['user-agent'] || 'Unknown';
};

const getDeviceInfo = (userAgent) => {
    return {
        device: getUserDevice(userAgent),
        type: getDeviceType(userAgent),
        browser: getBrowser(userAgent),
        os: getOS(userAgent),
        userAgent: userAgent || 'Unknown'
    };
};

const getLocation = (ip) => {
    return getLocationFromIP(ip);
};

// ============================================
// ✅ DEVICE TYPE HELPERS (ပြင်ဆင်ပြီး)
// ============================================
const getDeviceType = (userAgent) => {
    const ua = userAgent?.toLowerCase() || '';
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet')) return 'tablet';
    if (ua.includes('postman')) return 'api';
    if (ua.includes('curl')) return 'cli';
    if (ua.includes('insomnia')) return 'api';
    return 'desktop';
};

const getBrowser = (userAgent) => {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    
    // API Clients
    if (ua.includes('postman')) return 'Postman';
    if (ua.includes('insomnia')) return 'Insomnia';
    if (ua.includes('curl')) return 'cURL';
    if (ua.includes('axios')) return 'Axios';
    if (ua.includes('fetch')) return 'Fetch';
    if (ua.includes('httpie')) return 'HTTPie';
    
    // Browsers
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    if (ua.includes('brave')) return 'Brave';
    if (ua.includes('vivaldi')) return 'Vivaldi';
    
    return 'Unknown';
};

const getOS = (userAgent) => {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    
    // API Clients
    if (ua.includes('postman')) return 'Postman';
    if (ua.includes('insomnia')) return 'Insomnia';
    if (ua.includes('curl')) return 'cURL';
    
    // Operating Systems
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('iphone')) return 'iOS';
    if (ua.includes('ipad')) return 'iPadOS';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('ubuntu')) return 'Ubuntu';
    if (ua.includes('debian')) return 'Debian';
    if (ua.includes('fedora')) return 'Fedora';
    
    return 'Unknown';
};

// ============================================
// VALIDATION
// ============================================
const isValidEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

const isValidUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
};

// ============================================
// STRING UTILITIES
// ============================================
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .trim()
        .replace(/[<>]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};

const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// ============================================
// DATE FUNCTIONS
// ============================================
const formatDate = (date, format = 'full') => {
    if (!date) return 'Invalid date';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    const options = {
        full: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        short: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        date: { year: 'numeric', month: 'short', day: 'numeric' },
        time: { hour: '2-digit', minute: '2-digit' }
    };
    
    return d.toLocaleString('en-US', options[format] || options.full);
};

const getTimeAgo = (date) => {
    return timeAgo(date);
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
    // Password
    isStrongPassword,
    getPasswordStrength,
    
    // Token
    generateToken,
    
    // Mask
    maskEmail,
    maskPhone,
    
    // IP & Device
    getClientIP,
    getUserAgent,
    getDeviceInfo,
    getLocation,
    getDeviceType,
    getBrowser,
    getOS,
    
    // Validation
    isValidEmail,
    isValidPhone,
    isValidUsername,
    
    // String
    sanitizeInput,
    capitalize,
    
    // Date
    formatDate,
    getTimeAgo
};