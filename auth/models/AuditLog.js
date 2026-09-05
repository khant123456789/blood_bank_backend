const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../constant/authConstants');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    action: {
        type: String,
        enum: Object.values(AUDIT_ACTIONS),
        required: true,
        index: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        index: true
    },
    userAgent: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    success: {
        type: Boolean,
        default: true,
        index: true
    },
    error: {
        type: String
    },
    // Additional fields
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'resourceType',
        index: true
    },
    resourceType: {
        type: String,
        enum: ['User', 'Product', 'Order', 'Payment']
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    sessionId: {
        type: String,
        index: true
    },
    deviceInfo: {
        browser: String,
        os: String,
        device: String
    },
    location: {
        country: String,
        city: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    }
}, {
    timestamps: true
});

// ============================================
// INDEXES
// ============================================
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ 'details.targetUserId': 1 });
auditLogSchema.index({ success: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, resourceType: 1 });
auditLogSchema.index({ createdAt: 1 });

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, success: 1, timestamp: -1 });

// ============================================
// STATIC METHODS
// ============================================

// Cleanup old logs
auditLogSchema.statics.cleanupOld = async function(days = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({ timestamp: { $lt: cutoff } });
    return result.deletedCount;
};

// Get audit log count
auditLogSchema.statics.getCount = async function(filters = {}) {
    const query = this.buildQuery(filters);
    return await this.countDocuments(query);
};

// Build query from filters
auditLogSchema.statics.buildQuery = function(filters = {}) {
    const query = {};
    
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.success !== undefined) query.success = filters.success;
    if (filters.resourceId) query.resourceId = filters.resourceId;
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.sessionId) query.sessionId = filters.sessionId;
    
    if (filters.startDate) {
        query.timestamp = { $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
        query.timestamp = { ...query.timestamp, $lte: new Date(filters.endDate) };
    }
    
    if (filters.search) {
        query.$or = [
            { 'details.email': { $regex: filters.search, $options: 'i' } },
            { 'details.username': { $regex: filters.search, $options: 'i' } },
            { 'details.targetUserId': filters.search },
            { error: { $regex: filters.search, $options: 'i' } }
        ];
    }
    
    return query;
};

// ============================================
// INSTANCE METHODS
// ============================================

// Check if log is recent
auditLogSchema.methods.isRecent = function(minutes = 5) {
    const now = new Date();
    const diff = (now - this.timestamp) / (1000 * 60);
    return diff <= minutes;
};

// Get formatted log
auditLogSchema.methods.format = function() {
    return {
        id: this._id,
        action: this.action,
        user: this.userId ? {
            id: this.userId._id || this.userId,
            username: this.userId?.username,
            email: this.userId?.email
        } : null,
        details: this.details,
        timestamp: this.timestamp,
        ip: this.ipAddress,
        device: this.deviceInfo,
        location: this.location,
        success: this.success,
        error: this.error,
        createdAt: this.createdAt
    };
};

// ============================================
// VIRTUAL FIELDS
// ============================================

auditLogSchema.virtual('isError').get(function() {
    return !this.success;
});

auditLogSchema.virtual('timeAgo').get(function() {
    const seconds = Math.floor((Date.now() - this.timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
});

// ============================================
// TRANSFORM
// ============================================

auditLogSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.__v;
        return ret;
    }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;