const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    deviceInfo: {
        userAgent: { type: String },
        ipAddress: { type: String },
        deviceId: { type: String }
    },
    isRevoked: {
        type: Boolean,
        default: false
    },
    revokedAt: Date,
    revokedReason: String
}, {
    timestamps: true
});

// Indexes
refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ userId: 1, expiresAt: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
refreshTokenSchema.methods.isExpired = function() {
    return this.expiresAt < new Date();
};

refreshTokenSchema.methods.isValid = function() {
    return !this.isRevoked && !this.isExpired();
};

// Static methods
refreshTokenSchema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({
        $or: [
            { expiresAt: { $lt: new Date() } },
            { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        ]
    });
    return result.deletedCount;
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
module.exports = RefreshToken;