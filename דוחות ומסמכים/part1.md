# תיעוד טכני והעברת הקשר — מערכת בראשית סולאר

| שדה | ערך |
|---|---|
| תאריך עדכון | 2026-10-07 |
| היקף | כל מה שנבנה, נבדק, נכשל ונפסל בשיחת הפיתוח (כולל החלק שקדם לדחיסת ההקשר) |
| שפת עבודה עם המשתמש | עברית. שמות מזהים בקוד באנגלית. |
| מקורות המסמך | תמלול טרום-דחיסה, השיחה עצמה, ביקורת קוד סטטית של הקבצים שנמסרו, והרצות בדיקה בדפדפן (Playwright) ו-Node |
| קבצי המערכת | ראו סעיף 4.1 |

## מקרא סטטוס

| סימן | משמעות |
|---|---|
| ✅ | אומת בהרצה בפועל (דפדפן Chromium מול Mock של `google.script.run`, או Node). לא אומת מול פריסת Apps Script אמיתית אלא אם נכתב אחרת. |
| 🟡 | ממומש. נבדק חלקית, נבדק רק סטטית, או תלוי בסביבת פריסה שלא הייתה זמינה לבדיקה. |
| 🔴 | פגם ידוע, רכיב שלא חובר בפועל, או דרישה שלא מומשה. כל 🔴 ממוספר בסעיף 6.1 עם הוראות תיקון. |

## הסתייגויות יסוד

1. אף קוד Apps Script (`code.js`) לא הורץ בסביבת Apps Script אמיתית. נבדק תחבירית בלבד (`node --check`). כל התנהגות שרת שמתועדת כ-✅ נבדקה באמצעות מקביל בצד לקוח או לא נבדקה כלל.
2. אפליקציית ה-Flutter לא קומפלה ולא הורצה (אין Dart/Flutter SDK בסביבה). נבדק איזון סוגריים וקריאה ידנית בלבד.
3. סעיף 6.1 מכיל פגמים שהתגלו בביקורת הסופית לצורך מסמך זה. חלקם סותרים טענות שנמסרו למשתמש במהלך השיחה (למשל: שדות חיוג מחדש מטופס הלקוח, סליידר גדילת צריכה, יחס שטח גג 5.5). המסמך משקף את מצב הקוד בפועל ולא את הטענות הקודמות.

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
