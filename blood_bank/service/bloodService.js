// blood_bank/service/bloodService.js
const Stock = require('../model/bloodStock');
const Transaction = require('../model/bloodTransaction');
const mongoose = require('mongoose');

const getFullName = (bloodType, component) => {
    return `${bloodType} ${component}`;
};

// ✅ Add Stock - performedBy ထည့်ပါ
const addStock = async (bloodType, component, quantity, performedBy) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const fullName = getFullName(bloodType, component);
        
        // ၁။ Transaction မှတ်တမ်းတင်မယ် (performedBy ပါ)
        await Transaction.create([{
            bloodType, 
            component, 
            quantity, 
            action: 'Add',
            performedBy: {
                userId: performedBy._id,
                username: performedBy.username,
                email: performedBy.email
            }
        }], { session });

        // ၂။ Stock လက်ကျန် တိုးမယ်
        let stock = await Stock.findOne({ bloodType, component }).session(session);
        
        if (stock) {
            stock.currentQty += quantity;
            await stock.save({ session });
        } else {
            stock = new Stock({ bloodType, component, currentQty: quantity });
            await stock.save({ session });
        }
        
        await session.commitTransaction();
        session.endSession();
        
        return { 
            success: true,
            message: `✅ Successfully added ${quantity} unit(s) of ${fullName}.`,
            data: {
                bloodType,
                component,
                quantityAdded: quantity,
                currentStock: stock.currentQty,
                performedBy: {
                    username: performedBy.username,
                    email: performedBy.email
                }
            }
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// ✅ Issue Stock - performedBy ထည့်ပါ
const issueStock = async (bloodType, component, quantity, performedBy) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const fullName = getFullName(bloodType, component);
        const stock = await Stock.findOne({ bloodType, component }).session(session);

        if (!stock || stock.currentQty < quantity) {
            throw new Error(`❌ Insufficient stock for ${fullName}. Available: ${stock ? stock.currentQty : 0}, Requested: ${quantity}`);
        }

        stock.currentQty -= quantity;
        await stock.save({ session });

        await Transaction.create([{
            bloodType, 
            component, 
            quantity, 
            action: 'Issue',
            performedBy: {
                userId: performedBy._id,
                username: performedBy.username,
                email: performedBy.email
            }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return { 
            success: true,
            message: `✅ Successfully issued ${quantity} unit(s) of ${fullName}.`,
            data: {
                bloodType,
                component,
                quantityIssued: quantity,
                currentStock: stock.currentQty,
                performedBy: {
                    username: performedBy.username,
                    email: performedBy.email
                }
            }
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// ✅ Expire Stock - performedBy ထည့်ပါ
const expireStock = async (bloodType, component, quantity, performedBy) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const fullName = getFullName(bloodType, component);
        const stock = await Stock.findOne({ bloodType, component }).session(session);

        if (!stock || stock.currentQty < quantity) {
            throw new Error(`❌ Insufficient stock to expire for ${fullName}. Available: ${stock ? stock.currentQty : 0}, Requested: ${quantity}`);
        }

        stock.currentQty -= quantity;
        await stock.save({ session });

        await Transaction.create([{
            bloodType, 
            component, 
            quantity, 
            action: 'Expired',
            performedBy: {
                userId: performedBy._id,
                username: performedBy.username,
                email: performedBy.email
            }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return { 
            success: true,
            message: `✅ Successfully expired ${quantity} unit(s) of ${fullName}.`,
            data: {
                bloodType,
                component,
                quantityExpired: quantity,
                currentStock: stock.currentQty,
                performedBy: {
                    username: performedBy.username,
                    email: performedBy.email
                }
            }
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

module.exports = {
    addStock,
    issueStock,
    expireStock,
    getAllStocks
};