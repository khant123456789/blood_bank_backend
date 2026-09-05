// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, STATUS, GENDER } = require('../constant/authConstants');

const userSchema = new mongoose.Schema({
    // ===== BASIC INFO =====
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscore']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
    },

    // ===== PERSONAL INFO =====
    age: {
        type: Number,
        min: [0, 'Age cannot be negative'],
        max: [150, 'Age cannot exceed 150'],
        validate: {
            validator: function(value) {
                return value === null || value === undefined || Number.isInteger(value);
            },
            message: 'Age must be a whole number'
        }
    },
    gender: {
        type: String,
        enum: Object.values(GENDER),
        default: GENDER.OTHER
    },

    // ===== ROLE & STATUS =====
    role: {
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.USER
    },
    status: {
        type: String,
        enum: Object.values(STATUS),
        default: STATUS.PENDING
    },

    // ===== PROFILE =====
    profile: {
        firstName: { 
            type: String, 
            trim: true,
            maxlength: [50, 'First name cannot exceed 50 characters']
        },
        lastName: { 
            type: String, 
            trim: true,
            maxlength: [50, 'Last name cannot exceed 50 characters']
        },
        avatar: { 
            type: String 
        },
        bio: { 
            type: String, 
            maxlength: [500, 'Bio cannot exceed 500 characters'] 
        }
    },

    // ===== SECURITY =====
    security: {
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: { type: String },
        failedLoginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date },
        lastLoginIp: { type: String },
        lastLoginDevice: { type: String },
        // ✅ ✅ ✅ Add setter to convert to lowercase
        passwordStrength: { 
            type: String, 
            enum: ['weak', 'fair', 'good', 'strong'],
            default: 'weak',
            set: function(value) {
                // Convert any value to lowercase
                if (value) {
                    const lower = value.toLowerCase();
                    // Only allow valid enum values
                    const validValues = ['weak', 'fair', 'good', 'strong'];
                    return validValues.includes(lower) ? lower : 'weak';
                }
                return 'weak';
            }
        }
    },

    // ===== TIMESTAMPS =====
    lastLogin: { type: Date },
    lastActivity: { type: Date, default: Date.now },
    passwordChangedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date }
}, {
    timestamps: true
});

// ===== INDEXES =====
userSchema.index({ email: 1, username: 1, phone: 1 });
userSchema.index({ status: 1, role: 1 });
userSchema.index({ gender: 1 });
userSchema.index({ age: 1 });
userSchema.index({ 'security.lockUntil': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// ===== PRE-SAVE HOOK =====
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        this.passwordChangedAt = Date.now();
        next();
    } catch (error) {
        next(error);
    }
});

// ===== METHODS =====

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            this.passwordChangedAt.getTime() / 1000, 10
        );
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Check if user can login
userSchema.methods.canLogin = function() {
    if (!this.isActive) return false;
    if (this.deletedAt) return false;
    if (this.status !== STATUS.APPROVED) return false;
    if (this.security.lockUntil && this.security.lockUntil > Date.now()) return false;
    return true;
};

// Check if account is locked
userSchema.methods.isLocked = function() {
    return this.security.lockUntil && this.security.lockUntil > Date.now();
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
    this.security.failedLoginAttempts += 1;
    
    if (this.security.failedLoginAttempts >= 5) {
        this.security.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    
    await this.save();
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
    this.security.failedLoginAttempts = 0;
    this.security.lockUntil = null;
    await this.save();
};

// ===== VIRTUALS =====
userSchema.virtual('fullName').get(function() {
    return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
});

userSchema.virtual('isAdmin').get(function() {
    return this.role === ROLES.ADMIN;
});

userSchema.virtual('genderDisplay').get(function() {
    const labels = {
        [GENDER.MALE]: 'Male',
        [GENDER.FEMALE]: 'Female',
        [GENDER.OTHER]: 'Other'
    };
    return labels[this.gender] || 'Unknown';
});

// ===== STATIC METHODS =====

// Find by age range
userSchema.statics.findByAgeRange = function(minAge, maxAge) {
    return this.find({
        age: { $gte: minAge, $lte: maxAge }
    });
};

// Find by gender
userSchema.statics.findByGender = function(gender) {
    return this.find({ gender });
};

// Get age statistics
userSchema.statics.getAgeStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                avgAge: { $avg: '$age' },
                minAge: { $min: '$age' },
                maxAge: { $max: '$age' },
                total: { $sum: 1 }
            }
        }
    ]);
    return stats[0] || { avgAge: 0, minAge: 0, maxAge: 0, total: 0 };
};

// Get gender distribution
userSchema.statics.getGenderDistribution = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$gender',
                count: { $sum: 1 }
            }
        }
    ]);
    
    const distribution = {};
    stats.forEach(item => {
        distribution[item._id || 'unknown'] = item.count;
    });
    return distribution;
};

// ===== TRANSFORM =====
userSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.__v;
        delete ret.security;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;