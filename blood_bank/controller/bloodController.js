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

module.exports = {
    addStock,
    issueStock,
    expireStock,
    getAllStocks
};