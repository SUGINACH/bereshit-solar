# תיעוד טכני והעברת הקשר — מערכת בראשית סולאר

| שדה | ערך |
|---|---|
| תאריך עדכון | 2026-10-07 |
| היקף | כל מה שנבנה, נבדק, נכשל ונפסל בשיחת הפיתוח (כולל החלק שקדם לדחיסת ההקשר) |
| שפת עבודה עם המשתמש | עברית. שמות מזהים בקוד באנגלית. |
| מקורות המסמך | תמלול טרום-דחיסה, השיחה עצמה, ביקורת קוד סטטית של הקבצים שנמסרו, והרצות בדיקה בדפדפן (Playwright) ו-Node |
| קבצי המערכת | ראו סעיף 4.1 |

## תוכן עניינים

1. סקירת המערכת והארכיטקטורה (High-Level Architecture)
2. מכלול המנגנונים והאלגוריתמים שפותחו (Deep Dive Implementation)
3. יומן כישלונות, טעויות וגישות שנפסלו (Mistakes & Failed Approaches)
4. סטטוס קוד נוכחי ורכיבים מוכנים (Current Codebase & Implementation State)
5. מקרי קצה, אבטחה וביצועים (Edge Cases, Security & Performance)
6. מפת דרכים והצעדים הבאים (Roadmap & Pending Tasks)
נספח: מונחון

---

## מקרא סטטוס

| סימן | משמעות |
|---|---|
| ✅ | אומת בהרצה בפועל (דפדפן Chromium מול Mock של `google.script.run`, או Node). לא אומת מול פריסת Apps Script אמיתית אלא אם נכתב אחרת. |
| 🟡 | ממומש. נבדק חלקית, נבדק רק סטטית, או תלוי בסביבת פריסה שלא הייתה זמינה לבדיקה. |
| 🔴 | פגם ידוע, רכיב שלא חובר בפועל, או דרישה שלא מומשה. כל 🔴 ממוספר בסעיף 6.1 עם הוראות תיקון. |

## הסתייגויות יסוד

1. אף קוד Apps Script (`code.js`) לא הורץ בסביבת Apps Script אמיתית. נבדק תחבירית בלבד (`node --check`). כל התנהגות שרת שמתועדת כ-✅ נבדקה באמצעות מקביל בצד לקוח או לא נבדקה כלל.
2. אפליקציית ה-Flutter לא קומפלה ולא הורצה (אין Dart/Flutter SDK בסביבה). נבדק איזון סוגריים וקריאה ידנית בלבד.
3. סעיף 6.1 מכיל פגמים שהתגלו בביקורת הסופית לצורך מסמך זה. חלקם סותרים טענות שנמסרו למשתמש במהלך השיחה (למשל: מילוי נתוני החיוב מקובץ ה-JSON של הטופס, סליידר גדילת צריכה, יחס שטח גג 5.5). המסמך משקף את מצב הקוד בפועל ולא את הטענות הקודמות.

---

## 1. סקירת המערכת והארכיטקטורה (High-Level Architecture)

### 1.1 ייעוד והבעיה שנפתרת

חברה: בראשית סולאר (התקנת מערכות סולאריות). המערכת משלבת CRM, מחולל הצעות מחיר מודפסות וניתוח אנרגטי.

בעיות עסקיות:

1. **הצעת מחיר**: בניית הצעה ללקוח ממחירון ציוד (גיליון `מחירון`), כרטיסי מערכת (מצברים, ממירים, פאנלים, התקנה, תוספות), תמונות, והדפסה כ-A4 (13 עמודי מסמך: cover, summary, intro, why, spec, components, exclusions, warranty, payment, notes, finance, finance-charts, contact).
2. **איסוף נתוני צריכה מהלקוח**: טופס ציבורי (`Form.html`) שמפיק מלאי צרכני חשמל (רמת מכשיר), סוג נכס ונתוני חיוב (`billing`), ומצפין את התוצאה בהצפנה היברידית כך שרק בעל המפתח הפרטי יכול לפענח.
3. **ניתוח צריכה בפועל** מקובץ מונה חח"י (CSV/XLSX, רזולוציית רבע-שעה) לפי תקנות תעו"ז (עונות חורף/מעבר/קיץ, שעות פסגה/שפל, ימי חול/שבת/חג), כולל מונים מרובים (דו-כיווני + ייצור).
4. **המלצת גודל מערכת** (פאנלים + אגירה) בכפוף למגבלות גג/חיבור/תקציב, כולל גיבוי שבת/חג (חשמל כשר).
5. **מודל פיננסי** ל-25 שנה (IRR/NPV, מיסוי, הלוואה, החלפות ציוד) והזנת עמודי הכדאיות בהצעה המודפסת.
6. **גישה ניידת** לאנשי מכירות בשטח (Android, בהמשך iOS) מול אותו גיליון.

אילוצים קשיחים שעיצבו את הארכיטקטורה:

| אילוץ | השפעה |
|---|---|
| תא ב-Google Sheets מוגבל ל-50,000 תווים | קידוד קומפקטי לסדרות שעתיות (סעיף 2.9) |
| Apps Script: 6 דקות ריצה לבקשה, אין מערכת מודולים ל-HtmlService | לוגיקה כבדה בצד לקוח; כפילות קוד בין קבצי HTML (סעיף 1.4) |
| Apps Script Web App תמיד מחזיר HTTP 200 | חוזה ה-API נשען על שדה `ok` בגוף ה-JSON (סעיף 2.16) |
| ספריית SheetJS החינמית אינה כותבת צבעי תא | יצירת Excel מעוצב בצד שרת (סעיף 2.10) |
| תוכן הצעת המחיר המודפסת מחייב ואסור לשינוי עיצובי | עיצוב מאוחד חל על לוח הבקרה בלבד, בעזרת דריסת משתנים מקומית (סעיף 2.13) |
| עברית/RTL | ראו הנחיית ניסוח מספרים בסעיף 2.8 |

### 1.2 טכנולוגיות

| שכבה | טכנולוגיה | תפקיד / הערות |
|---|---|---|
| שרת | Google Apps Script (V8), Web App | `doGet` כנתב; `google.script.run` כ-RPC מהדפים; `ContentService` ל-JSON; `PropertiesService` לסוד; `SpreadsheetApp`, `DriveApp`, `UrlFetchApp`, `ScriptApp.getOAuthToken`, `Utilities` |
| אחסון | Google Sheets | גיליונות: `לקוחות ופרוייקטים` (32 עמודות), `מחירון`, `הגדרות` |
| לקוח | HTML/CSS/JS ללא פריימוורק וללא bundler | סקריפט inline בכל דף. ספריות CDN: PapaParse, SheetJS `xlsx@0.18.5` (cdnjs), Chart.js (jsdelivr, ב-PrintQuote). גופנים: Heebo, Assistant, JetBrains Mono |
| הצפנה | Web Crypto API | RSA-OAEP 2048 / SHA-256 עוטף מפתח AES-256-GCM. מימוש ב-`Form.html` ובכלי הפענוח העצמאי |
| נייד | Flutter (Dart ≥ 3.0) | `http ^1.2.0`, `webview_flutter ^4.7.0`, `shared_preferences ^2.2.2`, `url_launcher ^6.2.5` |
| בדיקות | `node --check`, BeautifulSoup, Playwright (Chromium), openpyxl, Python | ראו סעיף 2.18 |

דפוסי ארכיטקטורה:

- **Page-per-route Web App**: נתב `doGet` לפי פרמטר `page`; כל דף קובץ HTML עצמאי.
- **Pipeline של שלבים עם מסירה מתמידה** (Persisted handoff): שלב n כותב לעמודת גיליון ייעודית, שלב n+1 קורא אותה לפי `clientId`.
- **Partial update**: פונקציות שרת שכותבות עמודות ספציפיות בלבד (סעיף 1.5).
- **Strangler**: `Calculator.html` המקורי נשמר לתאימות (`?page=calculator`) לצד שלושת קבצי השלבים החדשים.
- **Hybrid mobile**: מעטפת Flutter נייטיב (רשימה, חיפוש, ניווט) + WebView לדפים הקיימים. JSON API על אותו `code.js`.
- **Scoped CSS custom properties** לעיצוב לוח הבקרה של PrintQuote בלי לגעת בעיצוב המסמך.
- **Defensive reuse**: קוד שחולץ מקובץ אחד לאחר נשמר עם בדיקות null על אלמנטים של שלבים אחרים.

### 1.3 זרימת נתונים

```
Form.html (לקוח) ──.json.enc──► כלי פענוח (offline, מפתח פרטי) ──► JSON גלוי
                                                                    │ (העלאה ידנית)
Index.html (CRM) ──?page=consumption&clientId=X──► ConsumptionAnalysis ── col 30, col 32
                 ──?page=sizing&clientId=X───────► SystemSizing         ── col 31
                 ──?page=finance&clientId=X──────► FinancialModel       ── col 20-23, col 29
                 ──?page=print&clientId=X────────► PrintQuote (קורא col 29 או localStorage.pendingQuote)
                 ──?page=form&clientId=X─────────► Form (ללקוח)
Flutter ──GET ?api=customers|customer&apiKey=K──► code.js (JSON) ; WebView ──► אותם דפי HTML
                    כולם ◄──► Google Sheet דרך code.js בלבד
```

### 1.4 עקרונות תכנון והפרדת אחריות

| # | עיקרון | נימוק / תוצאה |
|---|---|---|
| P1 | הגיליון הוא מקור האמת היחיד; כל צרכן (דפדפן, מובייל) עובר דרך `code.js` | מניעת כפל מימוש של סכימת 32 העמודות |
| P2 | שלב 1 = "כל נתוני העבר". שלב 2 = הסתכלות קדימה (גודל). שלב 3 = תרגום פיננסי | הגדרת המשתמש; פירוק ערבוב שהיה בקובץ המקורי בין ייצור קיים (עבר) לייצור מערכת מוצעת (עתיד) |
| P3 | מסירה בין שלבים דרך הגיליון; `localStorage` רק כמסלול מהיר | חלונות נפתחים בלשוניות שונות ואין זיכרון משותף אמין |
| P4 | לוגיקה עסקית בצד לקוח; שרת = התמדה + יצירת קבצים מעוצבים | הלוגיקה (לוח עברי, תעריפים) כבר קיימת ונבדקה ב-JS |
| P5 | כפילות מכוונת במקום שיתוף קוד | אין `include` ב-HtmlService. בלוקים מושכפלים בין קבצים: לוח עברי + אסטרונומיה, מנוע תעריפים, `classifyHour`, פרימיטיבים פיננסיים (`pmt`, `npvCalc`, `npvAt`, `irrCalc`), `runFinancialModel` (בשלבים 2 ו-3), פונקציות unpack |
| P6 | תוכן הצעת המחיר (`.page`) לא משתנה | עיצוב מאוחד חל על `.sidebar` בלבד |
| P7 | כתיבות שלב הן עדכון חלקי של עמודות | `saveConsumptionAnalysis` (30,32), `saveSizingRecommendation` (31), `updateCalculatorResults` (20-23,29). חריג: `saveCustomerData` כותב שורה מלאה 1-29 (ראו 🔴 D1) |
| P8 | נתון שנשמר בתא בגיליון חייב להיות ≤ 50,000 תווים | קידוד Uint16+Base64, חלון שנה אחרונה, רשת שעתית |
| P9 | כשמחלצים קוד לקובץ אחר: מוסיפים null-guard לכל `getElementById` של אלמנט מקובץ אחר | חילוץ לפי טווחי שורות שכח תלויות ועקבות |
| P10 | כל מידע בעברית RTL: אין סימן +/- צמוד למספר בטקסט | סימן כזה נצמד בצד הלא נכון בסידור דו-כיווני |

### 1.5 סכימת הגיליון `לקוחות ופרוייקטים`

עמודות 1-28 היו קיימות. עמודות 29-32 נוספו בפיתוח זה (מיגרציות `oneTimeSetup_v3`, `oneTimeSetup_v4`).

| # | כותרת | שדה | הערות |
|---|---|---|---|
| 1 | ID (מזהה) | clientId | מפתח שורה. פורמט `BS-####` |
| 2-5 | שם הלקוח / כתובת / איש קשר / טלפון | clientName, clientAddress, clientContact, clientPhone | |
| 6-14 | כותרת הפרויקט, תאריך, שטח גג, טופס 4, מכסה, מקורות חשמל (JSON), צרכנים (JSON), הספק פאנלים, קיבולת אגירה | projectTitle ... storageCapacity | 11 ו-12 הם JSON |
| 15-19 | מצברים / ממירים / פאנלים / התקנה / תוספות | | Legacy. כפילות מהכרטיסייה הפעילה |
| 20-23 | עלות מערכת / חיסכון שנתי / תשואה / רווח מצטבר | totalPrice, annualSavings, roi, profit25 | נכתבים גם ע"י `updateCalculatorResults` |
| 24 | הערות ניתוח | analysisNotes | |
| 25 | תמונות לקוח (JSON) | clientImages | |
| 26 | רכיבי מערכת (JSON) | systemCards | מערך כרטיסי מערכת |
| 27 | כרטיסייה פעילה | activeCardIndex | |
| 28 | עוצמת ממיר נדרשת | inverterPowerTarget | |
| 29 | נתוני חישוב גולמיים (JSON) | rawCalculatorData | תוצר שלב 3. קלט ל-PrintQuote (עמודי 11-12) |
| 30 | נתוני צריכה מועשרים (JSON) | consumptionAnalysis | תוצר שלב 1. סדרה שעתית ארוזה + מטא-דאטה |
| 31 | המלצת גודל מערכת (JSON) | sizingRecommendation | תוצר שלב 2 |
| 32 | נתוני ייצור מועשרים (JSON) | productionSeries | סדרת ייצור ארוזה (אם נקלטה) |

גיליון `מחירון`: עמודות `קטגוריה / יצרן / דגם / מחיר יחידה (₪) / תמונה` + 10 עמודות מפרט (מידות, הספק, קיבולת, מגבלת הכפלה, מגבלת שרשור, BMS כלול, עוצמה, היברידי, התאמה למערכת, קבוצת התאמה). זיהוי עמודת תמונה דינמי לפי כותרת המכילה `תמונ` / `לוגו` / `image`. ערכי `CellImage` מומרים ל-Base64 (`convertCellImageToBase64`).

גיליון `הגדרות`: רשימות `מקורות חשמל` ו-`צרכנים` (ברירות מחדל בקוד כשהעמודה חסרה).

### 1.6 ניתוב (`doGet`)

| פרמטר | קובץ | שיטת הגשה |
|---|---|---|
| `api=customers` / `api=customer&id=X` (+`apiKey`) | JSON | `handleApiRequest` |
| `page=print&clientId=X` | PrintQuote | `createTemplateFromFile(...).evaluate()` |
| `page=calculator` | Calculator (legacy) | `createHtmlOutputFromFile` |
| `page=consumption` | ConsumptionAnalysis (שלב 1) | `createHtmlOutputFromFile` |
| `page=sizing` | SystemSizing (שלב 2) | `createHtmlOutputFromFile` |
| `page=finance` | FinancialModel (שלב 3) | `createHtmlOutputFromFile` |
| `page=form&clientId=X` | Form | `createTemplateFromFile` (הזרקת שרת) |
| ברירת מחדל | Index | `createHtmlOutputFromFile` |

כל הדפים: `XFrameOptionsMode.ALLOWALL`, meta viewport `width=device-width, initial-scale=1`.

## 2. מכלול המנגנונים והאלגוריתמים שפותחו (Deep Dive Implementation)

### 2.1 פירוק `Calculator.html` המקורי לשלושה שלבים

`Calculator.html` המקורי: 2,897 שורות, סקריפט יחיד, חמישה סעיפי UI ממוספרים. מפת מודולים (מספרי שורות בקובץ הישן):

| טווח שורות | מודול | יעד |
|---|---|---|
| 660-720 | `initTooltips`, `CONSUMPTION_DISTRIBUTION`, `CALC_CONSTANTS` | משוכפל בכל שלושת השלבים |
| 725-758 | `pmt`, `npvCalc`, `npvAt`, `irrCalc` | שלבים 2 (תלות של מנוע ההמלצה) ו-3 |
| 763-1016 | לוח עברי, אסטרונומיה, מנוע תעריף מדרגות, מודאל הגדרות תעריף, `classifyHour`, `computeSeasonalPeakDayCounts` | שלבים 1, 2, 3 |
| 1028-1599 | סינתזה (שנתי/מטריצה), פענוח CSV/XLSX/JSON, סטטיסטיקה, `renderReports`, `exportToExcel` | שלב 1 |
| 1603-1773 | פרטי לקוח, החלפת מצבי קלט צריכה/ייצור | שלב 1 (מצב קלט צריכה בוטל) |
| 1775-1806 | `updateRoofAreaDisplay`, `applySuggestedBattery`, `applySuggestedInverterPower` | שלב 2 (`updateRoofAreaDisplay` לא חולץ, ראו D4) |
| 1807-1855 | חלון "תקופת ניתוח" | שלב 1 (`getTrailingYearWindow`, `detectStepHours`) |
| 1856-2236 | סימולציית אגירה שעתית, `calcBatteryArbitrageRevenue` | שלב 2 (`calcBatteryArbitrageRevenue` נדרש גם בשלב 3) |
| 2240-2442 | `runFinancialModel`, `displayCalcResults` | שלב 3 (+ `runFinancialModel` משוכפל בשלב 2) |
| 2446-2607 | גרף תזרים, דוח סופי, ייצוא | שלב 3 |
| 2615-2712 | `readUrlParamsForQuoteBridge`, `transferDataToQuote` | הוחלפו ב-`saveResultsAndReturnToIndex` |
| 2720-2894 | מנוע המלצה (`findOptimalSystemSize` ועוד) | שלב 2 |

מיפוי סעיפי UI:

| סעיף ישן | תוכן | יעד |
|---|---|---|
| 1 | נתוני צריכה + ייצור קיים + דוחות | שלב 1 |
| תיבת "המלצת גודל" | שטח גג, חיבור, תקציב | שלב 2 (אוחדה עם סעיף 2) |
| 2 | גג ותשתית חשמל, סימולציה | שלב 2 |
| 3 | הלכתי: "מצב עבר" + `estShabbatLoad` | שלב 1 |
| 3 | הלכתי: "תכנון לעתיד" + `generatorCost` | שלב 2 |
| 4 | פיננסי ומיסוי | שלב 3 |
| 5 | דוח סופי | שלב 3 |

החלטות בעלות המוצר (המשתמש) שנקבעו בשיחה:

| # | החלטה | סטטוס מימוש |
|---|---|---|
| H1 | `generatorCost` בשלב 2 | ✅ |
| H2 | איזון משקלים בין שלושה מקורות (JSON טופס, סוג-נכס+סכום שנתי/חודשי, מטריצה ידנית) ללא נתוני עבר לאימות | 🟡 משקלים 0.6/0.4 לא מאומתים (2.4) |
| H3 | השפעת גדילת צריכה על שלב 3 נדחתה; חובה להזכיר בקוד ובממשק | ✅ הערת TODO בקוד + אזהרה בממשק. ראו D3 לגבי השפעת הסליידר על שלב 2 |
| H4 | יחס שטח-גג: שלב 1 = שדה קלט (פאנלים ישנים); שלב 2 = סטנדרט פאנלים מודרניים (5.5 מ"ר/קוו"ט) | 🔴 שלב 1: השדה נשמר אך לא משמש בחישוב (D6). שלב 2: 5.5 מופיע בתוויות בלבד, המנוע משתמש ב-7.5 (D2) |
| H5 | נתוני שבת לפי יום עברי: מ-20 דקות לפני שקיעת שישי עד 40 דקות אחרי שקיעת שבת | ✅ זיהוי. 🔴 מילוי/שימוש בהערכה (D5) |
| H6 | סקשן "צריכה משוערת לשבת" מוצג רק כשסומן "התעלם משבתות חסרות" | ✅ |
| H7 | סליידר תוספת צריכה בשבת: לפי שבוע (ששת ימי החול שקדמו), פרופיל שעתי, תוספת אחוז לכל שעה בנפרד | 🟡 מחושב כממוצע פרופילים על פני שבועות ולא ליישום פר-שבת (D5) |
| H8 | סליידר גדילת צריכה עתידית: שלב 2 בלבד | 🔴 UI בלבד (D3) |
| H9 | נתונים שנשמרים בתא: רק צריכה (וייצור בעמודה נפרדת) שעתית רזה. טבלאות Excel/דוח מועשר לא נשמרים | ✅ |
| H10 | תיקוני החלפת שינוי קידוד נוגעים רק בתא המאוחסן, לא בתצוגה ולא ב-Excel | ✅ |
| H11 | השוואת שנים לפי יחידות שנתיות מיושרות לסוף הנתונים, לא שנים קלנדריות | ✅ |
| H12 | הספק ממיר מחושב גם לפי פיקים מנתוני הצריכה | ✅ |
| H13 | סימולציה/המלצה נעולות ללא נתוני שלב 1 | ✅ |
| H14 | כפתור "מצא גודל מומלץ" אחרי כל השדות המשפיעים; שדה "הספק מבוקש" הפך תוצאה | ✅ (שדה נסתר `calc_targetKw`) |
| H15 | קובץ סימולציה רביעי עצמאי (בלי נתוני שלב 1) | נבחר ע"י המשתמש; לא נבנה; השאלה על ייעודו (הדגמה/מכירה) לא נענתה |
| H16 | אפליקציית מובייל: תוספת (לא תחליף), לאנשי מכירות בשטח, טכנולוגיה לפי המלצה | 🟡 שלד Flutter בלבד |

### 2.2 קליטת נתוני צריכה

ארבעה מקורות נתונים. כל אחד מייצר סדרה `[{date: Date, kwh: Number}]`.

| מפתח | מקור | מנגנון |
|---|---|---|
| `iec` | CSV / XLSX מונה חח"י | `Papa.parse` / `XLSX.read` → `handleParsedRows` → `parseMultimeterRows` → `ingestDataPoint` |
| `json` | JSON מ-`Form.html` (אחרי פענוח) | `handleImportedEstimateFile` (פורמט `bereshit-solar-consumption-data-v1`: אובייקטים `{date,hour,kwh}`; תואם לאחור גם `[iso,kwh]`) |
| `annual` | סך שנתי + סוג נכס | `synthesizeFromAnnualTotal(annualKwh, propertyType, year)` |
| `matrix` | מטריצה ידנית (עונה × פסגה/שפל) | `synthesizeFromMatrix` |

**`parseMultimeterRows`** (פירוט בקוד, סעיף 4.4):

