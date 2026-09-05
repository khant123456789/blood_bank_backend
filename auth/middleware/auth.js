const User = require('../../auth/models/User');
const tokenService = require('../../auth/services/tokenService');
const { ROLES, STATUS } = require('../../auth/constant/authConstants');

const protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, no token'
            });
        }

        const verification = tokenService.verifyAccessToken(token);
        
        if (!verification.valid) {
            if (verification.expired) {
                return res.status(401).json({
                    success: false,
                    message: 'Access token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid access token'
            });
        }

        const user = await User.findById(verification.decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        if (user.deletedAt) {
            return res.status(401).json({
                success: false,
                message: 'Account has been deleted'
            });
        }

        if (user.status !== STATUS.APPROVED) {
            return res.status(403).json({
                success: false,
                message: `Account status is ${user.status}. Please wait for admin approval`
            });
        }

        if (user.changedPasswordAfter(verification.decoded.iat)) {
            return res.status(401).json({
                success: false,
                message: 'Password recently changed, please login again',
                code: 'PASSWORD_CHANGED'
            });
        }

        user.lastActivity = new Date();
        await user.save();

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Not authorized'
        });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === ROLES.ADMIN) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied. Admin only'
        });
    }
};

module.exports = { protect, admin };