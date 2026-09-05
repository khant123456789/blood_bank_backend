// routes/userRoute.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, admin } = require('../middleware/auth');
const { limiter, loginLimiter, registerLimiter } = require('../middleware/security');

const {
    registerValidation,
    loginValidation,
    updateProfileValidation,
    passwordChangeValidation,
    idValidation,
    statusValidation,
    roleValidation
} = require('../middleware/validation');


// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/register', registerLimiter, registerValidation, userController.register);
router.post('/login', loginLimiter, loginValidation, userController.login);
router.post('/refresh-token', loginLimiter, userController.refreshToken);

// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, updateProfileValidation, userController.updateProfile);
router.post('/change-password', protect, passwordChangeValidation, userController.changePassword);
router.post('/logout', protect, userController.logout);
router.post('/logout-all', protect, userController.logoutAll);
router.get('/security-score', protect, userController.getSecurityScore);
router.get('/my-audit-logs', protect, userController.getMyAuditLogs);

// ============================================
// ADMIN ROUTES
// ============================================
router.get('/users', protect, admin, userController.getAllUsers);
router.get('/users/:id', protect, admin, idValidation, userController.getUserById);
router.put('/users/:id', protect, admin, idValidation, updateProfileValidation, userController.adminUpdateUser);
router.put('/users/:id/role', protect, admin, idValidation, roleValidation, userController.updateUserRole);
router.put('/users/:id/status', protect, admin, idValidation, statusValidation, userController.updateUserStatus);
router.delete('/users/:id', protect, admin, idValidation, userController.deleteUser);
router.put('/users/:id/deactivate', protect, admin, idValidation, userController.deactivateUser);
router.put('/users/:id/activate', protect, admin, idValidation, userController.activateUser);
router.get('/audit-logs', protect, admin, userController.getAuditLogs);
router.get('/audit-stats', protect, admin, userController.getAuditStats);

module.exports = router;