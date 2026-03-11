/**
 * YouBike 即時資訊模組
 * 資料來源：臺北市資料大平臺 - YouBike2.0臺北市公共自行車即時資訊
 */

const YOUBIKE_API_URL = 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json';

// 站點經緯度資料（用於 Google Maps 連結）
const STATION_COORDS = {
    '臺灣師範大學(浦城街)': { lat: 25.02476, lng: 121.52803 },
    '和平龍泉街口': { lat: 25.02638, lng: 121.52971 },
    '臺灣師範大學(圖書館)': { lat: 25.0266, lng: 121.52973 },
    '和平泰順街口': { lat: 25.02621, lng: 121.53171 },
    '師大公館校區學二舍': { lat: 25.00825, lng: 121.53419 },
    '師範大學公館校區': { lat: 25.00792, lng: 121.53731 },
    '師範大學公館校區_1': { lat: 25.00753, lng: 121.53719 },
    '臺灣科技大學側門': { lat: 25.01295, lng: 121.53973 },
    '臺科大側門(基隆路四段73巷)': { lat: 25.01291, lng: 121.53967 },
    '臺灣科技大學正門': { lat: 25.01451, lng: 121.54142 },
    '臺灣科技大學後門': { lat: 25.01182, lng: 121.54165 },
    '臺大第一活動中心西南側': { lat: 25.01761, lng: 121.53995 },
    '臺大總圖書館西南側': { lat: 25.0169, lng: 121.54031 },
    '羅斯福新生南路口': { lat: 25.01604, lng: 121.53316 },
    '臺大男一舍前': { lat: 25.01637, lng: 121.54535 }
};

// 指定要顯示的 YouBike 站點（精確名稱匹配）
// 選擇原則：走出學校任一個門就可以抵達的距離
const EXACT_STATIONS = {
    'heping': {
        name: '和平校區',
        class: 'heping',
        // 站點名稱（會從 API 資料的 sna 欄位比對，需移除 "YouBike2.0_" 前綴後比對）
        stations: [
            '臺灣師範大學(浦城街)',
            '和平龍泉街口',
            '臺灣師範大學(圖書館)',
            '和平泰順街口'
        ]
    },
    'gongguan': {
        name: '公館校區',
        class: 'gongguan',
        stations: [
            '師大公館校區學二舍',
            '師範大學公館校區',
            '師範大學公館校區_1'
        ]
    },
    'ntust': {
        name: '臺灣科技大學',
        class: 'ntust',
        stations: [
            '臺灣科技大學側門',
            '臺科大側門(基隆路四段73巷)',
            '臺灣科技大學正門',
            '臺灣科技大學後門'
        ]
    },
    'ntu': {
        name: '臺灣大學',
        class: 'ntu',
        // 台大校內站點（特別指定）
        stations: [
            '臺大第一活動中心西南側',
            '臺大總圖書館西南側',
            '羅斯福新生南路口',
            '臺大男一舍前'
        ]
    }
};

let youbikeData = [];
let lastUpdateTime = null;

/**
 * 從 API 取得 YouBike 即時資料
 * @param {AbortSignal} signal - 可選的 AbortController signal
 * @returns {Promise<Array>}
 */
async function fetchYoubikeData(signal = null) {
    try {
        const options = signal ? { signal } : {};
        const response = await fetch(YOUBIKE_API_URL, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        youbikeData = await response.json();
        lastUpdateTime = new Date();
        return youbikeData;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw error; // 讓上層處理取消的請求
        }
        console.error('Failed to fetch YouBike data:', error);
        throw error;
    }
}

/**
 * 格式化站點名稱（移除 YouBike2.0_ 前綴）
 * @param {string} name 
 * @returns {string}
 */
function formatStationName(name) {
    return name.replace(/^YouBike2\.0_/, '');
}

/**
 * 根據站點名稱列表取得站點資料
 * @param {Array<string>} stationNames - 站點名稱列表
 * @returns {Array}
 */
function getStationsByNames(stationNames) {
    if (!youbikeData || youbikeData.length === 0) {
        return [];
    }
    
    const results = [];
    
    for (const targetName of stationNames) {
        const found = youbikeData.find(station => {
            const name = formatStationName(station.sna || '');
            return name === targetName || name.includes(targetName) || targetName.includes(name);
        });
        
        if (found) {
            results.push(found);
        }
    }
    
    return results;
}

