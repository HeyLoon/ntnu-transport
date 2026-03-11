/**
 * NTNU Transport - 主程式
 * 優化版本：包含錯誤處理、並發控制、記憶體管理
 */

// ===== DOM Elements =====
const elements = {
    currentTime: document.getElementById('currentTime'),
    currentDate: document.getElementById('currentDate'),
    fromStation: document.getElementById('fromStation'),
    toStation: document.getElementById('toStation'),
    swapBtn: document.getElementById('swapBtn'),
    scheduleNotice: document.getElementById('scheduleNotice'),
    scheduleDisplay: document.getElementById('scheduleDisplay'),
    recommendationCard: document.getElementById('recommendationCard'),
    youbikeContainer: document.getElementById('youbikeContainer'),
    youbikeUpdateTime: document.getElementById('youbikeUpdateTime'),
    refreshYoubikeBtn: document.getElementById('refreshYoubikeBtn'),
    fuxingNoKey: document.getElementById('fuxingNoKey'),
    fuxingRealtime: document.getElementById('fuxingRealtime'),
    setupKeyBtn: document.getElementById('setupKeyBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    clearKeyBtn: document.getElementById('clearKeyBtn'),
    tdxClientId: document.getElementById('tdxClientId'),
    tdxClientSecret: document.getElementById('tdxClientSecret')
};

// ===== State =====
let currentFrom = 'heping';
let currentTo = 'gongguan';

// ===== Timer Management (防止記憶體洩漏) =====
const timers = [];
let youbikeAbortController = null;
let fuxingAbortController = null;
let isOnline = navigator.onLine;

function registerTimer(timerId) {
    timers.push(timerId);
}

function clearAllTimers() {
    timers.forEach(timer => clearInterval(timer));
    timers.length = 0;
}

// ===== Notification System =====
function showNotification(message, type = 'info') {
    // 移除現有通知
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="notification-message">${message}</span>
    `;
    document.body.appendChild(notification);
    
    // 觸發動畫
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== Error Display Helper =====
function showError(container, message, onRetryFn = null) {
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <p class="error-message">${message}</p>
            ${onRetryFn ? `<button class="btn-retry" onclick="${onRetryFn}">重試</button>` : ''}
        </div>
    `;
}

// ===== Loading Skeleton =====
function showYoubikeSkeleton() {
    elements.youbikeContainer.innerHTML = `
        <div class="skeleton-container">
            <div class="skeleton-area">
                <div class="skeleton-header"></div>
                <div class="skeleton-station"></div>
                <div class="skeleton-station"></div>
                <div class="skeleton-station"></div>
            </div>
            <div class="skeleton-area">
                <div class="skeleton-header"></div>
                <div class="skeleton-station"></div>
                <div class="skeleton-station"></div>
                <div class="skeleton-station"></div>
            </div>
        </div>
    `;
}

// ===== Time Display =====
function updateTimeDisplay() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    elements.currentTime.textContent = `${hours}:${minutes}:${seconds}`;
    
    const year = now.getFullYear() - 1911; // 民國年
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dayText = ScheduleData.getDayOfWeekText();
    
    elements.currentDate.textContent = `民國 ${year} 年 ${month} 月 ${date} 日（${dayText}）`;
}

// ===== Schedule Notice =====
function updateScheduleNotice() {
    const { isOperating, reason } = ScheduleData.isOperatingDay();
    
    if (!isOperating) {
        elements.scheduleNotice.textContent = reason || '今日接駁車不行駛';
        elements.scheduleNotice.classList.add('show');
    } else {
        elements.scheduleNotice.classList.remove('show');
    }
}

