## 4. סטטוס קוד נוכחי ורכיבים מוכנים (Current Codebase & Implementation State)

### 4.1 מלאי קבצים

{{INVENTORY}}

תיקיית פלט קבועה: `/mnt/user-data/outputs`. סביבת העבודה הזמנית (`/home/claude/work`) מתאפסת באופן בלתי צפוי.

### 4.2 מפת מחלקות/פונקציות לפי קובץ

#### `code.js` (Apps Script, צד שרת)

| קבוצה | פונקציות | הערות |
|---|---|---|
| ניתוב | `doGet(e)`, `handleApiRequest(e)`, `jsonResponse(obj)` | `api` מנותב לפני `page` |
| קריאה | `getInitialData()`, `getCustomerData(clientId)`, `getWebAppUrl()`, `convertCellImageToBase64(val)`, `apiCustomerList()`, `apiCustomerDetail(id)` | `getCustomerData` מפרסר עמודות JSON ומחזיר אובייקט עם מפתחות עבריים |
| כתיבה | `saveCustomerData(payload)` (שורה מלאה 1-29), `updateCalculatorResults(payload)` (20-23, 29), `saveConsumptionAnalysis(payload)` (30, 32), `saveSizingRecommendation(payload)` (31) | |
| Excel | `generateConsumptionExcelReport(payloadJson)`, `_styleHeaderRow`, `_applyRedYellowGradient`, `_buildGradientDataSheet`, `_buildStatsSheet`, `_buildSourcesSheet`, `_buildTariffStructureSheet`, `_buildMonsterSheet`, `_fmtTariffSplit` | לא הורצו ב-Apps Script |
| הגדרה חד-פעמית | `oneTimeSetup_v2`, `oneTimeSetup_v3` (עמודה 29), `oneTimeSetup_v4` (עמודות 30-32), `setApiKey_oneTime` | להריץ ידנית מהעורך |
| ללא שינוי מהותי | `getTariffFromCompany()` (stub) | |

#### שלושת קבצי השלבים (משותף)

| קבוצה | פונקציות (שלב 1 / 2 / 3) |
|---|---|
| אתחול | `initTooltips`, `initClientIdAndBootstrap` (1) / `initClientIdAndBootstrap2` + `bootstrapStage2` (2) / `initClientIdAndBootstrap3` + `bootstrapStage3` (3) |
| קידוד | `packHourlySeriesToB64`, `unpackB64ToHourlySeries` (1: גם `getTrailingYearDayWindow`, `aggregateToHourlyGrid`, `chooseScale`; 2, 3: `unpack` בלבד) |
| תעריף ולוח שנה | `hc_*`, `toHebrewDate`, `estimateSunsetHHMM`, `classifyHour`, `isPeakHour`, `computeSeasonalPeakDayCounts`, `calcStaircaseTariff`, `openSettingsModal`, `saveTariffSettings` |
| פיננסי | `pmt`, `npvCalc`, `npvAt`, `irrCalc`, `runFinancialModel` (2, 3), `calcBatteryArbitrageRevenue` (3) |

#### `ConsumptionAnalysis.html` (שלב 1)

| קבוצה | פונקציות |
|---|---|
| קליטה | `handleParsedRows`, `parseMultimeterRows`, `handleImportedEstimateFile`, `detectGenericColumns`, `ingestDataPoint`, `synthesizeFromAnnualTotal`, `synthesizeFromMatrix`, `computeDistributionWeight`, `populatePropertyTypeSelect`, `updatePropertyTypeDesc`, `onProductionModeChange`, `syncExistingProductionToP0` |
| איחוד | `snapshotSource`, `normalizeShape`, `blendShapes`, `unifyAllSources` |
| שבת וחריגים | `getSunsetMinutesOfDay`, `getHalachicShabbatWindow`, `isInHalachicShabbat`, `computeWeeklyShabbatProfiles`, `detectExceptionDays`, `onShabbatUpliftChange`, `onIgnoreMissingShabbatToggle`, `updateShabbatSummaryRow` |
| דוחות | `renderReports`, `getStats`, `populateDOM`, `calculateMedian`, `calculateTrimmedMean`, `calculateTopPercentAvg`, `calculateBottomPercentAvg`, `showFilePreview` |
| תקופה | `getTrailingYearWindow` (ישן, בשימוש `updateAnalysisPeriodFromData`), `detectStepHours`, `updateAnalysisPeriodFromData` |
| Excel | `buildExcelPayload`, `exportToExcel`, `_fmtDDMMYYYY`, `Utilities_fmtDateTime`, `hebGematria`, `hebYearGematria`, `formatHebrewDateLabel` |
| חיוב מטופס | `offerBillingFromFormJson`, `toggleMonthlyBilling`, `getMonthlyBillingValues` (🔴 D7) |
| שמירה | `saveAndContinueToStage2` |

