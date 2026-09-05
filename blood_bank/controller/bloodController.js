// blood_bank/controller/bloodController.js
const stockService = require('../service/bloodService');

// ✅ Controller မှာ Validation မပါတော့ပါ (Middleware က လုပ်ပြီးသား)
const addStock = async (req, res) => {
    try {
        const { bloodType, component, quantity } = req.body;
        const result = await stockService.addStock(bloodType, component, quantity);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

const issueStock = async (req, res) => {
    try {
        const { bloodType, component, quantity } = req.body;
        const result = await stockService.issueStock(bloodType, component, quantity);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

const expireStock = async (req, res) => {
    try {
        const { bloodType, component, quantity } = req.body;
        const result = await stockService.expireStock(bloodType, component, quantity);
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