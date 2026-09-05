const { body, param, query, validationResult } = require('express-validator');
const { isStrongPassword, isValidPhone, sanitizeInput } = require('../utils/helper');

// ============================================
// VALIDATION ERROR HANDLER
// ============================================
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value || null,
                location: err.location
            }))
        });
    }
    next();
};

// ============================================
// AUTH VALIDATIONS
// ============================================
const registerValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscore')
        .customSanitizer(value => value.toLowerCase()),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
        .customSanitizer(value => value.toLowerCase()),
    
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .custom((value) => {
            if (!isValidPhone(value)) {
                throw new Error('Invalid phone number format');
            }
            return true;
        }),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .custom((value) => {
            if (!isStrongPassword(value)) {
                throw new Error('Password must contain at least one uppercase, lowercase, number and special character');
            }
            return true;
        }),
    
    body('confirmPassword')
        .notEmpty().withMessage('Confirm password is required')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    
    body('age')
        .optional()
        .isInt({ min: 0, max: 150 }).withMessage('Age must be a whole number between 0 and 150')
        .toInt(),
    
    body('gender')
        .optional()
        .isIn(['male', 'female', 'other']).withMessage('Gender must be one of: male, female, other'),
    
    validate
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
        .customSanitizer(value => value.toLowerCase()),
    
    body('password')
        .notEmpty().withMessage('Password is required'),
    
    validate
];

const passwordChangeValidation = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password must be different from current password');
            }
            if (!isStrongPassword(value)) {
                throw new Error('Password must contain at least one uppercase, lowercase, number and special character');
            }
            return true;
        }),
    
    body('confirmNewPassword')
        .notEmpty().withMessage('Please confirm your new password')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    
    validate
];

// ============================================
// PROFILE VALIDATIONS
// ============================================
const updateProfileValidation = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscore')
        .customSanitizer(value => value.toLowerCase()),
    
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
        .customSanitizer(value => value.toLowerCase()),
    
    body('phone')
        .optional()
        .trim()
        .custom((value) => {
            if (!isValidPhone(value)) {
                throw new Error('Invalid phone number format');
            }
            return true;
        }),
    
    body('profile.firstName')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
        .customSanitizer(value => sanitizeInput(value)),
    
    body('profile.lastName')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
        .customSanitizer(value => sanitizeInput(value)),
    
    body('profile.bio')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters')
        .customSanitizer(value => sanitizeInput(value)),
    
    body('age')
        .optional()
        .isInt({ min: 0, max: 150 }).withMessage('Age must be a whole number between 0 and 150')
        .toInt(),
    
    body('gender')
        .optional()
        .isIn(['male', 'female', 'other']).withMessage('Gender must be one of: male, female, other'),
    
    validate
];

// ============================================
// ADMIN VALIDATIONS
// ============================================
const idValidation = [
    param('id')
        .isMongoId().withMessage('Invalid user ID'),
    validate
];

const statusValidation = [
    body('status')
        .isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status. Must be pending, approved, or rejected'),
    validate
];

const roleValidation = [
    body('role')
        .isIn(['user', 'admin']).withMessage('Invalid role. Must be user or admin'),
    validate
];

// ============================================
// PERSON VALIDATIONS
// ============================================
const validateRegNo = (req, res, next) => {
    const { regNo } = req.params;
    if (!regNo || regNo.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Registration number is required'
        });
    }
    next();
};

const validatePeriod = (req, res, next) => {
    const { period } = req.params;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid period format. Must be YYYY-MM (e.g., 2026-07)'
        });
    }
    next();
};

// ============================================
// QUERY VALIDATIONS
// ============================================
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
        .toInt(),
    
    validate
];

const searchValidation = [
    query('q')
        .optional()
        .trim()
        .isLength({ min: 2 }).withMessage('Search query must be at least 2 characters')
        .customSanitizer(value => sanitizeInput(value)),
    
    validate
];

// ============================================
// EXPORTS
// ============================================
module.exports = {
    // Auth
    registerValidation,
    loginValidation,
    passwordChangeValidation,
    
    // Profile
    updateProfileValidation,
    
    // Admin
    idValidation,
    statusValidation,
    roleValidation,
    
    // Person
    validateRegNo,
    validatePeriod,
    
    // Query
    paginationValidation,
    searchValidation,
    
    // Utility
    validate
};