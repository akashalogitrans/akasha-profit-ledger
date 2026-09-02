/* ==========================================================================
   AKASHA LOGITRANS LLP - CENTRAL DATE & FINANCIAL YEAR UTILITIES
   Indian Financial Year (April 1 - March 31) & Strict Date Normalization Engine
   ========================================================================== */

/**
 * Normalizes any valid date string or Date object into a pure 'YYYY-MM-DD' string.
 * Avoids UTC timezone day-shifting.
 * @param {string|Date|*} dateInput - Input date.
 * @param {string} fallback - Fallback date string (default: current local date).
 * @returns {string} Clean 'YYYY-MM-DD' string.
 */
function normalizeDateOnly(dateInput, fallback = null) {
    if (!dateInput || dateInput === 'null' || dateInput === 'undefined') {
        return fallback !== null ? fallback : new Date().toISOString().split('T')[0];
    }

    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        // If already 'YYYY-MM-DD'
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
        // If full ISO or timestamp 'YYYY-MM-DDTHH:mm:ss...'
        if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return trimmed.substring(0, 10);
        }
        // If 'DD-MM-YYYY' or 'DD/MM/YYYY'
        const dmyMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (dmyMatch) {
            const day = String(dmyMatch[1]).padStart(2, '0');
            const month = String(dmyMatch[2]).padStart(2, '0');
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
        }
    }

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
        return fallback !== null ? fallback : new Date().toISOString().split('T')[0];
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Calculates Indian Financial Year string (e.g. 'FY 2026-27') from a date.
 * Rule: April 1 (Month 04) of Year N to March 31 (Month 03) of Year N+1 is FY N-(N+1).
 * @param {string|Date|*} dateInput - Input date.
 * @returns {string} Indian Financial Year label (e.g. 'FY 2026-27').
 */
function calculateFinancialYear(dateInput) {
    const normalized = normalizeDateOnly(dateInput);
    const [yearStr, monthStr] = normalized.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1 to 12

    if (isNaN(year) || isNaN(month)) {
        const curYear = new Date().getFullYear();
        return `FY ${curYear}-${String(curYear + 1).slice(-2)}`;
    }

    // If month is April (4) to Dec (12), FY starts in current calendar year
    // If month is Jan (1) to March (3), FY started in previous calendar year
    const startYear = month >= 4 ? year : year - 1;
    const endYearShort = String(startYear + 1).slice(-2);
    return `FY ${startYear}-${endYearShort}`;
}

/**
 * Gets start and end date boundaries for an Indian Financial Year.
 * @param {number|string} startYear - Starting calendar year of the FY (e.g. 2026 for FY 2026-27).
 * @returns {{ startDate: string, endDate: string, label: string }}
 */
function getFinancialYearDates(startYear) {
    const yr = typeof startYear === 'string' ? parseInt(startYear.replace(/[^0-9]/g, '').substring(0, 4), 10) : startYear;
    const sYr = isNaN(yr) ? new Date().getFullYear() : yr;
    return {
        startDate: `${sYr}-04-01`,
        endDate: `${sYr + 1}-03-31`,
        label: `FY ${sYr}-${String(sYr + 1).slice(-2)}`
    };
}

/**
 * Extracts month key ('YYYY-MM') and full label ('August 2026').
 * @param {string|Date|*} dateInput - Input date.
 * @returns {{ monthKey: string, monthLabel: string, shortLabel: string }}
 */
function getMonthKeyAndLabel(dateInput) {
    const normalized = normalizeDateOnly(dateInput);
    const parts = normalized.split('-');
    const ym = `${parts[0]}-${parts[1]}`;
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const fullLabel = monthNames[monthIndex] ? `${monthNames[monthIndex]} ${year}` : ym;
    const shortLabel = monthNamesShort[monthIndex] ? `${monthNamesShort[monthIndex]} ${year}` : ym;

    return {
        monthKey: ym,
        monthLabel: fullLabel,
        shortLabel: shortLabel
    };
}

/**
 * Calculates days difference between a date and today.
 * @param {string|Date|*} dateInput - Input date.
 * @returns {number} Days outstanding.
 */
function getDaysOutstanding(dateInput) {
    if (!dateInput) return 0;
    const normalized = normalizeDateOnly(dateInput);
    const d = new Date(normalized + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = today.getTime() - d.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

module.exports = {
    normalizeDateOnly,
    calculateFinancialYear,
    getFinancialYearDates,
    getMonthKeyAndLabel,
    getDaysOutstanding
};
