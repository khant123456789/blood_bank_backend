// blood_bank/controller/bloodController.js
const stockService = require('../service/bloodService');

// ✅ Add Stock - req.user ကို passed လုပ်ပါ
const addStock = async (req, res) => {
    try {
        const { bloodType, component, quantity } = req.body;
        
        // ✅ req.user ကို service ကို passed လုပ်ပါ
        const result = await stockService.addStock(
            bloodType, 
            component, 
            quantity, 
            req.user  // ✅ လက်ရှိ user
        );
        
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// ✅ Issue Stock - req.user ကို passed လုပ်ပါ
const issueStock = async (req, res) => {
    try {
        const { bloodType, component, quantity } = req.body;
        const result = await stockService.issueStock(
            bloodType, 
            component, 
            quantity, 
            req.user  // ✅ လက်ရှိ user
        );
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

// ✅ Expire Stock - req.user ကို passed လုပ်ပါ
const expireStock = async (req, res) => {
    try {
        const { bloodType, component, quantity } = req.body;
        const result = await stockService.expireStock(
            bloodType, 
            component, 
            quantity, 
            req.user  // ✅ လက်ရှိ user
        );
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

const getAllStocks = async (req, res) => {
    try {
        const stocks = await stockService.getAllStocks();
        res.status(200).json({
            success: true,
            data: stocks
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};
// ✅ Get all transactions (Admin Only)
const getTransactions = async (req, res) => {
    try {
        const {
            bloodType,
            component,
            action,
            startDate,  // ✅ YYYY-MM-DD format
            endDate,    // ✅ YYYY-MM-DD format
            performedBy,
            page = 1,
            limit = 50
        } = req.query;

        // ✅ Validate date format
        if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid startDate format. Use YYYY-MM-DD'
            });
        }
        if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid endDate format. Use YYYY-MM-DD'
            });
        }

        const result = await stockService.getTransactions({
            bloodType,
            component,
            action,
            startDate,  // ✅
            endDate,    // ✅
            performedBy,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    addStock,
    issueStock,
    expireStock,
    getAllStocks,
    getTransactions
};