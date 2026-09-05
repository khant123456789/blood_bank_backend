// utils/sessionHelper.js

// ============================================
// DEVICE DETECTION
// ============================================
function getUserDevice(userAgent) {
    if (!userAgent) return '🔍 Unknown Device';
    
    const ua = userAgent.toLowerCase();
    
    // ✅ API Clients (ဒါကို ထည့်ပါ)
    if (ua.includes('postman')) return '📮 Postman API Client';
    if (ua.includes('insomnia')) return '😴 Insomnia API Client';
    if (ua.includes('curl')) return '📡 cURL';
    if (ua.includes('axios')) return '⚡ Axios';
    if (ua.includes('fetch')) return '🌐 Fetch API';
    if (ua.includes('httpie')) return '🔥 HTTPie';
    
    // Mobile Devices
    if (ua.includes('iphone')) return '📱 iPhone';
    if (ua.includes('ipad')) return '📱 iPad';
    if (ua.includes('android')) {
        if (ua.includes('mobile')) return '📱 Android Phone';
        return '📱 Android Tablet';
    }
    
    // Desktop OS
    if (ua.includes('windows')) return '💻 Windows PC';
    if (ua.includes('mac')) return '🍎 Mac';
    if (ua.includes('linux')) return '🐧 Linux';
    
    // Browsers
    if (ua.includes('chrome')) return '🌐 Chrome Browser';
    if (ua.includes('firefox')) return '🦊 Firefox Browser';
    if (ua.includes('safari')) return '🧭 Safari Browser';
    if (ua.includes('edge')) return '🌊 Edge Browser';
    if (ua.includes('opera')) return '🎭 Opera Browser';
    if (ua.includes('brave')) return '🦁 Brave Browser';
    
    return '🔍 Unknown Device';
}

// ============================================
// LOCATION DETECTION
// ============================================
function getLocationFromIP(ip) {
    if (!ip) return '🌍 Unknown Location';
    
    // Localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return '🏠 Localhost (Development)';
    }
    
    // Local Network
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
        return '🏠 Local Network';
    }
    
    // Docker / Container
    if (ip.startsWith('172.17.') || ip.startsWith('172.18.')) {
        return '🐳 Docker Container';
    }
    
    // AWS
    if (ip.startsWith('54.') || ip.startsWith('52.') || ip.startsWith('35.')) {
        return '☁️ AWS Cloud';
    }
    
    // Google Cloud
    if (ip.startsWith('34.') || ip.startsWith('35.') || ip.startsWith('104.')) {
        return '☁️ Google Cloud';
    }
    
    // Myanmar IP ranges (အကြမ်းဖျင်း)
    if (ip.startsWith('103.') || ip.startsWith('203.') || ip.startsWith('37.')) {
        return '🇲🇲 Myanmar';
    }
    
    return '🌍 Remote';
}

// ============================================
// TIME AGO
// ============================================
function timeAgo(date) {
    if (!date) return 'Unknown';
    
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 0) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    
    const years = Math.floor(days / 365);
    return `${years}y ago`;
}

// ============================================
// SESSION STATUS
// ============================================
function getActiveStatus(session, currentSessionToken) {
    if (!session) return { status: 'unknown', text: '❓ Unknown', color: 'gray' };
    
    const isCurrent = session.token === currentSessionToken;
    if (isCurrent) {
        return { status: 'active', text: '🟢 Active Now', color: 'green' };
    }
    
    const lastActive = new Date(session.updatedAt);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastActive) / 60000);
    
    if (diffMinutes < 5) {
        return { status: 'recent', text: '🟡 Recently Active', color: 'orange' };
    }
    
    if (diffMinutes < 60) {
        return { status: 'idle', text: '🟠 Idle', color: 'orange' };
    }
    
    return { status: 'inactive', text: '⚫ Inactive', color: 'gray' };
}

// ============================================
// BROWSER & OS DETECTION (ထပ်ထည့်ပါ)
// ============================================
function getBrowser(userAgent) {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('postman')) return 'Postman';
    if (ua.includes('insomnia')) return 'Insomnia';
    if (ua.includes('curl')) return 'cURL';
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    if (ua.includes('brave')) return 'Brave';
    return 'Unknown';
}

function getOS(userAgent) {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('iphone')) return 'iOS';
    if (ua.includes('ipad')) return 'iPadOS';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('postman')) return 'Postman';
    return 'Unknown';
}

function getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet')) return 'tablet';
    if (ua.includes('postman')) return 'api';
    if (ua.includes('curl')) return 'cli';
    return 'desktop';
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
    getUserDevice,
    getLocationFromIP,
    timeAgo,
    getActiveStatus,
    getBrowser,
    getOS,
    getDeviceType
};