// ===== Schedule Display =====
function renderSchedule() {
    const schedule = ScheduleData.getSchedule(currentFrom, currentTo);
    const now = new Date();
    const nextBus = ScheduleData.getNextBus(schedule, now);
    
    // 決定方向標題
    let directionText = '';
    let directionClass = '';
    
    if (currentFrom === 'heping') {
        directionText = '和平 → ';
        directionClass = 'direction-heping';
    } else {
        directionText = '公館 → ';
        directionClass = 'direction-gongguan';
    }
    
    if (currentTo === 'gongguan') {
        directionText += '公館';
    } else if (currentTo === 'heping') {
        directionText += '和平';
    } else if (currentTo === 'ntu') {
        directionText += '臺大（三校車）';
    } else if (currentTo === 'ntust') {
        directionText += '臺科大（三校車）';
    }
    
    let html = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th class="${directionClass}" colspan="2">${directionText}</th>
                </tr>
                <tr>
                    <th>發車時間</th>
                    <th>備註</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (schedule.length === 0) {
        html += `
            <tr>
                <td colspan="2" style="padding: 20px; color: #666;">
                    此路線無直達班次，請使用其他交通方式
                </td>
            </tr>
        `;
    } else {
        schedule.forEach((item, index) => {
            const isNext = nextBus && nextBus.index === index;
            const rowClass = isNext ? 'next-bus' : '';
            
            let noteHtml = '';
            if (item.note) {
                if (item.note.includes('三校')) {
                    noteHtml = '<span class="note-badge sanxiao">三校</span>';
                } else if (item.note.includes('車')) {
                    noteHtml = `<span class="note-badge multi-bus">${item.note}</span>`;
                } else {
                    noteHtml = item.note;
                }
            }
            
            if (item.extra) {
                noteHtml += ` <small style="color: #999;">(${item.extra})</small>`;
            }
            
            html += `
                <tr class="${rowClass}">
                    <td>
                        <div class="time-cell">
                            ${isNext ? '<span class="next-arrow">▶</span>' : ''}
                            <span class="time-value">${item.time}</span>
                            ${isNext ? '<span class="next-indicator">下一班</span>' : ''}
                        </div>
                    </td>
                    <td>${noteHtml}</td>
                </tr>
            `;
        });
    }
    
    html += '</tbody></table>';
    elements.scheduleDisplay.innerHTML = html;
}

// ===== Recommendation (整合 YouBike 與復興幹線) =====
async function updateRecommendation() {
    const now = new Date();
    const schedule = ScheduleData.getSchedule(currentFrom, currentTo);
    const nextBus = ScheduleData.getNextBus(schedule, now);
    
    // 取得 YouBike 可用性
    const availableBikes = YoubikeData.getTotalAvailableBikes(currentFrom);
    const bikesWarning = availableBikes === 0 
        ? '（注意：附近站點目前無車輛）' 
        : availableBikes <= 3 
            ? `（僅剩 ${availableBikes} 輛，建議儘速前往）` 
            : '';
    
    // 判斷是否為假日
    const { isOperating, reason } = ScheduleData.isOperatingDay();
    
    if (!isOperating) {
        renderRecommendation({
            type: 'youbike',
            icon: '🚲',
            title: 'YouBike',
            time: '',
            desc: (reason || '今日假日無接駁車') + '，建議使用 YouBike' + bikesWarning,
            countdown: '',
            bikesAvailable: availableBikes
        });
        return;
    }
    
    // 判斷接駁車時間
    if (nextBus) {
        const minutes = nextBus.minutesUntil;
        
        // 5 分鐘內有車 → 推薦接駁車
        if (minutes <= 5) {
            renderRecommendation({
                type: 'shuttle',
                icon: '🚌',
                title: '校區接駁車',
                time: nextBus.time,
                desc: nextBus.note ? `${nextBus.note}` : '一般班次',
                countdown: ScheduleData.formatCountdown(minutes),
                imminent: minutes <= 2
            });
            return;
        }
        
        // 15 分鐘內有車 → 可考慮接駁車或 YouBike
        if (minutes <= 15) {
            const alternative = availableBikes > 0 
                ? `YouBike 也是不錯的選擇（附近有 ${availableBikes} 輛）`
                : '附近 YouBike 無車輛，建議等待接駁車';
            
            renderRecommendation({
                type: 'shuttle',
                icon: '🚌',
                title: '校區接駁車',
                time: nextBus.time,
                desc: `約 ${minutes} 分鐘後發車` + (nextBus.note ? ` (${nextBus.note})` : ''),
                countdown: ScheduleData.formatCountdown(minutes),
                imminent: false,
                alternative: alternative
            });
            return;
        }
        
        // 校車 > 30 分鐘 且 目的地不是台大/台科大 → 檢查復興幹線
        if (minutes > 30 && currentTo !== 'ntu' && currentTo !== 'ntust') {
            try {
                const directionConfig = TdxApi.getFuxingDirectionConfig(currentFrom);
                if (directionConfig) {
                    const etaData = await TdxApi.getFuxingLineETA();
                    const stationData = TdxApi.filterFuxingStations(etaData, directionConfig);
                    const fuxingMinutes = TdxApi.getNextFuxingBusMinutes(stationData);
                    
                    // 復興幹線在 8-15 分鐘內到站 → 推薦復興幹線
                    if (fuxingMinutes !== null && fuxingMinutes >= 8 && fuxingMinutes <= 15) {
                        renderRecommendation({
                            type: 'fuxing',
                            icon: '🚃',
                            title: '復興幹線',
                            time: `約 ${fuxingMinutes} 分鐘`,
                            desc: `接駁車還要等 ${minutes} 分鐘（${nextBus.time}），建議搭乘復興幹線`,
                            countdown: `${fuxingMinutes} 分`,
                            alternative: `或等待 ${nextBus.time} 的接駁車`
                        });
                        return;
                    }
                }
            } catch (error) {
                console.error('無法取得復興幹線推薦資訊:', error);
                // 繼續顯示其他推薦
            }
        }
        
        // 超過 15 分鐘 → 推薦 YouBike
        renderRecommendation({
            type: 'youbike',
            icon: '🚲',
            title: 'YouBike',
            time: '',
            desc: `下班接駁車要等 ${minutes} 分鐘（${nextBus.time}），建議騎 YouBike` + bikesWarning,
            countdown: '',
            shuttle: { time: nextBus.time, minutes },
            bikesAvailable: availableBikes
        });
        return;
    }
    
    // 今日班次已結束
    renderRecommendation({
        type: 'youbike',
        icon: '🚲',
        title: 'YouBike',
        time: '',
        desc: '今日接駁車班次已結束，建議使用 YouBike 或搭乘復興幹線' + bikesWarning,
        countdown: '',
        bikesAvailable: availableBikes
    });
}

