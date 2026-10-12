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

מצב: 🟡 לא הורץ מול Apps Script. פגמים מאומתים (ביקורת והרצה של `buildExcelPayload`): D9, D10, D11 (סעיף 6.1).

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
