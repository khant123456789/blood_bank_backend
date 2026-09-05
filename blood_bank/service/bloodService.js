// blood_bank/service/bloodService.js
const Stock = require('../model/bloodStock');
const Transaction = require('../model/bloodTransaction');
const mongoose = require('mongoose');

const getFullName = (bloodType, component) => {
    return `${bloodType} ${component}`;
};

const getAllStocks = async () => {
    const allStock = await Stock.find();

    const bloodTypes = ['A', 'B', 'O', 'AB'];
    const result = {
        positive: bloodTypes.map(type => ({ 
            bloodType: type, 
            wholeBlood: 0, 
            ffp: 0, 
            packCell: 0, 
            prp: 0 
        })),
        negative: bloodTypes.map(type => ({ 
            bloodType: type, 
            wholeBlood: 0, 
            ffp: 0, 
            packCell: 0, 
            prp: 0 
        }))
    };

    allStock.forEach(item => {
        const isPositive = item.bloodType.endsWith('+');
        const baseType = item.bloodType.slice(0, -1);

        const targetArray = isPositive ? result.positive : result.negative;
        const row = targetArray.find(t => t.bloodType === baseType);

        if (row) {
            if (item.component === 'Whole Blood') row.wholeBlood = item.currentQty;
            if (item.component === 'FFP') row.ffp = item.currentQty;
            if (item.component === 'Pack Cell') row.packCell = item.currentQty;
            if (item.component === 'PRP') row.prp = item.currentQty;
        }
    });

    return result;
};

// ✅ Transaction ထည့်ပြီး ပြင်ဆင်ထားတဲ့ Add Stock
const addStock = async (bloodType, component, quantity) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const fullName = getFullName(bloodType, component);
        
        // ၁။ Transaction မှတ်တမ်းတင်မယ်
        await Transaction.create([{
            bloodType, 
            component, 
            quantity, 
            action: 'Add'
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
        
        // ✅ Transaction အောင်မြင်ပြီဆိုရင် commit လုပ်ပါ
        await session.commitTransaction();
        session.endSession();
        
        return { 
            success: true,
            message: `✅ Successfully added ${quantity} unit(s) of ${fullName}.`,
            data: {
                bloodType,
                component,
                quantityAdded: quantity,
                currentStock: stock.currentQty
            }
        };
    } catch (error) {
        // ❌ Error ဖြစ်ရင် rollback လုပ်ပါ
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// ✅ Issue Stock ကိုလည်း အလားတူ ပြင်ပါ
const issueStock = async (bloodType, component, quantity) => {
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
            action: 'Issue'
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
                currentStock: stock.currentQty
            }
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// ✅ Expire Stock ကိုလည်း အလားတူ ပြင်ပါ
const expireStock = async (bloodType, component, quantity) => {
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
            action: 'Expired'
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
                currentStock: stock.currentQty
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