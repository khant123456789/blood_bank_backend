// controllers/userController.js
const userService = require("../services/userService");
const auditService = require("../services/auditService");
const securityService = require("../services/securityService");
const { getClientIP, getUserAgent } = require("../utils/helper");

class UserController {
  // ============================================
  // AUTHENTICATION
  // ============================================

  // Register
  async register(req, res, next) {
    try {
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      const result = await userService.register(req.body, ipAddress, userAgent);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Login
  async login(req, res, next) {
    try {
      const { email, password, deviceId } = req.body;
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      const result = await userService.login(
        email,
        password,
        ipAddress,
        userAgent,
        deviceId,
      );


      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Production မှာ သာ secure ဖြစ်စေရန်
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 30 * 24 * 60 * 60 * 1000,
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined,
        // Cross-site isolation အတွက်
        ...(process.env.NODE_ENV === 'production' && { partitioned: true })
      };

      res.cookie("refreshToken", result.refreshToken, cookieOptions);

      // Remove refresh token from response body
      delete result.refreshToken;

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Refresh Token
  async refreshToken(req, res, next) {
    try {

      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      const result = await userService.refreshAccessToken(
        refreshToken,
        ipAddress,
        userAgent,
      );
      await auditService.log({
            userId: result.userId,
            action: 'REFRESH_TOKEN',
            details: { tokenRefreshed: result.tokenRefreshed },
            ipAddress: ipAddress,
            userAgent: userAgent
        });

      if (result.tokenRefreshed) {
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // Production မှာ သာ secure ဖြစ်စေရန်
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 30 * 24 * 60 * 60 * 1000,
          path: '/',
          domain: process.env.COOKIE_DOMAIN || undefined,
          // Cross-site isolation အတွက်
          ...(process.env.NODE_ENV === 'production' && { partitioned: true })
        };
        res.cookie("refreshToken", result.refreshToken, cookieOptions);
      }

      delete result.refreshToken;

      res.status(200).json(result);
    } catch (error) {
      if (
        error.message &&
        (error.message.includes("Invalid") || error.message.includes("expired"))
      ) {
        res.clearCookie("refreshToken", { path: "/" });
      }
      next(error);
    }
  }
  // Logout
  async logout(req, res, next) {
    try {
      // ✅ req.user ရှိမရှိ စစ်ပါ
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User not authenticated'
        });
      }

      // ✅ refreshToken ကို safe ယူပါ (optional chaining)
      const refreshToken = req.cookies?.refreshToken;
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      console.log(`📤 Logout: ${req.user.email}`);

      const result = await userService.logout(
        req.user._id,
        refreshToken,
        ipAddress,
        userAgent,
      );

      res.clearCookie("refreshToken", { path: "/" });
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ Logout error:', error);
      next(error);
    }
  }

  // ============================================
  // ✅ LOGOUT ALL - ပြင်ဆင်ပြီး
  // ============================================
  async logoutAll(req, res, next) {
    try {
      // ✅ req.user ရှိမရှိ စစ်ပါ
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User not authenticated'
        });
      }

      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      console.log(`📤 LogoutAll: ${req.user.email}`);

      const result = await userService.logoutAll(
        req.user._id,
        ipAddress,
        userAgent,
      );

      res.clearCookie("refreshToken", { path: "/" });
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ LogoutAll error:', error);
      next(error);
    }
  }
  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  // Get Profile
  async getProfile(req, res, next) {
    try {
      const user = await userService.getUserById(req.user._id);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update Profile
  async updateProfile(req, res, next) {
    try {
      const updatedUser = await userService.updateUser(req.user._id, req.body);

      // Audit log
      await auditService.log({
        userId: req.user._id,
        action: "PROFILE_UPDATE",
        details: { updatedFields: Object.keys(req.body) },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
      });

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  // Change Password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      const result = await userService.changePassword(
        req.user._id,
        currentPassword,
        newPassword,
        ipAddress,
        userAgent,
      );

      // Clear all cookies after password change - Path ကိုထည့်
      res.clearCookie("refreshToken", { path: "/" }); // ← ✅ path ထည့်

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SECURITY & AUDIT
  // ============================================

  // Get Security Score
  async getSecurityScore(req, res, next) {
    try {
      const score = await securityService.getSecurityScore(req.user._id);
      res.status(200).json({
        success: true,
        ...score,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get My Audit Logs
  async getMyAuditLogs(req, res, next) {
    try {
      const { limit = 50, skip = 0 } = req.query;
      const logs = await userService.getUserAuditLogs(
        req.user._id,
        limit,
        skip,
      );
      res.status(200).json({
        success: true,
        count: logs.length,
        logs,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ADMIN - USER MANAGEMENT
  // ============================================

  // Admin: Get All Users
  async getAllUsers(req, res, next) {
    try {
      const { role, status, isActive } = req.query;
      const users = await userService.getAllUsers({ role, status, isActive });
      res.status(200).json({
        success: true,
        count: users.length,
        users,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get User by ID
  async getUserById(req, res, next) {
    try {
      const user = await userService.getUserById(req.params.id);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update User
  async adminUpdateUser(req, res, next) {
    try {
      const updatedUser = await userService.updateUser(req.params.id, req.body);

      await auditService.log({
        userId: req.user._id,
        action: "PROFILE_UPDATE",
        details: {
          targetUserId: req.params.id,
          updatedFields: Object.keys(req.body),
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
      });

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update User Role
  async updateUserRole(req, res, next) {
    try {
      const { role } = req.body;
      const result = await userService.updateUserRole(
        req.params.id,
        role,
        req.user._id,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update User Status
  async updateUserStatus(req, res, next) {
    try {
      const { status } = req.body;
      const result = await userService.updateUserStatus(
        req.params.id,
        status,
        req.user._id,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Admin: Delete User
  async deleteUser(req, res, next) {
    try {
      const result = await userService.deleteUser(req.params.id, req.user._id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Admin: Deactivate User
  async deactivateUser(req, res, next) {
    try {
      const result = await userService.deactivateUser(
        req.params.id,
        req.user._id,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Admin: Activate User
  async activateUser(req, res, next) {
    try {
      const result = await userService.activateUser(
        req.params.id,
        req.user._id,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ADMIN - AUDIT LOGS
  // ============================================

  // Admin: Get Audit Logs
  async getAuditLogs(req, res, next) {
    try {
      const {
        userId,
        action,
        startDate,
        endDate,
        limit = 100,
        skip = 0,
      } = req.query;

      const logs = await auditService.getAuditLogs({
        userId,
        action,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: parseInt(limit),
        skip: parseInt(skip),
      });

      res.status(200).json({
        success: true,
        count: logs.length,
        logs,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get Audit Stats
  async getAuditStats(req, res, next) {
    try {
      const { days = 7 } = req.query;
      const stats = await auditService.getAuditStats(parseInt(days));
      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
