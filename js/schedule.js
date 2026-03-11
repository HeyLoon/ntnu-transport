/**
 * 師大校區接駁車時刻表資料
 * 資料來源：國立臺灣師範大學和平與公館校區接駁車時刻表 (115/03/16)
 */

const SCHEDULE_DATA = {
    // 和平校區 → 公館校區
    hepingToGongguan: [
        { time: '08:30', note: '三校' },
        { time: '09:00', note: '' },
        { time: '09:30', note: '' },
        { time: '10:00', note: '三校' },
        { time: '10:05', note: '' },
        { time: '10:30', note: '' },
        { time: '12:15', note: '' },
        { time: '12:30', note: '' },
        { time: '12:40', note: '三校' },
        { time: '13:15', note: '' },
        { time: '14:25', note: '' },
        { time: '15:35', note: '' },
        { time: '16:35', note: '' },
        { time: '17:35', note: '' },
        { time: '18:30', note: '' }
    ],
    
    // 公館校區 → 和平校區
    gongguanToHeping: [
        { time: '07:50', note: '2車', extra: '週二四 3車' },
        { time: '08:45', note: '3車', extra: '週三五 2車' },
        { time: '08:50', note: '三校' },
        { time: '09:45', note: '' },
        { time: '10:00', note: '2車' },
        { time: '10:05', note: '' },
        { time: '10:20', note: '三校' },
        { time: '12:00', note: '' },
        { time: '12:15', note: '三校+1車' },
        { time: '12:30', note: '' },
        { time: '13:00', note: '2車' },
        { time: '14:00', note: '' },
        { time: '15:15', note: '' },
        { time: '16:10', note: '' },
        { time: '17:10', note: '' },
        { time: '18:10', note: '' }
    ]
};

// 三校接駁車時刻（僅篩選三校班次）
const SANXIAO_SCHEDULE = {
    hepingToGongguan: SCHEDULE_DATA.hepingToGongguan.filter(s => s.note.includes('三校')),
    gongguanToHeping: SCHEDULE_DATA.gongguanToHeping.filter(s => s.note.includes('三校'))
};

// ===== 國定假日資料（民國 114-115 年）=====
// 格式: 'YYYY-MM-DD'
const HOLIDAYS = [
    // 民國 114 年 (2025)
    '2025-01-01', // 元旦
    '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', // 春節
    '2025-02-01', '2025-02-02', // 春節
    '2025-02-08', // 補假（補行上班日除外）
    '2025-02-28', // 和平紀念日
    '2025-04-03', '2025-04-04', '2025-04-05', // 兒童節+清明節
    '2025-05-01', // 勞動節
    '2025-05-30', '2025-05-31', '2025-06-01', // 端午節
    '2025-10-06', // 中秋節
    '2025-10-10', '2025-10-11', // 國慶日
    
    // 民國 115 年 (2026)
    '2026-01-01', '2026-01-02', // 元旦
    '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', // 春節
    '2026-02-19', '2026-02-20', // 春節
    '2026-02-28', // 和平紀念日
    '2026-03-28', // 補假（可能調整）
    '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', // 兒童節+清明節
    '2026-05-01', // 勞動節
    '2026-05-31', '2026-06-01', // 端午節
    '2026-09-25', '2026-09-26', '2026-09-27', // 中秋節
    '2026-10-10', '2026-10-11', // 國慶日
];

// ===== 寒暑假期間（接駁車減班或停駛）=====
// 注意：實際日期請依學校公告為準
const VACATION_PERIODS = [
    // 113 學年度寒假 (2025/1/13 - 2025/2/16)
    { start: '2025-01-13', end: '2025-02-16', name: '寒假' },
    // 113 學年度暑假 (2025/6/30 - 2025/9/7)
    { start: '2025-06-30', end: '2025-09-07', name: '暑假' },
    // 114 學年度寒假 (2026/1/12 - 2026/2/22)
    { start: '2026-01-12', end: '2026-02-22', name: '寒假' },
    // 114 學年度暑假 (2026/6/29 - 2026/9/6)
    { start: '2026-06-29', end: '2026-09-06', name: '暑假' },
];

/**
 * 將時間字串轉換為今日的 Date 物件
 * @param {string} timeStr - 時間字串，格式如 "08:30"
 * @returns {Date}
 */