/**
 * 取得特定校區的 YouBike 站點資訊
 * @param {string} areaKey - 校區代碼
 * @returns {Array}
 */
function getStationsByArea(areaKey) {
    const config = EXACT_STATIONS[areaKey];
    if (!config) return [];
    
    return getStationsByNames(config.stations);
}

/**
 * 取得所有校區的站點資訊
 * @returns {Object}
 */
function getAllAreaStations() {
    const result = {};
    
    for (const areaKey of Object.keys(EXACT_STATIONS)) {
        const stations = getStationsByArea(areaKey);
        result[areaKey] = {
            name: EXACT_STATIONS[areaKey].name,
            class: EXACT_STATIONS[areaKey].class,
            stations: stations
        };
    }
    
    return result;
}

/**
 * 取得站點狀態類別
 * @param {number} bikes - 可借車輛數
 * @returns {string}
 */
function getStatusClass(bikes) {
    if (bikes === 0) return 'empty';
    if (bikes <= 3) return 'low';
    return 'good';
}

/**
 * 取得站點狀態文字
 * @param {number} bikes - 可借車輛數
 * @returns {string}
 */
function getStatusText(bikes) {
    if (bikes === 0) return '無車';
    if (bikes <= 3) return '車少';
    return '充足';
}

/**
 * 取得最後更新時間
 * @returns {string}
 */
function getLastUpdateTimeText() {
    if (!lastUpdateTime) return '--';
    
    const hours = lastUpdateTime.getHours().toString().padStart(2, '0');
    const minutes = lastUpdateTime.getMinutes().toString().padStart(2, '0');
    const seconds = lastUpdateTime.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds} 更新`;
}

/**
 * 計算從某站到某站騎 YouBike 的估計時間（分鐘）
 * @param {string} fromArea - 出發區域
 * @param {string} toArea - 目的區域
 * @returns {number}
 */
function estimateBikeTime(fromArea, toArea) {
    // 預估騎車時間（分鐘）
    const times = {
        'heping_gongguan': 15,
        'gongguan_heping': 15,
        'gongguan_ntu': 5,
        'gongguan_ntust': 5,
        'heping_ntu': 20,
        'heping_ntust': 20,
        'ntu_ntust': 5,
        'ntust_ntu': 5
    };
    
    const key = `${fromArea}_${toArea}`;
    return times[key] || 15; // 預設 15 分鐘
}

/**
 * 檢查某區域是否有可借的 YouBike
 * @param {string} areaKey 
 * @returns {boolean}
 */
function hasAvailableBikes(areaKey) {
    const stations = getStationsByArea(areaKey);
    return stations.some(s => (s.available_rent_bikes || 0) > 0);
}

/**
 * 取得某區域的總可借車輛數
 * @param {string} areaKey 
 * @returns {number}
 */
function getTotalAvailableBikes(areaKey) {
    const stations = getStationsByArea(areaKey);
    return stations.reduce((sum, s) => sum + (s.available_rent_bikes || 0), 0);
}

/**
 * 取得站點的 Google Maps URL
 * @param {string} stationName - 站點名稱
 * @returns {string}
 */
function getGoogleMapsUrl(stationName) {
    const coords = STATION_COORDS[stationName];
    if (!coords) return '';
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}

/**
 * 從站點物件取得 Google Maps URL
 * @param {Object} station - YouBike API 回傳的站點物件
 * @returns {string}
 */
function getStationMapsUrl(station) {
    const name = formatStationName(station.sna || '');
    return getGoogleMapsUrl(name);
}

// 匯出供其他模組使用
window.YoubikeData = {
    EXACT_STATIONS,
    STATION_COORDS,
    fetchYoubikeData,
    getStationsByNames,
    getStationsByArea,
    getAllAreaStations,
    formatStationName,
    getStatusClass,
    getStatusText,
    getLastUpdateTimeText,
    estimateBikeTime,
    hasAvailableBikes,
    getTotalAvailableBikes,
    getGoogleMapsUrl,
    getStationMapsUrl,
    get lastUpdateTime() { return lastUpdateTime; },
    get data() { return youbikeData; }
};