- פורמט שורה: `row[1]` סוג מונה (טקסט), `row[2]` תאריך, `row[3]` שעה, `row[4]` ערך (קוט"ש), `row[5]` הזרמה (למונה דו-כיווני). מינימום 5 עמודות. מספרים מנוקים מ-`"` ומ-`,` (ראו 5.1: פסיק עשרוני).
- סוג מונה: מכיל "דו" ו"כיוונ" → דו-כיווני; "ייצור" → ייצור; "צריכה" → צריכה; אחר → צריכה.
- מפתח צבירה: `Date.getTime()`. כמה מונים באותו חותם-זמן מצטברים במערכים (`netDraw`, `netFeed`, `consMeter`, `prodMeter`) ומחושב **ממוצע** (קריאות כפולות של אותו מונה), לא סכום. אם קיים מונה דו-כיווני באותו חותם-זמן, מוני צריכה נפרדים מתעלמים (`gridDraw = avg(netDraw)`).
- צריכה אמיתית: `consumption = gridDraw + max(0, production − feedIn)`. כשאין מונה דו-כיווני `feedIn = 0` ולכן כל הייצור נחשב כצריכה עצמית (🟡 הנחה; מנפחת צריכה אם יש הזרמה).
- `hasMultipleMeterTypes = true` כשיש יותר מסוג מונה אחד.
- נקודה: `{date, kwh, productionKwh}`. ייצור > 0 בנקודה כלשהי → `window._productionSeries = [{date, kwh: productionKwh}]`.

**סינתזה שנתית**: `CONSUMPTION_DISTRIBUTION[propertyType]` = טבלת התפלגות אמפירית (עונות, שפל/פסגה, חול/סופ"ש). `computeDistributionWeight(date, distRow)` מחזיר משקל שעה. הסכום מנורמל ל-`annualKwh`. תוצר: שנה קלנדרית מלאה ברזולוציה שעתית (8,760 או 8,784 נקודות).

**מטריצה**: ממוצע קוט"ש/שעה לכל שילוב עונה × (פסגה/שפל), מוחל על שנה קלנדרית מלאה.

**צבירות פנימיות**: `ingestDataPoint(date, kwh, hourlyAgg, dailyAgg, dailyTouAgg)` מעדכן שלוש צבירות ומוסיף ל-`globalRawSeries`. `renderReports(hourly, daily, tou)` בונה את שלוש הטבלאות, סטטיסטיקת ימי פסגה (חציון, ממוצע מנוכה 15%, 15% עליונים/תחתונים) ושורת שבת.

### 2.3 מעקב מקורות ורישום לאיחוד

- `sourceResults = {iec, json, annual, matrix}` (כל אחד `null` או `{rawSeries, annualKwh, capturedAt}`).
- **דפוס ההקלטה (Hook, לא שינוי פנימי של המפענחים)**: משתנה `currentImportTag` מוצב לפני פענוח קובץ (`'iec'` ל-CSV/XLSX, `'json'` ל-JSON). בתחילת `renderReports`, אם `currentImportTag` מוגדר → `snapshotSource(tag, globalRawSeries)` ואיפוס התגית. מסלולי `annual` ו-`matrix` קוראים ל-`snapshotSource` מפורשות אחרי `renderReports`.
- `snapshotSource` מעדכן "צ'יפ" סטטוס (`#chip-<tag>`) ומפעיל את כפתור האיחוד (`#unifyBtn`).

### 2.4 מנוע איחוד מקורות (`unifyAllSources`)

עדיפות (ראשון שקיים קובע):

| סדר | תנאי | תוצאה | confidence |
|---|---|---|---|
| 1 | `iec` קיים | הסדרה והסכום של חח"י. מקורות אחרים רק להשוואה | `high` |
| 2 | `json` קיים | הסדרה של ה-JSON | `high` אם יש מקור נוסף, אחרת `medium` |
| 3 | `matrix` + `annual` | מיזוג צורות: `0.6·shape(matrix) + 0.4·shape(annual)`, מוחל על הסכום של המטריצה | `medium` |
| 4 | מקור בודד אחר | הסדרה כמות שהיא + אזהרה | `low` |

- `shape = normalizeShape(series)` = פלח כל נקודה מהסכום (`frac`). `blendShapes([[shape, weight], ...])` משקלל לפי אינדקס (מניח אורך זהה; שני המקורות מיוצרים לאותה שנה ולכן זהים באורכם).
- אזהרה כשסכום שנתי של מקור משני שונה ביותר מ-15% מהמקור הקובע.
- אחרי הבחירה: בנייה מחדש של צבירות דרך `ingestDataPoint`, `globalRawSeries = finalSeries`, `renderReports(...)`, `window._unifiedResult = {finalSeries, confidence, sourcesUsed}`.
- 🟡 המשקלים 0.6/0.4 והסף 15% הם הנחות הנדסיות. המשתמש אישר שאין נתוני עבר לאימות. נדרש כיול מול תיקי לקוח אמיתיים עם יותר ממקור אחד.
- 🔴 אין מיזוג בין `json` ל-`annual`/`matrix` כשאין חח"י (JSON גובר ללא שקלול). זו בחירה, לא באג. אם נדרש מיזוג תלת-מקורי ראו 6.2.
- 🔴 D7: מקור "סוג נכס + שנתי/חודשי" מטופס הלקוח אינו מוזן בפועל (ראו D7).

### 2.5 מנוע תעריפים ועונות

- `classifyHour(date)` → `{season, isPeak}`. עונות: חורף = דצמבר-פברואר; קיץ = יוני-ספטמבר; מעבר = שאר החודשים. פסגה: חורף 17:00-21:59 בכל ימות השבוע (בלי חריגים); קיץ 17:00-22:59 ומעבר 17:00-21:59, רק ביום שאינו שישי/שבת ואינו ברשימת החגים הקשיחה. קוד מלא בסעיף 4.4.
- `CALC_CONSTANTS.tou` = תעריפי פסגה/שפל לעונה (`winter_peak`, `winter_low`, ...). ערכים בסדר גודל 0.4-1.5 ₪/קוט"ש.
- `knownHolidays`: מערך קשיח של תאריכי חג 2020-2030. 🟡 דורש הרחבה/מקור דינמי ב-2030.
- `calcStaircaseTariff(P0, P1, withStorageDiscount)`: תעריף מדרגות לפי הספק קיים P0 והספק כולל P1 (מדרגות t15, t100, t300, t630). מחזיר **מספר** (₪/קוט"ש) או `null` מעל 630 קוו"ט. ערך מאומת בהערת קוד: `P0=0, P1=39, t100=39.36 → 0.426831`; עם הנחת אגירה `×0.95 → 0.41472`. ⚠️ מחזיר `Number`, לא אובייקט (ראו D8).
- `computeSeasonalPeakDayCounts(year)`: מספר ימי פסגה לעונה בשנה (חול, ללא חגים) לצורך ערך אגירה.
- מודאל הגדרות (`openSettingsModal`/`saveTariffSettings`) מעדכן `CALC_CONSTANTS` בזיכרון בלבד (לא נשמר).

### 2.6 לוח עברי ואסטרונומיה

- `hc_g2j`, `hc_j2h`, `hc_isLeap`, `hc_numMonths`, `hc_elapsed`, `hc_delay`, `hc_newYear`, `hc_daysInYear`: המרה גרגוריאני ↔ יום יוליאני ↔ עברי. `toHebrewDate(date)` → `{year, month, day}`.
- `hc_noaa`, `hc_sunEvent(jd0, lat, lon, zenith, rise)`: חישוב זריחה/שקיעה (NOAA). ברירת מחדל: תל אביב `(32.0853, 34.7818)`, זנית `90.78°`.
- `hc_israelDst(Y, M, D)`: שעון קיץ. `tz = 2 + (dst ? 1 : 0)`.
- `estimateSunsetHHMM(date)` → `"HH:MM"` או `'—'` בכישלון. `getSunsetMinutesOfDay(date)` → דקות מחצות; נפילה ל-`18*60` בכישלון.
- ⚠️ קואורדינטות קבועות לכל הלקוחות. סטייה של דקות בין אזורים בארץ. אין מיקום פר-לקוח.
- עיצוב תאריך עברי לטקסט (לטבלת Excel): `hebGematria(n)`, `hebYearGematria(y)`, `formatHebrewDateLabel({year, month, day})`. ✅ נבדק: `21→כ״א`, `15→ט״ו`, `16→ט״ז`, `785→תשפ״ה`, `5785→ה׳תשפ״ה`. 🔴 D13 (אומת בהרצה): שמות החודשים שגויים. `hc_j2h` מחזיר מספר חודש לפי מניין תשרי=1 (שנה פשוטה: אדר=6, ניסן=7, ..., אלול=12; שנה מעוברת: אדר א׳=6, אדר ב׳=7, ניסן=8, ..., אלול=13), ואילו `HEB_MONTH_NAMES[month−1]` מניח סדר קבוע של 14 שמות. תוצאות: `2025-06-17` (כ״א סיוון) מוצג `כ״א ניסן`; `2025-04-13` (ט״ו ניסן) מוצג `ט״ו אדר א׳`; `2024-03-24` (י״ד אדר ב׳) מוצג `י״ד אדר א׳`. נכונים: תשרי עד אדר בשנה פשוטה (`2025-09-23` → `א׳ תשרי ה׳תשפ״ו` ✅, `2025-03-14` → `י״ד אדר ה׳תשפ״ה` ✅). קיבוץ 'יום עברי' בטבלת Excel נשען על התווית ולכן עקבי, אך השמות שגויים. בנוסף התווית נגזרת מתאריך גרגוריאני (חצות), לא מיום עברי שמתחיל בשקיעה.

### 2.7 שבת הלכתית, פרופיל שבועי, ימי חריגה

**חלון שבת**: `getHalachicShabbatWindow(anyDate)`:

1. `dow = date.getDay()`. `daysToFriday = (5 − dow + 7) % 7`. אם `dow === 6` → `−1` (תיקון באג, ראו F11).
2. `friday`, `saturday = friday + 1`.
3. `start = friday 00:00 + (fridaySunsetMin − 20) דקות`. `end = saturday 00:00 + (saturdaySunsetMin + 40) דקות`.
4. `isInHalachicShabbat(date)` = `start ≤ date ≤ end`.

✅ נבדק על 21/06/2025 (שבת): שישי 20/06, שבת 21/06. גבולות: שישי 14:00 לא; שישי 20:30 כן; שבת 14:00 כן; שבת 21:00 לא; ראשון 10:00 לא. סדרה סינתטית ביוני 2025: 4 שבתות, 25 נקודות כל אחת.

**פרופיל שבועי** `computeWeeklyShabbatProfiles(series)`:

- `exceptionDateStrs = detectExceptionDays(series)` (תאריכים).
- לכל נקודה בתוך שבת → מקובצת לפי תאריך שבת: `{saturday, shabbatPoints[]}`.
- לכל שבת: חלון `[start − 6 ימים, start)` ללא נקודות בתוך שבת וללא ימי חריגה → ממוצע לכל שעה (0-23) = `precedingHourlyAvg[h]`. מחזיר גם `excludedExceptionHours`.
- שבת "מלאה" = יותר מ-20 נקודות.

**סליידר תוספת שבת** `onShabbatUpliftChange`: ממוצע `precedingHourlyAvg[h]` על פני כל השבועות → כפל ב-`(1 + pct/100)` לכל שעה → סכום 24 שעות → `estShabbatLoad` (קוט"ש ליום). דוגמת המשתמש: 100 → 115 (שעה 18:00) ו-200 → 230 (שעה 19:00) ב-15%. 🔴 D5: `_shabbatHourlyEstimate` נכתב ואינו נקרא; שבתות חסרות לא ממולאות בסדרה.

**`ignoreMissingShabbat`**: מציג/מסתיר את כרטיס `#estShabbatSection`, נשמר בתא 30, ללא השפעה על חישוב. 🔴 D5.

**ימי חריגה** `detectExceptionDays(series)`:

- חג מהרשימה הקשיחה שנפל על יום שאינו שבת.
- חריגה סטטיסטית: לכל יום-בשבוע, חציון וסטיית חציון מוחלטת (MAD, ברירת מחדל 1 אם 0); חריג אם `|total − median| > 3.5·MAD`. ⚠️ זה שקול ל-modified z-score ≈ 2.36 (הסטנדרט 3.5 דורש `5.19·MAD`). רגיש מהסטנדרט. בקובץ הממשי: 23 ימי חריגה מתוך 731.
- ההשפעה: הוצאה מבסיס "יום חול טיפוסי" בפרופיל השבועי בלבד. לא משפיע על סכומים, תצוגה, Excel או הסדרה השמורה.
- ✅ נבדק: יום מלאכותי עם צריכה כפולה זוהה; 1-2/6/2025 (שבועות) זוהו כחג.

### 2.8 תצוגה מקדימה של קובץ והשוואת שנים

`showFilePreview(points, meta)` מציג בפאנל `#filePreviewPanel`:

1. טווח תאריכים, מספר ימים ורשומות.
2. סוג מונה (חח"י) והודעה על מונים מרובים ושיטת הטיפול (ממוצע לכפילויות; נוסחת צריכה).
3. ייצור שזוהה (סכום).
4. מחסור בנתוני שבת: `computeWeeklyShabbatProfiles` → שבתות עם ≤ 20 נקודות נספרות חלקיות/חסרות.
5. ימי חריגה (עד 6 מוצגים) והסבר ההוצאה.
6. השוואת שנים (להלן).

**השוואת שנים (נוסחה סופית)** (תנאי כניסה: יותר מ-400 ימי נתונים):

```
lastDay   = יום (חצות) של הרשומה האחרונה
bEnd      = lastDay + 1 יום                 (בלעדי)
bStart    = bEnd − שנה                      (תחילת תקופה ב')
aStart    = bStart − שנה                    (תחילת תקופה א')
אם יום-ראשון-בנתונים ≤ aStart:
    sumA, sumB = סכומי kWh בתקופות [aStart,bStart) ו-[bStart,bEnd)
    כיסוי = ימים שנצפו / ימים צפויים בכל תקופה
    אם sumA > 0 וכיסוי ≥ 95% בשתיהן: growth = (sumB − sumA)/sumA·100
    אחרת: הודעת "לא ניתן להשוות" + סיבה
אחרת: הודעה "הנתונים מכסים N ימים - לא מספיק לשתי שנים מלאות"
```

סיווג: `growth > 2` עלייה; `< −2` ירידה; אחרת "ללא שינוי משמעותי (X% בלבד)" (ללא סימן +/−, ראו P10). ✅ נבדק על קובץ בגודל הקובץ הממשי (15/09/2024-15/09/2026, רבע-שעה): תקופות `16/09/2024-15/09/2025` מול `16/09/2025-15/09/2026`; עלייה מזרועה של 10% → `10.0%`; צריכה קבועה → `0.0%`.

### 2.9 קידוד ההתמדה בתאי הגיליון (עמודות 30, 32)

מוגבל ל-**50,000 תווים לתא**. השרת דוחה `consumptionAnalysis` ארוך מ-49,000 תווים (`saveConsumptionAnalysis`).

**צינור השמירה (`saveAndContinueToStage2`)**:

1. `fullSeries = window._unifiedResult.finalSeries` (לא נערך; התצוגה ו-Excel משתמשים בו).
2. `min/max` תאריכים בלולאה (לא `Math.min(...arr)` על 70 אלף איברים).
3. `getTrailingYearDayWindow(min, max)`: מ-00:00 של `(היום האחרון + 1) − שנה` (חסום ל-היום הראשון בנתונים) עד סוף היום האחרון. מיושר לימים שלמים.
4. `aggregateToHourlyGrid(seriesInWindow, start, nDays)`: רשת רציפה `nDays·24`. כל משבצת = סכום kWh של הרשומות בשעה (רבע-שעה → שעה). משבצת בלי נתונים = 0 ונספרת ב-`missingHours`.
5. `chooseScale(sums)`: הקנה הראשון מ-`[1000, 100, 10, 1]` שבו `max·scale ≤ 65535`.
6. `packHourlySeriesToB64(sums, scale)`: `Uint16Array` → בתים → `btoa`.

**סכימת JSON לעמודה 30** (`consumptionAnalysis`):

| שדה | טיפוס | משמעות |
|---|---|---|
| `refYear` | int | שנת היום הראשון ברשת |
| `startISO` | `"YYYY-MM-DD"` | היום הראשון ברשת (חדש; רשומות ישנות בלעדיו) |
| `days` | int | מספר ימים |
| `hoursCount` | int | `days·24` |
| `scale` | int | מחלק לפענוח (ברירת מחדל 1000 בהיעדר) |
| `missingHours` | int | שעות ללא נתונים |
| `valuesB64` | string | Uint16 little-endian Base64 |
| `annualKwh` | float | סכום הרשת (לפני עיגול) |
| `sources` | string[] | מקורות שנוכחו באיחוד |
| `confidence` | `high/medium/low` | |
| `ignoreMissingShabbat` | bool | |
| `estShabbatLoad` | float \| null | קוט"ש ליום שבת |
| `shabbatUpliftPct` | number | |
| `existingProductionKw` | number | |
| `existingRoofRatio` | number | נשמר בלבד (D6) |

עמודה 32 (`productionSeries`): `refYear, startISO, days, hoursCount, scale, missingHours, valuesB64`. אותו חלון תאריכים ואותה רשת, `scale` נפרד.

**פענוח** `unpackB64ToHourlySeries(b64, refYear, startISO, scale)`: תאריך משבצת i = `new Date(y, m, d + floor(i/24), i % 24)` (חשבון לוח-שנה, לא מילישניות, כדי ששעון קיץ לא יסיט תוויות). ללא `startISO`: נפילה ל-1 בינואר של `refYear`. `kwh = value / (scale || 1000)`.

**חישובי גודל**:

| מקרה | ערכים | תווי Base64 |
|---|---|---|
| שנה שעתית | 8,760 | 23,360 |
| שנה מעוברת | 8,784 | 23,424 |
| הכישלון הממשי (שתי שנים × רבע-שעה) | 70,168 | ≈187,115 (+מטא-דאטה = 187,355 כפי שדווח) |
| תוצאת בדיקה אחרי התיקון | 8,760 | `consumptionAnalysis` כ-JSON: 23,664 תווים |

פרישת רזולוציה: סכום kWh ל-4 רבעי שעה = kWh שעתי (אנרגיה אדיטיבית). דיוק Uint16 ב-scale 1000: ±0.5 וואט-שעה לשעה. בבדיקה: הפרש מקסימלי לשעה `5.4e-5` קוט"ש; הפרש שנתי `1.7e-9` קוט"ש.

### 2.10 יצירת קובץ Excel בצד שרת

**ממצא אמפירי** (`xlsx@0.18.5` ב-Node, קריאה חוזרת עם openpyxl): `!merges` ✅ נשמר, `!autofilter` ✅ נשמר, `cell.s.fill`/`font` ❌ לא נכתב (גם עם `cellStyles:true`). מסקנה: גרדיאנט צבעים אפשרי רק בצד שרת.

**זרימה**: `exportToExcel()` (לקוח) → `buildExcelPayload()` → `google.script.run.generateConsumptionExcelReport(JSON)` → שרת: `SpreadsheetApp.create('_temp_export_<uuid>')`, בניית גיליונות, `UrlFetchApp.fetch('.../export?format=xlsx', {Authorization: Bearer ScriptApp.getOAuthToken()})`, `Utilities.base64Encode`, `finally { DriveApp.getFileById(id).setTrashed(true) }` → לקוח מפענח Base64 ל-`Blob` ומוריד.

**גיליונות**: `פירוט שנתי מלא` (טבלה היררכית ממוזגת), `דו"ח שעתי`, `דו"ח יומי מרוכז`, `ימי פסגה בלבד`, `ניתוח סטטיסטי פסגות`, `מקורות נתונים` (חדש), `מבנה תעריפים` (חדש). עמודת ייצור מתווספת כשקיימת.

**טבלת-על ("המפלצתית")** — מבנה היררכי שנלמד מקובץ ייחוס שהועלה (`דוחות_צריכה_חחי_משה_מדן.xlsx`: 6 גיליונות, 8,995 שורות בגיליון הראשי, 4,279 טווחי מיזוג):

עמודות: שנה | צריכה שנתית | תשלום שנתי | עונה | צריכת עונה | תשלום עונתי | תאריך | יום בשבוע | צריכה יומית | תשלום יומי | תאריך עברי | צריכת יום עברי | תשלום יום עברי | שעה | צריכה שעתית | תשלום שעתי | [ייצור שעתי]. ערכי קבוצה מופיעים בשורה הראשונה של כל קבוצה (ממוזגים אנכית). פיצול "שפל:/פסגה:" בטקסט תא.

צבעים: כותרת `#D9E1F2`. שעת שפל `#CCFFCC` / פסגה `#FFCCCC` (עמודות 14-16). גרדיאנט בגיליונות הפשוטים: מינימום `#FFFF99` (צהוב) → מקסימום `#FF6666` (אדום), `setGradientMinpoint/Maxpoint`. מסנן: `createFilter()` על כל טווח. גבולות: `setBorder`. הקפאת כותרת.

מצב: 🟡 לא הורץ מול Apps Script. פגמים מאומתים (ביקורת והרצה של `buildExcelPayload`): D8, D9, D10, D11, D13 (סעיף 6.1).

### 2.11 שלב 2: המלצת גודל מערכת

**קלט וחסימה**: הכפתורים `#findSizeBtn`, `#runHourlySimBtn` מתחילים `disabled` ונפתחים רק לאחר טעינה מוצלחת של עמודה 30 (`globalRawSeries` נטען). אין `clientId` → נשארים חסומים (✅ נבדק).

**מגבלות החיפוש** (`findOptimalSystemSize`):

```
maxByRoof   = roofArea / 7.5          (D2: אמור להיות 5.5)
maxByConn   = connLimit
maxByBudget = budget / capexPV
maxKw       = min(maxByRoof, maxByConn, maxByBudget, 630 − P0)
```

**שלב א (פאנלים בלבד)**: לולאה `kw = min(3, maxKw) .. maxKw` בצעד 1 קוו"ט. לכל מועמד: `tariff = calcStaircaseTariff(P0, P0+kw, false)` (`null` → דילוג), `runFinancialModel(kw, 0, tariff, ...)`. בחירה לפי `irrEquity` (סף תיקו 0.5 נקודות אחוז; בתיקו → `totalProfit` גבוה).

**שלב ב (אגירה, רק אם יש `seasonStats`)**: 

```
gapKwhYear = max(0, bestPv.kw·800 − bestPv.kw·79)
floorKwh   = gapKwhYear / 115
אם גיבוי שבת/חג: floorKwh = max(floorKwh, estShabbatLoad · (חג ? 50 : 25.5))     (D12: יחידות)
typicalPeak = max(trimmed של חורף/קיץ/מעבר מ-computeSeasonPeakStatsFromRawSeries)
ceilKwh   = max(floorKwh·1.2, typicalPeak·1.5, 10)
step      = max(1, round((ceilKwh − floorKwh)/15))
bkwh      ∈ [max(floorKwh,1), ceilKwh] בצעד step → runFinancialModel עם tariffWithStorage (×0.95)
```

`confidence` = `high` כש-`seasonStats` קיים, אחרת `low`. התוצאה ב-`lastRecommendation`. `applyRecommendationToManualFields` כותב `calc_targetKw`, `actualBatteryKwh`.

**המלצות נוספות**:

- `applySuggestedBattery`: ללא גיבוי: `0.75·calc_targetKw`; שבת: `estShabbatLoad·1.2/dod`; שבת+חג: `estShabbatLoad·2.2/dod`.
- `applySuggestedInverterPower`: `max(nominalKwh·cRate, peakKwh·1.15)` כאשר `peakKwh = max(kwh שעתי)` מנתוני שלב 1 (✅ שינוי לפי בקשת המשתמש).

**סימולציית אגירה שעתית** (`runBatteryDispatchSimulation(series, stepHours, usableKwh, rangeStart, rangeEnd, maxRateKw)`): צעד-אחר-צעד על הסדרה בטווח. SOC התחלתי = רזרבת DoD. מחוץ לפסגה (כל שעת שפל, גם ללא צורך): טעינה `min(maxRateKw·stepHours, מקום פנוי)`. בפסגה: `deliverable = min(זמין, maxRateKw·stepHours)·effDischarge`; פריקה = `min(צריכה, deliverable)`; ירידת SOC = `פריקה/effDischarge`. עלות בסיס = `צריכה·תעריף`. עלות עם סוללה = `יבוא·תעריף + (טעינה/effCharge)·תעריף` (הטעינה מתומחרת בתעריף השעה שבה בוצעה). תעריף = `CALC_CONSTANTS.tou[עונה + '_peak' | '_low']`. פלט: `totals` (כולל `batteryArbitrageValue`, `peakCoveragePct`, `annualCycles`), פירוק חודשי, דגימות יומיות. **אינה מדמה ייצור PV, גיבוי שבת או הזרמה.** טווח הסימולציה = כל הסדרה שנטענה משלב 1 (אין בורר תאריכים).

**ממשק**: גדילת צריכה עתידית (`futureGrowthSlider` 0-10%/שנה, צעד 0.5) נשמרת כ-`futureGrowthPct` אך אינה נקראת ע"י המנוע (D3).

**תוצר שמור** (`saveSizingRecommendation`, עמודה 31): `{recommendedPanelsKw, recommendedBatteryKwh, recommendedInverterKw, futureGrowthPct, useStorageShabbat, useStorageHoliday, generatorCost, generatedAt}`.

### 2.12 שלב 3: מודל פיננסי

- `runFinancialModel(capacityKw, batteryUsableKwh, tariffPerKwh, inputs, peakDayCounts, simAnnualValueOverride)`: תזרים 25 שנה.
- מרכיבים מאומתים בקוד: דעיכה לינארית `1 − degradation·(year−1)`; פרמיה אורבנית `CALC_CONSTANTS.urbanPremium` עד `urbanPremiumYears`; החלפות ציוד (`replacements.inverterYear/inverterCostPct`, `batteryYear/batteryCostPct`); הלוואה (`pmt`); מע"מ; חיסכון גנרטור בשבת = `estShabbatLoad × genCost × shabbatCount`; ערך אגירה מ-`calcBatteryArbitrageRevenue` או מ-`simAnnualValueOverride`.
- **מס לאדם פרטי (מודל דו-מסלולי)**: מס = `min(מסלול פטור, מסלול שטוח)`; מסלול פטור: `(taxable − privateTaxExemption)·privateTaxRate` מעל הפטור; מסלול שטוח: `min(taxable, privateTaxFlatCap)·privateTaxRate`. `privateTaxExemption = 27900`, `privateTaxFlatCap = 120000`. 🟡 סכומים לא אומתו מול רו"ח.
- מדדים: `irrCalc` (ניוטון), `npvCalc`, `npvAt`.
- `calcBtn` → `globalSimulationData = {pvOnly, withBat, inputs, reportYear, simPeriod}` → `displayCalcResults` → גרף תזרים → דוח סופי.
- שדות נסתרים נטענים מעמודה 31: `calc_targetKw`, `actualBatteryKwh`, `useStorageShabbat/Holiday`, `generatorCost`; `estShabbatLoad` מעמודה 30. ללא עמודה 31 → `calcBtn` חסום.
- שמירה (`saveResultsAndReturnToIndex`): `updateCalculatorResults({clientId, totalPrice, annualSavings, roi, profit25, rawCalculatorData})`. סכימת `rawCalculatorData` (חוזה מול PrintQuote):

```json
{
  "withBat": {"capacity": 0, "batKwh": 0, "totalProfit": 0, "irr": "0.0", "capex": 0, "equity": 0},
  "inputs": {"roofArea": "0", "useStorageShabbat": false, "useStorageHoliday": false},
  "rawAssumptions": {"weightedTariff": 0, "yieldPerKwp": 0, "degradationPct": 0, "urbanEligible": true,
    "urbanPremium": 0, "urbanYears": 0, "opexPerKwp": 0, "batteryAnnualValue0": 0, "batteryCapex": 0,
    "batteryDegradationPct": 2.2, "loanPct": 0, "loanRatePct": 0, "loanYears": 0, "discountRatePct": 0},
  "clientId": "BS-0000", "source": "financial-model-stage3", "transferredAt": "ISO"
}
```

- 🔴 D2: `roofArea` בדוח הסופי (`scenario.capacity * 7.5`, FinancialModel 967) לעומת `roofArea` ב-payload (`*5.5`).

### 2.13 הצעת מחיר מודפסת ולוח בקרה (`PrintQuote.html`)

- מבנה: `.sidebar.no-print` (לוח בקרה, שורות 200-603) מול 13 דפי `.page` (המסמך). `@media print` מסתיר את הסיידבר.
- **עיצוב מאוחד ללוח הבקרה בלבד**: בלוק `.sidebar { --blue:...; --blue-dark:...; --brand-blue:...; --teal:...; --border:...; --bg-row:...; --text:...; --text-light:...; --white:...; font-family: Heebo,... }` דורס משתנים **מקומית**. כל `var(--blue)` מוטבע (inline) בתוך הסיידבר עוקב אוטומטית; המסמך (מחוץ ל-`.sidebar`) נשאר על ערכי `:root` המקוריים. כללי `details/summary/.form-group/.item-toggle-list/.toggle-row/.btn-add-item/.btn-print/.btn-clear-sig` הוגבלו ל-`.sidebar ...`.
- לא נגע: `.sig-fill-line`, `.sig-pads-row`, `.sig-pad-wrap`, `.sig-pad-label`, `.sig-pad`, `.contact-details` (שייכים למסמך, שורות 1100-1110).
- ADMIN_MODE (`window.ADMIN_MODE`, מופעל ע"י כלי עריכת תבנית): אלמנטים מוזרקים עם סגנון inline קשיח. שונו: `#admin-master-panel` (רקע `#FDF3DE`, גבול `#F39C12`) ו-`.admin-systype-select` (גבול `#F39C12`, צבע `#12283F`). השאר נשאר (הדרישה בנתונים: `rgba(255,255,255,0.15)` נשאר תואם).
- אימות: צבעים מחושבים של אלמנטי מסמך זהים לקובץ המקורי (רקע עמוד, צבע פרטי קשר `rgb(85,85,85)`, תווית חתימה `rgb(0,90,112)`, גופן `Assistant`); הסיידבר השתנה (גרדיאנט `rgb(243,156,18)`, גופן Heebo).
- שליפת נתונים: `window.onload` פוצל ל-`finalizeQuoteInit` + `applyQuoteData` + `mapServerCustomerToQuoteData`. אם `localStorage.pendingQuote` ריק → `getCustomerData(clientId מה-URL)`.

### 2.14 הטופס, ההצפנה וכלי הפענוח

- `Form.html`: `RSA_PUBLIC_KEY_B64` (SPKI) בשורה 1484. הצפנה: AES-256-GCM (`generateKey`), `iv` אקראי, מפתח AES גולמי עטוף ב-RSA-OAEP. פלט `.json.enc`: `{alg: 'RSA-OAEP-2048-SHA256+AES-256-GCM', encryptedKey, iv, ciphertext, ...}`.
- כלי פענוח עצמאי (`כלי_פענוח_טופס_בראשית_סולאר.html`, offline): `loadPrivateKey` (PKCS8/PEM, מפתח רק בזיכרון), `generateNewKeyPair` (RSA-OAEP 2048 SHA-256 + הורדת PEM), `decryptFile`, `renderSummary`, `downloadPlainJson`, `downloadPrivateKey`. אם נוצר זוג חדש חובה להחליף `RSA_PUBLIC_KEY_B64` ב-`Form.html`.
- שליפת לקוח בטופס: `tryLoadClientFromAppsScript` משתמש ב-`google.script.url.getLocation` (עם נפילה). `fetchCustomerData` תוקן: מפתחות עבריים של הגיליון (`data['שם הלקוח']`) ולא מפתחות אנגליים.
- מבנה `billing` בטופס: `{annualKwh, annualNis, monthly: [{month: 1..12, kwh, nis}]}`. `client.propertyType`.

### 2.15 מערכת עיצוב אחידה

```css
--navy:#12283F; --navy-2:#1A3A5F; --navy-3:#2454A0;
--orange:#F39C12; --orange-2:#D9820A;
--green:#1E8449; --green-bg:#E9F7EF; --red:#C0392B; --red-bg:#FBEAE8;
--sky:#2C7DA0; --sky-bg:#E3F2F8; --paper:#F0F3F8; --card:#FFFFFF;
--font:'Heebo','Assistant',sans-serif; --font-mono:'JetBrains Mono',monospace;
--shadow-sm:0 1px 3px rgba(18,40,63,.08); --shadow-md:0 10px 30px rgba(18,40,63,.16);
--radius:16px; --radius-sm:10px;
```

כותרת עליונה: גרדיאנט רדיאלי navy + זוהר כתום, "☀️ בראשית סולאר" + תג שלב, כפתורי pill (`border-radius:999px`). מספרים ב-`JetBrains Mono`. אומת בדפדפן: אין גלישה אופקית; גופן, צבעי כפתור/כותרת, רדיוס וצל מחושבים תואמים לטוקנים.

### 2.16 API לנייד ואפליקציית Flutter

**חוזה JSON** (`doGet?api=...`):

| בקשה | תשובה |
|---|---|
| `?api=customers&apiKey=K` | `{ok:true, customers:[{clientId, clientName, clientAddress, clientPhone, projectTitle, hasStage1, hasStage2, hasStage3}]}` |
| `?api=customer&id=X&apiKey=K` | `{ok:true, customer:<תוצאת getCustomerData>}` |
| שגיאה | `{ok:false, error:"..."}` עם HTTP 200 |

- אימות: `apiKey` מושווה ל-`PropertiesService.getScriptProperties().getProperty('MOBILE_API_KEY')`. הגדרה: `setApiKey_oneTime()` (מחליפים את המחרוזת בקוד לפני הרצה).
- Apps Script אינו מאפשר קוד סטטוס HTTP מותאם ואינו חושף כותרות בקשה ל-`doGet`. לכן: `ok` בגוף ו-`apiKey` בפרמטר URL.
- `apiCustomerList` מחזיר דגלי `hasStageN` לפי תוכן תא (ללא JSON כבד).

**מבנה אפליקציה** (ארכיון `bereshit_solar_mobile_app.zip`):

| קובץ | תפקיד |
|---|---|
| `lib/main.dart` | `_StartupGate`: בדיקת הגדרות; ללא הגדרות → `SettingsScreen`, אחרת `CustomerListScreen` |
| `lib/models/customer.dart` | `Customer.fromJson`, `nextStageLabel` |
| `lib/services/api_service.dart` | `ApiService` (`SharedPreferences`: `webAppUrl`, `apiKey`), `fetchCustomers`, `fetchCustomerDetail`, `ApiException`; בדיקת `body['ok']` ולא סטטוס HTTP |
| `lib/screens/settings_screen.dart` | הזנת URL + מפתח, בדיקת חיבור מיידית |
| `lib/screens/customer_list_screen.dart` | רשימה + חיפוש (שם/מזהה/טלפון), צבע לפי שלב |
| `lib/screens/customer_detail_screen.dart` | פרטים + כפתור המשך מותנה (אותה לוגיקה כמו `renderStageButtons`) |
| `lib/screens/webview_screen.dart` | `WebViewController`, `JavaScriptMode.unrestricted`, `RTL` |

ארכיטקטורה: מעטפת נייטיב לרשימה/חיפוש/סטטוס; מסכי הקלט והחישוב נפתחים כ-WebView על אותם דפי HTML (בלי שכפול לוגיקה ב-Dart). כל המסכים עטופים ב-`Directionality(rtl)`.

### 2.17 זיהוי `clientId` בדפי השלבים

- בעיה שדווחה בפריסה אמיתית: "לא נמצא מזהה לקוח" למרות `clientId` ב-URL.
- הנחת עבודה: `window.location.search` אינו אמין בדפים שמוגשים ע"י Apps Script. פתרון: `google.script.url.getLocation(cb)` (אותו API ש-`Form.html` השתמש בו מלכתחילה), עם נפילה ל-`URLSearchParams`.
- מימוש: `initClientIdAndBootstrap` (שלב 1), `initClientIdAndBootstrap2` + `bootstrapStage2` (שלב 2), `initClientIdAndBootstrap3` + `bootstrapStage3` (שלב 3). `clientIdSN` הוא `let` שמתמלא אסינכרונית.
- ✅ נבדק עם Mock: `getLocation` מחזיר מזהה → נקלט; `getLocation` ריק + `?clientId` ב-URL → נפילה תקינה; שניהם ריקים → ריק.
- 🟡 הסבר הסיבה אינו מאומת. עדות עקיפה בלבד: אחרי התיקון המשתמש קיבל הודעת שרת (אורך תא), כלומר הבדיקה בצד לקוח עברה.

### 2.18 תשתית בדיקות

- **Mock של `google.script.run`**: `Object.defineProperty(window.google.script, 'run', {get: () => make()})` — מחזיר runner טרי בכל גישה (כמו בפריסה אמיתית). `getCustomerData` קורא `window.__MOCK_CUSTOMER`. `getWebAppUrl` לא קורא ל-callback כדי למנוע ניווט באמצע בדיקה. `google.script.url.getLocation` מוזרק כווריאנט.
- **נתוני בדיקה מייצגים**: סדרה סינתטית ברזולוציית רבע-שעה של 731 ימים (15/09/2024-15/09/2026, 70,176 נקודות) — בדיוק צורת הקובץ שהמשתמש העלה.
- **בדיקות איתור**: חילוץ פונקציות לפי התאמת סוגריים (במקום `eval` של כל הסקריפט) ובדיקת ריצה בבידוד ב-Node.
- **בדיקת מבנה**: BeautifulSoup (קיום IDs, ספירת כפילויות), `node --check` על כל בלוק `<script>`, בדיקת IDs ב-JS מול HTML (מייצר false-positive לאלמנטים שנוצרים דינמית, למשל `staleSimWarning`).

| בדיקה | תוצאה |
|---|---|
| סינתזה שנתית 9000 קוט"ש + מטריצה 1.5 → איחוד | 2 מקורות, `medium`, מטריצה 13,140 קוט"ש ✅ |
| סליידר שבת 30% על ממוצע 40.1 | 52.2 קוט"ש ✅ |
| אריזה/פענוח 8,760 שעות | 23,360 תווים, סטייה 0.007% ✅ |
| חלון שבת הלכתי (21/06/2025) | ✅ אחרי תיקון (F11) |
| זיהוי ימי חריגה | ✅ |
| שמירת קובץ דו-שנתי רבע-שעה | JSON 23,664 תווים, 8,760 שעות, `startISO=2025-09-16`, סדרה מלאה לא שונתה (70,176) ✅ |
| עומס שעתי מעל 65.5 קוט"ש | `scale=100`, שגיאה ≤ 0.0042 קוט"ש ✅ |
| 2 ימים חסרים בשנה | `missingHours=48` ✅ |
| טעינת שלב 1 (resume), שלב 2, שלב 3 מהסדרה הארוזה | תאריכים נכונים (16/09/2025-15/09/2026) ✅; המלצת שלב 2 רצה ✅ |
| מצב 4 כפתורי שלב ב-Index | ✅ |
| `buildExcelPayload`: 8,760 נק' / 70,176 נק' | 71ms / 341ms; 2.78MB / 20.7MB JSON ✅ (הרצה בלבד, ללא שרת) |

## 3. יומן כישלונות, טעויות וגישות שנפסלו (Mistakes & Failed Approaches)

מבנה כל רשומה: **הגישה** (הצעה ראשונית) | **הכישלון** (תרחיש/מקרה קצה) | **הוכחה** (איך הוכח) | **מסקנה** (למה אסור לחזור).

### 3.1 טעויות וגישות שנפסלו, לפי סדר כרונולוגי

#### חלק א: לפני דחיסת ההקשר

**F1 — תכנית השלמה על סמך מסמכי אפיון/ביקורת**
- הגישה: רשימת "פערים פתוחים" נגזרה ממסמכי האפיון והביקורת שהועלו.
- הכישלון: מסמכים הכילו פערים שכבר נסגרו בקוד, ופערים שלא תוארו.
- הוכחה: הצלבה שורה-אחר-שורה מול הקוד בפועל.
- מסקנה: מסמכים הם טענות. אמת = הקוד. לקרוא את הקוד לפני תכנון.

**F2 — מודל מס לאדם פרטי במסלול יחיד**
- הגישה: נוסחת מס בודדת בקובץ המחשבון.
- הכישלון: האפיון דורש שני מסלולים (פטור מול 10% שטוח עד תקרה). מסלול יחיד מעריך מס לא נכון.
- הוכחה: השוואת האפיון לקוד.
- מסקנה: מס = `min(מסלול פטור, מסלול שטוח)`. נוסף `privateTaxFlatCap: 120000`. 🟡 `privateTaxExemption: 27900` ו-`120000` לא אומתו מול רו"ח.

**F3 — פורמט JSON של טופס הלקוח**
- הגישה: `handleImportedEstimateFile` ציפה לפורמט ישן (`fileType` + זוגות `[iso,kwh]`).
- הכישלון: הפורמט האמיתי הוא `bereshit-solar-consumption-data-v1` עם אובייקטים `{date,hour,kwh}`. ייבוא נכשל/התעוות.
- הוכחה: קריאת מבנה הפלט של `Form.html`.
- מסקנה: מימוש תומך בשני הפורמטים.

**F4 — טעינת כרטיסי מערכת ב-`selectCustomer`**
- הגישה: בדיקה `Array.isArray(...)` על ערך העמודה.
- הכישלון: `getDisplayValues()` מחזיר מחרוזות. `systemCards` מגיע כמחרוזת JSON, לא כמערך. הכרטיסים לא נטענו אף פעם.
- הוכחה: מעקב אחר זרימת הנתונים מ-`getInitialData`.
- מסקנה: `JSON.parse` מפורש בצד לקוח לכל עמודת JSON. נתוני גיליון הם מחרוזות.

**F5 — `fetchCustomerData` ב-`Form.html`**
- הגישה: קריאת שדות באנגלית (`data.name`).
- הכישלון: השרת מחזיר מפתחות עבריים (כותרות הגיליון). הודעת "נטען ✓" הוצגה עם שדות ריקים (הצלחה שקרית).
- הוכחה: השוואת מפתחות ב-`getCustomerData` מול הצרכן.
- מסקנה: מפתחות עבריים. לוודא תוכן לפני הצגת הצלחה.

**F6 — מסירת תוצאות בין חלונות רק דרך `localStorage`**
- הגישה: המחשבון כתב `pendingQuote` ל-`localStorage`, Index/PrintQuote קראו משם.
- הכישלון: חלון/כרטיסייה/מכשיר/מקור (origin) אחר = אין נתונים.
- הוכחה: ניתוח זרימה בין דפים בפריסת Apps Script.
- מסקנה: מסירה דרך הגיליון (`updateCalculatorResults`, `getCustomerData`). `localStorage` רק כמסלול מהיר.

**F7 — אימות עיצוב ויזואלי בעזרת צילומי מסך**
- הגישה: הצגת צילומי מסך (Playwright) ובדיקה בעין.
- הכישלון: ערוץ התמונות לא החזיר תוכן תמונה בסביבה.
- הוכחה: הקבצים נוצרו בגודל סביר אך לא נצפו.
- מסקנה: אימות תכנותי: `getComputedStyle` על אלמנטים מפתח, זיהוי גלישה אופקית (`scrollWidth > clientWidth`), טוקנים. שגיאות 403 מ-CDN בסביבת הבדיקה הן חסימת רשת, לא באג.

**F8 — עיצוב מחדש של "כל מה שבבלוק SIDEBAR CONTROLS"**
- הגישה: להחליף את כל כללי ה-CSS שמתחת להערה `SIDEBAR CONTROLS`.
- הכישלון: הבלוק כולל `.sig-pad`, `.sig-pad-label`, `.sig-fill-line`, `.sig-pads-row`, `.sig-pad-wrap` שמשמשים את עמוד החתימה בהצעה המודפסת. `.btn-clear-sig` הוא כן בסיידבר.
- הוכחה: חיפוש שימושים בשורות 1100-1110 מול 468-469.
- מסקנה: הגדרת שייכות לפי מיקום ב-HTML (שורות), לא לפי קרבה ב-CSS. אומת בהשוואת צבעים מחושבים של המסמך מול הקובץ המקורי.

**F9 — דריסת סגנונות inline של ADMIN_MODE באמצעות CSS**
- הגישה: כללי CSS על `.admin-*`.
- הכישלון: `element.style.* = ...` ב-JS גובר על גיליון סגנונות. הפתרון הנקי דורש `!important` או רפקטור רחב של JS.
- הוכחה: קריאת `injectAdminRowControls`/`injectAdminPanel`.
- מסקנה: שונו ישירות שני ערכי hex בלבד (`#admin-master-panel`, `.admin-systype-select`). שאר ה-hex תואמים פלטה. אין רפקטור.

**F10 — בדיקת פונקציות שבת ב-Node ע"י `eval` של כל הסקריפט**
- הגישה: `eval` לכל הסקריפט עם הסרת מאזיני DOM באמצעות regex.
- הכישלון: `SyntaxError` (שרידי תחביר מהסרה).
- הוכחה: ריצה נכשלה.
- מסקנה: חילוץ פונקציות מסוימות לפי התאמת סוגריים (`match_brace`) והרצתן בבידוד.

**F11 — באג בחלון שבת: קלט יום שבת**
- הגישה: `daysToFriday = (5 − dow + 7) % 7`.
- הכישלון: עבור `dow = 6` מחזיר `+6` (שישי של שבוע הבא) במקום `−1`.
- הוכחה: בדיקה על 21/06/2025 (שבת): הוחזר שישי 27/06 ושבת 28/06.
- מסקנה: `if (dow === 6) daysToFriday = −1`. לבדוק קלטי קצה לכל יום-בשבוע.

**F12 — סכימת שמירה v1: JSON מילולי עם סדרה שעתית ופירוטים**
- הגישה: עמודה 30 = `{mergedHourlySeries (8,760 אובייקטים), tariffBreakdown, dailySummary, monthlySummary, ...}`.
- הכישלון: ~45 תווים לנקודה × 8,760 ≈ 394,000 תווים. תקרת תא 50,000.
- הוכחה: חישוב; הערת המשתמש.
- מסקנה: קידוד Uint16+Base64 (23,360 תווים/שנה). טבלאות ודוחות מועשרים אינם נשמרים בגיליון (נוצרים בדפדפן/שרת לפי דרישה).

**F13 — עיצוב Excel בצד לקוח (SheetJS)**
- הגישה: `cell.s = {fill, font}` + `cellStyles:true` + `!autofilter`.
- הכישלון: הספריה החינמית מקבלת את ההגדרה בשקט ולא כותבת fill/font.
- הוכחה: כתיבת קובץ בדיקה ב-Node (`xlsx@0.18.5`) וקריאה חוזרת ב-openpyxl: `fill=00000000`, `bold=False`; `merges` ו-`autofilter` נשמרו.
- מסקנה: גרדיאנט וצבעים רק בצד שרת (עיצוב מותנה של Sheets + ייצוא). לא להסתמך על "הגדרה התקבלה" ללא קריאה חוזרת.

**F14 — מאזינים כפולים לכפתורי המקורות**
- הגישה: הוספת `addEventListener` חדשים ל-`synthesizeAnnualBtn`/`synthesizeMatrixBtn`.
- הכישלון: המאזינים המקוריים כבר חולצו עם הקוד. כל לחיצה הפעילה שניים (כפל חישוב/רינדור).
- הוכחה: `grep` ל-`addEventListener` על אותם מזהים.
- מסקנה: הוסרו. שילוב דרך `renderReports` + `currentImportTag`. לבדוק קיום מאזינים לפני הוספה.

**F15 — העברת פרמטר `sourceTag` דרך כל המפענחים**
- הגישה: שינוי חתימות `handleParsedRows`, `handleImportedEstimateFile`, `renderReports`.
- הכישלון (נפסל מראש): מערב ~1,000 שורות לוגיקה ללא כיסוי בדיקות.
- מסקנה: משתנה גלובלי `currentImportTag` + `snapshotSource` ב-`renderReports` (נקודת התערבות אחת).

**F16 — תקלות עריכה ב-HTML (4 אירועים)**
- הגישה: `str_replace` עם עוגנים חופפים.
- הכישלון: (א) נמחק `<div id="consModeMatrix">` הפותח ונוצר `fileParseError` כפול; (ב) נמחקה כותרת `<h2>` של סקשן שבת; (ג) נמחקה שורת ההצהרה `function computeSeasonPeakStatsFromRawSeries(){` (פעמיים, כש-`new_str` לא כלל את שורת העוגן); (ד) נמחקה הערת כותרת.
- הוכחה: BeautifulSoup (ספירת IDs, כפילויות), `grep`.
- מסקנה: `new_str` חייב לכלול מחדש את שורות העוגן. אחרי כל עריכה: BeautifulSoup + `node --check`. להעדיף סקריפט Python אטומי עם `assert count == 1`.

**F17 — גבולות חילוץ**
- הגישה: חילוץ בלוקי קוד לפי טווחי שורות מהקובץ הישן.
- הכישלון: (א) שורה 660 (`<script>`) נכללה; (ב) חילוץ שלב 2 כלל קריאה סופית `readUrlParamsForQuoteBridge();` (שייכת לגשר הישן); (ג) תלויות עקיפות נשכחו (F18-F19).
- הוכחה: `node --check`, הרצה.
- מסקנה: אימות גבולות בקריאת שורות ראשונה/אחרונה של כל בלוק, והרצת הדף.

**F18 — הנחה ש"מנוע ההמלצה" הוא חישוב גודל טהור**
- הגישה: שלב 2 בלי מנוע פיננסי (הפיננסי = שלב 3).
- הכישלון: `findOptimalSystemSize` קורא ל-`runFinancialModel` לכל מועמד.
- הוכחה: `grep runFinancialModel` בקובץ שלב 2.
- מסקנה: הועתק מנוע פיננסי לשלב 2 עם ערכי ברירת מחדל נסתרים (`<details>` מכווץ) לדירוג בלבד. נדחה: פונקציית דירוג מפושטת (משנה התנהגות מבוקרת).

**F19 — תלויות שנחשפו רק בזמן ריצה**
- הגישה: בדיקת IDs סטטית (regex `getElementById` מול `id=`) + `node --check`.
- הכישלון: חסרו `calculateMedian`, `calculateTrimmedMean` (שלב 2), `applySuggestedBattery`/`applySuggestedInverterPower` (קראו מ-`onclick`, מעולם לא חולצו), `calcBatteryArbitrageRevenue` (שלב 3), והגלובלים `globalRawSeries`, `globalHourlySimResult`, `globalSimulationData` (שלב 3). שגיאה ראשונה בטיפול `calcBtn` מנעה השמה של `globalSimulationData`, ולכן שגיאה שנייה הייתה תוצאה של הראשונה.
- הוכחה: Playwright: `X is not defined` בכל מקרה. בדיקת ה-ID סימנה `staleSimWarning` (נוצר דינמית) כ-false-positive.
- מסקנה: להריץ את הדף עם נתונים בצורה אמיתית. לטפל בשגיאה **הראשונה**. בדיקת IDs סטטית אינה מספיקה.

**F20 — הרכבת HTML בהוספות רצופות**
- הגישה: `cat >>` של בלוקים; `</body></html>` נוסף לפני בלוק הסקריפט.
- הכישלון: הסקריפט הוצב מחוץ ל-`<body>`/`<html>`.
- הוכחה: `grep -n '</body>\|<script>'`.
- מסקנה: תגי סגירה נוספים אחרון בלבד.

**F21 — גרש עברי במחרוזת JS**
- הגישה: `'... (ר' הבאנר ...)'`.
- הכישלון: `ר'` סוגר את המחרוזת. `SyntaxError: Unexpected identifier`.
- הוכחה: `node --check`.
- מסקנה: מחרוזות עם קיצורים עבריים במירכאות כפולות או בלי גרש.

**F22 — פריסת שלב 2 הראשונה (ביקורת המשתמש)**
- הגישה: (א) כפתור "מצא גודל מומלץ" לפני השדות המשפיעים (תשתית, ייעוד אגירה); (ב) תיבת המלצה וסעיף תשתית נפרדים; (ג) שדה "הספק מבוקש" ידני; (ד) מחשבון תפוקה לטווח תאריכים ("חשב הערכה פשוטה"); (ה) `estShabbatLoad` כשדה ניתן לעריכה; (ו) ממיר לפי 0.2C בלבד; (ז) סימולציה זמינה בלי נתוני שלב 1.
- הכישלון: סדר לוגי שגוי (הכפתור לפני הקלטים), כפילות (הספק מבוקש מול המלצה), תכונה מיותרת (נתונים אמיתיים זמינים), כפילות מול שלב 1, ממיר בלי דרישת שיא, סימולציה בלי עיגון בנתונים.
- הוכחה: ביקורת המשתמש + בדיקת הקוד.
- מסקנה: מומש מחדש (H12, H13, H14). שדה `estShabbatLoad` לקריאה בלבד.

**F23 — `applySimResultsToCalculator` לחץ על כפתור שאינו קיים**
- הגישה: שימוש חוזר בפונקציה (`calcBtn.click()`).
- הכישלון: `calcBtn` שייך לארכיטקטורה הישנה.
- מסקנה: הפונקציה אישרה בחירה וגללה לכפתור "המשך לשלב 3".

**F24 — פרשנות שגויה של תוצאות בדיקה (4 אירועים)**
- (א) `get_attribute('disabled')` החזיר `None` בטעינה (תזמון). בדיקה נכונה: `element.disabled` בתרחיש בלי `clientId` → `true`.
- (ב) `roofAreaDisplay` הציג `-` ופורש כ"התנהגות נכונה לפני החלה". בפועל `updateRoofAreaDisplay` מעולם לא חולצה (D4).
- (ג) ניווט ל-URL של Mock גרם לפסק זמן. נפתר: `getWebAppUrl` ללא callback.
- (ד) הזרקת Mock לפני `</head>` נכשלה בשקט כי בדפי השלבים אין תג `</head>`. הוזרק לפני `<body>`.
- מסקנה: להשוות תוצאה לציפייה מפורשת. לא להניח "נכון" בדיעבד.

**F25 — קוד סטטוס HTTP מותאם ב-API**
- הגישה: `jsonResponse(obj, 401/404/500)`.
- הכישלון: Apps Script Web App אינו תומך בקוד סטטוס מותאם; התגובה תמיד 200. הפרמטר נתעלם.
- מסקנה: `ok` בגוף ה-JSON הוא החוזה. לקוח Flutter בודק `body['ok']`. הוסר הפרמטר.

**F26 — תחביר Dart**
- הגישה: `_stageButton(ctx, label, color, textColor: c, () => ...)`.
- הכישלון: ארגומנט מיקומי אחרי ארגומנט עם שם אינו חוקי. תוקן. 
- הוכחה: קריאה ידנית; אין קומפיילר בסביבה.
- מסקנה: 🟡 הקוד לא קומפל. להריץ `flutter analyze` לפני כל דבר אחר.

**F27 — קריאת `clientId` מ-`window.location.search`**
- הגישה: `new URLSearchParams(window.location.search).get('clientId')` בשלבים 1-3.
- הכישלון (דיווח משתמש בפריסה): "לא נמצא מזהה לקוח" למרות שהמזהה מופיע בשורת הכתובת.
- הוכחה: דיווח משתמש. אין שחזור מקומי. `Form.html` (קוד קודם) כבר השתמש ב-`google.script.url.getLocation`.
- מסקנה: `google.script.url.getLocation` + נפילה. אתחול אסינכרוני. 🟡 סיבת שורש לא מאומתת.

**F28 — השוואת שנים לפי שנה קלנדרית**
- הגישה: סכימה לפי `getFullYear()` והשוואת שתי השנים האחרונות.
- הכישלון: 2025 מלאה מול 2026 עד 15/09 → "ירידה של 31.1%" כוזבת.
- הוכחה: דיווח משתמש עם הנתונים (85,553 מול 58,961).
- מסקנה: שתי יחידות שנתיות שלמות מיושרות לסוף הנתונים. דרישת כיסוי 95%. אסור להשוות תקופות באורך שונה.

**F29 — שמירה לגיליון: קובץ דו-שנתי ברזולוציית רבע-שעה**
- הגישה: אריזת `finalSeries` המלא.
- הכישלון: 70,168 ערכים × 2 בתים → 187,115 תווי Base64 (187,355 עם מטא-דאטה). חריגה פי 3.7 מהתקרה.
- הוכחה: הודעת השרת של המשתמש; חישוב; שחזור (23,664 תווים אחרי תיקון).
- מסקנה: חלון שנה אחרונה מיושר לימים + רשת שעתית. שני כשלים נוספים התגלו באותו מעבר: (א) `unpack` הניח התחלה ב-1 בינואר (היה מסיט עונות בשלבים 2-3); (ב) חיתוך ב-Uint16 שקט מעל 65.5 קוט"ש/שעה. תוקנו (`startISO`, `scale`).

**F30 — גרסת ביניים שנפסלה לתיקון F29**
- הגישה: חיתוך לשנה אחרונה בעזרת `getTrailingYearWindow` (עם שעת-יום של הרשומה האחרונה) בלבד.
- הכישלון: (א) גבול שנקבע לפי שעה (למשל 16/09 23:00) מוריד 23 שעות מהיום הראשון; (ב) ברזולוציית רבע-שעה עדיין 35,040 ערכים → ~93,440 תווים (>50,000).
- מסקנה: חלון ברמת יום + צבירה שעתית.

**F31 — `Math.min(...arr)` על סדרה גדולה**
- הגישה: `Math.min(...fullDates)` על 70,176 איברים.
- הכישלון: סיכון `RangeError` (מגבלת ארגומנטים) בקבצים גדולים יותר.
- מסקנה: לולאה. (בשלב 2 נשארו שימושים על ≤ 8,784 איברים: `Math.max(...globalRawSeries.map(...))`, `Math.min(...sortedDates)`).

**F32 — איפוסי סביבת העבודה (4 פעמים לפחות)**
- הגישה: עריכה ב-`/home/claude/work` ושמירה לפלט בסוף.
- הכישלון: הספריה נמחקה. עריכות שלא נשמרו אבדו והיה צורך לבצע מחדש.
- מסקנה: `/mnt/user-data/outputs` הוא האחסון הקבוע היחיד. שמירת נקודת ביקורת אחרי כל עריכה שנבדקה. עריכות מרובות בסקריפט Python אחד עם `assert`.

**F33 — חיתוך פלט עברי**
- הגישה: `cut -c1-190` על שורות עבריות.
- הכישלון: חיתוך באמצע בייט מרובה-בתים → פלט לא תקין ב-UTF-8, הכלי דחה את כל הפלט.
- מסקנה: חיתוך תווים ב-Python.

**F34 — הודעה שאינה שייכת לפרויקט**
- הנסיבות: משתמש ביקש "לבדוק עימוד, ישורים, מילים וכותרות אלמנות/יתומים". אין התאמה לקוד הנוכחי.
- ההחלטה: לא להחיל. לציין את אי-ההתאמה ולשאול (למשל האם התכוון לעימוד הצעת המחיר). מסקנה: הודעות עלולות להיות מיועדות לפרויקט אחר. אין לבצע שינויים רחבים על סמך הודעה לא ברורה.

### 3.2 פערים בין טענות שנמסרו לבין הקוד (התגלו בביקורת הסופית)

טענות אלה נמסרו למשתמש במהלך השיחה כמומשו. הביקורת (קריאת קוד + הרצה) הראתה שאינן מתקיימות. פרטי תיקון בסעיף 6.1.

| # | הטענה שנמסרה | המצב בפועל | מזהה |
|---|---|---|---|
| G1 | נתוני `billing` מטופס הלקוח מוצעים אוטומטית כמקור "סוג נכס + שנתי/חודשי" | `offerBillingFromFormJson` קורא `billing.annual` (לא קיים; המפתחות: `annualKwh`, `annualNis`), ממפה חודשים באינדקס 0 (בטופס `month` הוא 1-12), והערכים החודשיים לא נצרכים (`getMonthlyBillingValues` ללא קורא) | D7 |
| G2 | סליידר גדילת צריכה "משפיע על גודל המערכת/הסוללה המומלצים בשלב 2" | `futureGrowthPct` נשמר בעמודה 31 בלבד. המנוע לא קורא אותו. הטקסט בממשק מטעה | D3 |
| G3 | שלב 2 מניח סטנדרט פאנלים מודרניים (5.5) | 5.5 בתוויות ובשמירה בשלב 3. המנוע (`roofArea/7.5`) ודוח שלב 3 (`*7.5`) משתמשים ב-7.5 | D2 |
| G4 | סליידר שבת + "התעלם משבתות חסרות" מעריכים שבתות חסרות | נחשב `estShabbatLoad` בלבד. `_shabbatHourlyEstimate` לא נקרא. אין מילוי בסדרה | D5 |
| G5 | שלב 1 כולל שדה יחס שטח-גג להערכת ייצור עבר | השדה נשמר ולא נצרך. אין הערכת ייצור ממודל (שטח + זווית) בשלב 1 | D6 |
| G6 | ייצוא Excel כולל "טבלה מפלצתית" וצבעים | לא הורץ מול Apps Script. מחירים בעמודות תשלום הם קבועים (0.6/0.3). שמות חודש עברי שגויים. רזולוציית רבע-שעה לא מצטברת. כתיבה לא מקובצת | D8-D11, D13 |
| G7 | "חוזר למערכת ההצעות" אחרי שלב 3 | Index מתעלם מ-`?clientId`. כפתור "משוך נתונים מהמחשבון" הוסר ו-`lastCalculatorRawData` מאופס בבחירת לקוח. שמירה מ-Index מוחקת עמודה 29 | D1, D14 |
| G8 | שדה `roofAreaDisplay` מתעדכן | `updateRoofAreaDisplay` לא קיימת בשלב 2 | D4 |

### 3.3 חלופות שנשקלו ונדחו (ללא ניסיון מימוש)

| נושא | חלופה | סיבת הדחייה |
|---|---|---|
| מובייל: גישה לגיליון | Google Sheets API ישירות מ-Flutter (OAuth לכל איש מכירות) | הצורך לשכפל ב-Dart את סכימת 32 העמודות ולוגיקת JSON; ניהול OAuth; סיכון סטייה בין שתי המערכות |
| מובייל: מסכים | כתיבה מחדש נייטיב של טפסים/מחשבונים | שכפול לוגיקה מורכבת (איחוד, שבת הלכתי, המלצה, פיננסי) בלי כיסוי בדיקות |
| מובייל: טכנולוגיה | Kotlin + Swift נפרדים; React Native | שני קודים; Flutter נבחר (ניסיון קיים של המשתמש, בסיס קוד יחיד) |
| API: אימות | מפתח בכותרת HTTP | `doGet` ב-Apps Script אינו חושף כותרות. מפתח בפרמטר URL |
| Excel | SheetJS Pro | לא נבדק; ממצא: הגרסה החינמית אינה כותבת סגנונות |
| פורמט שמירה | CSV דחוס, בסיס 36 קבוע-רוחב | נדחה לטובת Uint16+Base64 (תקן, עמיד, קל לפענוח) |
| איחוד מקורות | ממוצע פשוט של כל המקורות | מקור מדוד (חח"י) אמור לגבור על הערכה; נבחרה היררכיה + שקלול רק בין הערכות |
| ימי חריגה | סטיית תקן רגילה | חריגים עצמם מנפחים סטיית תקן. נבחר MAD |

## 4. סטטוס קוד נוכחי ורכיבים מוכנים (Current Codebase & Implementation State)

### 4.1 מלאי קבצים

| קובץ | בתים | שורות | תפקיד | סטטוס |
|---|---|---|---|---|
| `Calculator.html` | 200,823 | 2897 | מחשבון חד-קובצי ישן (תאימות לאחור, route calculator) | Legacy |
| `ConsumptionAnalysis.html` | 168,745 | 2332 | שלב 1: ניתוח והעשרת נתוני צריכה וייצור (עבר) | 🟡 D5-D9, D13 |
| `FinancialModel.html` | 86,725 | 1172 | שלב 3: מודל פיננסי ושמירה להצעת המחיר | 🟡 D2 |
| `Form.html` | 86,952 | 1649 | טופס איסוף נתוני צריכה ללקוח (הצפנה היברידית) | 🟡 עיצוב ותיקון fetchCustomerData בלבד שונו |
| `Index.html` | 85,054 | 1327 | CRM: לקוחות, כרטיסי מערכת, כפתורי שלבים | 🟡 D1, D14 |
| `PrintQuote.html` | 175,403 | 2852 | הצעת מחיר מודפסת (13 עמודי A4) + לוח בקרה | 🟡 עיצוב לוח הבקרה בלבד שונה |
| `SystemSizing.html` | 108,143 | 1470 | שלב 2: המלצת גודל מערכת (קדימה) | 🟡 D2-D4, D12, D15 |
| `bereshit_solar_mobile_app.zip` | 13,595 | - | אפליקציית Flutter (מעטפת + WebView + JSON API) | 🟡 לא קומפל |
| `code.js` | 44,257 | 782 | Backend (Apps Script): ניתוב, JSON API, כתיבות עמודות, ייצוא Excel | 🟡 לא הורץ ב-Apps Script |
| `כלי_פענוח_טופס_בראשית_סולאר.html` | 16,006 | 268 | כלי פענוח עצמאי (offline, Web Crypto) | ✅ נבדק במהלך הפיתוח המוקדם |
| `מדריך_ארכיטקטורה_מלא_מערכת_בראשית_סולאר.html` | 47,245 | 398 | מדריך ארכיטקטורה | 🔴 קדם לפיצול לשלושה שלבים; לא מעודכן |
| `תכנית_השלמה_וחיבור_מערכת_בראשית_סולאר.html` | 38,686 | 284 | תכנית השלמה ראשונית | היסטורי |
| `תכנית_פיצול_המחשבון_ל3_שלבים.html` | 24,021 | 206 | תכנית פיצול המחשבון | 🟡 סכימת עמודה 30 בתכנית (JSON עשיר) הוחלפה בקידוד קומפקטי (2.9) |

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

**code.js**

```
doGet:8, getWebAppUrl:76, getInitialData:84, convertCellImageToBase64:143, getCustomerData:164, saveCustomerData:206, updateCalculatorResults:270, saveConsumptionAnalysis:311, saveSizingRecommendation:340, generateConsumptionExcelReport:381, _styleHeaderRow:411, _applyRedYellowGradient:415, _buildGradientDataSheet:428, _buildStatsSheet:442, _buildSourcesSheet:461, _buildTariffStructureSheet:485, _buildMonsterSheet:499, _fmtTariffSplit:577, getTariffFromCompany:589, oneTimeSetup_v2:614, oneTimeSetup_v3:662, oneTimeSetup_v4:689, handleApiRequest:712, jsonResponse:737, apiCustomerList:743, apiCustomerDetail:765, setApiKey_oneTime:777
```

**ConsumptionAnalysis.html**

```
initTooltips:472, hc_isLeap:536, hc_numMonths:537, hc_elapsed:538, hc_delay:545, hc_newYear:551, hc_daysInYear:552, hc_longCheshvan:553, hc_shortKislev:554, hc_daysInMonth:555, hc_g2j:561, hc_j2h:565, toHebrewDate:578, hebGematria:584, hebYearGematria:594, formatHebrewDateLabel:598, hc_monthIdx:601, getZmanInfo:606, hc_noaa:618, hc_sunEvent:633, hc_israelDst:646, estimateSunsetHHMM:656, calcStaircaseTariff:667, openSettingsModal:689, closeSettingsModal:707, saveTariffSettings:710, parseIsraelDate:739, isKnownHoliday:760, classifyHour:766, isPeakHour:786, computeSeasonalPeakDayCounts:789, computeDistributionWeight:814, synthesizeFromAnnualTotal:829, synthesizeFromMatrix:886, calculateMedian:901, calculateTrimmedMean:907, calculateTopPercentAvg:915, calculateBottomPercentAvg:921, parseMultimeterRows:1010, handleParsedRows:1069, showFilePreview:1170, peakObservedKwh0:1255, ingestDataPoint:1269, handleImportedEstimateFile:1288, detectGenericColumns:1354, getStats:1366, populateDOM:1373, renderReports:1384, updateShabbatSummaryRow:1460, buildExcelPayload:1480, _fmtDDMMYYYY:1578, Utilities_fmtDateTime:1579, exportToExcel:1581, setClientInputMode:1610, applyClientDetails:1630, onConsumptionModeChange:1664, onProductionModeChange:1671, syncExistingProductionToP0:1680, populatePropertyTypeSelect:1686, updatePropertyTypeDesc:1692, getTrailingYearWindow:1790, fmtDateInput:1799, updateAnalysisPeriodFromData:1804, detectStepHours:1824, getTrailingYearDayWindow:1850, aggregateToHourlyGrid:1863, chooseScale:1883, packHourlySeriesToB64:1890, unpackB64ToHourlySeries:1904, snapshotSource:1926, normalizeShape:1953, blendShapes:1957, unifyAllSources:1967, getSunsetMinutesOfDay:2021, getHalachicShabbatWindow:2028, isInHalachicShabbat:2041, computeWeeklyShabbatProfiles:2048, detectExceptionDays:2086, onShabbatUpliftChange:2119, onIgnoreMissingShabbatToggle:2148, toggleMonthlyBilling:2157, getMonthlyBillingValues:2170, offerBillingFromFormJson:2181, saveAndContinueToStage2:2210, initClientIdAndBootstrap:2287, proceedWithClientId:2288
```

**SystemSizing.html**

```
initTooltips:351, hc_isLeap:413, hc_numMonths:414, hc_elapsed:415, hc_delay:422, hc_newYear:428, hc_daysInYear:429, hc_longCheshvan:430, hc_shortKislev:431, hc_daysInMonth:432, hc_g2j:438, hc_j2h:442, toHebrewDate:455, hc_monthIdx:459, getZmanInfo:464, hc_noaa:476, hc_sunEvent:491, hc_israelDst:504, estimateSunsetHHMM:514, calcStaircaseTariff:525, openSettingsModal:547, closeSettingsModal:565, saveTariffSettings:568, parseIsraelDate:597, isKnownHoliday:618, classifyHour:624, isPeakHour:644, computeSeasonalPeakDayCounts:647, runBatteryDispatchSimulation:661, fmtKwh:747, renderHourlySimResults:749, renderMonthlyBarChart:802, renderDayChart:844, xAt:852, yConsAt:853, ySocAt:854, applySimResultsToCalculator:942, calcBatteryArbitrageRevenue:956, calculateMedian:983, calculateTrimmedMean:989, applySuggestedBattery:997, applySuggestedInverterPower:1014, computeSeasonPeakStatsFromRawSeries:1032, pmt:1052, npvCalc:1056, npvAt:1059, irrCalc:1060, runFinancialModel:1087, fmtCurrency:1177, gatherBaseInputsForSearch:1179, findOptimalSystemSize:1208, renderRecommendationResults:1286, applyRecommendationToManualFields:1323, unpackB64ToHourlySeries:1340, onFutureGrowthChange:1359, bootstrapStage2:1377, initClientIdAndBootstrap2:1414, proceed:1415, saveAndContinueToStage3:1439
```

**FinancialModel.html**

```
initTooltips:299, pmt:359, npvCalc:363, npvAt:366, irrCalc:367, hc_isLeap:399, hc_numMonths:400, hc_elapsed:401, hc_delay:408, hc_newYear:414, hc_daysInYear:415, hc_longCheshvan:416, hc_shortKislev:417, hc_daysInMonth:418, hc_g2j:424, hc_j2h:428, toHebrewDate:441, hc_monthIdx:445, getZmanInfo:450, hc_noaa:462, hc_sunEvent:477, hc_israelDst:490, estimateSunsetHHMM:500, calcStaircaseTariff:511, openSettingsModal:533, closeSettingsModal:551, saveTariffSettings:554, parseIsraelDate:583, isKnownHoliday:604, classifyHour:610, isPeakHour:630, computeSeasonalPeakDayCounts:633, calcBatteryArbitrageRevenue:647, runFinancialModel:675, fmtCurrency:818, displayCalcResults:820, renderCashflowChart:881, xAt:894, yAt:895, pathFor:897, buildFinalReport:934, renderFinalReport:940, exportReportToExcel:1004, unpackB64ToHourlySeries:1049, bootstrapStage3:1068, initClientIdAndBootstrap3:1111, saveResultsAndReturnToIndex:1125
```

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

```js
function getTrailingYearDayWindow(minDate, maxDate) {
    const lastDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    const endExcl = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
    let start = new Date(endExcl.getFullYear() - 1, endExcl.getMonth(), endExcl.getDate());
    const firstDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (start < firstDay) start = firstDay;
    const nDays = Math.round((endExcl - start) / 86400000);
    return { start, endExcl, lastDay, nDays };
}
```

```js
function aggregateToHourlyGrid(series, gridStart, nDays) {
    const total = nDays * 24;
    const sums = new Array(total).fill(0);
    const seen = new Array(total).fill(false);
    const startMs = gridStart.getTime();
    for (const p of series) {
        const dayStartMs = new Date(p.date.getFullYear(), p.date.getMonth(), p.date.getDate()).getTime();
        const dayIdx = Math.round((dayStartMs - startMs) / 86400000);
        if (dayIdx < 0 || dayIdx >= nDays) continue;
        const idx = dayIdx * 24 + p.date.getHours();
        sums[idx] += p.kwh;
        seen[idx] = true;
    }
    let missing = 0;
    for (let i = 0; i < total; i++) if (!seen[i]) missing++;
    return { sums, missingHours: missing };
}
```

```js
function chooseScale(kwhArray) {
    let mx = 0;
    for (let i = 0; i < kwhArray.length; i++) if (kwhArray[i] > mx) mx = kwhArray[i];
    for (const s of [1000, 100, 10, 1]) if (mx * s <= 65535) return s;
    return 1;
}
```

```js
function packHourlySeriesToB64(kwhArray, scale) {
    const sc = scale || 1000;
    const buf = new Uint16Array(kwhArray.length);
    for (let i = 0; i < kwhArray.length; i++) {
        buf[i] = Math.max(0, Math.min(65535, Math.round((kwhArray[i] || 0) * sc)));
    }
    const bytes = new Uint8Array(buf.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}
```

```js
function unpackB64ToHourlySeries(b64, refYearStr, startISO, scale) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = new Uint16Array(bytes.buffer);
    const div = scale || 1000;
    let y, m, d;
    if (startISO) { const parts = startISO.split('-').map(Number); y = parts[0]; m = parts[1] - 1; d = parts[2]; }
    else { y = parseInt(refYearStr, 10); m = 0; d = 1; }
    const out = [];
    for (let i = 0; i < buf.length; i++) {
        out.push({ date: new Date(y, m, d + Math.floor(i / 24), i % 24, 0, 0), kwh: buf[i] / div });
    }
    return out;
}
```

#### 4.4.2 שמירה ומעבר לשלב 2 — ✅

טיפול בשגיאות: חסימה בלי איחוד או בלי `clientId` (`alert`); `withFailureHandler`; הודעת שרת מוצגת.

```js
function saveAndContinueToStage2() {
    if (!window._unifiedResult) { alert('יש ללחוץ קודם על "אחד את כל המקורות שהוזנו" כדי לייצר ניתוח מאוחד.'); return; }
    if (!clientIdS1) { alert('לא נמצא מזהה לקוח. יש לפתוח את הדף הזה מתוך כרטיס לקוח קיים במערכת ההצעות (לא ישירות מה-URL/סימניה).'); return; }

    const statusEl = document.getElementById('continueStatus');
    statusEl.textContent = 'שומר...';

    // חשוב: החיתוך לשנה אחרונה והצבירה לשעות חלים *רק* על מה שנשמר בתא בגיליון (שם יש תקרה של
    // 50,000 תווים). התצוגה בדף וקובץ ה-Excel ממשיכים להשתמש בסדרה המלאה (window._unifiedResult.finalSeries)
    // ללא שינוי: היא לא נערכת כאן, רק נגזר ממנה עותק לשמירה.
    const fullSeries = window._unifiedResult.finalSeries;
    let overallMin = fullSeries[0].date, overallMax = fullSeries[0].date;
    for (const p of fullSeries) { if (p.date < overallMin) overallMin = p.date; if (p.date > overallMax) overallMax = p.date; }
    const win = getTrailingYearDayWindow(overallMin, overallMax);
    const seriesInWindow = fullSeries.filter(p => p.date >= win.start && p.date < win.endExcl);
    const grid = aggregateToHourlyGrid(seriesInWindow, win.start, win.nDays);
    const scale = chooseScale(grid.sums);
    const pad2 = n => String(n).padStart(2, '0');
    const startISO = `${win.start.getFullYear()}-${pad2(win.start.getMonth() + 1)}-${pad2(win.start.getDate())}`;
    if (fullSeries.length > grid.sums.length * 1.02) {
        statusEl.innerHTML = `<span style="color:#7f8c8d">לצורך השמירה בגיליון (תקרה של 50,000 תווים לתא) נשמרת השנה האחרונה בלבד (${_fmtDDMMYYYY(win.start)} עד ${_fmtDDMMYYYY(win.lastDay)}) וברזולוציה שעתית. התצוגה בדף וקובץ ה-Excel ממשיכים לכלול את כל הטווח והרזולוציה.</span> שומר...`;
    }

    const refYear = win.start.getFullYear();
    const consumptionAnalysis = {
        refYear, startISO, days: win.nDays, hoursCount: grid.sums.length, scale, missingHours: grid.missingHours,
        valuesB64: packHourlySeriesToB64(grid.sums, scale),
        annualKwh: grid.sums.reduce((s, v) => s + v, 0),
        sources: window._unifiedResult.sourcesUsed,
        confidence: window._unifiedResult.confidence,
        ignoreMissingShabbat: document.getElementById('ignoreMissingShabbat').checked,
        estShabbatLoad: parseFloat(document.getElementById('estShabbatLoad').value) || null,
        shabbatUpliftPct: parseFloat(document.getElementById('shabbatUpliftSlider').value) || 0,
        existingProductionKw: parseFloat(document.getElementById('existingProductionKw').value) || 0,
        existingRoofRatio: parseFloat(document.getElementById('existingRoofRatio').value) || 7.5
    };

    const payload = { clientId: clientIdS1, consumptionAnalysis };
    // נתוני ייצור קיימים - אותו חלון תאריכים ואותה רשת שעתית (כדי שצריכה וייצור יישארו מיושרים),
    // בעמודה נפרדת (32) מאותה סיבת תקרת-תווים.
    if (window._productionSeries && window._productionSeries.length) {
        const prodInWindow = window._productionSeries.filter(p => p.date >= win.start && p.date < win.endExcl);
        const prodGrid = aggregateToHourlyGrid(prodInWindow, win.start, win.nDays);
        const prodScale = chooseScale(prodGrid.sums);
        payload.productionSeries = {
            refYear, startISO, days: win.nDays, hoursCount: prodGrid.sums.length, scale: prodScale, missingHours: prodGrid.missingHours,
            valuesB64: packHourlySeriesToB64(prodGrid.sums, prodScale)
        };
    }

    localStorage.setItem('stage1ConsumptionAnalysis', JSON.stringify(consumptionAnalysis));

    google.script.run
        .withSuccessHandler(function (res) {
            if (res && res.ok) {
                statusEl.innerHTML = '<span style="color:#1e8449">✓ נשמר. עובר לשלב 2...</span>';
                google.script.run.withSuccessHandler(function (url) {
                    window.location.href = url + '?page=sizing&clientId=' + encodeURIComponent(clientIdS1);
                }).getWebAppUrl();
            } else {
                statusEl.innerHTML = '<span style="color:#c0392b">⚠️ ' + (res ? res.message : 'שגיאה לא ידועה') + '</span>';
            }
        })
        .withFailureHandler(function (err) {
            statusEl.innerHTML = '<span style="color:#c0392b">⚠️ השמירה נכשלה: ' + (err.message || err) + '</span>';
        })
        .saveConsumptionAnalysis(JSON.stringify(payload));
}
```

```js
function saveConsumptionAnalysis(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = JSON.parse(payload);
  if (!data.clientId) return { ok: false, message: "לא התקבל מזהה לקוח." };

  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.clientId).trim()) { rowIndex = i + 1; break; }
  }
  if (rowIndex < 1) {
    return { ok: false, message: "לא נמצא לקוח קיים עם מזהה " + data.clientId + ". יש לשמור את פרטי הלקוח במערכת ההצעות (Index) לפני תחילת ניתוח הצריכה." };
  }
  const consumptionJson = JSON.stringify(data.consumptionAnalysis || {});
  if (consumptionJson.length > 49000) {
    return { ok: false, message: "ניתוח הצריכה ארוך מדי לשמירה (" + consumptionJson.length + " תווים, תקרה 50,000). ודאו שנשמרת שנה אחרונה בלבד, ברזולוציה שעתית, ובקידוד base64 (ולא כמערך JSON מילולי או כסדרה רב-שנתית/רבע-שעתית)." };
  }
  sheet.getRange(rowIndex, 30).setValue(consumptionJson);
  if (data.productionSeries) {
    sheet.getRange(rowIndex, 32).setValue(JSON.stringify(data.productionSeries));
  }
  return { ok: true, message: "ניתוח הצריכה נשמר בהצלחה לתיק הלקוח " + data.clientId + "." };
}
```

```js
function saveSizingRecommendation(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = JSON.parse(payload);
  if (!data.clientId) return { ok: false, message: "לא התקבל מזהה לקוח." };

  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.clientId).trim()) { rowIndex = i + 1; break; }
  }
  if (rowIndex < 1) {
    return { ok: false, message: "לא נמצא לקוח קיים עם מזהה " + data.clientId + "." };
  }
  sheet.getRange(rowIndex, 31).setValue(JSON.stringify(data.sizingRecommendation || {}));
  return { ok: true, message: "המלצת גודל המערכת נשמרה בהצלחה לתיק הלקוח " + data.clientId + "." };
}
```

#### 4.4.3 זיהוי מזהה לקוח (שלב 1; שלבים 2-3 זהים במבנה) — 🟡

```js
function initClientIdAndBootstrap() {
    function proceedWithClientId(id) {
        clientIdS1 = id || '';
        initTooltips();
        if (!clientIdS1) return;

        document.getElementById('topClientId') && (document.getElementById('topClientId').value = clientIdS1);
        google.script.run
            .withSuccessHandler(function (customer) {
                const existing = customer && customer['נתוני צריכה מועשרים (JSON)'];
                if (existing && existing.valuesB64) {
                    const series = unpackB64ToHourlySeries(existing.valuesB64, existing.refYear, existing.startISO, existing.scale);
                    let hourlyAggregation = {}, dailyAggregation = {}, dailyTouAggregation = {};
                    series.forEach(p => ingestDataPoint(p.date, p.kwh, hourlyAggregation, dailyAggregation, dailyTouAggregation));
                    globalRawSeries = series;
                    renderReports(hourlyAggregation, dailyAggregation, dailyTouAggregation);
                    window._unifiedResult = { finalSeries: series, confidence: existing.confidence || 'high', sourcesUsed: existing.sources || [] };
                    if (existing.shabbatUpliftPct) { document.getElementById('shabbatUpliftSlider').value = existing.shabbatUpliftPct; onShabbatUpliftChange(); }
                    if (existing.estShabbatLoad) document.getElementById('estShabbatLoad').value = existing.estShabbatLoad;
                    if (existing.ignoreMissingShabbat) document.getElementById('ignoreMissingShabbat').checked = true;
                    onIgnoreMissingShabbatToggle();
                    if (existing.existingProductionKw) { document.getElementById('existingProductionKw').value = existing.existingProductionKw; document.getElementById('productionModeSelect').value = 'existing'; onProductionModeChange(); }
                    if (existing.existingRoofRatio) document.getElementById('existingRoofRatio').value = existing.existingRoofRatio;
                    document.getElementById('continueStatus').innerHTML = '<span style="color:#7f8c8d">נטען ניתוח קיים מהשרת - ניתן לערוך ולשמור מחדש.</span>';
                }
            })
            .withFailureHandler(function (err) { console.warn('לא ניתן היה לטעון ניתוח קיים:', err); })
            .getCustomerData(clientIdS1);
    }

    if (typeof google !== 'undefined' && google.script && google.script.url) {
        google.script.url.getLocation(function (loc) {
            const idFromGas = loc && loc.parameter && loc.parameter.clientId;
            // רשת ביטחון: אם משום מה ריק, מנסים גם את window.location.search לפני שמוותרים
            proceedWithClientId(idFromGas || new URLSearchParams(window.location.search).get('clientId') || '');
        });
    } else {
        // נפילה חזרה - למשל בבדיקה מקומית של הקובץ שלא כ-Web App אמיתי
        proceedWithClientId(new URLSearchParams(window.location.search).get('clientId') || '');
    }
}
```

#### 4.4.4 סיווג שעה לתעריף — ✅

```js
function classifyHour(dateObj) {
    const month = dateObj.getMonth() + 1;
    const wday = dateObj.getDay();
    const hour = dateObj.getHours();
    let season;
    if (month === 12 || month === 1 || month === 2) season = 'winter';
    else if (month >= 6 && month <= 9) season = 'summer';
    else season = 'transition';

    let isPeak = false;
    if (season === 'winter') {
        isPeak = (hour >= 17 && hour < 22); // כל ימות השבוע, ללא יוצא מן הכלל
    } else if (season === 'summer') {
        if (wday !== 5 && wday !== 6 && !isKnownHoliday(dateObj)) isPeak = (hour >= 17 && hour < 23);
    } else { // transition
        if (wday !== 5 && wday !== 6 && !isKnownHoliday(dateObj)) isPeak = (hour >= 17 && hour < 22);
    }
    return { season, isPeak };
}
```

```js
const CALC_CONSTANTS = {
    staircase: { p15: 15, p100: 100, p300: 300, p630: 630, t15: 0.48, t100: 0.3936, t300: 0.3437, t630: 0.2844, disc: 1 },
    storageT100Factor: 0.95, // "מחשבון כולל אגירה" מפעיל הנחה של 5% על מדרגת 15-100 קוו"ט כשיש אגירה
    tou: {
        winter_peak: 0.9774, winter_low: 0.4022,
        transition_peak: 0.4293, transition_low: 0.3945,
        summer_peak: 1.4597, summer_low: 0.4358
    },
    // "תעריף משלים" — טבלה נפרדת מהתעו"ז הרשמי לעיל, שהיא זו שבפועל קובעת את שווי הפסגה
    // לחישוב ערך הארביטראז' מהאגירה במקור (מאומת מול קבצי ה-Excel המקוריים). מפוצלת לפי
    // גודל המערכת (עד/מעל 300 קוט"ט).
    compTariff: {
        upTo300:  { winter: 0.932,  summer: 1.3424, transition: 0.3721 },
        above300: { winter: 0.8339, summer: 1.2011, transition: 0.3329 }
    },
    transitionCompFromSource: 0.55, // התעריף שמופיע במקור בפועל לעונת המעבר (במקום נוסחת הבלנד העקבית)
    urbanPremium: 0.06,
    urbanPremiumYears: 17,   // בקובץ המקור הפרמיה מיושמת בשנים 1-17 בלבד, לא ל-25 שנה
    yieldBase: 1600,
    degradation: 0.0025,     // לינארי (לא מצטבר): שנה1=100%, שנה n = 1-0.0025*(n-1)
    battery: { dod: 0.95, effCharge: 0.93, effDischarge: 0.94, cRate: 0.2 },
    vatRate: 0.18,
    discountRate: 0.035,
    privateTaxExemption: 27900,
    privateTaxRate: 0.10,
    privateTaxFlatCap: 120000, // תקרת מסלול המס המופחת (10% מהשקל הראשון) - טרם אומת מול רו"ח, ר' תכנית ההשלמה
    replacements: { inverterYear: 14, inverterCostPct: 0.15, batteryYear: 15, batteryCostPct: 0.60 }
};
```

#### 4.4.5 פענוח מונה חח"י מרובה-מונים — ✅

טיפול בשגיאות: שורות קצרות מ-5 עמודות או עם ערך/תאריך לא תקין מדולגות. 🟡 פסיק עשרוני נמחק (ראו 5.1).

```js
function parseMultimeterRows(data, dataStartIndex) {
    const buckets = new Map();

    for (let i = dataStartIndex; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 5) continue;
        const meterType = (row[1] || '').toString().trim();
        const dateStr = row[2], timeStr = row[3];
        const valStr = row[4], feedStr = row[5];
        if (!dateStr || !timeStr || valStr === undefined || valStr === '') continue;

        const val = parseFloat(valStr.toString().replace(/[",]/g, ''));
        const feed = feedStr !== undefined && feedStr !== '' ? parseFloat(feedStr.toString().replace(/[",]/g, '')) : 0;
        if (isNaN(val)) continue;

        const dateObj = parseIsraelDate(dateStr, timeStr);
        if (!dateObj || isNaN(dateObj.getTime())) continue;

        const key = dateObj.getTime();
        if (!buckets.has(key)) buckets.set(key, { netDraw: [], netFeed: [], consMeter: [], prodMeter: [], dateObj });
        const b = buckets.get(key);

        if (meterType.includes('דו') && meterType.includes('כיוונ')) {
            b.netDraw.push(val);
            b.netFeed.push(isNaN(feed) ? 0 : feed);
        } else if (meterType.includes('ייצור')) {
            b.prodMeter.push(val);
        } else if (meterType.includes('צריכה')) {
            b.consMeter.push(val);
        } else {
            b.consMeter.push(val); // סוג מונה לא מזוהה - מתייחסים כצריכה רגילה, ליתר ביטחון
        }
    }

    const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const points = [];
    let hasMultipleMeterTypes = false;
    let totalProduction = 0;

    buckets.forEach((b) => {
        const hasNet = b.netDraw.length > 0;
        const hasCons = b.consMeter.length > 0;
        const hasProd = b.prodMeter.length > 0;
        if ((hasNet ? 1 : 0) + (hasCons ? 1 : 0) + (hasProd ? 1 : 0) >= 2) hasMultipleMeterTypes = true;

        const gridDraw = hasNet ? avg(b.netDraw) : avg(b.consMeter);
        const feedIn = hasNet ? avg(b.netFeed) : 0;
        const production = avg(b.prodMeter);
        const selfConsumed = Math.max(0, production - feedIn);
        const trueConsumption = gridDraw + selfConsumed;

        points.push({ date: b.dateObj, kwh: trueConsumption, productionKwh: production });
        totalProduction += production;
    });

    points.sort((a, b) => a.date - b.date);
    return { points, hasMultipleMeterTypes, totalProduction };
}
```

#### 4.4.6 איחוד מקורות — ✅ (המשקלים 🟡)

```js
function snapshotSource(tag, rawSeries) {
    if (!rawSeries || !rawSeries.length) return;
    const annualKwh = rawSeries.reduce((s, p) => s + p.kwh, 0);
    sourceResults[tag] = { rawSeries: rawSeries.slice(), annualKwh, capturedAt: new Date().toISOString() };
    const chip = document.getElementById('chip-' + tag);
    if (chip) {
        chip.style.background = '#e9f7ef'; chip.style.color = '#1e8449'; chip.style.borderColor = '#1e8449';
        chip.textContent = SOURCE_LABELS[tag] + ': ✓ ' + Math.round(annualKwh).toLocaleString() + ' קוט"ש/שנה';
    }
    const activeCount = Object.values(sourceResults).filter(v => v !== null).length;
    const unifyBtn = document.getElementById('unifyBtn');
    const unifyExplain = document.getElementById('unifyExplain');
    if (activeCount > 0) {
        unifyBtn.disabled = false;
        unifyExplain.textContent = activeCount === 1
            ? 'מקור נתונים אחד פעיל - ניתן לאחד (התוצאה תהיה זהה למקור הבודד), או להוסיף מקור נוסף לדיוק גבוה יותר.'
            : activeCount + ' מקורות נתונים פעילים - האיחוד ישקלל ביניהם לתוצאה מדויקת יותר.';
    }
}
```

```js
function normalizeShape(rawSeries) {
    const total = rawSeries.reduce((s, p) => s + p.kwh, 0) || 1;
    return rawSeries.map(p => ({ date: p.date, frac: p.kwh / total }));
}
```

```js
function blendShapes(weighted) {
    const totalWeight = weighted.reduce((s, [, w]) => s + w, 0);
    const base = weighted[0][0];
    return base.map((point, i) => {
        let frac = 0;
        weighted.forEach(([shape, w]) => { if (shape[i]) frac += shape[i].frac * (w / totalWeight); });
        return { date: point.date, frac };
    });
}
```

```js
function unifyAllSources() {
    const active = Object.entries(sourceResults).filter(([, v]) => v !== null);
    if (active.length === 0) { alert('יש להזין ולעבד לפחות מקור נתונים אחד למעלה.'); return; }

    let finalSeries, confidence, warnings = [];

    if (sourceResults.iec) {
        finalSeries = sourceResults.iec.rawSeries;
        confidence = 'high';
        active.filter(([k]) => k !== 'iec').forEach(([k, v]) => {
            const diffPct = Math.abs(v.annualKwh - sourceResults.iec.annualKwh) / sourceResults.iec.annualKwh * 100;
            if (diffPct > 15) warnings.push(SOURCE_LABELS[k] + ' שונה ב-' + diffPct.toFixed(0) + '% מנתוני חח"י - ייתכן שהצריכה השתנתה מאז, או שהמקור פחות מדויק.');
        });
    } else if (sourceResults.json) {
        finalSeries = sourceResults.json.rawSeries;
        confidence = active.length > 1 ? 'high' : 'medium';
        active.filter(([k]) => k !== 'json').forEach(([k, v]) => {
            const diffPct = Math.abs(v.annualKwh - sourceResults.json.annualKwh) / sourceResults.json.annualKwh * 100;
            if (diffPct > 15) warnings.push(SOURCE_LABELS[k] + ' שונה ב-' + diffPct.toFixed(0) + '% מפירוט הטופס.');
        });
    } else if (sourceResults.matrix && sourceResults.annual) {
        const shapeMatrix = normalizeShape(sourceResults.matrix.rawSeries);
        const shapeAnnual = normalizeShape(sourceResults.annual.rawSeries);
        const blended = blendShapes([[shapeMatrix, 0.6], [shapeAnnual, 0.4]]);
        const finalAnnualKwh = sourceResults.matrix.annualKwh; // למטריצה עדיפות על הסכום, כי היא הזנה ישירה
        finalSeries = blended.map(p => ({ date: p.date, kwh: p.frac * finalAnnualKwh }));
        confidence = 'medium';
    } else {
        const only = active[0][1];
        finalSeries = only.rawSeries;
        confidence = 'low';
        warnings.push('מקור נתונים בודד בלבד - הדיוק מוגבל. מומלץ להוסיף מקור נוסף (למשל מטריצה ידנית) אם אפשר.');
    }

    // בנייה מחדש של הצבירות (hourly/daily/tou) מהסדרה המאוחדת, ע"י מעבר חוזר על ingestDataPoint
    let hourlyAggregation = {}, dailyAggregation = {}, dailyTouAggregation = {};
    finalSeries.forEach(p => ingestDataPoint(p.date, p.kwh, hourlyAggregation, dailyAggregation, dailyTouAggregation));
    globalRawSeries = finalSeries;
    renderReports(hourlyAggregation, dailyAggregation, dailyTouAggregation);

    window._unifiedResult = { finalSeries, confidence, sourcesUsed: active.map(([k]) => k) };
    const statusEl = document.getElementById('unifyExplain');
    let msg = '✓ אוחדו ' + active.length + ' מקור/ות (' + active.map(([k]) => SOURCE_LABELS[k]).join(', ') + '). רמת ביטחון: ' + ({high:'גבוהה',medium:'בינונית',low:'נמוכה'}[confidence]) + '.';
    if (warnings.length) msg += ' ⚠️ ' + warnings.join(' | ');
    statusEl.innerHTML = msg;
    statusEl.style.color = warnings.length ? '#c0392b' : '#1e8449';

    document.getElementById('unifyExplain').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

#### 4.4.7 שבת הלכתית, פרופיל שבועי, ימי חריגה — ✅ (🔴 D5 לגבי שימוש בהערכה)

```js
function getSunsetMinutesOfDay(dateObj) {
    const hhmm = estimateSunsetHHMM(dateObj);
    if (hhmm === '—') return 18 * 60; // נפילה בטוחה אם החישוב האסטרונומי נכשל
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
```

```js
function getHalachicShabbatWindow(anyDateInWeek) {
    const d = new Date(anyDateInWeek);
    const dow = d.getDay(); // 0=ראשון...5=שישי,6=שבת
    let daysToFriday = (5 - dow + 7) % 7;
    if (dow === 6) daysToFriday = -1; // שבת עצמה -> יום שישי הקודם (אתמול), לא יום שישי הבא בעוד 6 ימים
    const friday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysToFriday);
    const saturday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 1);
    const fridaySunsetMin = getSunsetMinutesOfDay(friday);
    const saturdaySunsetMin = getSunsetMinutesOfDay(saturday);
    const start = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate(), 0, fridaySunsetMin - 20);
    const end = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate(), 0, saturdaySunsetMin + 40);
    return { start, end, friday, saturday };
}
```

```js
function isInHalachicShabbat(dateObj) {
    const { start, end } = getHalachicShabbatWindow(dateObj);
    return dateObj >= start && dateObj <= end;
}
```

```js
function computeWeeklyShabbatProfiles(series) {
    if (!series || !series.length) return [];
    const exceptionDateStrs = new Set(detectExceptionDays(series).map(e => e.date.toDateString()));
    const bySaturday = {}; // key: תאריך יום שבת (toDateString) -> {shabbatPoints:[], precedingWeekdayHourly: {0..23: [values]}}
    series.forEach(p => {
        if (isInHalachicShabbat(p.date)) {
            const { saturday } = getHalachicShabbatWindow(p.date);
            const key = saturday.toDateString();
            if (!bySaturday[key]) bySaturday[key] = { saturday, shabbatPoints: [], precedingHourly: {} };
            bySaturday[key].shabbatPoints.push(p);
        }
    });
    Object.values(bySaturday).forEach(entry => {
        // ששת הימים שקדמו (יום ראשון עד חמישי + חלק מיום שישי שלפני תחילת השבת ההלכתית) -
        // ימי חריגה (חג/סטטיסטי) מוצאים מהחישוב כדי לא לעוות את הבסיס ל"יום חול טיפוסי"
        const { start } = getHalachicShabbatWindow(entry.saturday);
        const weekStart = new Date(start); weekStart.setDate(weekStart.getDate() - 6);
        const hourlyBuckets = {}; // hour -> [values]
        for (let h = 0; h < 24; h++) hourlyBuckets[h] = [];
        let excludedCount = 0;
        series.forEach(p => {
            if (p.date >= weekStart && p.date < start && !isInHalachicShabbat(p.date)) {
                if (exceptionDateStrs.has(p.date.toDateString())) { excludedCount++; return; }
                hourlyBuckets[p.date.getHours()].push(p.kwh);
            }
        });
        const hourlyAvg = {};
        for (let h = 0; h < 24; h++) hourlyAvg[h] = hourlyBuckets[h].length ? hourlyBuckets[h].reduce((s, v) => s + v, 0) / hourlyBuckets[h].length : 0;
        entry.precedingHourlyAvg = hourlyAvg;
        entry.excludedExceptionHours = excludedCount;
    });
    return Object.values(bySaturday);
}
```

```js
function detectExceptionDays(series) {
    if (!series || !series.length) return [];
    const dailyTotals = {}; // dateStr -> {date, total, dow}
    series.forEach(p => {
        const key = p.date.toDateString();
        if (!dailyTotals[key]) dailyTotals[key] = { date: p.date, total: 0, dow: p.date.getDay() };
        dailyTotals[key].total += p.kwh;
    });
    const days = Object.values(dailyTotals);
    const exceptions = [];

    // א. חגים ידועים שנפלו על יום חול (לא שבת עצמה - זו כבר מטופלת בנפרד)
    days.forEach(d => {
        if (d.dow !== 6 && isKnownHoliday(d.date)) exceptions.push({ date: d.date, reason: 'חג', total: d.total });
    });

    // ב. חריגות סטטיסטיות - לפי קבוצת (יום-בשבוע), משווים לחציון+MAD (עמיד יותר לחריגים מסטיית תקן רגילה)
    const byDow = {};
    days.forEach(d => { if (!byDow[d.dow]) byDow[d.dow] = []; byDow[d.dow].push(d); });
    Object.values(byDow).forEach(group => {
        const totals = group.map(d => d.total).sort((a, b) => a - b);
        const median = totals[Math.floor(totals.length / 2)];
        const absDevs = totals.map(t => Math.abs(t - median)).sort((a, b) => a - b);
        const mad = absDevs[Math.floor(absDevs.length / 2)] || 1;
        group.forEach(d => {
            if (Math.abs(d.total - median) > 3.5 * mad && !exceptions.some(e => e.date.toDateString() === d.date.toDateString())) {
                exceptions.push({ date: d.date, reason: d.total > median ? 'צריכה חריגה גבוהה' : 'צריכה חריגה נמוכה', total: d.total, median });
            }
        });
    });
    return exceptions.sort((a, b) => a.date - b.date);
}
```

```js
function onShabbatUpliftChange() {
    const pct = parseFloat(document.getElementById('shabbatUpliftSlider').value) || 0;
    document.getElementById('shabbatUpliftValue').textContent = pct + '%';
    const resultEl = document.getElementById('shabbatUpliftResult');
    if (pct === 0) { resultEl.textContent = ''; return; }
    const series = window._unifiedResult ? window._unifiedResult.finalSeries : globalRawSeries;
    if (!series || !series.length) { resultEl.textContent = 'יש לנתח/לאחד נתונים קודם כדי לחשב הערכה מדויקת.'; return; }

    // ממוצע פרופיל שעתי של ימי חול, ממוצע על-פני כל השבועות בקובץ (לא שנתי גס וגם לא שבוע בודד) -
    // לשימוש כברירת מחדל להשלמת שבתות חסרות באופן כללי. לכל שבת ספציפית עם נתונים חלקיים,
    // renderReports עצמו משתמש ב-computeWeeklyShabbatProfiles לפי השבוע הספציפי שלה.
    const weeklyProfiles = computeWeeklyShabbatProfiles(series);
    const hourlyAvgAcrossWeeks = {};
    for (let h = 0; h < 24; h++) {
        const vals = weeklyProfiles.map(w => w.precedingHourlyAvg[h]).filter(v => v != null);
        hourlyAvgAcrossWeeks[h] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    }
    const scaledHourly = {};
    let totalEstimated = 0;
    for (let h = 0; h < 24; h++) { scaledHourly[h] = hourlyAvgAcrossWeeks[h] * (1 + pct / 100); totalEstimated += scaledHourly[h]; }

    window._shabbatHourlyEstimate = scaledHourly; // נשמר לשימוש בשמירה/בהצגה
    document.getElementById('estShabbatLoad').value = totalEstimated.toFixed(1);
    updateShabbatSummaryRow();
    const sampleH1 = 18, sampleH2 = 19;
    resultEl.innerHTML = `מבוסס על פרופיל שעתי ממוצע של ששת ימי החול שקדמו לכל שבת בנתונים (לא ממוצע שנתי כללי). לדוגמה: שעה ${sampleH1}:00 → ${hourlyAvgAcrossWeeks[sampleH1].toFixed(1)} קוט"ש בחול ← ${scaledHourly[sampleH1].toFixed(1)} קוט"ש בשבת המוערכת. סה"כ יום שבת מוערך: <strong>${totalEstimated.toFixed(1)} קוט"ש</strong>.`;
}
```

#### 4.4.8 השוואת שנים בתצוגה המקדימה — ✅

```js
// השוואת צריכה בין שתי יחידות שנתיות שלמות המסתיימות ביום האחרון בנתונים - ולא לפי שנים
// קלנדריות. שנה קלנדרית חלקית (למשל ינואר עד ספטמבר) נראית בטעות כ"ירידה" רק כי חסרים בה חודשים.
// לדוגמה, נתונים מ-15/09/2024 עד 15/09/2026: 16/09/2024-15/09/2025 מול 16/09/2025-15/09/2026.
if (totalDays > 400) {
    const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const lastDayY = dayStart(maxDate);
    const bEnd = new Date(lastDayY.getFullYear(), lastDayY.getMonth(), lastDayY.getDate() + 1); // בלעדי
    const bStart = new Date(bEnd.getFullYear() - 1, bEnd.getMonth(), bEnd.getDate());
    const aStart = new Date(bStart.getFullYear() - 1, bStart.getMonth(), bStart.getDate());
    if (dayStart(minDate) <= aStart) {
        let sumA = 0, sumB = 0;
        const daysA = new Set(), daysB = new Set();
        sorted.forEach(p => {
            if (p.date >= aStart && p.date < bStart) { sumA += p.kwh; daysA.add(p.date.toDateString()); }
            else if (p.date >= bStart && p.date < bEnd) { sumB += p.kwh; daysB.add(p.date.toDateString()); }
        });
        const expectedA = Math.round((bStart - aStart) / 86400000);
        const expectedB = Math.round((bEnd - bStart) / 86400000);
        const aEndLabel = new Date(bStart.getFullYear(), bStart.getMonth(), bStart.getDate() - 1);
        const rangeA = `${_fmtDDMMYYYY(aStart)} עד ${_fmtDDMMYYYY(aEndLabel)}`;
        const rangeB = `${_fmtDDMMYYYY(bStart)} עד ${_fmtDDMMYYYY(lastDayY)}`;
        if (sumA > 0 && daysA.size / expectedA >= 0.95 && daysB.size / expectedB >= 0.95) {
            const growthPct = (sumB - sumA) / sumA * 100;
            const pctAbs = Math.abs(growthPct).toFixed(1);
            // ניסוח בלי סימן +/- צמוד למספר (בעברית RTL סימן כזה נוטה להיצמד בצד הלא נכון של המספר)
            const changeText = growthPct > 2 ? `עלייה של ${pctAbs}%`
                : (growthPct < -2 ? `ירידה של ${pctAbs}%` : `ללא שינוי משמעותי (${pctAbs}% בלבד)`);
            const advice = growthPct > 2
                ? ' מגמת עלייה - שווה לשקול את סליידר "גדילת צריכה עתידית" בשלב 2.'
                : (growthPct < -2 ? ' מגמת ירידה - שווה לשים לב שלא להגדיל את המערכת מעבר לצריכה הנוכחית.' : '');
            html += `<li>📈 השוואה בין שתי שנים מלאות (מיושרות לסוף הנתונים): ${rangeA} (${Math.round(sumA).toLocaleString()} קוט"ש) מול ${rangeB} (${Math.round(sumB).toLocaleString()} קוט"ש) - ${changeText}.${advice}</li>`;
        } else {
            html += `<li>⚠️ לא ניתן להשוות בין שתי השנים (${rangeA} מול ${rangeB}): חסרים נתונים באחת התקופות (פחות מ-95% מהימים).</li>`;
        }
    } else {
        html += `<li>ℹ️ הנתונים מכסים ${totalDays} ימים - לא מספיק לשתי שנים מלאות, ולכן לא מוצגת השוואה בין שנים (השוואה בין תקופות חלקיות נותנת "ירידה" או "עלייה" מדומות).</li>`;
    }
}
```

#### 4.4.9 חיוב מטופס הלקוח — 🔴 D7

```js
function offerBillingFromFormJson(payload) {
    if (!payload || !payload.billing) return;
    if (payload.billing.annual) document.getElementById('annualTotalKwh').value = payload.billing.annual;
    if (payload.client && payload.client.propertyType) {
        const sel = document.getElementById('propertyTypeSelect');
        for (const opt of sel.options) { if (opt.value === payload.client.propertyType) { sel.value = payload.client.propertyType; updatePropertyTypeDesc(); break; } }
    }
    if (Array.isArray(payload.billing.monthly) && payload.billing.monthly.some(m => m && m.kwh)) {
        toggleMonthlyBilling();
        payload.billing.monthly.forEach(m => {
            if (!m) return;
            const idx = HEB_MONTHS_GREG.findIndex((_, i) => i === m.month);
            const inp = document.querySelector('.monthly-kwh-input[data-month="' + idx + '"]');
            if (inp && m.kwh) inp.value = m.kwh;
        });
    }
}
```

```js
function getMonthlyBillingValues() {
    const inputs = document.querySelectorAll('.monthly-kwh-input');
    const vals = new Array(12).fill(null);
    inputs.forEach(inp => { if (inp.value) vals[parseInt(inp.dataset.month, 10)] = parseFloat(inp.value); });
    return vals.some(v => v !== null) ? vals : null;
}
```

#### 4.4.10 מנוע המלצה, הצעות סוללה/ממיר — 🔴 D2, D3, D12

```js
function findOptimalSystemSize(){
    const statusEl = document.getElementById('recStatus');
    const roofArea = parseFloat(document.getElementById('rec_roofArea').value);
    const connLimit = parseFloat(document.getElementById('rec_connLimit').value);
    const budget = parseFloat(document.getElementById('rec_budget').value);
    if(!roofArea && !connLimit){
        statusEl.innerHTML = '<span style="color:#c0392b">נא להזין שטח גג פנוי או הספק חיבור מקסימלי - לפחות אחד מהשניים.</span>';
        return;
    }
    statusEl.innerHTML = '<span style="color:#7f8c8d">מחפש... (עשוי לקחת מספר שניות)</span>';

    const baseInputs = gatherBaseInputsForSearch();
    const peakDayCounts = computeSeasonalPeakDayCounts(baseInputs.reportYear);

    const maxByRoof = roofArea ? roofArea/7.5 : Infinity;
    const maxByConn = connLimit || Infinity;
    const maxByBudget = budget ? budget/baseInputs.capexPV : Infinity;
    const maxKw = Math.min(maxByRoof, maxByConn, maxByBudget, 630 - baseInputs.p0);
    if(!isFinite(maxKw) || maxKw < 1){
        statusEl.innerHTML = '<span style="color:#c0392b">לא ניתן לגזור גודל מערכת מהנתונים שהוזנו.</span>';
        return;
    }
    const minKw = Math.min(3, maxKw);

    // --- שלב א: חיפוש גודל פאנלים מיטבי (ללא אגירה) ---
    let bestPv = null;
    for(let kw = minKw; kw <= maxKw + 1e-9; kw += 1){
        const k = Math.min(kw, maxKw);
        const tariff = calcStaircaseTariff(baseInputs.p0, baseInputs.p0 + k, false);
        if(tariff === null) { if(k >= maxKw) break; continue; }
        const inputs = Object.assign({}, baseInputs, { targetKw: k });
        const result = runFinancialModel(k, 0, tariff, inputs, peakDayCounts);
        const meaningfullyBetter = !bestPv || result.irrEquity > bestPv.result.irrEquity + 0.5; // סף 0.5 נקודת-אחוז לתיקו
        const tiedButMoreProfit = bestPv && Math.abs(result.irrEquity - bestPv.result.irrEquity) <= 0.5 && result.totalProfit > bestPv.result.totalProfit;
        if(meaningfullyBetter || tiedButMoreProfit) bestPv = { kw: k, tariff, result };
        if(k >= maxKw) break;
    }
    if(!bestPv){
        statusEl.innerHTML = '<span style="color:#c0392b">לא נמצא גודל תקין בטווח.</span>';
        return;
    }

    // --- שלב ב: חיפוש גודל אגירה מיטבי (רק אם יש נתוני צריכה) ---
    const seasonStats = computeSeasonPeakStatsFromRawSeries();
    let bestBat = null, consConfidence = 'low';
    if(seasonStats){
        consConfidence = 'high';
        const tariffWithStorage = calcStaircaseTariff(baseInputs.p0, baseInputs.p0 + bestPv.kw, true);
        const minInjection = bestPv.kw * 800;
        const directInjection = bestPv.kw * 79;
        const gapKwhYear = Math.max(0, minInjection - directInjection);
        let floorKwh = gapKwhYear > 0 ? gapKwhYear/115 : 0;

        // גיבוי שבת/חג (אם סומן בסעיף 3) - מעלה את רצפת הגודל
        if(baseInputs.useStorageShabbat || baseInputs.useStorageHoliday){
            const hoursBackup = baseInputs.useStorageHoliday ? 50 : 25.5;
            const shabbatKwh = baseInputs.estShabbatLoad * hoursBackup;
            floorKwh = Math.max(floorKwh, shabbatKwh);
        }

        const typicalPeak = Math.max(seasonStats.winter.trimmed||0, seasonStats.summer.trimmed||0, seasonStats.transition.trimmed||0);
        const ceilKwh = Math.max(floorKwh*1.2, typicalPeak*1.5, 10);
        const step = Math.max(1, Math.round((ceilKwh-floorKwh)/15));

        for(let bkwh = Math.max(floorKwh,1); bkwh <= ceilKwh + 1e-9; bkwh += step){
            const inputs = Object.assign({}, baseInputs, { targetKw: bestPv.kw });
            const result = runFinancialModel(bestPv.kw, bkwh, tariffWithStorage, inputs, peakDayCounts);
            const meaningfullyBetterBat = !bestBat || result.irrEquity > bestBat.result.irrEquity + 0.5;
            const tiedButMoreProfitBat = bestBat && Math.abs(result.irrEquity - bestBat.result.irrEquity) <= 0.5 && result.totalProfit > bestBat.result.totalProfit;
            if(meaningfullyBetterBat || tiedButMoreProfitBat) bestBat = { kwh: bkwh, result };
        }
    }

    lastRecommendation = { bestPv, bestBat, baseInputs, consConfidence, roofArea, connLimit, budget };
    renderRecommendationResults();
    statusEl.innerHTML = '';
}
```

```js
function applySuggestedBattery() {
    const dod = CALC_CONSTANTS.battery.dod;
    const shabbatLoad = parseFloat(document.getElementById('estShabbatLoad').value) || 0;
    const useHoliday = document.getElementById('useStorageHoliday').checked;
    const useShabbat = document.getElementById('useStorageShabbat').checked;
    const targetKw = parseFloat(document.getElementById('calc_targetKw').value) || 0;
    let suggestion;
    if (useHoliday) suggestion = (shabbatLoad * 2.2) / dod;
    else if (useShabbat) suggestion = (shabbatLoad * 1.2) / dod;
    else suggestion = targetKw * 0.75;
    document.getElementById('actualBatteryKwh').value = suggestion.toFixed(1);
    if (parseFloat(document.getElementById('inverterPowerKw').value) === 0) applySuggestedInverterPower();
}
```

```js
function applySuggestedInverterPower() {
    const usableKwh = parseFloat(document.getElementById('actualBatteryKwh').value) || 0;
    const nominalKwh = usableKwh > 0 ? usableKwh / CALC_CONSTANTS.battery.dod : 0;
    const fromBatteryRate = nominalKwh * CALC_CONSTANTS.battery.cRate;

    let fromConsumptionPeak = 0;
    let peakNote = '';
    if (globalRawSeries && globalRawSeries.length) {
        const peakKwh = Math.max(...globalRawSeries.map(p => p.kwh));
        fromConsumptionPeak = peakKwh * 1.15;
        peakNote = ` (פיק צריכה בפועל משלב 1: ${peakKwh.toFixed(1)} קוו"ט × 1.15 מרווח ביטחון = ${fromConsumptionPeak.toFixed(1)} קוו"ט)`;
    }
    const finalValue = Math.max(fromBatteryRate, fromConsumptionPeak);
    document.getElementById('inverterPowerKw').value = finalValue.toFixed(1);
    const note = document.getElementById('batterySuggestNote');
    if (note) note.innerHTML = `הספק ממיר: ${finalValue.toFixed(1)} קוו"ט = מקסימום בין 0.2C-סוללה (${fromBatteryRate.toFixed(1)}) לבין דרישת שיא הצריכה${peakNote}.`;
}
```

```js
function saveAndContinueToStage3() {
    if (!clientIdS2) { alert('לא נמצא מזהה לקוח. יש לפתוח את הדף הזה מתוך כרטיס לקוח קיים.'); return; }
    const statusEl = document.getElementById('continueStatus');
    statusEl.textContent = 'שומר...';
    const sizingRecommendation = {
        recommendedPanelsKw: parseFloat(document.getElementById('calc_targetKw').value) || 0,
        recommendedBatteryKwh: parseFloat(document.getElementById('actualBatteryKwh').value) || 0,
        recommendedInverterKw: parseFloat(document.getElementById('inverterPowerKw').value) || 0,
        futureGrowthPct: parseFloat(document.getElementById('futureGrowthSlider').value) || 0,
        useStorageShabbat: document.getElementById('useStorageShabbat').checked,
        useStorageHoliday: document.getElementById('useStorageHoliday').checked,
        generatorCost: parseFloat(document.getElementById('generatorCost').value) || 0,
        generatedAt: new Date().toISOString()
    };
    google.script.run
        .withSuccessHandler(function (res) {
            if (res && res.ok) {
                statusEl.innerHTML = '<span style="color:#1e8449">✓ נשמר. עובר לשלב 3...</span>';
                google.script.run.withSuccessHandler(function (url) {
                    window.location.href = url + '?page=finance&clientId=' + encodeURIComponent(clientIdS2);
                }).getWebAppUrl();
            } else {
                statusEl.innerHTML = '<span style="color:#c0392b">⚠️ ' + (res ? res.message : 'שגיאה לא ידועה') + '</span>';
            }
        })
        .withFailureHandler(function (err) { statusEl.innerHTML = '<span style="color:#c0392b">⚠️ השמירה נכשלה: ' + (err.message || err) + '</span>'; })
        .saveSizingRecommendation(JSON.stringify({ clientId: clientIdS2, sizingRecommendation }));
}
```

#### 4.4.11 שמירת שלב 3 — ✅ (🔴 D2 לגבי שטח הגג בדוח)

```js
function saveResultsAndReturnToIndex() {
    const statusEl = document.getElementById('continueStatus');
    if (!globalSimulationData) { statusEl.innerHTML = '<span style="color:#c0392b">יש להריץ חישוב (כפתור "חשב") לפני השמירה.</span>'; return; }
    if (!clientIdS3) { statusEl.innerHTML = '<span style="color:#c0392b">לא נמצא מזהה לקוח - יש לפתוח דף זה מתוך כרטיס לקוח קיים.</span>'; return; }
    const { pvOnly, withBat, inputs } = globalSimulationData;
    const finalResult = withBat.batKwh > 0 ? withBat : pvOnly;

    const payload = {
        withBat: { capacity: finalResult.capacity, batKwh: finalResult.batKwh, totalProfit: finalResult.totalProfit, irr: finalResult.irrEquity.toFixed(1), capex: finalResult.capex, equity: finalResult.equity },
        inputs: { roofArea: (stage2RoofArea || inputs.targetKw * 5.5).toFixed(0), useStorageShabbat: inputs.useStorageShabbat, useStorageHoliday: inputs.useStorageHoliday },
        rawAssumptions: {
            weightedTariff: calcStaircaseTariff(inputs.p0, inputs.p0 + inputs.targetKw, withBat.batKwh > 0),
            yieldPerKwp: CALC_CONSTANTS.yieldBase * inputs.azimuth * inputs.shading,
            degradationPct: CALC_CONSTANTS.degradation * 100,
            urbanEligible: inputs.isUrban, urbanPremium: CALC_CONSTANTS.urbanPremium, urbanYears: CALC_CONSTANTS.urbanPremiumYears,
            opexPerKwp: finalResult.batKwh > 0 ? inputs.opexWithStorage : inputs.opexPvOnly,
            batteryAnnualValue0: finalResult.batteryArbRevenue || 0,
            batteryCapex: finalResult.batKwh > 0 ? (finalResult.capex - pvOnly.capex) : 0,
            batteryDegradationPct: 2.2,
            loanPct: inputs.loanPct * 100, loanRatePct: inputs.loanInt * 100, loanYears: inputs.loanYrs,
            discountRatePct: CALC_CONSTANTS.discountRate * 100
        },
        clientId: clientIdS3, source: 'financial-model-stage3', transferredAt: new Date().toISOString()
    };

    statusEl.textContent = 'שומר...';
    google.script.run
        .withSuccessHandler(function (res) {
            if (res && res.ok) {
                statusEl.innerHTML = '<span style="color:#1e8449">✓ נשמר. חוזר למערכת ההצעות...</span>';
                google.script.run.withSuccessHandler(function (url) {
                    window.location.href = url + '?clientId=' + encodeURIComponent(clientIdS3);
                }).getWebAppUrl();
            } else {
                statusEl.innerHTML = '<span style="color:#c0392b">⚠️ ' + (res ? res.message : 'שגיאה לא ידועה') + '</span>';
            }
        })
        .withFailureHandler(function (err) { statusEl.innerHTML = '<span style="color:#c0392b">⚠️ השמירה נכשלה: ' + (err.message || err) + '</span>'; })
        .updateCalculatorResults(JSON.stringify({
            clientId: clientIdS3, totalPrice: finalResult.capex, annualSavings: Math.round(finalResult.totalProfit / 25),
            roi: finalResult.irrEquity.toFixed(1) + '%', profit25: Math.round(finalResult.totalProfit), rawCalculatorData: payload
        }));
}
```

```js
function updateCalculatorResults(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = JSON.parse(payload);

  if (!data.clientId) {
    return { ok: false, message: "לא התקבל מזהה לקוח מהמחשבון - יש לפתוח את המחשבון מתוך כרטיס לקוח קיים." };
  }

  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.clientId).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex < 1) {
    return { ok: false, message: "לא נמצא לקוח קיים עם מזהה " + data.clientId + " בגיליון. יש לשמור את פרטי הלקוח במערכת ההצעות (Index) לפני שליחת תוצאות מהמחשבון." };
  }

  // עמודות 20-23: מחיר/חיסכון/תשואה/רווח מצטבר (רק אם נשלחו בפועל)
  if (data.totalPrice !== undefined) sheet.getRange(rowIndex, 20).setValue(data.totalPrice || "");
  if (data.annualSavings !== undefined) sheet.getRange(rowIndex, 21).setValue(data.annualSavings || "");
  if (data.roi !== undefined) sheet.getRange(rowIndex, 22).setValue(data.roi || "");
  if (data.profit25 !== undefined) sheet.getRange(rowIndex, 23).setValue(data.profit25 || "");
  // עמודה 29: מארז הנתונים הגולמיים המלא (IRR/NPV/הנחות-יסוד) לשימוש עמוד ההדפסה
  if (data.rawCalculatorData !== undefined) sheet.getRange(rowIndex, 29).setValue(JSON.stringify(data.rawCalculatorData));

  return { ok: true, message: "תוצאות המחשבון נשמרו בהצלחה לתיק הלקוח " + data.clientId + "." };
}
```

#### 4.4.12 כפתורי המשך ב-Index — ✅ (🔴 D14)

```js
function renderStageButtons(customerRecord) {
    const container = document.getElementById('stageButtonsContainer');
    const statusLine = document.getElementById('stageStatusLine');
    if (!container) return;

    // הערה: customerRecord מגיע מ-globalCustomers (getDisplayValues בצד שרת) - ערכי מחרוזת גולמיים,
    // מספיק כדי לבדוק "יש תוכן / אין תוכן" (לא צריך JSON.parse בשביל זה).
    const hasStage1 = !!(customerRecord && customerRecord['נתוני צריכה מועשרים (JSON)']);
    const hasStage2 = !!(customerRecord && customerRecord['המלצת גודל מערכת (JSON)']);
    const hasStage3 = !!(customerRecord && customerRecord['נתוני חישוב גולמיים (JSON)']);

    let html, status;
    if (!hasStage1) {
        html = `<button type="button" class="btn-add" onclick="openStageConsumption()" style="background:#38bdf8;color:white;border-color:#38bdf8;">🔍 התחל ניתוח צריכה (שלב 1)</button>`;
        status = 'טרם בוצע ניתוח צריכה עבור לקוח זה.';
    } else if (!hasStage2) {
        html = `<button type="button" class="btn-add" onclick="openStageSizing()" style="background:#a855f7;color:white;border-color:#a855f7;">➡️ המשך להמלצת גודל מערכת (שלב 2)</button>
                <button type="button" class="btn-add" onclick="openStageConsumption()" style="background:#fff;color:#38bdf8;border:1.5px dashed #38bdf8;">✏️ ערוך ניתוח צריכה</button>`;
        status = 'ניתוח צריכה (שלב 1) הושלם. טרם הוגדרה המלצת גודל מערכת.';
    } else if (!hasStage3) {
        html = `<button type="button" class="btn-add" onclick="openStageFinance()" style="background:#10b981;color:white;border-color:#10b981;">➡️ המשך למודל פיננסי (שלב 3)</button>
                <button type="button" class="btn-add" onclick="openStageSizing()" style="background:#fff;color:#a855f7;border:1.5px dashed #a855f7;">✏️ ערוך המלצת גודל</button>`;
        status = 'המלצת גודל מערכת (שלב 2) הושלמה. טרם הופק מודל פיננסי.';
    } else {
        html = `<button type="button" class="btn-add" onclick="openStageFinance()" style="background:#10b981;color:white;border-color:#10b981;">📈 פתח מודל פיננסי (שלב 3)</button>
                <button type="button" class="btn-add" onclick="openStageConsumption()" style="background:#fff;color:#7f8c8d;border:1.5px dashed #ccc;">🔄 התחל ניתוח מחדש</button>`;
        status = '✓ כל שלושת השלבים (ניתוח צריכה, המלצת גודל, מודל פיננסי) הושלמו עבור לקוח זה.';
    }
    container.innerHTML = html;
    if (statusLine) statusLine.textContent = status;
}
```

#### 4.4.13 ייצוא Excel — 🔴 D8-D11, D13 (לא הורץ בשרת)

צד לקוח (בונה payload):

```js
function buildExcelPayload() {
    const series = (window._unifiedResult ? window._unifiedResult.finalSeries : globalRawSeries) || [];
    if (!series.length) return null;
    const hasProduction = !!(window._productionSeries && window._productionSeries.length);
    const prodByTime = {};
    if (hasProduction) window._productionSeries.forEach(p => { prodByTime[p.date.getTime()] = p.kwh; });

    // --- מבנה היררכי לטבלה המפלצתית: שנה -> עונה -> יום -> (קיבוץ יום עברי) -> שעות ---
    const sorted = series.slice().sort((a, b) => a.date - b.date);
    const seasonsMap = {}; // { winter: {name, kwh:{offpeak,peak}, payment:{...}, daysMap:{dateStr:{...}}} }
    let annualCons = { offpeak: 0, peak: 0 }, annualPay = { offpeak: 0, peak: 0 };

    sorted.forEach(p => {
        const cls = classifyHour(p.date);
        const seasonKey = cls.season;
        const rate = calcStaircaseTariff(0, 0, false); // נשען על ההגדרות השמורות (cfg_*) שנטענו/נשמרו במודל השטח
        const tariffPerKwh = cls.isPeak ? (rate.peak || 0.6) : (rate.offpeak || 0.3);
        const payment = p.kwh * tariffPerKwh;
        const tariffType = cls.isPeak ? 'פסגה' : 'שפל';

        if (!seasonsMap[seasonKey]) seasonsMap[seasonKey] = { name: SEASON_HEB[seasonKey] || seasonKey, kwh: { offpeak: 0, peak: 0 }, payment: { offpeak: 0, peak: 0 }, daysMap: {} };
        const sObj = seasonsMap[seasonKey];
        sObj.kwh[cls.isPeak ? 'peak' : 'offpeak'] += p.kwh;
        sObj.payment[cls.isPeak ? 'peak' : 'offpeak'] += payment;
        annualCons[cls.isPeak ? 'peak' : 'offpeak'] += p.kwh;
        annualPay[cls.isPeak ? 'peak' : 'offpeak'] += payment;

        const dateStr = (p.date.getMonth() + 1).toString().padStart(2, '0') + '/' + p.date.getDate().toString().padStart(2, '0') + '/' + p.date.getFullYear();
        if (!sObj.daysMap[dateStr]) sObj.daysMap[dateStr] = { date: dateStr, dayOfWeek: HEB_DOW[p.date.getDay()], kwh: { offpeak: 0, peak: 0 }, payment: { offpeak: 0, peak: 0 }, hebrewGroups: {}, hours: [] };
        const dObj = sObj.daysMap[dateStr];
        dObj.kwh[cls.isPeak ? 'peak' : 'offpeak'] += p.kwh;
        dObj.payment[cls.isPeak ? 'peak' : 'offpeak'] += payment;

        const hebLabel = formatHebrewDateLabel(toHebrewDate(p.date));
        if (!dObj.hebrewGroups[hebLabel]) dObj.hebrewGroups[hebLabel] = { kwh: { offpeak: 0, peak: 0 }, payment: { offpeak: 0, peak: 0 } };
        dObj.hebrewGroups[hebLabel].kwh[cls.isPeak ? 'peak' : 'offpeak'] += p.kwh;
        dObj.hebrewGroups[hebLabel].payment[cls.isPeak ? 'peak' : 'offpeak'] += payment;

        const prodKwh = hasProduction ? (prodByTime[p.date.getTime()] || 0) : null;
        dObj.hours.push({
            hourLabel: String(p.date.getHours()).padStart(2, '0') + ':00 (' + tariffType + ')',
            kwh: Number(p.kwh.toFixed(3)), payment: Number(payment.toFixed(4)), tariffType, hebrewDate: hebLabel,
            productionKwh: prodKwh != null ? Number(prodKwh.toFixed(3)) : null
        });
    });

    const seasonsArr = Object.values(seasonsMap).map(s => ({ ...s, days: Object.values(s.daysMap) }));
    const monsterTable = { yearLabel: 'שנה אחרונה', annualCons, annualPay, seasons: seasonsArr, hasProduction };

    // --- שורות שטוחות לגיליונות הפשוטים (שעתי/יומי/פסגה) ---
    const hourlyRows = sorted.map(p => {
        const row = [Utilities_fmtDateTime(p.date), HEB_DOW[p.date.getDay()], Number(p.kwh.toFixed(3))];
        if (hasProduction) row.push(prodByTime[p.date.getTime()] != null ? Number(prodByTime[p.date.getTime()].toFixed(3)) : '');
        return row;
    });
    const dailyMap = {};
    sorted.forEach(p => {
        const cls = classifyHour(p.date);
        const key = p.date.toDateString();
        if (!dailyMap[key]) dailyMap[key] = { date: p.date, total: 0, offpeak: 0, peak: 0, prod: 0 };
        dailyMap[key].total += p.kwh;
        dailyMap[key][cls.isPeak ? 'peak' : 'offpeak'] += p.kwh;
        if (hasProduction) dailyMap[key].prod += (prodByTime[p.date.getTime()] || 0);
    });
    const dailyRows = Object.values(dailyMap).map(d => {
        const row = [_fmtDDMMYYYY(d.date), HEB_DOW[d.date.getDay()], Number(d.total.toFixed(3)), Number(d.offpeak.toFixed(3)), Number(d.peak.toFixed(3))];
        if (hasProduction) row.push(Number(d.prod.toFixed(3)));
        return row;
    });
    const peakDays = Object.values(dailyMap).filter(d => d.peak > 0).map(d => {
        const rate = calcStaircaseTariff(0, 0, false);
        return [_fmtDDMMYYYY(d.date), HEB_DOW[d.date.getDay()], Number(d.peak.toFixed(3)), Number((d.peak * (rate.peak || 0.6)).toFixed(2))];
    });

    // --- מקורות נתונים, תעריפים, סוג נכס, שבת ---
    const sourcesArr = Object.entries(sourceResults).filter(([, v]) => v).map(([k, v]) => ({ label: SOURCE_LABELS[k], annualKwh: Math.round(v.annualKwh), capturedAt: v.capturedAt }));
    const rate = calcStaircaseTariff(0, 0, false);
    const tariffStructure = [
        { season: 'חורף', dayType: 'כל הימים', hourRange: 'לפי מדרגת צריכה', tariffType: 'פסגה', rate: rate.peak || '' },
        { season: 'מעבר (אביב/סתיו)', dayType: 'ימי חול', hourRange: '17:00-22:00', tariffType: 'פסגה', rate: rate.peak || '' },
        { season: 'מעבר (אביב/סתיו)', dayType: 'שאר השעות/סופ"ש', hourRange: '-', tariffType: 'שפל', rate: rate.offpeak || '' },
        { season: 'קיץ', dayType: 'ימי חול (לא סופ"ש/חג)', hourRange: '17:00-22:00', tariffType: 'פסגה', rate: rate.peak || '' },
        { season: 'קיץ', dayType: 'שאר השעות/סופ"ש/חג', hourRange: '-', tariffType: 'שפל', rate: rate.offpeak || '' }
    ];
    const propertyTypeSel = document.getElementById('propertyTypeSelect');
    const propertyTypeLabel = propertyTypeSel && propertyTypeSel.selectedOptions.length ? propertyTypeSel.selectedOptions[0].text : null;

    return {
        clientName: (document.getElementById('md_name') ? document.getElementById('md_name').innerText.trim() : '') || 'לקוח_כללי',
        hasProduction, monsterTable, hourlyRows, dailyRows, peakDays,
        stats: globalCalculatedStats || null,
        sources: sourcesArr,
        propertyType: propertyTypeSel ? propertyTypeSel.value : null,
        propertyTypeLabel,
        tariffStructure,
        shabbat: { estLoadKwh: parseFloat(document.getElementById('estShabbatLoad').value) || null, upliftPct: parseFloat(document.getElementById('shabbatUpliftSlider').value) || 0 }
    };
}
```

```js
function exportToExcel() {
    const payload = buildExcelPayload();
    if (!payload) { alert('אין נתונים לייצוא - יש לנתח/לאחד מקור נתונים לפחות אחד קודם.'); return; }
    const btn = document.getElementById('exportExcelBtn');
    btn.disabled = true; btn.textContent = '⏳ בונה קובץ Excel בשרת...';
    google.script.run
        .withSuccessHandler(function (res) {
            btn.disabled = false; btn.textContent = '📥 הורד דוחות נתונים ל-Excel';
            if (!res || !res.ok) { alert('יצירת קובץ ה-Excel נכשלה: ' + (res ? res.message : 'שגיאה לא ידועה')); return; }
            const bin = atob(res.base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = res.filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .withFailureHandler(function (err) {
            btn.disabled = false; btn.textContent = '📥 הורד דוחות נתונים ל-Excel';
            alert('יצירת קובץ ה-Excel נכשלה: ' + (err.message || err));
        })
        .generateConsumptionExcelReport(JSON.stringify(payload));
}
```

צד שרת:

```js
function generateConsumptionExcelReport(payloadJson) {
  const data = JSON.parse(payloadJson);
  const tempSS = SpreadsheetApp.create('_temp_export_' + Utilities.getUuid());
  const defaultSheet = tempSS.getSheets()[0];

  try {
    _buildMonsterSheet(tempSS, data.monsterTable, defaultSheet);
    _buildGradientDataSheet(tempSS, 'דו"ח שעתי',
      data.hasProduction ? ['תאריך ושעה', 'יום בשבוע', 'צריכה בפועל (kwh)', 'ייצור (kwh)'] : ['תאריך ושעה', 'יום בשבוע', 'צריכה בפועל (kwh)'],
      data.hourlyRows, data.hasProduction ? [2, 3] : [2]);
    _buildGradientDataSheet(tempSS, 'דו"ח יומי מרוכז',
      data.hasProduction ? ['תאריך', 'יום בשבוע', 'סה"כ (kwh)', 'שפל', 'פסגה', 'ייצור (kwh)'] : ['תאריך', 'יום בשבוע', 'סה"כ (kwh)', 'שפל', 'פסגה'],
      data.dailyRows, data.hasProduction ? [2, 3, 4, 5] : [2, 3, 4]);
    _buildGradientDataSheet(tempSS, 'ימי פסגה בלבד', ['תאריך', 'יום בשבוע', 'צריכה (kwh)', 'עלות (₪)'], data.peakDays, [2, 3]);
    _buildStatsSheet(tempSS, data.stats);
    _buildSourcesSheet(tempSS, data.sources, data.propertyType, data.propertyTypeLabel, data.shabbat);
    _buildTariffStructureSheet(tempSS, data.tariffStructure);

    tempSS.deleteSheet(defaultSheet);

    const token = ScriptApp.getOAuthToken();
    const url = 'https://docs.google.com/spreadsheets/d/' + tempSS.getId() + '/export?format=xlsx';
    const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const base64 = Utilities.base64Encode(response.getBlob().getBytes());
    return { ok: true, base64, filename: 'דוחות_צריכה_חחי_' + (data.clientName || 'לקוח_כללי') + '.xlsx' };
  } finally {
    DriveApp.getFileById(tempSS.getId()).setTrashed(true);
  }
}
```

```js
function _applyRedYellowGradient(sheet, range) {
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpoint('#FFFF99')
    .setGradientMaxpoint('#FF6666')
    .setRanges([range])
    .build();
  const rules = sheet.getConditionalFormatRules();
  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}
```

```js
function _buildGradientDataSheet(ss, name, headers, rows, gradientColIdxs) {
  const sheet = ss.insertSheet(name);
  if (!rows || !rows.length) { sheet.getRange(1, 1).setValue('אין נתונים'); return sheet; }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  _styleHeaderRow(sheet.getRange(1, 1, 1, headers.length));
  sheet.getRange(1, 1, rows.length + 1, headers.length).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(1, 1, rows.length + 1, headers.length).createFilter();
  gradientColIdxs.forEach(idx => _applyRedYellowGradient(sheet, sheet.getRange(2, idx + 1, rows.length, 1)));
  sheet.setFrozenRows(1);
  for (let c = 1; c <= headers.length; c++) sheet.autoResizeColumn(c);
  return sheet;
}
```

```js
function _buildMonsterSheet(ss, mt, existingSheet) {
  if (!mt) return;
  const sheet = existingSheet ? existingSheet.setName('פירוט שנתי מלא') : ss.insertSheet('פירוט שנתי מלא');
  const hasProduction = !!mt.hasProduction;
  const headers = ['שנה', 'צריכה שנתית (קוט"ש)', 'תשלום שנתי (₪)', 'עונה', 'צריכת עונה (קוט"ש)', 'תשלום עונתי (₪)',
    'תאריך', 'יום בשבוע', 'צריכה יומית (קוט"ש)', 'תשלום יומי (₪)', 'תאריך עברי', 'צריכת יום עברי (קוט"ש)', 'תשלום יום עברי (₪)',
    'שעה', 'צריכה שעתית (קוט"ש)', 'תשלום שעתי (₪)'];
  if (hasProduction) headers.push('ייצור שעתי (קוט"ש)');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeaderRow(sheet.getRange(1, 1, 1, headers.length));

  let row = 2;
  const yearStartRow = row;
  mt.seasons.forEach(season => {
    const seasonStartRow = row;
    season.days.forEach(day => {
      const dayStartRow = row;
      // קיבוץ תאריך עברי בתוך היום (עשוי להיות שונה מגבולות היום הגרגוריאני, ר' getZmanInfo בצד לקוח)
      let hIdx = 0;
      while (hIdx < day.hours.length) {
        const hebLabel = day.hours[hIdx].hebrewDate;
        const hebStartRow = row;
        while (hIdx < day.hours.length && day.hours[hIdx].hebrewDate === hebLabel) {
          const h = day.hours[hIdx];
          const rowData = [null, null, null, null, null, null, null, null, null, null, null, null, null, h.hourLabel, h.kwh, h.payment];
          if (hasProduction) rowData.push(h.productionKwh != null ? h.productionKwh : '');
          sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
          const hourCell = sheet.getRange(row, 14);
          const isOffpeak = h.tariffType === 'שפל';
          hourCell.setBackground(isOffpeak ? '#CCFFCC' : '#FFCCCC');
          sheet.getRange(row, 15, 1, 2).setBackground(isOffpeak ? '#CCFFCC' : '#FFCCCC');
          row++; hIdx++;
        }
        if (row - 1 >= hebStartRow) {
          sheet.getRange(hebStartRow, 11).setValue(hebLabel);
          if (row - 1 > hebStartRow) sheet.getRange(hebStartRow, 11, row - hebStartRow, 1).merge();
          const hebCons = day.hebrewGroups && day.hebrewGroups[hebLabel];
          if (hebCons) {
            sheet.getRange(hebStartRow, 12).setValue(_fmtTariffSplit(hebCons.kwh));
            sheet.getRange(hebStartRow, 13).setValue(_fmtTariffSplit(hebCons.payment));
            if (row - 1 > hebStartRow) { sheet.getRange(hebStartRow, 12, row - hebStartRow, 1).merge(); sheet.getRange(hebStartRow, 13, row - hebStartRow, 1).merge(); }
          }
        }
      }
      sheet.getRange(dayStartRow, 7).setValue(day.date);
      sheet.getRange(dayStartRow, 8).setValue(day.dayOfWeek);
      sheet.getRange(dayStartRow, 9).setValue(_fmtTariffSplit(day.kwh));
      sheet.getRange(dayStartRow, 10).setValue(_fmtTariffSplit(day.payment));
      if (row - 1 > dayStartRow) {
        sheet.getRange(dayStartRow, 7, row - dayStartRow, 1).merge();
        sheet.getRange(dayStartRow, 8, row - dayStartRow, 1).merge();
        sheet.getRange(dayStartRow, 9, row - dayStartRow, 1).merge();
        sheet.getRange(dayStartRow, 10, row - dayStartRow, 1).merge();
      }
    });
    sheet.getRange(seasonStartRow, 4).setValue(season.name);
    sheet.getRange(seasonStartRow, 5).setValue(_fmtTariffSplit(season.kwh));
    sheet.getRange(seasonStartRow, 6).setValue(_fmtTariffSplit(season.payment));
    if (row - 1 > seasonStartRow) {
      sheet.getRange(seasonStartRow, 4, row - seasonStartRow, 1).merge();
      sheet.getRange(seasonStartRow, 5, row - seasonStartRow, 1).merge();
      sheet.getRange(seasonStartRow, 6, row - seasonStartRow, 1).merge();
    }
  });
  sheet.getRange(yearStartRow, 1).setValue(mt.yearLabel);
  sheet.getRange(yearStartRow, 2).setValue(_fmtTariffSplit(mt.annualCons));
  sheet.getRange(yearStartRow, 3).setValue(_fmtTariffSplit(mt.annualPay));
  if (row - 1 > yearStartRow) {
    sheet.getRange(yearStartRow, 1, row - yearStartRow, 1).merge();
    sheet.getRange(yearStartRow, 2, row - yearStartRow, 1).merge();
    sheet.getRange(yearStartRow, 3, row - yearStartRow, 1).merge();
  }
  sheet.getRange(1, 1, row - 1, headers.length).setBorder(true, true, true, true, true, true, '#dddddd', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(0);
}
```

#### 4.4.14 API JSON לנייד — 🟡 (לא הורץ בפריסה)

```js
function handleApiRequest(e) {
  const provided = e.parameter.apiKey || '';
  const expected = PropertiesService.getScriptProperties().getProperty('MOBILE_API_KEY');
  if (!expected) {
    return jsonResponse({ ok: false, error: 'לא הוגדר MOBILE_API_KEY בשרת - יש להריץ setApiKey_oneTime() פעם אחת מעורך ה-Apps Script.' });
  }
  if (provided !== expected) {
    return jsonResponse({ ok: false, error: 'apiKey שגוי או חסר.' });
  }

  try {
    if (e.parameter.api === 'customers') return jsonResponse({ ok: true, customers: apiCustomerList() });
    if (e.parameter.api === 'customer') {
      const id = e.parameter.id;
      if (!id) return jsonResponse({ ok: false, error: 'חסר פרמטר id.' });
      const data = apiCustomerDetail(id);
      if (!data) return jsonResponse({ ok: false, error: 'לקוח לא נמצא.' });
      return jsonResponse({ ok: true, customer: data });
    }
    return jsonResponse({ ok: false, error: 'api לא מוכר: ' + e.parameter.api });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'שגיאת שרת: ' + err.toString() });
  }
}
```

```js
function apiCustomerList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data.shift().map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  return data.filter(row => row[idx['ID (מזהה)']]).map(row => ({
    clientId: row[idx['ID (מזהה)']] || '',
    clientName: row[idx['שם הלקוח']] || '',
    clientAddress: row[idx['כתובת']] || '',
    clientPhone: row[idx['טלפון']] || '',
    projectTitle: row[idx['כותרת הפרויקט']] || '',
    hasStage1: !!row[idx['נתוני צריכה מועשרים (JSON)']],
    hasStage2: !!row[idx['המלצת גודל מערכת (JSON)']],
    hasStage3: !!row[idx['נתוני חישוב גולמיים (JSON)']]
  }));
}
```

```js
function setApiKey_oneTime() {
  const key = 'CHANGE-ME-to-a-random-32-char-string';
  PropertiesService.getScriptProperties().setProperty('MOBILE_API_KEY', key);
  SpreadsheetApp.getUi().alert('מפתח ה-API למובייל הוגדר. זכרו להזין את אותו המפתח באפליקציית Flutter, ולערוך את המפתח בפונקציה הזו למשהו לא-נחוש לפני ההרצה.');
}
```

#### 4.4.15 אפליקציית Flutter — 🟡 (לא קומפל)

`mobile_app/lib/services/api_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/customer.dart';

/// שכבת התקשורת היחידה מול code.js. חשוב: Google Apps Script Web Apps תמיד
/// מחזירים HTTP 200 בפועל (אין להם API לקבוע קוד סטטוס מותאם) - לכן הבדיקה
/// היחידה למי אם הבקשה הצליחה היא שדה ok בתוך גוף ה-JSON, לא סטטוס ה-HTTP.
class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class ApiService {
  static const _prefsUrlKey = 'webAppUrl';
  static const _prefsKeyKey = 'apiKey';

  String? _baseUrl;
  String? _apiKey;

  Future<void> loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString(_prefsUrlKey);
    _apiKey = prefs.getString(_prefsKeyKey);
  }

  Future<bool> get isConfigured async {
    await loadSettings();
    return (_baseUrl != null && _baseUrl!.isNotEmpty && _apiKey != null && _apiKey!.isNotEmpty);
  }

  Future<void> saveSettings({required String webAppUrl, required String apiKey}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsUrlKey, webAppUrl.trim());
    await prefs.setString(_prefsKeyKey, apiKey.trim());
    _baseUrl = webAppUrl.trim();
    _apiKey = apiKey.trim();
  }

  Future<String?> get webAppUrl async {
    await loadSettings();
    return _baseUrl;
  }

  Uri _buildUri(String api, [Map<String, String>? extra]) {
    if (_baseUrl == null || _apiKey == null) {
      throw ApiException('לא הוגדרו כתובת השרת/מפתח ה-API. יש להגדיר במסך ההגדרות.');
    }
    final params = <String, String>{'api': api, 'apiKey': _apiKey!};
    if (extra != null) params.addAll(extra);
    return Uri.parse(_baseUrl!).replace(queryParameters: params);
  }

  Future<Map<String, dynamic>> _get(String api, [Map<String, String>? extra]) async {
    await loadSettings();
    final uri = _buildUri(api, extra);
    late http.Response response;
    try {
      response = await http.get(uri).timeout(const Duration(seconds: 20));
    } catch (e) {
      throw ApiException('שגיאת רשת: לא ניתן להגיע לשרת. ודאו חיבור לאינטרנט ושכתובת ה-Web App נכונה.\n($e)');
    }
    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (e) {
      throw ApiException('תשובת שרת לא תקינה (לא JSON). ייתכן שכתובת ה-Web App שגויה, או שגרסת הפריסה ישנה.');
    }
    if (body['ok'] != true) {
      throw ApiException(body['error'] as String? ?? 'שגיאה לא ידועה מהשרת.');
    }
    return body;
  }

  Future<List<Customer>> fetchCustomers() async {
    final body = await _get('customers');
    final list = (body['customers'] as List<dynamic>? ?? []);
    return list.map((e) => Customer.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// פרטי לקוח מלאים - מפתחות עבריים גולמיים (כמו שהם בגיליון), בדיוק כמו
  /// mapServerCustomerToQuoteData ב-PrintQuote.html. לא ממופה למודל Dart נפרד
  /// כי המסך היחיד שצריך את זה (CustomerDetailScreen) רק מציג שדות בודדים.
  Future<Map<String, dynamic>> fetchCustomerDetail(String clientId) async {
    final body = await _get('customer', {'id': clientId});
    return body['customer'] as Map<String, dynamic>;
  }
}
```

`mobile_app/lib/models/customer.dart`

```dart
/// מודל לקוח קליל - תואם בדיוק לצורת התשובה של apiCustomerList() ב-code.js.
/// בכוונה לא מכיל את כל 32 העמודות (JSON כבדים של שלבי הצריכה/ההמלצה/הפיננסי) -
/// אלה נצפים דרך ה-WebView (אותם דפים מדויקים שכבר קיימים), לא משוכפלים כאן.
class Customer {
  final String clientId;
  final String clientName;
  final String clientAddress;
  final String clientPhone;
  final String projectTitle;
  final bool hasStage1;
  final bool hasStage2;
  final bool hasStage3;

  Customer({
    required this.clientId,
    required this.clientName,
    required this.clientAddress,
    required this.clientPhone,
    required this.projectTitle,
    required this.hasStage1,
    required this.hasStage2,
    required this.hasStage3,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      clientId: json['clientId'] as String? ?? '',
      clientName: json['clientName'] as String? ?? '',
      clientAddress: json['clientAddress'] as String? ?? '',
      clientPhone: json['clientPhone'] as String? ?? '',
      projectTitle: json['projectTitle'] as String? ?? '',
      hasStage1: json['hasStage1'] as bool? ?? false,
      hasStage2: json['hasStage2'] as bool? ?? false,
      hasStage3: json['hasStage3'] as bool? ?? false,
    );
  }

  /// תיאור קצר של השלב הבא, לתצוגה ברשימה - אותה לוגיקה בדיוק כמו renderStageButtons ב-Index.html
  String get nextStageLabel {
    if (!hasStage1) return 'טרם בוצע ניתוח צריכה';
    if (!hasStage2) return 'ממתין להמלצת גודל מערכת';
    if (!hasStage3) return 'ממתין למודל פיננסי';
    return 'כל השלבים הושלמו';
  }
}
```

`mobile_app/lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'screens/customer_list_screen.dart';
import 'screens/settings_screen.dart';

void main() {
  runApp(const BereshitSolarApp());
}

class BereshitSolarApp extends StatelessWidget {
  const BereshitSolarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'בראשית סולאר',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1A3A5F)),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(backgroundColor: Color(0xFF1A3A5F), foregroundColor: Colors.white),
      ),
      home: const _StartupGate(),
    );
  }
}