function renderRecommendation(data) {
    let html = `
        <div class="recommendation-content">
            <div class="recommendation-icon">${data.icon}</div>
            <div class="recommendation-info">
                <div class="recommendation-type">${data.title}</div>
    `;
    
    if (data.time) {
        html += `<div class="recommendation-time"><span class="time-value">${data.time}</span> 發車</div>`;
    }
    
    html += `<div class="recommendation-desc">${data.desc}</div>`;
    
    if (data.alternative) {
        html += `<div class="recommendation-alternative">💡 ${data.alternative}</div>`;
    }
    
    html += '</div>';
    
    if (data.countdown) {
        html += `
            <div class="recommendation-countdown">
                <div class="countdown-label">剩餘時間</div>
                <div class="countdown-value ${data.imminent ? 'imminent' : ''}">${data.countdown}</div>
            </div>
        `;
    }
    
    html += '</div>';
    
    elements.recommendationCard.innerHTML = html;
}

// ===== YouBike Display (加入並發控制) =====
async function loadYoubikeData() {
    // 取消前一次未完成的請求
    if (youbikeAbortController) {
        youbikeAbortController.abort();
    }
    youbikeAbortController = new AbortController();
    
    // 檢查網路狀態
    if (!navigator.onLine) {
        showError(elements.youbikeContainer, '網路已中斷，無法更新資料', 'loadYoubikeData()');
        return;
    }
    
    showYoubikeSkeleton();
    
    try {
        await YoubikeData.fetchYoubikeData(youbikeAbortController.signal);
        renderYoubike();
        // 更新推薦（因為 YouBike 資料已更新）
        updateRecommendation();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('YouBike request cancelled');
            return;
        }
        showError(
            elements.youbikeContainer, 
            `載入失敗：${error.message}`, 
            'loadYoubikeData()'
        );
    }
}