#### `SystemSizing.html` (שלב 2)

`findOptimalSystemSize`, `gatherBaseInputsForSearch`, `computeSeasonPeakStatsFromRawSeries`, `renderRecommendationResults`, `applyRecommendationToManualFields`, `applySuggestedBattery`, `applySuggestedInverterPower`, `runBatteryDispatchSimulation`, `renderHourlySimResults`, `renderMonthlyBarChart`, `renderDayChart`, `applySimResultsToCalculator`, `onFutureGrowthChange`, `saveAndContinueToStage3`.

#### `FinancialModel.html` (שלב 3)

`runFinancialModel`, `displayCalcResults`, `renderCashflowChart`, `buildFinalReport`, `renderFinalReport`, `exportReportToExcel`, `fmtCurrency`, `saveResultsAndReturnToIndex`. מאזין `calcBtn`.

#### `Index.html` (CRM)

`resetToNewCustomer`, `selectCustomer`, `renderStageButtons`, `openStage`, `openStageConsumption`, `openStageSizing`, `openStageFinance`, `openConsumerForm`, `saveDataToSheet`, `calculateAll`, `applyCalculatorData`, `pullDataFromCalculator` (🔴 ללא כפתור), `openCalculatorWindow` (🔴 ללא כפתור), `openPrintWindow`.

<details>
<summary>רשימות פונקציות מלאות עם מספרי שורות (נוצר אוטומטית מהקבצים)</summary>

{{FUNCS|code.js}}

{{FUNCS|ConsumptionAnalysis.html}}

{{FUNCS|SystemSizing.html}}

{{FUNCS|FinancialModel.html}}

</details>

### 4.3 ממשקי שרת (`google.script.run`)

| פונקציה | קורא | קלט | פלט | כתיבה |
|---|---|---|---|---|
| `getInitialData()` | Index | — | `{catalog, customers, settings}` (כל הלקוחות כמחרוזות) | — |
| `getCustomerData(clientId)` | שלבים 1-3, PrintQuote, Form, API | מזהה | אובייקט לקוח, עמודות JSON מפורסרות | — |
| `getWebAppUrl()` | כל הדפים | — | כתובת `/exec` | — |
| `saveCustomerData(payload)` | Index | JSON מלא | `{ok, message}` | שורה 1-29 |
| `updateCalculatorResults(payload)` | שלב 3, Index | `{clientId, totalPrice?, annualSavings?, roi?, profit25?, rawCalculatorData?}` | `{ok, message}` | 20-23, 29 |
| `saveConsumptionAnalysis(payload)` | שלב 1 | `{clientId, consumptionAnalysis, productionSeries?}` | `{ok, message}` | 30, 32 |
| `saveSizingRecommendation(payload)` | שלב 2 | `{clientId, sizingRecommendation}` | `{ok, message}` | 31 |
| `generateConsumptionExcelReport(payloadJson)` | שלב 1 | ראו 2.10 | `{ok, base64, filename}` | קובץ זמני ב-Drive |

סכימות JSON של עמודות 29-32: סעיפים 2.9 (30, 32), 2.11 (31), 2.12 (29).

### 4.4 קטעי קוד סופיים (נשלפו אוטומטית מהקבצים שנמסרו; זהים לקוד)

סמלי מוכנות: ✅ נבדק בהרצה | 🟡 נבדק חלקית/לא בפריסה | 🔴 מכיל פגם ידוע (ראו 6.1). טיפול בשגיאות מצוין לכל קטע.

#### 4.4.1 קידוד התמדה לתא הגיליון — ✅

אימות קלט: אין. `chooseScale` מבטיח שאין חיתוך. `unpack` נפילה ל-1 בינואר כשחסר `startISO` (רשומות ישנות).

{{CODE|ConsumptionAnalysis.html|getTrailingYearDayWindow}}

{{CODE|ConsumptionAnalysis.html|aggregateToHourlyGrid}}

{{CODE|ConsumptionAnalysis.html|chooseScale}}

{{CODE|ConsumptionAnalysis.html|packHourlySeriesToB64}}

{{CODE|ConsumptionAnalysis.html|unpackB64ToHourlySeries}}

#### 4.4.2 שמירה ומעבר לשלב 2 — ✅

טיפול בשגיאות: חסימה בלי איחוד או בלי `clientId` (`alert`); `withFailureHandler`; הודעת שרת מוצגת.

{{CODE|ConsumptionAnalysis.html|saveAndContinueToStage2}}