/// בעליית האפליקציה בודקים אם כבר הוגדרו כתובת ה-Web App ומפתח ה-API -
/// אם לא, מפנים ישר למסך ההגדרות (הרצה ראשונה); אם כן, ישר לרשימת הלקוחות.
class _StartupGate extends StatefulWidget {
  const _StartupGate();

  @override
  State<_StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<_StartupGate> {
  final _apiService = ApiService();
  bool _checking = true;
  bool _configured = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final configured = await _apiService.isConfigured;
    setState(() {
      _configured = configured;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_configured) {
      return SettingsScreen(
        apiService: _apiService,
        onSaved: () => setState(() => _configured = true),
      );
    }
    return CustomerListScreen(apiService: _apiService);
  }
}
```

עוד קבצים בארכיון: `settings_screen.dart`, `customer_list_screen.dart`, `customer_detail_screen.dart`, `webview_screen.dart`, `pubspec.yaml`, `README.md`.

## 5. מקרי קצה, אבטחה וביצועים (Edge Cases, Security & Performance)

### 5.1 מקרי קצה

| # | מקרה | טיפול נוכחי | סטטוס |
|---|---|---|---|
| E1 | קובץ חח"י על פני יותר משנה | שמירה: חלון שנה אחרונה מיושר לימים. תצוגה ו-Excel: הסדרה המלאה | ✅ |
| E2 | רזולוציית רבע-שעה | שמירה: סכימה לשעות. תצוגה: רזולוציה מקורית. Excel: ראו D9 | ✅ / 🔴 |
| E3 | שעות חסרות בתוך החלון | משבצת = 0, נספרת ב-`missingHours`. אין אינטרפולציה ואין אזהרה בממשק | 🟡 |
| E4 | שעון קיץ (יום של 23/25 שעות) | רשת לפי יום-לוח: שעה לא קיימת נספרת חסרה; שעה כפולה מסתכמת למשבצת אחת. פענוח בחשבון לוח-שנה | 🟡 לא נבדק |
| E5 | שנה מעוברת | אורך חלון לפי תאריכי לוח (8,784 שעות; 23,424 תווים) | 🟡 חישוב גודל בלבד |
| E6 | יום אחרון חלקי | נכלל כמות שהוא. בדיקת כיסוי בהשוואת שנים סופרת ימים עם נתון כלשהו ואינה מזהה יום חלקי | 🟡 |
| E7 | פחות משנה בקובץ | חלון נחתך להתחלה בפועל (`days < 365`). שלבים 2-3 אינם מתריעים | 🟡 |
| E8 | ערך שעתי מעל 65.5 קוט"ש | `scale` יורד ל-100/10/1. אין חיתוך | ✅ |
| E9 | פסיק עשרוני בקובץ (`1,5`) | `parseMultimeterRows` מסיר `,` ולכן `1,5` הופך ל-`15` | 🔴 הערכת-יתר פי 10 בקבצים עם פסיק עשרוני. נדרש זיהוי מפריד |
| E10 | מונים כפולים לאותו חותם-זמן | ממוצע, לא סכום | ✅ |
| E11 | מונה ייצור בלי מונה דו-כיווני | `feedIn = 0`: כל הייצור נחשב צריכה עצמית. מנפח צריכה אם יש הזרמה | 🟡 |
| E12 | סוג מונה לא מזוהה | נחשב צריכה | 🟡 |
| E13 | מקורות סותרים (>15%) | אזהרה, לא חסימה | ✅ |
| E14 | `blendShapes` על סדרות באורך שונה | מדלג על אינדקסים חסרים. בפועל שתי הסדרות לאותה שנה | 🟡 |
| E15 | קובץ בלי שבתות / שבת חלקית (≤ 20 נקודות) | הודעה בפאנל ובכרטיס שבת. שבת חלקית נספרת חסרה | ✅ |
| E16 | חגים אחרי 2030 | `knownHolidays` קשיח עד 2030 | 🟡 |
| E17 | מיקום גאוגרפי | שקיעה לפי תל אביב לכל הלקוחות | 🟡 |
| E18 | ימי חריגה | סף `3.5·MAD`; רגיש מהסטנדרט | 🟡 |
| E19 | אין `clientId` | שלב 1: חסימת שמירה בהודעה. שלבים 2-3: באנר וחסימת כפתורים | ✅ |
| E20 | `google.script.url.getLocation` ריק | נפילה ל-`URLSearchParams` | ✅ |
| E21 | שלב 2 בלי עמודה 30 | כפתורי המלצה/סימולציה חסומים | ✅ |
| E22 | שלב 2 נשמר כש-`calc_targetKw = 0` (לא נלחץ "החל המלצה") | `recommendedPanelsKw: 0` נשמר; שלב 3 חוסם | 🔴 D15 |
| E23 | שלב 3 בלי עמודה 31 / לפני חישוב | `calcBtn` חסום / שמירה חסומה בהודעה | ✅ |
| E24 | שמירה ללקוח שאינו בגיליון | `{ok:false}` עם הודעה. לא נוצרת שורה | ✅ (קוד) |
| E25 | `consumptionAnalysis` מעל 49,000 תווים | השרת דוחה עם הודעה | ✅ (קוד) |
| E26 | שמירה מ-Index אחרי שלב 3 | עמודה 29 נמחקת | 🔴 D1 |
| E27 | Index פתוח בלשונית ישנה אחרי שלב 3 | `globalCustomers` ישן; כפתורי שלב לא מתעדכנים עד רענון | 🟡 D14 |
| E28 | כתיבה במקביל מכמה משתמשים/מכשירים | last-write-wins, ללא `LockService` | 🔴 |
| E29 | API: מפתח חסר/שגוי, `id` חסר/לא קיים | `{ok:false, error}` | 🟡 |
| E30 | Flutter: השרת מחזיר HTML (למשל דף התחברות) | "תשובת שרת לא תקינה (לא JSON)" | 🟡 |
| E31 | Flutter: אין רשת | `timeout(20s)` + הודעה | 🟡 |

### 5.2 ביצועים

**נמדד (הרצה בדפדפן, ללא שרת):**

| פעולה | קלט | תוצאה |
|---|---|---|
| `buildExcelPayload` | 8,760 נקודות (שעתי, שנה) | 71 ms. JSON 2.78 MB |
| `buildExcelPayload` | 70,176 נקודות (רבע-שעה, שנתיים) | 341 ms. JSON 20.7 MB. 96 "שעות" ליום בטבלת-על |
| אריזת שנה | 8,760 ערכים | 23,360 תווים (47% מהתקרה) |
| שמירה (קובץ דו-שנתי רבע-שעה) | 70,176 נקודות | `consumptionAnalysis` = 23,664 תווים |

**ניתוח (לא נמדד):**

| רכיב | מורכבות / הערה |
|---|---|
| `aggregateToHourlyGrid` | זמן O(n). זיכרון O(24·days) |
| `computeWeeklyShabbatProfiles` | מעבר ראשון O(n) עם `isInHalachicShabbat` (שני חישובי שקיעה לקריאה). לכל שבת סריקת סדרה (S·n השוואות), הבדיקה היקרה רק לנקודות בחלון ~6 ימים. נקרא 3 פעמים בטעינה: `showFilePreview`, `renderReports`, `onShabbatUpliftChange`. `detectExceptionDays` נקרא בכל קריאה. אין Memoization. המלצה: מטמון לפי הפניה לסדרה |
| `findOptimalSystemSize` | שלב PV: עד `maxKw` הרצות `runFinancialModel` (25 שנה כל אחת). שלב אגירה: ~16 הרצות. סינכרוני על ה-Thread הראשי |
| `runBatteryDispatchSimulation` | O(n) צעדים. סינכרוני |
| `_buildMonsterSheet` (שרת) | ~3 קריאות שירות לכל שורת שעה + מיזוגים. שנה שעתית ≈ 26,000 קריאות; שנתיים ברבע-שעה ≈ 210,000. קריאה לא מקובצת ב-Sheets: סדר גודל עשרות-מאות ms. חריגה מ-6 דקות סבירה מאוד (הערכה) |
| `google.script.run` | מגבלת גודל ארגומנט לא נבדקה. payload של 20.7 MB מסוכן |

I/O: כל קריאות השרת אסינכרוניות. חישובים כבדים (איחוד, ניתוח, חיפוש, סימולציה) רצים ב-Thread הראשי ומקפיאים את הדף. נקודת שיפור: `Web Worker` או פיצול לצעדים עם `setTimeout`.

### 5.3 אבטחה, הרשאות ותקינות נתונים

1. **חשיפת פונקציות שרת**: כל פונקציה גלובלית ב-`code.js` שאינה מסתיימת ב-`_` ניתנת לקריאה מהדפדפן דרך `google.script.run` (כולל `getInitialData` שמחזיר את כל הלקוחות, `saveCustomerData`, `setApiKey_oneTime`, `oneTimeSetup_*`, `generateConsumptionExcelReport` שיוצר קבצים ב-Drive של הבעלים). הגנה בפועל = הגדרת הגישה של ה-Web App בלבד. טופס הלקוח (`Form.html`) מחייב נגישות ללקוחות, ולכן אם הפריסה "Anyone" כל נתוני הלקוחות חשופים למי שמטעין דף כלשהו. 🔴 D16.
2. **מפתח ה-API למובייל**: מוגן רק את נתיב `?api=`. מפתח עובר כפרמטר URL (מופיע בלוגים/היסטוריה). Apps Script אינו חושף כותרות בקשה ל-`doGet`. מפתח נשמר ב-Script Properties (לא בקוד), אך הקבוע ב-`setApiKey_oneTime` חייב להיערך לפני הרצה ולהימחק אחריה.
3. **הצפנת נתוני טופס**: RSA-OAEP 2048/SHA-256 + AES-256-GCM. המפתח הפרטי רק בכלי הפענוח הלא-מקוון, בזיכרון. אין הליך החלפת מפתח (החלפה = עדכון `RSA_PUBLIC_KEY_B64` ופענוח קבצים ישנים דורש את המפתח הישן).
4. **Flutter**: המפתח נשמר ב-`SharedPreferences` (לא מוצפן). המלצה: `flutter_secure_storage`. `WebView` עם `JavaScriptMode.unrestricted` ובלי רשימת ניווט מותרת. המלצה: `NavigationDelegate.onNavigationRequest` שמאפשר רק את מארח ה-Web App.
5. **תקינות נתונים**: כתיבות שלב הן עדכוני עמודות (לא דורסות שורה). חריג: `saveCustomerData` (D1). השרת מבצע `JSON.parse` על ה-payload ללא אימות סכימה. התאמת לקוח לפי `String(...).trim()` שווה. אין נעילה ואין גרסאות.
6. **XSS**: קוד שנכתב בפיתוח זה בונה HTML מהודעות שרת ומערכים מספריים; מחרוזות לקוח מוצגות ב-`textContent` בקוד החדש. 🟡 קוד Legacy ב-`Index.html`/`PrintQuote.html` לא נסקר לעניין זה.
7. **קבצים זמניים**: `generateConsumptionExcelReport` יוצר `_temp_export_<uuid>` ומעביר לפח ב-`finally`. ריצה שנקטעה (חריגת זמן) משאירה קובץ יתום.

---

## 6. מפת דרכים והצעדים הבאים (Roadmap & Pending Tasks)

### 6.1 פגמים מאומתים (חייבים טיפול)

מקור האימות: קריאת קוד, ו/או הרצה בדפדפן, ו/או grep. מספרי שורות משוערים (הקבצים משתנים).

**D1 — עמודה 29 נמחקת בשמירה מ-Index (חומרה גבוהה, אובדן נתונים)**
- מיקום: `code.js` `saveCustomerData`: `data.rawCalculatorData ? JSON.stringify(...) : ""` (כתיבת שורה 1-29). `Index.html` `selectCustomer` מציב `lastCalculatorRawData = null`.
- ראיה: קריאת קוד. כפתור "משוך נתונים מהמחשבון" הוסר בשינוי האחרון, כך שאין דרך לשחזר `lastCalculatorRawData`.
- תיקון: בשרת — כש-`rawCalculatorData` ריק, לשמר את ערך התא הקיים. לחלופין ב-`selectCustomer`: `lastCalculatorRawData = JSON.parse(c['נתוני חישוב גולמיים (JSON)'])`.

**D2 — יחס שטח גג: 5.5 בתוויות, 7.5 בלוגיקה (חומרה גבוהה, החלטה H4 לא מומשה)**
- מיקום: `SystemSizing.html` `findOptimalSystemSize`: `const maxByRoof = roofArea ? roofArea/7.5 : Infinity;` (≈ שורה 1222). `FinancialModel.html` דוח סופי: `scenario.capacity * 7.5` (≈ שורה 967). `saveResultsAndReturnToIndex`: `stage2RoofArea = recommendedPanelsKw * 5.5`.
- תיקון: קבוע יחיד `ROOF_M2_PER_KWP_NEW = 5.5` בשלבים 2-3. לעדכן את כל השימושים.

**D3 — סליידר גדילת צריכה אינו מחובר (חומרה בינונית; הטקסט מטעה)**
- מיקום: `SystemSizing.html` `futureGrowthSlider` / `onFutureGrowthChange` / `saveAndContinueToStage3` (`futureGrowthPct`). `gatherBaseInputsForSearch` ו-`findOptimalSystemSize` אינם קוראים אותו. טקסט הממשק קובע שהוא משפיע על גודל המערכת/הסוללה.
- תיקון: (א) להזין למנוע סדרה מוגדלת (למשל כפל ב-`(1+g)^(H/2)` לאופק `H`) או (ב) לתקן את הטקסט כך שיצוין "נשמר ללא השפעה". השפעה על שלב 3 נדחתה בהחלטת המשתמש (H3) וה-TODO קיים בקוד.

**D4 — `updateRoofAreaDisplay` לא קיימת בשלב 2 (חומרה נמוכה)**
- ראיה: `grep` — מוזכרת רק תחת `typeof ... === 'function'`. `#roofAreaDisplay` נשאר `-`.
- תיקון: להגדיר (`calc_targetKw × 5.5`) ולקרוא ב-`applyRecommendationToManualFields`.

**D5 — הערכת שבת לא משמשת למילוי (חומרה בינונית)**
- מיקום: `ConsumptionAnalysis.html`. `window._shabbatHourlyEstimate` נכתב ב-`onShabbatUpliftChange` ואינו נקרא. `ignoreMissingShabbat` משפיע רק על נראות כרטיס ושמירה.
- דרישת המשתמש (H7): לכל שבת, פרופיל שעתי של ששת ימי החול שקדמו לה, מוגדל באחוז הסליידר לכל שעה בנפרד (100→115, 200→230 ב-15%).
- תיקון: לכל חלון שבת עם ≤ 20 נקודות (או כשסומן "התעלם"): משבצות `h` = `entry.precedingHourlyAvg[h]·(1+pct/100)` של אותה שבת. לסמן שעות מולאו, לספור, ולהחליט עם המשתמש אם המילוי נכנס לסדרה המלאה (תצוגה, Excel) או רק לעותק השמור. `estShabbatLoad` = סכום 24 שעות של אותו פרופיל.

**D6 — הערכת ייצור עבר משטח גג וזווית לא מומשה (חומרה בינונית)**
- מיקום: `existingRoofRatio`, `existingProductionKw` נשמרים בלבד. אין שדות זווית/הצללה בשלב 1.
- חומר לשימוש חוזר (הוסר מהמחשבון הישן, "חשב הערכה פשוטה"): `annualYield = kW · CALC_CONSTANTS.yieldBase · azimuth · shading`; מקדמי חודש `[0.66,0.77,0.96,1.10,1.19,1.29,1.29,1.24,1.10,0.96,0.77,0.67]`; פרופיל שעתי 06:00-17:00 `[0.01,0.03,0.07,0.10,0.13,0.16,0.16,0.13,0.10,0.07,0.03,0.01]`.
- תיקון: להוסיף `azimuth`/`shading` לשלב 1, לגזור `kW = area / existingRoofRatio` כשחסר הספק, לייצר סדרת ייצור שעתית לחלון הנשמר, ולשמור בעמודה 32.

**D7 — מילוי נתוני חיוב מקובץ הטופס שבור (חומרה בינונית-גבוהה)**
- מיקום: `ConsumptionAnalysis.html` `offerBillingFromFormJson`, `getMonthlyBillingValues` (ללא קורא).
- ראיה: מבנה `billing` בטופס: `{annualKwh, annualNis, monthly:[{month:1..12, kwh, nis}]}`. הקוד קורא `billing.annual` (לא קיים), ממפה `m.month` כאינדקס 0, ואינו צורך את ערכי החודשים.
- תיקון: לקרוא `billing.annualKwh`; עבור `annualNis` בלבד להמיר ל-קוט"ש לפי תעריף ממוצע מוגדר (ולהודיע); `month−1`; לחבר `getMonthlyBillingValues()` למאזין `synthesizeAnnualBtn` (סינתזה פר-חודש, קנה-מידה לפי קוט"ש חודשי); לבדוק מול JSON אמיתי מהטופס.