function timeToDate(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

/**
 * 計算距離指定時間的分鐘數
 * @param {string} timeStr - 時間字串
 * @param {Date} now - 當前時間
 * @returns {number} 分鐘數（負數表示已過）
 */
function getMinutesUntil(timeStr, now = new Date()) {
    const targetTime = timeToDate(timeStr);
    return Math.floor((targetTime - now) / (1000 * 60));
}

/**
 * 取得下一班車的資訊
 * @param {Array} schedule - 時刻表陣列
 * @param {Date} now - 當前時間
 * @returns {Object|null} 下一班車資訊，或 null（今日無班次）
 */
function getNextBus(schedule, now = new Date()) {
    for (let i = 0; i < schedule.length; i++) {
        const minutes = getMinutesUntil(schedule[i].time, now);
        if (minutes >= -2) { // 允許 2 分鐘緩衝（剛發車但可能還來得及）
            return {
                index: i,
                ...schedule[i],
                minutesUntil: Math.max(0, minutes)
            };
        }
    }
    return null; // 今日班次已結束
}

/**
 * 取得指定方向的時刻表
 * @param {string} from - 出發地 (heping/gongguan)
 * @param {string} to - 目的地 (heping/gongguan/ntu/ntust)
 * @returns {Array} 時刻表陣列
 */
function getSchedule(from, to) {
    // 前往台大或台科大，僅顯示三校班次
    if (to === 'ntu' || to === 'ntust') {
        if (from === 'heping') {
            return SANXIAO_SCHEDULE.hepingToGongguan;
        } else {
            return SANXIAO_SCHEDULE.gongguanToHeping;
        }
    }
    
    // 一般校區間移動
    if (from === 'heping' && to === 'gongguan') {
        return SCHEDULE_DATA.hepingToGongguan;
    } else if (from === 'gongguan' && to === 'heping') {
        return SCHEDULE_DATA.gongguanToHeping;
    }
    
    return [];
}

/**
 * 格式化日期為 YYYY-MM-DD
 * @param {Date} date 
 * @returns {string}
 */
function formatDateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 檢查是否為國定假日
 * @param {Date} date 
 * @returns {boolean}
 */
function isHoliday(date = new Date()) {
    const dateStr = formatDateString(date);
    return HOLIDAYS.includes(dateStr);
}

/**
 * 檢查是否為寒暑假期間
 * @param {Date} date 
 * @returns {Object|null} 假期資訊或 null
 */
function getVacationPeriod(date = new Date()) {
    const dateStr = formatDateString(date);
    
    for (const period of VACATION_PERIODS) {
        if (dateStr >= period.start && dateStr <= period.end) {
            return period;
        }
    }
    
    return null;
}

/**
 * 判斷今天是否為接駁車運行日
 * @param {Date} date 
 * @returns {Object} { isOperating: boolean, reason?: string }
 */
function isOperatingDay(date = new Date()) {
    const dayOfWeek = date.getDay();
    
    // 週六(6)、週日(0) 不運行
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { 
            isOperating: false, 
            reason: '今日為週末，接駁車不行駛' 
        };
    }
    
    // 檢查國定假日
    if (isHoliday(date)) {
        return { 
            isOperating: false, 
            reason: '今日為國定假日，接駁車不行駛' 
        };
    }
    
    // 檢查寒暑假（提示但可能有減班）
    const vacation = getVacationPeriod(date);
    if (vacation) {
        return { 
            isOperating: false, 
            reason: `目前為${vacation.name}期間，接駁車可能停駛或減班，請留意學校公告` 
        };
    }
    
    return { isOperating: true };
}

/**
 * 取得今天是星期幾的中文
 * @returns {string}
 */
function getDayOfWeekText() {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[new Date().getDay()];
}

/**
 * 格式化倒數時間
 * @param {number} minutes - 分鐘數
 * @returns {string}
 */
function formatCountdown(minutes) {
    if (minutes <= 0) {
        return '即將發車';
    } else if (minutes < 60) {
        return `${minutes} 分鐘`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours} 小時 ${mins} 分`;
    }
}

// 匯出供其他模組使用
window.ScheduleData = {
    SCHEDULE_DATA,
    SANXIAO_SCHEDULE,
    HOLIDAYS,
    VACATION_PERIODS,
    timeToDate,
    getMinutesUntil,
    getNextBus,
    getSchedule,
    formatDateString,
    isHoliday,
    getVacationPeriod,
    isOperatingDay,
    getDayOfWeekText,
    formatCountdown
};