function renderYoubike() {
    const allStations = YoubikeData.getAllAreaStations();
    elements.youbikeUpdateTime.textContent = YoubikeData.getLastUpdateTimeText();
    
    let html = '';
    
    // 依照使用者選擇的路線決定顯示順序
    const areaOrder = getYoubikeAreaOrder();
    
    for (const areaKey of areaOrder) {
        const area = allStations[areaKey];
        if (!area || area.stations.length === 0) continue;
        
        // 計算區域總可借車數
        const totalBikes = area.stations.reduce((sum, s) => sum + (s.available_rent_bikes || 0), 0);
        
        html += `
            <div class="youbike-area">
                <div class="youbike-area-header">
                    <span class="area-indicator ${area.class}"></span>
                    ${area.name}
                    <span class="area-total-bikes">共 ${totalBikes} 輛</span>
                </div>
                <div class="youbike-stations">
        `;
        
        for (const station of area.stations) {
            const bikes = station.available_rent_bikes || 0;
            const spaces = station.available_return_bikes || 0;
            const statusClass = YoubikeData.getStatusClass(bikes);
            const statusText = YoubikeData.getStatusText(bikes);
            const name = YoubikeData.formatStationName(station.sna);
            const mapsUrl = YoubikeData.getStationMapsUrl(station);
            
            html += `
                <div class="youbike-station">
                    <span class="station-name">${name}</span>
                    <span class="station-bikes">
                        <span class="bike-icon">🚲</span>
                        ${bikes}
                    </span>
                    <span class="station-spaces">
                        空位 ${spaces}
                    </span>
                    <span class="station-status ${statusClass}">${statusText}</span>
                    ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" class="maps-btn" title="在 Google Maps 中開啟">📍</a>` : ''}
                </div>
            `;
        }
        
        html += '</div></div>';
    }
    
    if (!html) {
        html = '<div class="empty-state">找不到相關站點資料</div>';
    }
    
    elements.youbikeContainer.innerHTML = html;
}

function getYoubikeAreaOrder() {
    // 依據出發地和目的地決定顯示順序
    const orders = {
        'heping_gongguan': ['heping', 'gongguan'],
        'heping_ntu': ['heping', 'ntu'],
        'heping_ntust': ['heping', 'ntust'],
        'gongguan_heping': ['gongguan', 'heping'],
        'gongguan_ntu': ['gongguan', 'ntu'],
        'gongguan_ntust': ['gongguan', 'ntust']
    };
    
    const key = `${currentFrom}_${currentTo}`;
    return orders[key] || ['heping', 'gongguan', 'ntu', 'ntust'];
}

// ===== Fuxing Line (捷運風格改造) =====

/**
 * 判斷是否應該顯示復興幹線區塊
 * 目的地是台大或台科大時隱藏（校車更方便）
 */
function shouldShowFuxingLine() {
    if (currentTo === 'ntu' || currentTo === 'ntust') {
        return false;
    }
    return true;
}

function checkFuxingApiKey() {
    const shouldShow = shouldShowFuxingLine();
    const fuxingSection = document.getElementById('fuxingSection');
    
    if (!shouldShow) {
        fuxingSection.style.display = 'none';
        return;
    }
    
    fuxingSection.style.display = 'block';
    
    if (TdxApi.hasApiKey()) {
        elements.fuxingNoKey.style.display = 'none';
        elements.fuxingRealtime.style.display = 'block';
        loadFuxingData();
    } else {
        elements.fuxingNoKey.style.display = 'block';
        elements.fuxingRealtime.style.display = 'none';
    }
}

/**
 * 顯示捷運風格 Skeleton 載入動畫
 */
function showFuxingMetroSkeleton() {
    const container = document.getElementById('fuxingStations');
    const skeletonItems = Array(6).fill(0).map(() => `
        <div class="metro-skeleton-item">
            <div class="skeleton-status"></div>
            <div class="skeleton-station-info">
                <div class="skeleton-station-name"></div>
            </div>
            <div class="skeleton-badge"></div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="metro-skeleton">${skeletonItems}</div>`;
}

async function loadFuxingData() {
    // 取消前一次未完成的請求
    if (fuxingAbortController) {
        fuxingAbortController.abort();
    }
    fuxingAbortController = new AbortController();
    
    // 檢查網路狀態
    if (!navigator.onLine) {
        showFuxingError('網路已中斷，無法更新資料');
        return;
    }
    
    showFuxingMetroSkeleton();
    
    try {
        // 取得對應方向設定
        const directionConfig = TdxApi.getFuxingDirectionConfig(currentFrom);
        if (!directionConfig) {
            showFuxingError('無法顯示此路線資訊');
            return;
        }
        
        // 更新方向標題
        document.getElementById('fuxingDirection').textContent = directionConfig.displayName;
        
        // 取得 ETA 資料
        const etaData = await TdxApi.getFuxingLineETA();
        
        // 篩選相關站點
        const stationData = TdxApi.filterFuxingStations(etaData, directionConfig);
        
        if (stationData.length === 0) {
            document.getElementById('fuxingStations').innerHTML = 
                '<div class="empty-state" style="padding: 24px; text-align: center; color: #666;">目前無班車資訊</div>';
            return;
        }
        
        // 渲染捷運風格站點
        renderFuxingMetroStations(stationData);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fuxing request cancelled');
            return;
        }
        showFuxingError(`載入失敗：${error.message}`);
    }
}

/**
 * 顯示復興幹線錯誤訊息
 */
function showFuxingError(message) {
    const container = document.getElementById('fuxingStations');
    container.innerHTML = `
        <div class="error-state" style="padding: 24px; text-align: center;">
            <div class="error-icon" style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>
            <p class="error-message" style="color: #666; margin-bottom: 12px;">${message}</p>
            <button class="btn-retry" onclick="loadFuxingData()" style="
                padding: 8px 16px;
                background: var(--color-primary);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            ">重試</button>
        </div>
    `;
}

/**
 * 渲染捷運風格站點列表
 */
function renderFuxingMetroStations(stationData) {
    const container = document.getElementById('fuxingStations');
    
    let html = '';
    for (const station of stationData) {
        const stopName = station.StopName?.Zh_tw || '未知站點';
        const eta = station.EstimateTime;
        
        // 判斷狀態
        let statusClass, statusText;
        if (eta === undefined || eta === null) {
            statusClass = 'status-not-departed';
            statusText = '未發車';
        } else if (eta <= 60) {
            statusClass = 'status-arriving';
            statusText = '進站中';
        } else {
            statusClass = 'status-minutes';
            const minutes = Math.floor(eta / 60);
            statusText = `${minutes} 分`;
        }
        
        html += `
            <div class="metro-station">
                <div class="station-status ${statusClass}">${statusText}</div>
                <div class="station-info">
                    <span class="station-name">${stopName}</span>
                </div>
                <div class="route-indicator">
                    <span class="route-badge-small">復興</span>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ===== Settings Modal =====
function openSettingsModal() {
    // 載入已儲存的憑證
    const credentials = TdxApi.getStoredCredentials();
    if (credentials) {
        elements.tdxClientId.value = credentials.clientId;
        elements.tdxClientSecret.value = credentials.clientSecret;
    } else {
        elements.tdxClientId.value = '';
        elements.tdxClientSecret.value = '';
    }
    
    elements.settingsModal.classList.add('show');
}

function closeSettingsModal() {
    elements.settingsModal.classList.remove('show');
}

async function saveSettings() {
    const clientId = elements.tdxClientId.value.trim();
    const clientSecret = elements.tdxClientSecret.value.trim();
    
    if (!clientId || !clientSecret) {
        showNotification('請輸入完整的 Client ID 和 Client Secret', 'warning');
        return;
    }
    
    // 暫存憑證
    TdxApi.saveCredentials(clientId, clientSecret);
    
    // 驗證 API Key
    try {
        showNotification('驗證 API Key 中...', 'info');
        await TdxApi.getAccessToken();
        
        showNotification('API Key 設定成功！', 'success');
        closeSettingsModal();
        checkFuxingApiKey();
    } catch (error) {
        // 驗證失敗，清除錯誤的 Key
        TdxApi.clearCredentials();
        showNotification(`API Key 驗證失敗：${error.message}`, 'error');
    }
}

function clearApiKey() {
    if (confirm('確定要清除已儲存的 API Key 嗎？')) {
        TdxApi.clearCredentials();
        elements.tdxClientId.value = '';
        elements.tdxClientSecret.value = '';
        showNotification('API Key 已清除', 'info');
        closeSettingsModal();
        checkFuxingApiKey();
    }
}

// ===== Route Selection =====
function onRouteChange() {
    currentFrom = elements.fromStation.value;
    currentTo = elements.toStation.value;
    
    // 確保出發地和目的地不同
    if (currentFrom === currentTo) {
        if (currentFrom === 'heping') {
            currentTo = 'gongguan';
        } else {
            currentTo = 'heping';
        }
        elements.toStation.value = currentTo;
    }
    
    // 更新目的地選項（排除出發地）
    updateToStationOptions();
    
    // 重新渲染
    renderSchedule();
    updateRecommendation();
    renderYoubike();
    
    // 檢查復興幹線顯示狀態並重新載入
    checkFuxingApiKey();
}

function updateToStationOptions() {
    const options = [
        { value: 'gongguan', text: '公館校區' },
        { value: 'heping', text: '和平校區' },
        { value: 'ntu', text: '臺灣大學' },
        { value: 'ntust', text: '臺灣科技大學' }
    ];
    
    // 過濾掉出發地
    const filteredOptions = options.filter(opt => opt.value !== currentFrom);
    
    elements.toStation.innerHTML = filteredOptions.map(opt => 
        `<option value="${opt.value}" ${opt.value === currentTo ? 'selected' : ''}>${opt.text}</option>`
    ).join('');
    
    // 如果當前目的地被過濾掉了，選擇第一個選項
    if (!filteredOptions.find(opt => opt.value === currentTo)) {
        currentTo = filteredOptions[0].value;
        elements.toStation.value = currentTo;
    }
}

function swapStations() {
    // 只有當目的地是 heping 或 gongguan 時才能交換
    if (currentTo !== 'heping' && currentTo !== 'gongguan') {
        showNotification('僅支援和平與公館校區間交換', 'warning');
        return;
    }
    
    const temp = currentFrom;
    currentFrom = currentTo;
    currentTo = temp;
    
    elements.fromStation.value = currentFrom;
    elements.toStation.value = currentTo;
    
    // 交換按鈕動畫
    elements.swapBtn.classList.add('swapping');
    setTimeout(() => elements.swapBtn.classList.remove('swapping'), 300);
    
    updateToStationOptions();
    onRouteChange();
}

// ===== Keyboard Shortcuts =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC: 關閉 Modal
        if (e.key === 'Escape' && elements.settingsModal.classList.contains('show')) {
            closeSettingsModal();
            return;
        }
        
        // 避免在輸入框內觸發快捷鍵
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }
        
        // R: 重新整理 YouBike
        if (e.key === 'r' || e.key === 'R') {
            loadYoubikeData();
            showNotification('正在重新整理 YouBike 資料...', 'info');
        }
        
        // S: 開啟設定
        if (e.key === 's' || e.key === 'S') {
            openSettingsModal();
        }
        
        // X: 交換起訖站
        if (e.key === 'x' || e.key === 'X') {
            swapStations();
        }
    });
}

