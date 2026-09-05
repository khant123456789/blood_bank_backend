// services/securityService.js
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

class SecurityService {
    // ============================================
    // SECURITY SCORE
    // ============================================
    
    async getSecurityScore(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            let score = 0;
            const details = [];

            // 1. Password strength (20 points)
            // ✅ User model မှာ သိမ်းထားတဲ့ password strength ကိုသုံး
            const passwordStrength = user.security?.passwordStrength || 'weak';
            const strengthPoints = this.getPasswordStrengthPoints(passwordStrength);
            score += strengthPoints;
            details.push({
                category: 'Password Strength',
                score: strengthPoints,
                max: 20,
                level: passwordStrength,
                warning: strengthPoints < 20 ? 'Use a stronger password' : undefined
            });

            // 2. 2FA enabled (25 points)
            if (user.security?.twoFactorEnabled) {
                score += 25;
                details.push({ 
                    category: 'Two-Factor Authentication', 
                    score: 25, 
                    max: 25,
                    status: 'Enabled ✅'
                });
            } else {
                details.push({ 
                    category: 'Two-Factor Authentication', 
                    score: 0, 
                    max: 25, 
                    warning: 'Enable 2FA for better security',
                    status: 'Disabled ❌'
                });
            }

            // 3. Account age (10 points)
            const daysSinceCreation = (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24);
            if (daysSinceCreation > 30) {
                score += 10;
                details.push({ 
                    category: 'Account Age', 
                    score: 10, 
                    max: 10,
                    info: `${Math.round(daysSinceCreation)} days old`
                });
            } else {
                score += 5;
                details.push({ 
                    category: 'Account Age', 
                    score: 5, 
                    max: 10,
                    info: 'Account is new (less than 30 days)'
                });
            }

            // 4. Password age (15 points)
            const daysSincePasswordChange = (Date.now() - user.passwordChangedAt) / (1000 * 60 * 60 * 24);
            if (daysSincePasswordChange < 30) {
                score += 15;
                details.push({ 
                    category: 'Password Age', 
                    score: 15, 
                    max: 15,
                    info: `Changed ${Math.round(daysSincePasswordChange)} days ago ✅`
                });
            } else if (daysSincePasswordChange < 90) {
                score += 10;
                details.push({ 
                    category: 'Password Age', 
                    score: 10, 
                    max: 15,
                    warning: `Changed ${Math.round(daysSincePasswordChange)} days ago`,
                    suggestion: 'Change password every 90 days'
                });
            } else {
                score += 5;
                details.push({ 
                    category: 'Password Age', 
                    score: 5, 
                    max: 15,
                    warning: `Password is ${Math.round(daysSincePasswordChange)} days old`,
                    suggestion: 'Change password immediately'
                });
            }

            // 5. Active sessions (15 points)
            const activeSessions = await RefreshToken.countDocuments({ 
                userId, 
                isRevoked: false 
            });
            if (activeSessions <= 2) {
                score += 15;
                details.push({ 
                    category: 'Active Sessions', 
                    score: 15, 
                    max: 15,
                    info: `${activeSessions} active session${activeSessions > 1 ? 's' : ''}`
                });
            } else if (activeSessions <= 5) {
                score += 10;
                details.push({ 
                    category: 'Active Sessions', 
                    score: 10, 
                    max: 15,
                    warning: `${activeSessions} active sessions`,
                    suggestion: 'Limit concurrent sessions'
                });
            } else {
                score += 5;
                details.push({ 
                    category: 'Active Sessions', 
                    score: 5, 
                    max: 15,
                    warning: `${activeSessions} active sessions`,
                    suggestion: 'Logout from unused devices'
                });
            }

            // 6. Account status (15 points)
            if (user.isActive && user.status === 'approved') {
                score += 15;
                details.push({ 
                    category: 'Account Status', 
                    score: 15, 
                    max: 15,
                    status: 'Active ✅'
                });
            } else if (!user.isActive) {
                details.push({ 
                    category: 'Account Status', 
                    score: 0, 
                    max: 15,
                    warning: 'Account is deactivated',
                    status: 'Deactivated ❌'
                });
            } else if (user.status === 'pending') {
                details.push({ 
                    category: 'Account Status', 
                    score: 5, 
                    max: 15,
                    warning: 'Account pending approval',
                    status: 'Pending ⏳'
                });
            } else if (user.status === 'rejected') {
                details.push({ 
                    category: 'Account Status', 
                    score: 0, 
                    max: 15,
                    warning: 'Account rejected',
                    status: 'Rejected ❌'
                });
            }

            const total = Math.min(score, 100);
            return {
                total,
                details,
                level: this.getSecurityLevel(total),
                summary: this.getSecuritySummary(details)
            };
        } catch (error) {
            console.error('Security score error:', error);
            throw error;
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getPasswordStrengthPoints(strength) {
        const levels = {
            'weak': 5,
            'fair': 10,
            'good': 15,
            'strong': 20
        };
        return levels[strength] || 5;
    }

    getSecurityLevel(score) {
        if (score >= 90) {
            return { 
                label: 'Excellent', 
                color: '#00C853', 
                emoji: '🛡️',
                description: 'Your account is very secure'
            };
        }
        if (score >= 70) {
            return { 
                label: 'Good', 
                color: '#FFA726', 
                emoji: '🔒',
                description: 'Your account is well protected'
            };
        }
        if (score >= 50) {
            return { 
                label: 'Fair', 
                color: '#FFC107', 
                emoji: '⚠️',
                description: 'Your account needs improvement'
            };
        }
        return { 
            label: 'Weak', 
            color: '#F44336', 
            emoji: '🔓',
            description: 'Your account is at risk'
        };
    }

    getSecuritySummary(details) {
        const warnings = details.filter(d => d.warning);
        const improvements = details.filter(d => d.score < d.max);
        
        return {
            totalWarnings: warnings.length,
            totalImprovements: improvements.length,
            warnings: warnings.map(d => d.warning),
            improvements: improvements.map(d => d.category)
        };
    }

    // ============================================
    // SUSPICIOUS ACTIVITY CHECK
    // ============================================
    
    async checkSuspiciousActivity(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return { suspicious: false, warnings: [] };
            }

            const warnings = [];

            // 1. Check multiple failed login attempts
            const failedAttempts = user.security?.failedLoginAttempts || 0;
            if (failedAttempts >= 3) {
                warnings.push({
                    type: 'multiple_failed_logins',
                    message: `Multiple failed login attempts (${failedAttempts})`,
                    severity: 'medium',
                    action: 'Monitor login activity'
                });
            }

            // 2. Check password age
            const passwordAge = (Date.now() - user.passwordChangedAt) / (1000 * 60 * 60 * 24);
            if (passwordAge > 180) {
                warnings.push({
                    type: 'old_password',
                    message: `Password is ${Math.round(passwordAge)} days old`,
                    severity: 'low',
                    action: 'Change password'
                });
            }

            // 3. Check multiple active sessions
            const activeSessions = await RefreshToken.countDocuments({ 
                userId, 
                isRevoked: false 
            });
            if (activeSessions > 5) {
                warnings.push({
                    type: 'multiple_sessions',
                    message: `${activeSessions} active sessions`,
                    severity: 'medium',
                    action: 'Logout from unused devices'
                });
            }

            // 4. Check account lock
            if (user.isLocked()) {
                warnings.push({
                    type: 'account_locked',
                    message: 'Account is temporarily locked',
                    severity: 'high',
                    action: 'Wait for lock to expire'
                });
            }

            return {
                suspicious: warnings.length > 0,
                warnings,
                severity: this.getHighestSeverity(warnings)
            };
        } catch (error) {
            console.error('Suspicious activity check error:', error);
            return { suspicious: false, warnings: [] };
        }
    }

    getHighestSeverity(warnings) {
        if (warnings.some(w => w.severity === 'high')) return 'high';
        if (warnings.some(w => w.severity === 'medium')) return 'medium';
        if (warnings.some(w => w.severity === 'low')) return 'low';
        return 'none';
    }

    // ============================================
    // SECURITY RECOMMENDATIONS
    // ============================================
    
    async getSecurityRecommendations(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const recommendations = [];

            // Password recommendations
            const passwordStrength = user.security?.passwordStrength || 'weak';
            if (passwordStrength !== 'strong') {
                recommendations.push({
                    category: 'Password',
                    priority: 'high',
                    message: 'Use a stronger password with uppercase, lowercase, numbers, and special characters',
                    action: 'Change password'
                });
            }

            // 2FA recommendations
            if (!user.security?.twoFactorEnabled) {
                recommendations.push({
                    category: 'Two-Factor Authentication',
                    priority: 'high',
                    message: 'Enable 2FA for better security',
                    action: 'Setup 2FA'
                });
            }

            // Password age recommendations
            const passwordAge = (Date.now() - user.passwordChangedAt) / (1000 * 60 * 60 * 24);
            if (passwordAge > 90) {
                recommendations.push({
                    category: 'Password Age',
                    priority: 'medium',
                    message: `Your password is ${Math.round(passwordAge)} days old`,
                    action: 'Change password'
                });
            }

            // Session recommendations
            const activeSessions = await RefreshToken.countDocuments({ 
                userId, 
                isRevoked: false 
            });
            if (activeSessions > 3) {
                recommendations.push({
                    category: 'Active Sessions',
                    priority: 'low',
                    message: `You have ${activeSessions} active sessions`,
                    action: 'Logout from unused devices'
                });
            }

            return {
                recommendations,
                total: recommendations.length,
                highPriority: recommendations.filter(r => r.priority === 'high').length
            };
        } catch (error) {
            console.error('Security recommendations error:', error);
            return { recommendations: [], total: 0, highPriority: 0 };
        }
    }
}

module.exports = new SecurityService();