**D8 — תעריפי Excel קבועים (חומרה גבוהה לנכונות הדוח)**
- מיקום: `buildExcelPayload`: `const rate = calcStaircaseTariff(0, 0, false);` ואז `(rate.peak || 0.6)` / `(rate.offpeak || 0.3)`; `tariffStructure[].rate = rate.peak || ''`.
- ראיה (הרצה): `calcStaircaseTariff(0,0,false)` מחזיר `Number` (`0`) ולא אובייקט, לכן `rate.peak === undefined`. שעה ראשונה: `1.44 קוט"ש × 0.3 = 0.432`. כל עמודות התשלום בטבלת-על ובגיליון ימי פסגה מחושבות ב-0.6/0.3; עמודת התעריף בגיליון "מבנה תעריפים" ריקה. המסך (`renderReports`) משתמש ב-`CALC_CONSTANTS.tou`.
- תיקון: חישוב תעריף שעתי מ-`CALC_CONSTANTS.tou[season + '_peak'|'_low']` (אותה לוגיקה כמו `renderReports`); למלא את עמודת התעריף.

**D9 — Excel ברזולוציית רבע-שעה ובנפח עצום (חומרה גבוהה)**
- ראיה (הרצה): `hoursInFirstDay: 96`, `hourlyRows: 70176`, JSON 20.7 MB. התווית "00:00 (שפל)" חוזרת 4 פעמים בשעה. `Utilities_fmtDateTime` מוריד דקות.
- תיקון: צבירה לשעות לפני בניית ה-payload; "פירוט שנתי מלא" לשנה אחרונה; לשקול דחיסה/פיצול ביצוע.

