/**
 * TDX API 模組 - 復興幹線公車即時動態
 * 資料來源：TDX 運輸資料流通服務
 */

const TDX_AUTH_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const TDX_BUS_API_BASE = 'https://tdx.transportdata.tw/api/basic/v2/Bus';

// 舊版站點資料（保留相容性）
const FUXING_STOPS = {
    heping: ['師大', '和平東路', '古亭'],
    gongguan: ['公館', '臺大', '台大']
};

/**
 * 復興幹線完整站點資料
 * 來源：https://pda5284.gov.taipei/MQS/route.jsp?rid=11833
 */
const FUXING_STOPS_DATA = {
    // Direction 0: 從公館往和平（返程往建國北路）
    // 顯示區間：捷運萬隆站 → 師大綜合大樓
    direction0: {
        displayName: '往建國北路（返程）',
        directionId: 0,
        description: '從公館出發適用',
        relevantStations: [
            '捷運萬隆站',
            '武功國小(羅斯福)',
            '師大分部',
            '捷運公館站',
            '台電大樓',
            '捷運台電大樓站',
            '師大路',
            '師大',
            '師大綜合大樓'
        ]
    },
    
    // Direction 1: 從和平往公館（去程往景美）
    // 顯示區間：大安森林公園 → 師大分部
    direction1: {
        displayName: '往景美（去程）',
        directionId: 1,
        description: '從和平出發適用',
        relevantStations: [
            '大安森林公園',
            '溫州街口',
            '師大綜合大樓',
            '師大',
            '捷運古亭站(和平)',
            '羅斯福金門街口',
            '羅斯福浦城街口',
            '捷運台電大樓站',
            '台電大樓',
            '捷運公館站',
            '師大分部'
        ]
    }
};

let accessToken = null;
let tokenExpireTime = null;

/**
 * 從 localStorage 取得 TDX 憑證
 * @returns {Object|null}
 */
function getStoredCredentials() {
    const clientId = localStorage.getItem('tdx_client_id');
    const clientSecret = localStorage.getItem('tdx_client_secret');
    
    if (clientId && clientSecret) {
        return { clientId, clientSecret };
    }
    return null;
}

/**
 * 儲存 TDX 憑證到 localStorage
 * @param {string} clientId 
 * @param {string} clientSecret 
 */
function saveCredentials(clientId, clientSecret) {
    localStorage.setItem('tdx_client_id', clientId);
    localStorage.setItem('tdx_client_secret', clientSecret);
}

/**
 * 清除儲存的憑證
 */
function clearCredentials() {
    localStorage.removeItem('tdx_client_id');
    localStorage.removeItem('tdx_client_secret');
    accessToken = null;
    tokenExpireTime = null;
}

/**
 * 檢查是否已設定 API Key
 * @returns {boolean}
 */
function hasApiKey() {
    return getStoredCredentials() !== null;
}

/**
 * 取得 TDX Access Token
 * @returns {Promise<string>}
 */
async function getAccessToken() {
    // 檢查現有 token 是否有效
    if (accessToken && tokenExpireTime && new Date() < tokenExpireTime) {
        return accessToken;
    }
    
    const credentials = getStoredCredentials();
    if (!credentials) {
        throw new Error('TDX API 憑證未設定');
    }
    
    const { clientId, clientSecret } = credentials;
    
    try {
        const response = await fetch(TDX_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            })
        });
        
        if (!response.ok) {
            throw new Error('認證失敗，請檢查 API Key 是否正確');
        }
        
        const data = await response.json();
        accessToken = data.access_token;
        
        // 設定過期時間（提前 5 分鐘過期以確保安全）
        tokenExpireTime = new Date(Date.now() + (data.expires_in - 300) * 1000);
        
        return accessToken;
    } catch (error) {
        console.error('TDX auth error:', error);
        throw error;
    }
}

/**
 * 呼叫 TDX API
 * @param {string} endpoint 
 * @returns {Promise<any>}
 */
