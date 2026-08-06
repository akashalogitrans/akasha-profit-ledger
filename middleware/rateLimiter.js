/* ==========================================================================
   AKASHA LOGITRANS LLP - LOGIN RATE LIMITER MIDDLEWARE
   Prevents Brute Force Attacks on Director Auth API
   ========================================================================== */

const loginAttemptsMap = new Map();

function loginRateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes window
    const maxAttempts = 5;

    const record = loginAttemptsMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
    }

    if (record.count >= maxAttempts) {
        return res.status(429).json({
            success: false,
            message: 'Too many failed login attempts. Account temporarily locked for 15 minutes for security.'
        });
    }

    req.loginAttemptRecord = record;
    req.clientIp = ip;
    next();
}

function recordFailedAttempt(ip) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const record = loginAttemptsMap.get(ip) || { count: 0, resetTime: now + windowMs };
    record.count += 1;
    loginAttemptsMap.set(ip, record);
}

function resetFailedAttempts(ip) {
    loginAttemptsMap.delete(ip);
}

module.exports = { loginRateLimiter, recordFailedAttempt, resetFailedAttempts };
