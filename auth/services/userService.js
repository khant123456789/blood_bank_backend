// services/userService.js
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const tokenService = require('./tokenService');
const auditService = require('./auditService');
const { ROLES, STATUS, GENDER } = require('../constant/authConstants');
const { isStrongPassword, getPasswordStrength } = require('../utils/helper');

class UserService {
    // ============================================
    // AUTHENTICATION
    // ============================================

    // Register user
    async register(userData, ipAddress, userAgent) {
        try {
            // Check if user exists
            const existingUser = await User.findOne({
                $or: [
                    { email: userData.email.toLowerCase() },
                    { username: userData.username.toLowerCase() },
                    { phone: userData.phone }
                ]
            });

            if (existingUser) {
                const fields = [];
                if (existingUser.email.toLowerCase() === userData.email.toLowerCase()) fields.push('email');
                if (existingUser.username.toLowerCase() === userData.username.toLowerCase()) fields.push('username');
                if (existingUser.phone === userData.phone) fields.push('phone');

                const error = new Error(`${fields.join(', ')} already exists`);
                error.statusCode = 400;
                throw error;
            }

            // Validate password strength
            const passwordStrength = getPasswordStrength(userData.password);
            if (passwordStrength.level === 'Weak') {
                const error = new Error('Password is too weak. Please choose a stronger password.');
                error.statusCode = 400;
                throw error;
            }

            // Create user
            const user = new User({
                username: userData.username.toLowerCase(),
                email: userData.email.toLowerCase(),
                phone: userData.phone,
                password: userData.password,
                role: ROLES.USER,
                status: STATUS.PENDING,

                // ===== 🆕 AGE & GENDER =====
                age: userData.age,
                gender: userData.gender || GENDER.OTHER,

                profile: {
                    firstName: userData.firstName?.trim(),
                    lastName: userData.lastName?.trim(),
                    bio: userData.bio?.trim()
                },
                security: {
                    passwordStrength: passwordStrength.level
                }
            });

            await user.save();

            // Audit log
            await auditService.log({
                userId: user._id,
                action: 'REGISTER',
                details: {
                    email: user.email,
                    age: user.age,
                    gender: user.gender,
                    ip: ipAddress,
                    userAgent
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                message: 'Registration successful. Please wait for admin approval',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    status: user.status,
                    profile: user.profile,
                    age: user.age,        // 🆕
                    gender: user.gender   // 🆕
                },
                passwordStrength
            };
        } catch (error) {
            throw error;
        }
    }

    // Login
    async login(email, password, ipAddress, userAgent, deviceId) {
        try {
            const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

            if (!user) {
                const error = new Error('Invalid credentials');
                error.statusCode = 401;
                throw error;
            }

            // Check if account is locked
            if (user.isLocked()) {
                const remainingMinutes = Math.ceil((user.security.lockUntil - Date.now()) / 60000);
                const error = new Error(`Account is locked. Please try again in ${remainingMinutes} minutes`);
                error.statusCode = 403;
                throw error;
            }

            // Check password
            const isPasswordMatch = await user.comparePassword(password);
            if (!isPasswordMatch) {
                await user.incrementLoginAttempts();

                await auditService.log({
                    userId: user._id,
                    action: 'FAILED_LOGIN',
                    details: {
                        email: email.toLowerCase(),
                        ip: ipAddress,
                        userAgent
                    },
                    ipAddress,
                    userAgent,
                    success: false,
                    error: 'Invalid password'
                });

                const error = new Error('Invalid credentials');
                error.statusCode = 401;
                throw error;
            }

            // Check if user can login
            if (!user.canLogin()) {
                let message = 'Account is deactivated';
                if (user.status === STATUS.PENDING) message = 'Account pending approval';
                if (user.status === STATUS.REJECTED) message = 'Account rejected';
                if (user.deletedAt) message = 'Account has been deleted';

                const error = new Error(message);
                error.statusCode = 403;
                throw error;
            }

            // Reset login attempts
            await user.resetLoginAttempts();

            // Update last login
            user.lastLogin = new Date();
            user.lastActivity = new Date();
            user.security.lastLoginIp = ipAddress;
            user.security.lastLoginDevice = userAgent;
            await user.save();

            // Generate tokens
            const accessToken = tokenService.generateAccessToken(user._id);
            const refreshToken = await tokenService.generateRefreshToken(user._id, {
                ipAddress,
                userAgent,
                deviceId
            });

            // Check for suspicious activity
            const suspicious = await this.checkSuspiciousActivity(user, ipAddress);

            // Audit log
            await auditService.log({
                userId: user._id,
                action: 'LOGIN',
                details: {
                    email: user.email,
                    ip: ipAddress,
                    deviceId,
                    suspicious: suspicious.isSuspicious
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                accessToken,
                refreshToken: refreshToken.token,
                expiresIn: process.env.JWT_EXPIRE || '15m',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    status: user.status,
                    profile: user.profile,
                    age: user.age,                 // 🆕
                    gender: user.gender,           // 🆕
                    lastLogin: user.lastLogin,
                    twoFactorEnabled: user.security?.twoFactorEnabled || false
                },
                suspicious: suspicious.isSuspicious ? suspicious : undefined
            };
        } catch (error) {
            throw error;
        }
    }

    // Check suspicious activity
    async checkSuspiciousActivity(user, currentIp) {
        const warnings = [];

        if (user.security?.lastLoginIp && user.security.lastLoginIp !== currentIp) {
            warnings.push({
                type: 'new_ip',
                message: 'Login from new IP address',
                ip: currentIp,
                previousIp: user.security.lastLoginIp
            });
        }

        if (user.security?.failedLoginAttempts >= 3) {
            warnings.push({
                type: 'failed_attempts',
                message: `Multiple failed login attempts (${user.security.failedLoginAttempts})`,
                attempts: user.security.failedLoginAttempts
            });
        }

        return {
            isSuspicious: warnings.length > 0,
            warnings
        };
    }

    // Refresh access token
    async refreshAccessToken(refreshToken, ipAddress, userAgent) {
        try {
            const tokenDoc = await RefreshToken.findOne({
                token: refreshToken,
                isRevoked: false
            });

            if (!tokenDoc) {
                const error = new Error('Invalid refresh token');
                error.statusCode = 401;
                throw error;
            }

            if (tokenDoc.isExpired()) {
                tokenDoc.isRevoked = true;
                tokenDoc.revokedReason = 'Token expired';
                await tokenDoc.save();

                const error = new Error('Refresh token expired');
                error.statusCode = 401;
                throw error;
            }

            const user = await User.findById(tokenDoc.userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (!user.canLogin()) {
                const error = new Error('Account cannot login');
                error.statusCode = 403;
                throw error;
            }

            const shouldRefresh = tokenService.shouldRefreshToken(tokenDoc.expiresAt);

            let newRefreshToken = refreshToken;
            let daysUntilExpiry = tokenService.getDaysUntilExpiry(tokenDoc.expiresAt);

            if (shouldRefresh) {
                await tokenService.revokeRefreshToken(refreshToken, 'Token rotated');

                const newToken = await tokenService.generateRefreshToken(user._id, {
                    ipAddress,
                    userAgent,
                    deviceId: tokenDoc.deviceInfo?.deviceId
                });

                newRefreshToken = newToken.token;
                daysUntilExpiry = 30;
            }

            user.lastActivity = new Date();
            await user.save();

            const accessToken = tokenService.generateAccessToken(user._id);

            await auditService.log({
                userId: user._id,
                action: 'REFRESH_TOKEN',
                details: {
                    tokenRefreshed: shouldRefresh,
                    daysUntilExpiry,
                    ip: ipAddress
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: process.env.JWT_EXPIRE || '15m',
                tokenRefreshed: shouldRefresh,
                daysUntilExpiry
            };
        } catch (error) {
            throw error;
        }
    }

    // Logout
    async logout(userId, refreshToken, ipAddress, userAgent) {
        try {
            if (refreshToken) {
                await tokenService.revokeRefreshToken(refreshToken, 'User logout');
            }

            await auditService.log({
                userId,
                action: 'LOGOUT',
                details: {
                    refreshToken: !!refreshToken,
                    ip: ipAddress
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Logout from all devices
    async logoutAll(userId, ipAddress, userAgent) {
        try {
            const count = await tokenService.revokeAllUserTokens(userId, 'Logout all devices');

            await auditService.log({
                userId,
                action: 'LOGOUT_ALL',
                details: {
                    message: 'Logged out from all devices',
                    sessionsRevoked: count,
                    ip: ipAddress
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                message: 'Logged out from all devices',
                sessionsRevoked: count.modifiedCount || 0
            };
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // USER MANAGEMENT
    // ============================================

    // Get user by ID
    async getUserById(userId, includeSensitive = false) {
        try {
            let query = User.findById(userId);
            if (includeSensitive) {
                query = query.select('+password +security');
            }
            const user = await query;

            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Get user by email
    async getUserByEmail(email, includeSensitive = false) {
        try {
            let query = User.findOne({ email: email.toLowerCase() });
            if (includeSensitive) {
                query = query.select('+password +security');
            }
            const user = await query;

            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Get user by username
    async getUserByUsername(username, includeSensitive = false) {
        try {
            let query = User.findOne({ username: username.toLowerCase() });
            if (includeSensitive) {
                query = query.select('+password +security');
            }
            const user = await query;

            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Get all users with pagination
    async getAllUsers(filters = {}, page = 1, limit = 20) {
        try {
            const query = {};

            if (filters.role) query.role = filters.role;
            if (filters.status) query.status = filters.status;
            if (filters.isActive !== undefined) query.isActive = filters.isActive;

            // 🆕 Filter by age range
            if (filters.minAge !== undefined || filters.maxAge !== undefined) {
                query.age = {};
                if (filters.minAge !== undefined) query.age.$gte = parseInt(filters.minAge);
                if (filters.maxAge !== undefined) query.age.$lte = parseInt(filters.maxAge);
            }

            // 🆕 Filter by gender
            if (filters.gender) {
                query.gender = filters.gender;
            }

            if (filters.search) {
                query.$or = [
                    { username: { $regex: filters.search, $options: 'i' } },
                    { email: { $regex: filters.search, $options: 'i' } },
                    { phone: { $regex: filters.search, $options: 'i' } }
                ];
            }

            if (filters.startDate) {
                query.createdAt = { $gte: new Date(filters.startDate) };
            }
            if (filters.endDate) {
                query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [users, total] = await Promise.all([
                User.find(query)
                    .sort({ createdAt: -1 })
                    .select('-__v')
                    .limit(parseInt(limit))
                    .skip(skip),
                User.countDocuments(query)
            ]);

            return {
                users,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            };
        } catch (error) {
            throw error;
        }
    }

    // Count users
    async countUsers(filters = {}) {
        try {
            const query = {};
            if (filters.role) query.role = filters.role;
            if (filters.status) query.status = filters.status;
            if (filters.isActive !== undefined) query.isActive = filters.isActive;
            if (filters.gender) query.gender = filters.gender;
            return await User.countDocuments(query);
        } catch (error) {
            throw error;
        }
    }

    // Update user
    async updateUser(userId, updateData) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Check uniqueness
            if (updateData.email || updateData.username || updateData.phone) {
                const query = {
                    _id: { $ne: userId },
                    $or: []
                };

                if (updateData.email) query.$or.push({ email: updateData.email.toLowerCase() });
                if (updateData.username) query.$or.push({ username: updateData.username.toLowerCase() });
                if (updateData.phone) query.$or.push({ phone: updateData.phone });

                const existingUser = await User.findOne(query);
                if (existingUser) {
                    const fields = [];
                    if (existingUser.email.toLowerCase() === updateData.email?.toLowerCase()) fields.push('email');
                    if (existingUser.username.toLowerCase() === updateData.username?.toLowerCase()) fields.push('username');
                    if (existingUser.phone === updateData.phone) fields.push('phone');

                    const error = new Error(`${fields.join(', ')} already exists`);
                    error.statusCode = 400;
                    throw error;
                }
            }

            // 🆕 Validate age if provided
            if (updateData.age !== undefined && updateData.age !== null) {
                if (updateData.age < 0 || updateData.age > 150) {
                    const error = new Error('Age must be between 0 and 150');
                    error.statusCode = 400;
                    throw error;
                }
                if (!Number.isInteger(updateData.age)) {
                    const error = new Error('Age must be a whole number');
                    error.statusCode = 400;
                    throw error;
                }
            }

            // 🆕 Validate gender if provided
            if (updateData.gender) {
                const validGenders = ['male', 'female', 'other'];
                if (!validGenders.includes(updateData.gender)) {
                    const error = new Error('Gender must be one of: male, female, other');
                    error.statusCode = 400;
                    throw error;
                }
            }

            // Remove fields that shouldn't be updated directly
            const restrictedFields = ['password', 'role', 'status', '_id', 'createdAt', 'updatedAt', 'deletedAt', 'security'];
            restrictedFields.forEach(field => delete updateData[field]);

            // Clean data
            if (updateData.username) updateData.username = updateData.username.toLowerCase();
            if (updateData.email) updateData.email = updateData.email.toLowerCase();
            if (updateData.profile) {
                if (updateData.profile.firstName) updateData.profile.firstName = updateData.profile.firstName.trim();
                if (updateData.profile.lastName) updateData.profile.lastName = updateData.profile.lastName.trim();
                if (updateData.profile.bio) updateData.profile.bio = updateData.profile.bio.trim();
            }

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            );

            return updatedUser;
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // PASSWORD MANAGEMENT
    // ============================================

    // Change password
    async changePassword(userId, currentPassword, newPassword, ipAddress, userAgent) {
        try {
            const user = await User.findById(userId).select('+password');
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const isPasswordMatch = await user.comparePassword(currentPassword);
            if (!isPasswordMatch) {
                const error = new Error('Current password is incorrect');
                error.statusCode = 401;
                throw error;
            }

            const isSamePassword = await user.comparePassword(newPassword);
            if (isSamePassword) {
                const error = new Error('New password must be different from current password');
                error.statusCode = 400;
                throw error;
            }

            if (!isStrongPassword(newPassword)) {
                const error = new Error('Password must contain at least one uppercase, lowercase, number and special character');
                error.statusCode = 400;
                throw error;
            }

            const passwordStrength = getPasswordStrength(newPassword);

            user.password = newPassword;
            user.security.passwordStrength = passwordStrength.level;
            user.security.lastPasswordChange = new Date();

            await tokenService.revokeAllUserTokens(userId, 'Password changed');
            await user.save();

            await auditService.log({
                userId,
                action: 'PASSWORD_CHANGE',
                details: {
                    message: 'Password changed successfully',
                    ip: ipAddress,
                    strength: passwordStrength.level
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                message: 'Password changed successfully. Please login again.',
                passwordStrength
            };
        } catch (error) {
            throw error;
        }
    }

    // Forgot password - generate reset token
    async forgotPassword(email, ipAddress, userAgent) {
        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return {
                    success: true,
                    message: 'If your email exists, you will receive a password reset link'
                };
            }

            const resetToken = tokenService.generateResetToken(user._id);

            user.security.resetPasswordToken = resetToken;
            user.security.resetPasswordExpires = new Date(Date.now() + 3600000);
            await user.save();

            await auditService.log({
                userId: user._id,
                action: 'FORGOT_PASSWORD',
                details: {
                    email: user.email,
                    ip: ipAddress
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                message: 'Password reset link sent to your email',
                resetToken
            };
        } catch (error) {
            throw error;
        }
    }

    // Reset password with token
    async resetPassword(token, newPassword, ipAddress, userAgent) {
        try {
            const user = await User.findOne({
                'security.resetPasswordToken': token,
                'security.resetPasswordExpires': { $gt: new Date() }
            }).select('+password');

            if (!user) {
                const error = new Error('Invalid or expired reset token');
                error.statusCode = 400;
                throw error;
            }

            if (!isStrongPassword(newPassword)) {
                const error = new Error('Password must contain at least one uppercase, lowercase, number and special character');
                error.statusCode = 400;
                throw error;
            }

            const passwordStrength = getPasswordStrength(newPassword);

            user.password = newPassword;
            user.security.passwordStrength = passwordStrength.level;
            user.security.lastPasswordChange = new Date();
            user.security.resetPasswordToken = undefined;
            user.security.resetPasswordExpires = undefined;

            await tokenService.revokeAllUserTokens(user._id, 'Password reset');
            await user.save();

            await auditService.log({
                userId: user._id,
                action: 'RESET_PASSWORD',
                details: {
                    ip: ipAddress,
                    strength: passwordStrength.level
                },
                ipAddress,
                userAgent
            });

            return {
                success: true,
                message: 'Password reset successfully. Please login.',
                passwordStrength
            };
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // ADMIN - USER MANAGEMENT
    // ============================================

    // Update user role (Admin only)
    async updateUserRole(userId, newRole, adminId) {
        try {
            if (!Object.values(ROLES).includes(newRole)) {
                const error = new Error('Invalid role');
                error.statusCode = 400;
                throw error;
            }

            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (userId.toString() === adminId.toString()) {
                const error = new Error('Cannot change your own role');
                error.statusCode = 403;
                throw error;
            }

            if (user.role === newRole) {
                const error = new Error('User already has this role');
                error.statusCode = 400;
                throw error;
            }

            const oldRole = user.role;
            user.role = newRole;
            await user.save();

            await tokenService.revokeAllUserTokens(userId, `Role changed from ${oldRole} to ${newRole}`);

            await auditService.log({
                userId: adminId,
                action: 'ROLE_CHANGE',
                details: {
                    targetUserId: userId,
                    targetUsername: user.username,
                    oldRole,
                    newRole
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Admin Panel'
            });

            return {
                success: true,
                message: `User role updated to ${newRole}`,
                user: {
                    id: user._id,
                    username: user.username,
                    role: user.role
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Update user status (Admin only)
    async updateUserStatus(userId, status, adminId) {
        try {
            if (!Object.values(STATUS).includes(status)) {
                const error = new Error('Invalid status');
                error.statusCode = 400;
                throw error;
            }

            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (userId.toString() === adminId.toString()) {
                const error = new Error('Cannot change your own status');
                error.statusCode = 403;
                throw error;
            }

            if (user.status === status) {
                const error = new Error('User already has this status');
                error.statusCode = 400;
                throw error;
            }

            const oldStatus = user.status;
            user.status = status;
            await user.save();

            if (status === STATUS.REJECTED || status === STATUS.PENDING) {
                await tokenService.revokeAllUserTokens(userId, `Status changed to ${status}`);
            }

            await auditService.log({
                userId: adminId,
                action: 'STATUS_CHANGE',
                details: {
                    targetUserId: userId,
                    targetUsername: user.username,
                    oldStatus,
                    newStatus: status
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Admin Panel'
            });

            return {
                success: true,
                message: `User status updated to ${status}`,
                user: {
                    id: user._id,
                    username: user.username,
                    status: user.status
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Delete user (Admin only)
    async deleteUser(userId, adminId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (user.role === ROLES.ADMIN) {
                const error = new Error('Cannot delete admin account');
                error.statusCode = 403;
                throw error;
            }

            if (userId.toString() === adminId.toString()) {
                const error = new Error('Cannot delete your own account');
                error.statusCode = 403;
                throw error;
            }

            user.isActive = false;
            user.deletedAt = new Date();
            user.deletedBy = adminId;
            await user.save();

            await tokenService.revokeAllUserTokens(userId, 'User deleted');

            await auditService.log({
                userId: adminId,
                action: 'USER_DELETE',
                details: {
                    targetUserId: userId,
                    username: user.username,
                    email: user.email
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Admin Panel'
            });

            return {
                success: true,
                message: 'User deleted successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Deactivate user (Admin only)
    async deactivateUser(userId, adminId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (user.role === ROLES.ADMIN) {
                const error = new Error('Cannot deactivate admin account');
                error.statusCode = 403;
                throw error;
            }

            if (!user.isActive) {
                const error = new Error('User is already deactivated');
                error.statusCode = 400;
                throw error;
            }

            user.isActive = false;
            user.deactivatedAt = new Date();
            user.deactivatedBy = adminId;
            await user.save();

            await tokenService.revokeAllUserTokens(userId, 'User deactivated');

            await auditService.log({
                userId: adminId,
                action: 'USER_DEACTIVATE',
                details: {
                    targetUserId: userId,
                    username: user.username
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Admin Panel'
            });

            return {
                success: true,
                message: 'User deactivated successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Activate user (Admin only)
    async activateUser(userId, adminId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (user.isActive) {
                const error = new Error('User is already active');
                error.statusCode = 400;
                throw error;
            }

            user.isActive = true;
            user.deactivatedAt = undefined;
            user.deactivatedBy = undefined;
            await user.save();

            await auditService.log({
                userId: adminId,
                action: 'USER_ACTIVATE',
                details: {
                    targetUserId: userId,
                    username: user.username
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Admin Panel'
            });

            return {
                success: true,
                message: 'User activated successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    // Get user active sessions
    async getUserActiveSessions(userId, currentRefreshToken) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const sessions = await RefreshToken.find({
                userId: userId,
                isRevoked: false
            }).sort({ updatedAt: -1 });

            return sessions.map(session => ({
                id: session._id,
                deviceInfo: session.deviceInfo,
                createdAt: session.createdAt,
                expiresAt: session.expiresAt,
                isCurrent: session.token === currentRefreshToken,
                isExpired: session.isExpired(),
                daysUntilExpiry: tokenService.getDaysUntilExpiry(session.expiresAt)
            }));
        } catch (error) {
            throw error;
        }
    }

    // Revoke specific session
    async revokeSession(userId, sessionId) {
        try {
            const session = await RefreshToken.findOne({
                _id: sessionId,
                userId: userId,
                isRevoked: false
            });

            if (!session) {
                const error = new Error('Session not found');
                error.statusCode = 404;
                throw error;
            }

            session.isRevoked = true;
            session.revokedReason = 'User revoked session';
            session.revokedAt = new Date();
            await session.save();

            return {
                success: true,
                message: 'Session revoked successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // AUDIT LOGS
    // ============================================

    // Get user audit logs
    async getUserAuditLogs(userId, limit = 50, skip = 0) {
        try {
            const [logs, total] = await Promise.all([
                AuditLog.find({ userId })
                    .sort({ timestamp: -1 })
                    .limit(parseInt(limit))
                    .skip(parseInt(skip)),
                AuditLog.countDocuments({ userId })
            ]);

            return {
                logs,
                total,
                limit: parseInt(limit),
                skip: parseInt(skip)
            };
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // STATISTICS
    // ============================================

    // Get user statistics
    async getUserStats() {
        try {
            const stats = await User.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: {
                            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                        },
                        inactive: {
                            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
                        },
                        admins: {
                            $sum: { $cond: [{ $eq: ['$role', ROLES.ADMIN] }, 1, 0] }
                        },
                        users: {
                            $sum: { $cond: [{ $eq: ['$role', ROLES.USER] }, 1, 0] }
                        },
                        pending: {
                            $sum: { $cond: [{ $eq: ['$status', STATUS.PENDING] }, 1, 0] }
                        },
                        approved: {
                            $sum: { $cond: [{ $eq: ['$status', STATUS.APPROVED] }, 1, 0] }
                        },
                        rejected: {
                            $sum: { $cond: [{ $eq: ['$status', STATUS.REJECTED] }, 1, 0] }
                        }
                    }
                }
            ]);

            const dailyStats = await User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            return {
                ...(stats[0] || {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    admins: 0,
                    users: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0
                }),
                dailyRegistrations: dailyStats
            };
        } catch (error) {
            throw error;
        }
    }

    // Get user stats for a specific user
    async getUserStatsById(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const [sessionCount, auditCount] = await Promise.all([
                RefreshToken.countDocuments({ userId, isRevoked: false }),
                AuditLog.countDocuments({ userId })
            ]);

            return {
                userId: user._id,
                username: user.username,
                age: user.age,          // 🆕
                gender: user.gender,    // 🆕
                sessionCount,
                auditCount,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                isActive: user.isActive,
                status: user.status,
                role: user.role
            };
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // BULK OPERATIONS (Admin only)
    // ============================================

    // Bulk delete users
    async bulkDeleteUsers(userIds, adminId) {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                const error = new Error('No user IDs provided');
                error.statusCode = 400;
                throw error;
            }

            const adminUsers = await User.find({
                _id: { $in: userIds },
                role: ROLES.ADMIN
            });

            if (adminUsers.length > 0) {
                const error = new Error(`Cannot delete ${adminUsers.length} admin account(s)`);
                error.statusCode = 403;
                throw error;
            }

            const result = await User.updateMany(
                { _id: { $in: userIds }, role: { $ne: ROLES.ADMIN } },
                {
                    isActive: false,
                    deletedAt: new Date(),
                    deletedBy: adminId
                }
            );

            await tokenService.revokeAllUserTokens(userIds, 'Bulk delete');

            await auditService.log({
                userId: adminId,
                action: 'BULK_USER_DELETE',
                details: {
                    deletedUsers: userIds,
                    count: result.modifiedCount
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Admin Panel'
            });

            return {
                success: true,
                message: `${result.modifiedCount} users deleted successfully`,
                deletedCount: result.modifiedCount
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new UserService();