// ===== Network Status Detection =====
function setupNetworkDetection() {
    window.addEventListener('online', () => {
        isOnline = true;
        showNotification('網路已恢復，正在更新資料...', 'success');
        loadYoubikeData();
        if (TdxApi.hasApiKey()) {
            loadFuxingData();
        }
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        showNotification('網路已中斷，資料可能不是最新', 'warning');
    });
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Route selection
    elements.fromStation.addEventListener('change', onRouteChange);
    elements.toStation.addEventListener('change', onRouteChange);
    elements.swapBtn.addEventListener('click', swapStations);
    
    // YouBike refresh
    elements.refreshYoubikeBtn.addEventListener('click', () => {
        loadYoubikeData();
        showNotification('正在重新整理...', 'info');
    });
    
    // Settings modal
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.setupKeyBtn.addEventListener('click', openSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.clearKeyBtn.addEventListener('click', clearApiKey);
    
    // Close modal on overlay click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
    });
}

// ===== Initialization =====
function init() {
    // Setup event listeners
    setupEventListeners();
    setupKeyboardShortcuts();
    setupNetworkDetection();
    
    // Initial time display
    updateTimeDisplay();
    registerTimer(setInterval(updateTimeDisplay, 1000));
    
    // Update schedule notice (holiday check)
    updateScheduleNotice();
    
    // Initial route options
    updateToStationOptions();
    
    // Render schedule
    renderSchedule();
    
    // Update recommendation
    updateRecommendation();
    registerTimer(setInterval(updateRecommendation, 30000)); // Update every 30 seconds
    
    // Load YouBike data
    loadYoubikeData();
    registerTimer(setInterval(loadYoubikeData, 60000)); // Refresh every minute
    
    // Check Fuxing API key and setup auto-refresh
    checkFuxingApiKey();
    registerTimer(setInterval(() => {
        if (TdxApi.hasApiKey()) {
            loadFuxingData();
        }
    }, 60000)); // Refresh Fuxing data every minute
    
    // Log keyboard shortcuts hint
    console.log('快捷鍵：R=重新整理, S=設定, X=交換起訖站');
}

// ===== Cleanup on page unload =====
window.addEventListener('beforeunload', () => {
    clearAllTimers();
    if (youbikeAbortController) youbikeAbortController.abort();
    if (fuxingAbortController) fuxingAbortController.abort();
});

// Start the app
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.App = {
    elements,
    currentFrom: () => currentFrom,
    currentTo: () => currentTo,
    loadYoubikeData,
    loadFuxingData,
    showNotification
};