{{CODE|code.js|saveConsumptionAnalysis}}

{{CODE|code.js|saveSizingRecommendation}}

#### 4.4.3 זיהוי מזהה לקוח (שלב 1; שלבים 2-3 זהים במבנה) — 🟡

{{CODE|ConsumptionAnalysis.html|initClientIdAndBootstrap}}

#### 4.4.4 סיווג שעה לתעריף — ✅

{{CODE|ConsumptionAnalysis.html|classifyHour}}

{{MARK|ConsumptionAnalysis.html|const CALC_CONSTANTS = {|CLOSE4SEMI|js}}

#### 4.4.5 פענוח מונה חח"י מרובה-מונים — ✅

טיפול בשגיאות: שורות קצרות מ-5 עמודות או עם ערך/תאריך לא תקין מדולגות. 🟡 פסיק עשרוני נמחק (ראו 5.1).

{{CODE|ConsumptionAnalysis.html|parseMultimeterRows}}

#### 4.4.6 איחוד מקורות — ✅ (המשקלים 🟡)

{{CODE|ConsumptionAnalysis.html|snapshotSource}}

{{CODE|ConsumptionAnalysis.html|normalizeShape}}

{{CODE|ConsumptionAnalysis.html|blendShapes}}

{{CODE|ConsumptionAnalysis.html|unifyAllSources}}

#### 4.4.7 שבת הלכתית, פרופיל שבועי, ימי חריגה — ✅ (🔴 D5 לגבי שימוש בהערכה)

{{CODE|ConsumptionAnalysis.html|getSunsetMinutesOfDay}}

{{CODE|ConsumptionAnalysis.html|getHalachicShabbatWindow}}

{{CODE|ConsumptionAnalysis.html|isInHalachicShabbat}}

{{CODE|ConsumptionAnalysis.html|computeWeeklyShabbatProfiles}}

{{CODE|ConsumptionAnalysis.html|detectExceptionDays}}

{{CODE|ConsumptionAnalysis.html|onShabbatUpliftChange}}

#### 4.4.8 השוואת שנים בתצוגה המקדימה — ✅

{{MARK|ConsumptionAnalysis.html|// השוואת צריכה בין שתי יחידות שנתיות שלמות|CLOSE8|js}}

#### 4.4.9 חיוב מטופס הלקוח — 🔴 D7

{{CODE|ConsumptionAnalysis.html|offerBillingFromFormJson}}

{{CODE|ConsumptionAnalysis.html|getMonthlyBillingValues}}

#### 4.4.10 מנוע המלצה, הצעות סוללה/ממיר — 🔴 D2, D3, D12

{{CODE|SystemSizing.html|findOptimalSystemSize}}

{{CODE|SystemSizing.html|applySuggestedBattery}}

{{CODE|SystemSizing.html|applySuggestedInverterPower}}

{{CODE|SystemSizing.html|saveAndContinueToStage3}}

#### 4.4.11 שמירת שלב 3 — ✅ (🔴 D2 לגבי שטח הגג בדוח)

{{CODE|FinancialModel.html|saveResultsAndReturnToIndex}}

{{CODE|code.js|updateCalculatorResults}}

#### 4.4.12 כפתורי המשך ב-Index — ✅ (🔴 D14)

{{CODE|Index.html|renderStageButtons}}

#### 4.4.13 ייצוא Excel — 🔴 D8-D11, D13 (לא הורץ בשרת)

צד לקוח (בונה payload):

{{CODE|ConsumptionAnalysis.html|buildExcelPayload}}

{{CODE|ConsumptionAnalysis.html|exportToExcel}}

צד שרת:

{{CODE|code.js|generateConsumptionExcelReport}}

{{CODE|code.js|_applyRedYellowGradient}}

{{CODE|code.js|_buildGradientDataSheet}}

{{CODE|code.js|_buildMonsterSheet}}

#### 4.4.14 API JSON לנייד — 🟡 (לא הורץ בפריסה)

{{CODE|code.js|handleApiRequest}}

{{CODE|code.js|apiCustomerList}}

{{CODE|code.js|setApiKey_oneTime}}

#### 4.4.15 אפליקציית Flutter — 🟡 (לא קומפל)

{{FILE|zip:mobile_app/lib/services/api_service.dart|dart}}

{{FILE|zip:mobile_app/lib/models/customer.dart|dart}}

{{FILE|zip:mobile_app/lib/main.dart|dart}}

עוד קבצים בארכיון: `settings_screen.dart`, `customer_list_screen.dart`, `customer_detail_screen.dart`, `webview_screen.dart`, `pubspec.yaml`, `README.md`.