**D10 — `_buildMonsterSheet` כותב ללא קיבוץ (חומרה גבוהה, הערכה)**
- ראיה: קוד — `setValues` + שני `setBackground` לכל שורת שעה, ומיזוגים נפרדים. ראו 5.2.
- תיקון: מערכים דו-ממדיים, `setValues`/`setBackgrounds` יחידים, `Range.mergeVertically()` לקבוצות, מדידת זמן בפריסה. אם עדיין ארוך: ייצור בקבצי CSV/XLSX בצד לקוח עם ספרייה שכותבת סגנונות, או ריצה מפוצלת עם `PropertiesService`/Trigger.

**D11 — תלויות שרת לא מאומתות בייצוא (חומרה בינונית)**
- `_fmtTariffSplit` משתמש ב-`toLocaleString('he-IL', {...})`. תמיכה ב-V8 של Apps Script לא אומתה. הרשאות OAuth (`spreadsheets`, `drive`, `script.external_request`) נדרשות ב-`appsscript.json`; לא נבדק. קבצי `_temp_export_*` יתומים בחריגת זמן.
- תיקון: עיצוב מספרים ידני; הצהרת סקופים; Trigger לניקוי קבצים ישנים מ-שעה.

**D12 — יחידות `estShabbatLoad` (חומרה גבוהה כשמסומן גיבוי שבת/חג)**
- מיקום: `findOptimalSystemSize`: `shabbatKwh = estShabbatLoad * hoursBackup` (25.5 לשבת, 50 לשבת+חג) מפרש את הערך כהספק (קוו"ט). `applySuggestedBattery` ו-`runFinancialModel` (`estShabbatLoad × genCost × shabbatCount`) מפרשים כאנרגיה (קוט"ש לשבת). שלב 1 מייצר קוט"ש ליום.
- ראיה: `grep hoursBackup` — מופיע גם ב-`Calculator.html` המקורי (הפער קדם לפיצול).
- תיקון: לאחד הגדרה (קוט"ש לשבת). בחיפוש: `floorKwh = estShabbatLoad · (חג ? 2.2 : 1.2)`.

**D13 — שמות חודשים עבריים שגויים (חומרה בינונית)**
- פירוט והוכחה: סעיף 2.6. תיקון: טבלת שמות תלוית שנה מעוברת (`hc_isLeap(year)`): פשוטה `[תשרי,חשוון,כסלו,טבת,שבט,אדר,ניסן,אייר,סיוון,תמוז,אב,אלול]`; מעוברת `[תשרי,חשוון,כסלו,טבת,שבט,אדר א׳,אדר ב׳,ניסן,אייר,סיוון,תמוז,אב,אלול]`. לאמת על 6 תאריכים ידועים (פשוטה ומעוברת). בנוסף: יום עברי שמתחיל בשקיעה (כיום: גבול חצות גרגוריאני).

**D14 — Index מתעלם מ-`?clientId` וממצב ישן (חומרה בינונית)**
- ראיה: `grep` ב-`Index.html` על `URLSearchParams|location.search|google.script.url` — אין. שלב 3 מנווט ל-`<exec>?clientId=...`.
- תיקון: קריאת `clientId` (כמו בשלבים) ו-`selectCustomer`. רענון `globalCustomers` בחזרה ללשונית (`visibilitychange`). לשחזר "משוך נתונים" או להזין `lastCalculatorRawData` אוטומטית (D1).

**D15 — שלב 2 שומר בלי אימות (חומרה בינונית)**
- מיקום: `saveAndContinueToStage3` — אין בדיקת `calc_targetKw > 0`.
- תיקון: חסימה עם הודעה, או החלה אוטומטית של `lastRecommendation` כשקיים.

**D16 — חשיפת פונקציות שרת (חומרה גבוהה, ארכיטקטורה)**
- פירוט: 5.3 סעיף 1. תיקון: הפרדה בין פריסה פנימית (CRM) לציבורית (טופס), `Session.getActiveUser()`/בדיקת הרשאה בכל פונקציה, שינוי שמות פונקציות פנימיות לסיומת `_`, מעבר של מפתח API ל-`doPost` + גוף בקשה.

### 6.2 החלטות פתוחות למשתמש

1. ייעוד קובץ הסימולציה הרביעי (עצמאי, בלי נתוני שלב 1): הדגמה/מכירה או אחר. נשאל ולא נענה.
2. השפעת גדילת צריכה על שלב 3 (נדחתה) והאם גם על המנוע בשלב 2 (D3).
3. נתוני כיול למשקלי האיחוד (0.6/0.4, סף 15%).
4. אימות סכומי מס (`27,900`, `120,000`) מול רו"ח.
5. יחסי שטח-גג: 7.5 (ישן) מול 5.5 (מודרני): לאחד בקבוע אחד (D2). האם שלב 1 מקבל שדה לפי סוג פאנל.
6. מילוי שבתות חסרות: בסדרה המלאה (תצוגה/Excel) או בעותק השמור בלבד (D5).
7. מיזוג בין JSON-טופס לבין שנתי/מטריצה כשאין חח"י (כיום JSON גובר).
8. יישור "יום עברי" בשקיעה בטבלת Excel (כיום חצות).
9. נתוני מחירון: 2 פריטי EFORE ללא מקור; 2-3 פריטי Absen עם קיבולת משוערת; 5 שורות פאנלים גנריות עם ברירת מחדל זמנית; תמחור לא הוזן בשום שורה.
10. טבלת חגים מעבר ל-2030 (Hebcal או הרחבה).
11. עיצוב לוח הבקרה של `PrintQuote`: מוכן. עימוד/אלמנות-יתומים: לא קשור לפרויקט, נדרשת הבהרה.
12. היקף אפליקציית הנייד: קריאה בלבד כיום. כתיבה, מצב לא-מקוון, iOS (דורש Mac + חשבון מפתחים).

### 6.3 שלבי ביצוע מומלצים

| שלב | תוכן |
|---|---|
| 0. אימות בפריסה | להעלות את הקבצים; להריץ `oneTimeSetup_v3`, `oneTimeSetup_v4`; פריסה חדשה; לבדוק שלב 1 עם קובץ חח"י אמיתי (שמירה, זיהוי `clientId`); להריץ ייצוא Excel ולמדוד זמן; להגדיר מפתח API |
| 1. אובדן נתונים ונכונות | D1, D2, D12, D15, D7, D5 |
| 2. Excel | D8, D9, D10, D11, D13 |
| 3. פונקציונליות | D3, D6, D4, D14 |
| 4. מובייל | `flutter pub get`, `flutter analyze`, הרצה; `NavigationDelegate`; `flutter_secure_storage`; אימות WebView מול פריסה (האם דפי ה-HTML דורשים התחברות גוגל); נקודות קצה לכתיבה; iOS |
| 5. אבטחה | D16 |
| 6. קובץ סימולציה רביעי | לאחר תשובה לשאלה 1 |

### 6.4 הנחיות ל-AI הבא

**סדר קריאה**: סעיף 1 → 4.1-4.3 → 6.1 → קטעי קוד בסעיף 4.4 → סעיף 3.

**כללי עבודה שנקבעו בשיחה**

1. אין לטעון שרכיב עובד בלי להריץ אותו. לציין במפורש מה לא אומת (✅/🟡/🔴). טענות קודמות של המסמך הזה על "עובד" שנסתרו מפורטות בסעיף 3.2.
2. אימות מחדש של רשימת D לפני הסתמכות. הקבצים עשויים להשתנות.
3. אין לשנות את תוכן הצעת המחיר (`.page`) ואת עיצובו.
4. שינוי בקידוד התא חל על הנתון השמור בלבד. תצוגה ו-Excel אינם נוגעים בו, אלא אם התבקש.
5. עריכה: להעתיק מ-`/mnt/user-data/outputs` לספריית עבודה; לבצע שינויים בסקריפט Python אטומי עם `assert count == 1`; אחרי כל עריכה: BeautifulSoup (מבנה, IDs, כפילויות), `node --check` לכל `<script>`, הרצת בדיקה בדפדפן; שמירה מיידית ל-`/mnt/user-data/outputs`. סביבת העבודה מתאפסת.
6. אין Flutter/Dart SDK בסביבה. אין גישה ל-Apps Script אמיתי. CDN חסום ברשת הבדיקה (403 אינו באג).
7. מחרוזות JS עם קיצורים עבריים: בלי `'` בתוך מחרוזת ב-`'`. פלט מעורב עברית: אין `cut -c`.
8. תקשורת: עברית, תמציתית. "המשך!!!" = להמשיך. המשתמש מעדיף שקיפות מלאה על כישלונות ובדיקות איטרטיביות. הודעה שנראית שייכת לפרויקט אחר: לציין ולשאול.

**תשתית בדיקה (Mock)**

```js
(function(){
  function make(){
    const h = {}; let ok = null, fail = null;
    h.withSuccessHandler = fn => { ok = fn; return h; };
    h.withFailureHandler = fn => { fail = fn; return h; };
    h.getCustomerData = id => { setTimeout(() => ok && ok(window.__MOCK_CUSTOMER || {}), 20); return h; };
    h.getWebAppUrl = () => h; // בכוונה בלי callback: מונע ניווט באמצע בדיקה
    h.saveConsumptionAnalysis = p => { window.__saved = JSON.parse(p); setTimeout(() => ok && ok({ok:true}), 20); return h; };
    return h;
  }
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: () => make() }); // runner טרי בכל גישה
})();
```

הזרקה: `html.replace('<body>', '<script>' + MOCK + '</script><body>', 1)` (בדפי השלבים אין `</head>`). `google.script.url.getLocation` מוזרק בנפרד לווריאנט הבדיקה.

**נתוני בדיקה מייצגים**: להרכיב סדרה ברזולוציית רבע-שעה של 731 ימים (התחלה באמצע שנה) כדי לשחזר את הקובץ שהמשתמש העלה, ולא סדרה שעתית שמתחילה ב-1 בינואר (זו הסתירה ששני באגים עמדו בה: F29 וה-`startISO`).

**צ'קליסט פריסה למשתמש**

1. להעלות `code.js` ואת קבצי ה-HTML (`Index`, `Form`, `PrintQuote`, `ConsumptionAnalysis`, `SystemSizing`, `FinancialModel`; `Calculator` רק לתאימות).
2. להריץ מהעורך פעם אחת: `oneTimeSetup_v3`, `oneTimeSetup_v4`.
3. ליצור פריסה חדשה (Deploy → Manage deployments → New version).
4. למובייל: לערוך את המפתח ב-`setApiKey_oneTime`, להריץ פעם אחת, למחוק את המפתח מהקוד; להזין URL + מפתח באפליקציה.
5. כלי הפענוח מורץ מקומית בלבד (לא להעלות ל-Apps Script).

---

### נספח: מונחון

| מונח | הסבר |
|---|---|
| חח"י | חברת החשמל. מקור קבצי מונה (CSV/XLSX) |
| תעו"ז | תעריף לפי עונה וזמן. פסגה/שפל לפי עונה (חורף/מעבר/קיץ) |
| P0 / P1 | הספק מערכת קיימת / הספק כולל (קוו"ט). קובעים מדרגת תעריף |
| DoD | עומק פריקה (Depth of Discharge) של הסוללה |
| C-rate | קצב טעינה/פריקה יחסי לקיבולת (0.2C = טעינה מלאה ב-5 שעות) |
| IRR / NPV | תשואה פנימית / ערך נוכחי נקי |
| Zero Export | מגבלת רשת ללא הזרמה |
| חשמל כשר | גיבוי שבת/חג: אי-תלות ברשת בשבת |
| שבת הלכתית | מ-20 דקות לפני שקיעת שישי עד 40 דקות אחרי שקיעת שבת |
| MAD | סטיית חציון מוחלטת (Median Absolute Deviation) |
| Strangler | החלפה הדרגתית של רכיב ישן בחדשים שמתקיימים לצידו |