async function callTdxApi(endpoint) {
    const token = await getAccessToken();
    
    const response = await fetch(`${TDX_BUS_API_BASE}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`API 請求失敗: ${response.status}`);
    }
    
    return response.json();
}

/**
 * 根據出發地取得對應的方向設定
 * @param {string} origin - 'heping' 或 'gongguan'
 * @returns {Object|null} - 方向設定
 */
function getFuxingDirectionConfig(origin) {
    if (origin === 'gongguan') {
        // 從公館出發 → 往和平 → 使用返程（Direction 0）
        return FUXING_STOPS_DATA.direction0;
    } else if (origin === 'heping') {
        // 從和平出發 → 往公館 → 使用去程（Direction 1）
        return FUXING_STOPS_DATA.direction1;
    }
    return null;
}

/**
 * 篩選並排序相關站點的 ETA 資料
 * @param {Array} etaData - API 回傳的原始 ETA 資料
 * @param {Object} directionConfig - 方向設定
 * @returns {Array} - 篩選並排序後的站點資料
 */
function filterFuxingStations(etaData, directionConfig) {
    if (!directionConfig || !etaData || !Array.isArray(etaData)) return [];
    
    const relevantStops = etaData.filter(stop => {
        const stopName = stop.StopName?.Zh_tw || '';
        const matchesDirection = stop.Direction === directionConfig.directionId;
        
        // 模糊匹配站名（處理括號和空格差異）
        const isRelevantStation = directionConfig.relevantStations.some(name => {
            const normalizedApiName = stopName.replace(/\s/g, '').replace(/\(/g, '(').replace(/\)/g, ')');
            const normalizedConfigName = name.replace(/\s/g, '').replace(/\(/g, '(').replace(/\)/g, ')');
            return normalizedApiName.includes(normalizedConfigName) || 
                   normalizedConfigName.includes(normalizedApiName);
        });
        
        return matchesDirection && isRelevantStation;
    });
    
    // 依照站點順序排序
    const sorted = relevantStops.sort((a, b) => {
        const getIndex = (stop) => {
            const stopName = stop.StopName?.Zh_tw || '';
            return directionConfig.relevantStations.findIndex(name => {
                const normalizedApiName = stopName.replace(/\s/g, '');
                const normalizedConfigName = name.replace(/\s/g, '');
                return normalizedApiName.includes(normalizedConfigName) || 
                       normalizedConfigName.includes(normalizedApiName);
            });
        };
        return getIndex(a) - getIndex(b);
    });
    
    return sorted;
}

/**
 * 取得復興幹線下一班車的分鐘數（用於推薦系統）
 * @param {Array} stationData - 篩選後的站點資料
 * @returns {number|null} - 最近一班車的分鐘數，或 null
 */
function getNextFuxingBusMinutes(stationData) {
    if (!stationData || stationData.length === 0) return null;
    
    let minETA = Infinity;
    
    for (const station of stationData) {
        const eta = station.EstimateTime;
        if (eta !== undefined && eta !== null && eta >= 0 && eta < minETA) {
            minETA = eta;
        }
    }
    
    return minETA === Infinity ? null : Math.floor(minETA / 60);
}

/**
 * 產生 Mock 資料（無 API Key 時用於測試）
 * @returns {Array} Mock ETA 資料
 */
function generateMockFuxingData() {
    // 模擬各種到站狀態
    const now = Date.now();
    const randomETA = (base, variance) => {
        const random = Math.floor(Math.random() * variance);
        return base + random;
    };
    
    const mockStations = [
        // Direction 0 站點（公館→和平）
        { StopName: { Zh_tw: '捷運萬隆站' }, Direction: 0, EstimateTime: randomETA(60, 120) },
        { StopName: { Zh_tw: '武功國小(羅斯福)' }, Direction: 0, EstimateTime: randomETA(120, 120) },
        { StopName: { Zh_tw: '師大分部' }, Direction: 0, EstimateTime: randomETA(180, 120) },
        { StopName: { Zh_tw: '捷運公館站' }, Direction: 0, EstimateTime: randomETA(240, 120) },
        { StopName: { Zh_tw: '台電大樓' }, Direction: 0, EstimateTime: randomETA(360, 180) },
        { StopName: { Zh_tw: '捷運台電大樓站' }, Direction: 0, EstimateTime: randomETA(420, 180) },
        { StopName: { Zh_tw: '師大路' }, Direction: 0, EstimateTime: randomETA(540, 180) },
        { StopName: { Zh_tw: '師大' }, Direction: 0, EstimateTime: randomETA(600, 180) },
        { StopName: { Zh_tw: '師大綜合大樓' }, Direction: 0, EstimateTime: null }, // 未發車
        
        // Direction 1 站點（和平→公館）
        { StopName: { Zh_tw: '大安森林公園' }, Direction: 1, EstimateTime: randomETA(180, 120) },
        { StopName: { Zh_tw: '溫州街口' }, Direction: 1, EstimateTime: randomETA(240, 120) },
        { StopName: { Zh_tw: '師大綜合大樓' }, Direction: 1, EstimateTime: randomETA(300, 120) },
        { StopName: { Zh_tw: '師大' }, Direction: 1, EstimateTime: randomETA(360, 120) },
        { StopName: { Zh_tw: '捷運古亭站(和平)' }, Direction: 1, EstimateTime: randomETA(420, 180) },
        { StopName: { Zh_tw: '羅斯福金門街口' }, Direction: 1, EstimateTime: randomETA(540, 180) },
        { StopName: { Zh_tw: '羅斯福浦城街口' }, Direction: 1, EstimateTime: randomETA(600, 180) },
        { StopName: { Zh_tw: '捷運台電大樓站' }, Direction: 1, EstimateTime: randomETA(720, 180) },
        { StopName: { Zh_tw: '台電大樓' }, Direction: 1, EstimateTime: randomETA(780, 180) },
        { StopName: { Zh_tw: '捷運公館站' }, Direction: 1, EstimateTime: randomETA(840, 180) },
        { StopName: { Zh_tw: '師大分部' }, Direction: 1, EstimateTime: null } // 未發車
    ];
    
    return mockStations;
}

/**
 * 取得復興幹線的預估到站時間
 * @returns {Promise<Array>}
 */
async function getFuxingLineETA() {
    // 如果沒有 API Key，使用 Mock 資料
    if (!hasApiKey()) {
        console.log('使用 Mock 資料（無 API Key）');
        return Promise.resolve(generateMockFuxingData());
    }
    
    try {
        const endpoint = '/EstimatedTimeOfArrival/City/Taipei/復興幹線?$format=JSON';
        const data = await callTdxApi(endpoint);
        return data;
    } catch (error) {
        console.error('Failed to get Fuxing line ETA:', error);
        throw error;
    }
}

/**
 * 取得復興幹線的路線站點資訊
 * @returns {Promise<Array>}
 */
async function getFuxingLineStops() {
    try {
        const endpoint = '/StopOfRoute/City/Taipei/復興幹線?$format=JSON';
        const data = await callTdxApi(endpoint);
        return data;
    } catch (error) {
        console.error('Failed to get Fuxing line stops:', error);
        throw error;
    }
}

/**
 * 取得指定區域附近站點的即時資訊
 * @param {string} area - 'heping' 或 'gongguan'
 * @returns {Promise<Array>}
 */
async function getNearbyStopsETA(area) {
    const etaData = await getFuxingLineETA();
    const keywords = FUXING_STOPS[area] || [];
    
    // 篩選相關站點
    const relevantStops = etaData.filter(stop => {
        const stopName = stop.StopName?.Zh_tw || '';
        return keywords.some(kw => stopName.includes(kw));
    });
    
    // 依預估到站時間排序
    return relevantStops.sort((a, b) => {
        const etaA = a.EstimateTime ?? Infinity;
        const etaB = b.EstimateTime ?? Infinity;
        return etaA - etaB;
    });
}

/**
 * 格式化預估到站時間
 * @param {number} seconds - 秒數
 * @returns {string}
 */
function formatETA(seconds) {
    if (seconds === undefined || seconds === null) {
        return '未發車';
    }
    if (seconds <= 60) {
        return '即將到站';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} 分`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} 小時 ${mins} 分`;
}

/**
 * 取得公車狀態類別
 * @param {number} seconds 
 * @returns {string}
 */
function getETAClass(seconds) {
    if (seconds === undefined || seconds === null) {
        return '';
    }
    if (seconds <= 180) { // 3 分鐘內
        return 'arriving';
    }
    return '';
}

// 匯出供其他模組使用
window.TdxApi = {
    // API Key 管理
    hasApiKey,
    getStoredCredentials,
    saveCredentials,
    clearCredentials,
    getAccessToken,
    
    // API 呼叫
    getFuxingLineETA,
    getFuxingLineStops,
    getNearbyStopsETA,  // 保留相容性
    
    // 新增：站點資料與篩選
    FUXING_STOPS_DATA,
    getFuxingDirectionConfig,
    filterFuxingStations,
    getNextFuxingBusMinutes,
    generateMockFuxingData,
    
    // 格式化工具
    formatETA,
    getETAClass,
    
    // 舊版（保留相容性）
    FUXING_STOPS
};
