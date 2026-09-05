const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

class TokenService {
    generateAccessToken(userId) {
        return jwt.sign(
            { id: userId, type: 'access' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '15m' }
        );
    }

    async generateRefreshToken(userId, deviceInfo = {}) {
        const token = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const refreshToken = new RefreshToken({
            token,
            userId,
            expiresAt,
            deviceInfo: {
                userAgent: deviceInfo.userAgent,
                ipAddress: deviceInfo.ipAddress,
                deviceId: deviceInfo.deviceId
            }
        });

        await refreshToken.save();
        return refreshToken;
    }

    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return { valid: true, decoded };
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return { valid: false, expired: true, message: 'Access token expired' };
            }
            return { valid: false, expired: false, message: 'Invalid access token' };
        }
    }

    async verifyRefreshToken(token, userId) {
        const refreshToken = await RefreshToken.findOne({
            token,
            userId
        });

        if (!refreshToken) {
            // ✅ Token ကို မကြာသေးမီက revoke လုပ်ထားရင် (attack ဖြစ်နိုင်ခြေ)
            const revokedToken = await RefreshToken.findOne({
                token,
                userId,
                isRevoked: true,
                revokedAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // ပြီးခဲ့တဲ့ 5 မိနစ်အတွင်း
            });

            if (revokedToken) {
                // ✅ Token reuse detected - user ရဲ့ token အကုန်လုံးကို revoke လုပ်ပါ
                await this.revokeAllUserTokens(userId, 'Token reuse detected - security incident');
                throw new Error('Token reuse detected. All sessions have been revoked.');
            }
            return { valid: false, message: 'Refresh token not found' };
        }

        if (refreshToken.isRevoked) {
            return { valid: false, message: 'Refresh token revoked' };
        }

        if (refreshToken.isExpired()) {
            refreshToken.isRevoked = true;
            refreshToken.revokedReason = 'Token expired';
            await refreshToken.save();
            return { valid: false, message: 'Refresh token expired' };
        }

        return { valid: true, token: refreshToken };
    }
    shouldRefreshToken(expiresAt) {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry < 1;
    }

    getDaysUntilExpiry(expiresAt) {
        const now = new Date();
        const expiry = new Date(expiresAt);
        return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
    }

    async revokeRefreshToken(token, reason = 'User logout') {
        const refreshToken = await RefreshToken.findOne({ token });
        if (refreshToken) {
            refreshToken.isRevoked = true;
            refreshToken.revokedAt = new Date();
            refreshToken.revokedReason = reason;
            await refreshToken.save();
        }
        return refreshToken;
    }

    async revokeAllUserTokens(userId, reason = 'Logout all devices') {
        const result = await RefreshToken.updateMany(
            { userId, isRevoked: false },
            {
                isRevoked: true,
                revokedAt: new Date(),
                revokedReason: reason
            }
        );
        return result;
    }

    generateResetToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        // လုံခြုံရေးအတွက် hashed version ကိုသိမ်းပါ
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
        return hashedToken;
    }

    verifyResetToken(token) {
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
        return hashedToken;
    }
}

module.exports = new TokenService();