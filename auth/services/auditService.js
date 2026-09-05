const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../constant/authConstants');

class AuditService {
    async log(data) {
        try {
            const logData = {
                userId: data.userId,
                action: data.action,
                details: data.details || {},
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                success: data.success !== undefined ? data.success : true,
                error: data.error,
                sessionId: data.sessionId
            };

            const log = new AuditLog(logData);
            await log.save();
            return log;
        } catch (error) {
            console.error('Audit log error:', error);
            return null;
        }
    }

    async getAuditLogs(filters = {}) {
        try {
            const query = {};
            if (filters.userId) query.userId = filters.userId;
            if (filters.action) query.action = filters.action;
            if (filters.success !== undefined) query.success = filters.success;
            if (filters.startDate) {
                query.timestamp = { $gte: new Date(filters.startDate) };
            }
            if (filters.endDate) {
                query.timestamp = { ...query.timestamp, $lte: new Date(filters.endDate) };
            }

            const logs = await AuditLog.find(query)
                .populate('userId', 'username email')
                .sort({ timestamp: -1 })
                .limit(filters.limit || 100)
                .skip(filters.skip || 0);

            return logs;
        } catch (error) {
            console.error('Get audit logs error:', error);
            throw error;
        }
    }
}

module.exports = new AuditService();