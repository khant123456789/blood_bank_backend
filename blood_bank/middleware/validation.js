// blood_bank/middleware/validation.js
const { body, validationResult } = require('express-validator');

const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const validComponents = ['WB', 'PC', 'FFP', 'PRP'];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value || null
            }))
        });
    }
    next();
};

// ✅ Blood Stock Validation
const bloodStockValidation = [
    body('bloodType')
        .notEmpty().withMessage('Blood type is required')
        .isIn(validBloodTypes).withMessage(`Blood type must be one of: ${validBloodTypes.join(', ')}`),
    
    body('component')
        .notEmpty().withMessage('Component is required')
        .isIn(validComponents).withMessage(`Component must be one of: ${validComponents.join(', ')}`),
    
    body('quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt({ min: 1, max: 1000 }).withMessage('Quantity must be between 1 and 1000')
        .toInt(),
    
    validate
];

module.exports = {
    bloodStockValidation,
    validBloodTypes,
    validComponents
};