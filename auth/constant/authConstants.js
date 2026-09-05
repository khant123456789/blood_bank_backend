// config/authConstants.js
// ============================================
// USER ROLES & STATUS
// ============================================
const ROLES = {
    USER: 'user',
    ADMIN: 'admin'
};

const STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

// ============================================
// GENDER 🆕
// ============================================
const GENDER = {
    MALE: 'male',
    FEMALE: 'female'
};

// ============================================
// TOKEN TYPES
// ============================================
const TOKEN_TYPES = {
    ACCESS: 'access',
    REFRESH: 'refresh'
};

// ============================================
// AUDIT ACTIONS
// ============================================
const AUDIT_ACTIONS = {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    LOGOUT_ALL: 'LOGOUT_ALL',
    REGISTER: 'REGISTER',
    REFRESH_TOKEN: 'REFRESH_TOKEN',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    PROFILE_UPDATE: 'PROFILE_UPDATE',
    ROLE_CHANGE: 'ROLE_CHANGE',
    STATUS_CHANGE: 'STATUS_CHANGE',
    USER_DELETE: 'USER_DELETE',
    USER_DEACTIVATE: 'USER_DEACTIVATE',
    USER_ACTIVATE: 'USER_ACTIVATE',
    FAILED_LOGIN: 'FAILED_LOGIN',
    FORGOT_PASSWORD: 'FORGOT_PASSWORD',
    RESET_PASSWORD: 'RESET_PASSWORD'
};

const PASSWORD_STRENGTH = {
    WEAK: 'weak',
    FAIR: 'fair',
    GOOD: 'good',
    STRONG: 'strong'
};

const DEVICE_TYPES = {
    WEB: 'web',
    MOBILE: 'mobile',
    TABLET: 'tablet',
    DESKTOP: 'desktop',
    OTHER: 'other'
};

const NOTIFICATION_TYPES = {
    LOGIN_ALERT: 'LOGIN_ALERT',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    PROFILE_UPDATE: 'PROFILE_UPDATE',
    ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
    ACCOUNT_ACTIVATED: 'ACCOUNT_ACTIVATED',
    ROLE_CHANGED: 'ROLE_CHANGED',
    STATUS_CHANGED: 'STATUS_CHANGED',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED'
};

// ============================================
// VALIDATION LIMITS
// ============================================
const VALIDATION = {
    PASSWORD_MIN_LENGTH: 8,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 30,
    MAX_REFRESH_TOKENS: 5
};

module.exports = {
    ROLES,
    STATUS,
    GENDER,  // 🆕
    TOKEN_TYPES,
    AUDIT_ACTIONS,
    VALIDATION,
    PASSWORD_STRENGTH,
    DEVICE_TYPES,
    NOTIFICATION_TYPES
};