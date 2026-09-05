const express = require('express');
const router = express.Router();
const stockController = require('../controller/bloodController');
const { protect, admin } = require('../../auth/middleware/auth');
const { bloodStockValidation } = require('../middleware/validation');

// ============================================
// ADMIN ROUTES -
// ============================================
router.post(
    '/add',
    protect,
    admin,
    bloodStockValidation,  
    stockController.addStock
);

router.post(
    '/issue',
    protect,
    admin,
    bloodStockValidation,  
    stockController.issueStock
);

router.post(
    '/expire',
    protect,
    admin,
    bloodStockValidation,
    stockController.expireStock
);

// ============================================
// USER ROUTES
// ============================================
router.get('/', stockController.getAllStocks);

module.exports = router;