# NTNU Transport PWA

> 台師大校園交通整合 Progressive Web App

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

一個整合台師大校區間交通資訊的 PWA 應用，提供校車時刻表、YouBike 即時車位、復興幹線公車動態，以及智慧交通方式推薦。

🌐 **線上體驗**：[https://heyloon.github.io/ntnu-transport](https://heyloon.github.io/ntnu-transport)

## ✨ 功能特色

### 📅 校區接駁車時刻表
- **完整時刻表**：和平 ↔ 公館 ↔ 台大 ↔ 台科大
- **三校路線標記**：清楚標示經過三校的班次
- **假日判斷**：自動判斷假日、寒暑假，顯示班次資訊
- **下一班車提示**：自動高亮顯示下一班車
- **即時倒數**：顯示距離發車的剩餘時間

### 🚲 YouBike 即時車位
- **15 個精選站點**：涵蓋和平、公館、台大、台科大周邊
- **即時資料**：可借車輛、可還空位即時更新
- **智慧排序**：根據選擇的路線調整站點顯示順序
- **地圖連結**：直接開啟 Google Maps 導航
- **每 60 秒自動更新**

### 🚃 復興幹線即時動態
- **捷運風格介面**：類似捷運的站點顯示設計
- **動態方向切換**：根據出發地自動顯示相關方向站點
- **狀態視覺化**：
  - 🔴 紅色「進站中」（1 分鐘內）
  - 🟠 橘色「X 分」（預估到站分鐘數）
  - ⚫ 灰色「未發車」
- **智慧顯示**：目的地是台大/台科大時自動隱藏（校車更方便）
- **Mock 模式**：無 API Key 時仍可測試介面

### 🧠 智慧推薦系統
根據當下時間、班車狀況、YouBike 可用性，推薦最佳交通方式：
- **校車 5 分鐘內**：推薦等待接駁車
- **校車 6-15 分鐘**：建議接駁車，提供 YouBike 替代建議
- **校車 16-30 分鐘**：推薦 YouBike
- **校車 > 30 分鐘 + 復興幹線 8-15 分鐘**：推薦復興幹線
- **假日無班車**：推薦 YouBike 或復興幹線

### 📱 PWA 功能
- ✅ **離線支援**：Service Worker 快取，離線也能查看時刻表
- ✅ **可安裝**：新增到主畫面，像原生 App 一樣使用
- ✅ **響應式設計**：手機、平板、桌面完美適配
- ✅ **深色主題**：JR 風格設計，視覺舒適

## 🚀 快速開始

### 線上使用
直接訪問：[https://heyloon.github.io/ntnu-transport](https://heyloon.github.io/ntnu-transport)

### 本地開發

```bash
# 1. Clone 專案
git clone https://github.com/heyloon/ntnu-transport.git
cd ntnu-transport

# 2. 啟動本地伺服器（任選一種）
# Python 3
python3 -m http.server 8080

# Node.js
npx serve

# 3. 開啟瀏覽器
open http://localhost:8080
```

## 🔑 取得 TDX API Key（選用）

復興幹線即時動態功能需要 TDX API Key，完全免費且步驟簡單：

### 申請流程

1. **註冊帳號**  
   訪問 [TDX 運輸資料流通服務](https://tdx.transportdata.tw/register) 註冊

2. **等待審核**  
   約 3-5 小時（工作日通常更快）

3. **取得 API Key**  
   審核通過後，登入取得 `Client ID` 和 `Client Secret`

4. **設定到 App**  
   點擊右上角設定按鈕，貼上 Client ID 和 Client Secret

### 配額資訊
- **每秒請求數**：50 次
- **每日請求數**：約 10,000-50,000 次
- **本 App 使用量**：每日約 1,440 次（復興幹線每 60 秒更新一次）
- **結論**：配額非常充裕，完全不用擔心超過限制 ✅

### 資料安全
- ✅ API Key 儲存在瀏覽器 `localStorage`
- ✅ 不會傳送到任何伺服器
- ✅ 僅用於直接呼叫 TDX API
- ✅ 可隨時清除

## 🛠 技術架構

### 前端技術
- **純前端 PWA**：HTML + CSS + JavaScript（無框架）
- **Service Worker**：離線快取與版本管理
- **Manifest**：PWA 安裝支援
- **Responsive Design**：適配各種裝置

### API 整合
- **YouBike API**：台北市資料大平台（無需 API Key）
- **TDX API**：運輸資料流通服務（需 API Key，免費）
- **Token 快取**：24 小時有效期，自動更新

### 資料來源
- 校車時刻表：民國 115/03/16 版本
- YouBike 資料：台北市政府開放資料
- 公車動態：交通部 TDX 平台
- 假日資料：2025-2026 年國定假日

## 📂 專案結構

```
ntnu-transport/
├── index.html              # 主頁面
├── manifest.json           # PWA 設定
├── sw.js                   # Service Worker
├── css/
│   └── style.css          # JR 風格樣式
├── js/
│   ├── app.js             # 主程式邏輯
│   ├── schedule.js        # 校車時刻表資料與邏輯
│   ├── youbike.js         # YouBike API 整合
│   └── tdx.js             # TDX API 整合（復興幹線）
└── icons/
    ├── icon.svg           # App 圖示
    └── generate-icons.html # PNG 圖標產生工具
```

## 🎨 設計特色

### JR 風格設計
- 藍紫色漸層 Header
- 清晰的路線顏色區分
- 動畫與過渡效果
- 站點狀態視覺化

### 捷運風格復興幹線
- 類似捷運路線圖的站點顯示
- 狀態標籤（灰/紅/橘色）
- 路線徽章
- 即時更新提示

### 使用者體驗
- ⌨️ **鍵盤快捷鍵**：R=刷新, S=設定, X=交換起訖站
- 🔔 **通知系統**：操作回饋與狀態提示
- 🔄 **自動更新**：時刻、推薦、YouBike、復興幹線
- 📶 **網路偵測**：斷線時顯示提示

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

### 開發建議
1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- **資料來源**
  - [台北市資料大平台](https://data.taipei/)
  - [TDX 運輸資料流通服務](https://tdx.transportdata.tw/)
  - [台師大總務處](https://www.ga.ntnu.edu.tw/)

- **設計靈感**
  - JR East 日本鐵道風格
  - 台北捷運路線圖設計

## 📮 聯絡方式

如有問題或建議，歡迎透過以下方式聯絡：
- 開 Issue：[GitHub Issues](https://github.com/heyloon/ntnu-transport/issues)
- Email：[your-email@example.com]

---

**Made with ❤️ for NTNU students**
