// blood_bank/service/bloodService.js
const Stock = require('../model/bloodStock');
const Transaction = require('../model/bloodTransaction');
const mongoose = require('mongoose');

const getFullName = (bloodType, component) => {
    return `${bloodType} ${component}`;
};

const getAllStocks = async () => {
    try {
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
                // Map component to field name
                if (item.component === 'WB' || item.component === 'Whole Blood') {
                    row.wholeBlood = item.currentQty;
                } else if (item.component === 'FFP') {
                    row.ffp = item.currentQty;
                } else if (item.component === 'PC' || item.component === 'Pack Cell') {
                    row.packCell = item.currentQty;
                } else if (item.component === 'PRP') {
                    row.prp = item.currentQty;
                }
            }
        });

        return result;
    } catch (error) {
        console.error('❌ Get all stocks error:', error);
        throw error;
    }
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

// ✅ Get all transactions with date filters (Admin Only)
const getTransactions = async (filters = {}) => {
    try {
        const query = {};
        
        // Filter by blood type
        if (filters.bloodType) {
            query.bloodType = filters.bloodType;
        }
        
        // Filter by component
        if (filters.component) {
            query.component = filters.component;
        }
        
        // Filter by action
        if (filters.action) {
            query.action = filters.action;
        }
        
        // ✅ Filter by date range (ဒီမှာ ထည့်ပါ)
        if (filters.startDate || filters.endDate) {
            query.date = {};
            if (filters.startDate) {
                // Start of day
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                query.date.$gte = start;
            }
            if (filters.endDate) {
                // End of day
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }
        
        // Filter by performed by (user)
        if (filters.performedBy) {
            query['performedBy.username'] = { $regex: filters.performedBy, $options: 'i' };
        }
        
        // Pagination
        const page = parseInt(filters.page) || 1;
        const limit = Math.min(parseInt(filters.limit) || 50, 200);
        const skip = (page - 1) * limit;
        
        // Get transactions
        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .populate('performedBy.userId', 'username email profile'),
            Transaction.countDocuments(query)
        ]);
        
        // Group by date for summary (ဒီမှာ ထည့်ပါ)
        const groupedByDate = {};
        transactions.forEach(t => {
            const dateKey = t.date.toISOString().split('T')[0];
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    totalAdd: 0,
                    totalIssue: 0,
                    totalExpired: 0,
                    totalUnits: 0,
                    transactions: []
                };
            }
            groupedByDate[dateKey].transactions.push(t);
            groupedByDate[dateKey].totalUnits += t.quantity;
            if (t.action === 'Add') groupedByDate[dateKey].totalAdd += 1;
            if (t.action === 'Issue') groupedByDate[dateKey].totalIssue += 1;
            if (t.action === 'Expired') groupedByDate[dateKey].totalExpired += 1;
        });
        
        // Format transactions
        const formattedTransactions = transactions.map(t => ({
            id: t._id,
            bloodType: t.bloodType,
            component: t.component,
            quantity: t.quantity,
            action: t.action,
            performedBy: t.performedBy,
            date: t.date,
            createdAt: t.createdAt,
            remark: t.remark || ''
        }));
        
        return {
            transactions: formattedTransactions,
            groupedByDate: Object.values(groupedByDate), // 🆕 Grouped by date
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            summary: {
                totalAdd: transactions.filter(t => t.action === 'Add').length,
                totalIssue: transactions.filter(t => t.action === 'Issue').length,
                totalExpired: transactions.filter(t => t.action === 'Expired').length,
                totalUnits: transactions.reduce((sum, t) => sum + t.quantity, 0)
            }
        };
    } catch (error) {
        console.error('❌ Get transactions error:', error);
        throw error;
    }
};

module.exports = {
    addStock,
    issueStock,
    expireStock,
    getAllStocks,
    getTransactions
};