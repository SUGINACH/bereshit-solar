/**
פונקציה ראשית להגשת ה-HTML עם ניתוב דינמי לעמוד ההדפסה
וגם, אם קיים פרמטר api, כ-JSON API עבור אפליקציית המובייל (Flutter) -
ר' apiCustomerList/apiCustomerDetail בהמשך הקובץ. שני ה"צרכנים" (דפי ה-HTML
ואפליקציית המובייל) עוברים תמיד דרך אותן פונקציות עסקיות (getCustomerData
וכו') כדי שהגיליון יישאר מקור-אמת יחיד, בלי כפל-מימוש בין הפלטפורמות.
*/
function doGet(e) {
  if (e.parameter.api) {
    return handleApiRequest(e);
  }

  const page = e.parameter.page || 'Index';
  
  if (page === 'print') {
    return HtmlService.createTemplateFromFile('PrintQuote')
      .evaluate()
      .setTitle('בראשית סולאר - הדפסת הצעת מחיר')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  if (page === 'calculator') {
    // נשמר לתאימות לאחור בזמן המעבר לשלושת קבצי השלבים החדשים (consumption/sizing/finance).
    // אפשר להסיר לאחר שהמעבר יושלם ונבדק.
    return HtmlService.createHtmlOutputFromFile('Calculator')
      .setTitle('מחשבון כדאיות ואגירה (גרסה ישנה)')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // שלב 1: ניתוח והעשרת נתוני צריכה וייצור (הכל מהעבר)
  if (page === 'consumption') {
    return HtmlService.createHtmlOutputFromFile('ConsumptionAnalysis')
      .setTitle('ניתוח נתוני צריכה - בראשית סולאר')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // שלב 2: המלצת גודל מערכת (קדימה)
  if (page === 'sizing') {
    return HtmlService.createHtmlOutputFromFile('SystemSizing')
      .setTitle('המלצת גודל מערכת - בראשית סולאר')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // שלב 3: מודל פיננסי ומיסוי
  if (page === 'finance') {
    return HtmlService.createHtmlOutputFromFile('FinancialModel')
      .setTitle('מודל פיננסי - בראשית סולאר')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // חלון טופס איסוף נתונים ללקוח
  // הפעם אנו משתמשים ב-Template כדי להזריק את ה-clientId מהשרת ישירות ל-HTML
  if (page === 'form') {
    const tmpl = HtmlService.createTemplateFromFile('Form');
    tmpl.clientIdParam = e.parameter.clientId || '';
    return tmpl.evaluate()
      .setTitle('טופס לאיסוף נתוני חשמל')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('בראשית סולאר - מערכת הצעות מחיר')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
משיכת כתובת ה-Web App המעודכנת לצורך פתיחת חלון חדש
*/
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
משיכת נתונים ראשונית (מחירון, לקוחות קיימים והגדרות)
כולל המרה אוטומטית של תמונות שהוכנסו לתא (CellImage) לקוד Base64
*/
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // מחירון
  const catalogSheet = ss.getSheetByName("מחירון");
  const catalogValues = catalogSheet.getDataRange().getValues(); // שימוש ב-getValues לשמירה על אובייקטי תמונה
  const catalogHeaders = catalogValues.shift().map(h => String(h).trim());
  
  // זיהוי דינמי של עמודת התמונה (תומך ב"תמונה", "תמונות", "תמונת מוצר" וכו')
  const imgColIdx = catalogHeaders.findIndex(h => h.includes('תמונ') || h.includes('לוגו') || h.toLowerCase().includes('image'));

  const catalog = catalogValues.map(row => {
    let obj = {};
    catalogHeaders.forEach((h, i) => {
      let val = row[i];
      // המרה אוטומטית ובטוחה של CellImage לקוד Base64
      if (i === imgColIdx && val) {
        val = convertCellImageToBase64(val);
        obj['image'] = val; // מפתח קבוע ואחיד לכל התמונות באפליקציה
      }
      obj[h] = val;
    });
    return obj;
  });

  // לקוחות ופרוייקטים
  const customerSheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const customerData = customerSheet.getDataRange().getDisplayValues();
  const customerHeaders = customerData.shift().map(h => String(h).trim());
  const customers = customerData.map(row => {
    let obj = {};
    customerHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // הגדרות
  const settingsSheet = ss.getSheetByName("הגדרות");
  const settingsData = settingsSheet.getDataRange().getDisplayValues();
  const settingsHeaders = settingsData.shift().map(h => String(h).trim());
  const settings = { powerSources: [], consumers: [] };
  
  if (settingsHeaders.includes('מקורות חשמל')) {
    settings.powerSources = settingsData.map(r => r[settingsHeaders.indexOf('מקורות חשמל')]).filter(v => v && v.toString().trim() !== '');
  } else {
    settings.powerSources = ['חברת החשמל', 'חשמל מתחדש', 'אחר'];
  }
  
  if (settingsHeaders.includes('צרכנים')) {
    settings.consumers = settingsData.map(r => r[settingsHeaders.indexOf('צרכנים')]).filter(v => v && v.toString().trim() !== '');
  } else {
    settings.consumers = ['מזגן', 'תנור', 'כביסה', 'קומפרסור', 'אחר'];
  }

  return { catalog, customers, settings };
}

/**
המרת אובייקט CellImage של גוגל לקוד Base64 הניתן להצגה ב-HTML
*/
function convertCellImageToBase64(cellImageValue) {
  if (!cellImageValue) return "";
  try {
    if (typeof cellImageValue === 'object' && typeof cellImageValue.getBlob === 'function') {
      const blob = cellImageValue.getBlob();
      if (blob) {
        const bytes = blob.getBytes();
        const base64 = Utilities.base64Encode(bytes);
        return "data:" + blob.getContentType() + ";base64," + base64;
      }
    }
  } catch (e) {
    // אם התא כבר מכיל מחרוזת Base64 או URL, נחזיר אותו כפי שהוא
    return cellImageValue;
  }
  return cellImageValue;
}

/**
טעינת פרטי לקוח ספציפי (משמש גם את ה-Index וגם את הטופס המותאם אישית)
*/
function getCustomerData(clientId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data.shift().map(h => String(h).trim());

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(clientId).trim()) {
      let obj = {};
      headers.forEach((h, idx) => obj[h] = data[i][idx]);
      
      const jsonFields = ['מקורות חשמל (JSON)', 'צרכנים (JSON)', 'מצברים', 'ממירים', 'פאנלים', 'התקנה', 'תוספות', 'רכיבי מערכת (JSON)', 'נתוני חישוב גולמיים (JSON)', 'נתוני צריכה מועשרים (JSON)', 'המלצת גודל מערכת (JSON)', 'נתוני ייצור מועשרים (JSON)'];
      jsonFields.forEach(field => {
        if (obj[field] && (obj[field].toString().startsWith('{') || obj[field].toString().startsWith('['))) {
          try { obj[field] = JSON.parse(obj[field]); } catch(e) { obj[field] = []; }
        } else {
          obj[field] = [];
        }
      });

      // תאימות לאחור (שיפור 1): אם 'רכיבי מערכת (JSON)' ריק (שורות שנוצרו לפני הכרטיסיות),
      // בונים "כרטיסייה 1" באופן שקוף מתוך חמשת העמודות הישנות — בלי צורך במיגרציה חד-פעמית על הנתונים.
      if (!obj['רכיבי מערכת (JSON)'] || !obj['רכיבי מערכת (JSON)'].length) {
        obj['רכיבי מערכת (JSON)'] = [{
          name: 'רכיבי מערכת 1',
          batteries: obj['מצברים'],
          inverters: obj['ממירים'],
          panels: obj['פאנלים'],
          installation: obj['התקנה'],
          addons: obj['תוספות']
        }];
      }

      return obj;
    }
  }
  return null;
}

/**
שמירה או עדכון של נתוני לקוח ופרויקט
*/
function saveCustomerData(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = JSON.parse(payload);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.clientId).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    data.clientId || "",
    data.clientName || "",
    data.clientAddress || "",
    data.clientContact || "",
    data.clientPhone || "",
    data.projectTitle || "",
    data.quoteDate || "",
    data.roofArea || "",
    data.form4 || "",
    data.gridQuota || "",
    JSON.stringify(data.powerSources) || "[]",
    JSON.stringify(data.consumers) || "[]",
    data.panelPower || "",
    data.storageCapacity || "",
    JSON.stringify(data.batteries) || "[]",       // עמודה 15: כפילות של הכרטיסייה הפעילה (תאימות לאחור, החלטה סופית)
    JSON.stringify(data.inverters) || "[]",        // עמודה 16: כנ"ל
    JSON.stringify(data.panels) || "[]",           // עמודה 17: כנ"ל
    JSON.stringify(data.installation) || "[]",     // עמודה 18: כנ"ל
    JSON.stringify(data.extras) || "[]",           // עמודה 19: כנ"ל
    data.totalPrice || "",
    data.annualSavings || "",
    data.roi || "",
    data.profit25 || "",
    data.analysisNotes || "",                      // עמודה 24: כותרת בגיליון חייבת להיות "הערות ניתוח" (ר' הערת מיגרציה בראש הקובץ)
    JSON.stringify(data.clientImages) || "[]",     // עמודה 25: כותרת בגיליון חייבת להיות "תמונות לקוח (JSON)" (ר' הערת מיגרציה בראש הקובץ)
    JSON.stringify(data.systemCards) || "[]",      // עמודה 26 (חדשה): מערך כל כרטיסיות רכיבי המערכת
    data.activeCardIndex != null ? data.activeCardIndex : 0, // עמודה 27 (חדשה): איזו כרטיסייה תיפתח כברירת מחדל בפעם הבאה
    data.inverterPowerTarget || "",                // עמודה 28 (חדשה): עוצמת ממיר נדרשת (kW), לסקשן הצעת השילובים
    data.rawCalculatorData ? JSON.stringify(data.rawCalculatorData) : "" // עמודה 29 (חדשה): תוצאות גולמיות מהמחשבון (IRR/NPV/הנחות-יסוד), לשימוש עמוד ההדפסה
  ].map(val => val === null || val === undefined ? "" : String(val));

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 29).setValues([rowData]);
    return "הנתונים עודכנו בהצלחה!";
  } else {
    sheet.appendRow(rowData);
    return "לקוח חדש נשמר בהצלחה!";
  }
}

/**
עדכון חלקי ובטוח של תוצאות המחשבון בלבד (עמודות 20-23 ו-29), ללא נגיעה בשאר
שדות הלקוח. נועד להיקרא ישירות מ-Calculator.html ברגע לחיצת "העבר תוצאות",
כערוץ שמירה עצמאי ואמין שאינו תלוי בהעברת localStorage בין חלונות (ר' תיעוד
הארכיטקטורה - החוק השלישי: תקשורת בין-חלונית חייבת להיות stateless דרך
ה-Backend, לא localStorage). בכוונה אינו משתמש ב-rowData/setValues מלא כמו
saveCustomerData, כדי לא לדרוס שדות אחרים (שם לקוח, כתובת, ציוד וכו') בטעות
אם המחשבון נפתח לפני שהלקוח נשמר במלואו ב-CRM.
*/
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

/**
עדכון חלקי ובטוח של תוצרי שלב 1 (ניתוח והעשרת נתוני צריכה) - עמודות 30 ו-32 בלבד.
נקרא מ-ConsumptionAnalysis.html בסוף השלב, לפני מעבר לשלב 2.
חשוב: payload.consumptionAnalysis חייב להיות המבנה ה"רזה" (סדרה שעתית ארוזה ב-base64,
לא הדו"ח המועשר המלא) - לתא ב-Sheets יש תקרה של 50,000 תווים; סדרה שעתית מלאה לשנה
שלמה בפורמט JSON מילולי (~8,760 נקודות) חורגת ממנה. ר' הערת התקרה גם ב-oneTimeSetup_v4.
נתוני ייצור (אם קיימים) נשמרים בנפרד בעמודה 32, מאותה סיבה בדיוק.
*/
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

/**
עדכון חלקי ובטוח של תוצרי שלב 2 (המלצת גודל מערכת) - עמודה 31 בלבד.
נקרא מ-SystemSizing.html בסוף השלב, לפני מעבר לשלב 3.
*/
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

/**
=====================================================================
 יצירת קובץ Excel עשיר (שלב 1 - ניתוח צריכה) בצד השרת.
 הסיבה שזה בצד שרת ולא בדפדפן: נבדק באופן אמפירי שספריית ה-JS החינמית
 (SheetJS/xlsx.js) אינה כותבת צבעי מילוי תא בפועל (למרות שהיא "מקבלת" את
 ההגדרה בשקט) - כלומר גרדיאנט צבעים לא ניתן להשגה בצד לקוח. Apps Script,
 לעומת זאת, תומך באופן מלא וטבעי בעיצוב מותנה (כולל גרדיאנט), טבלאות עם
 מסננים, וגבולות - ולכן כל בניית הקובץ עברה לכאן.

 payloadJson מבנה (הלוגיקה העסקית/ההיררכיה מחושבת כולה בצד לקוח, ששם כבר
 קיימים כל חישובי לוח השנה העברי/עונות/תעריפים - כאן רק כותבים ומעצבים):
 {
   clientName, monsterTable: {yearLabel, annualCons, annualPay, seasons:[...]},
   hourlyRows: [[dateStr, dayName, kwh, productionKwh|null], ...],
   dailyRows: [[dateStr, dayName, totalKwh, offpeakKwh, peakKwh, productionKwh|null], ...],
   peakDays: [[dateStr, dayName, kwh, cost], ...],
   stats: {combined:{...}, winter:{...}, summer:{...}},
   sources: [{type, label, annualKwh, capturedAt}], propertyType, propertyTypeLabel,
   tariffStructure: [{season, dayType, hourRange, rate, tariffType}],
   shabbat: {estLoadKwh, upliftPct}
 }
=====================================================================
*/
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

function _styleHeaderRow(range) {
  range.setBackground('#D9E1F2').setFontWeight('bold').setBorder(true, true, true, true, true, true);
}

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

// גיליון גנרי עם כותרת מעוצבת, טבלה עם מסנן (Filter), גבולות, וגרדיאנט צהוב-אדום
// על העמודות המספריות שצוינו (gradientColIdxs, אינדקס 0 מבוסס, כולל הכותרת בעמודה 0).
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

function _buildStatsSheet(ss, stats) {
  if (!stats) return;
  const sheet = ss.insertSheet('ניתוח סטטיסטי פסגות');
  const rows = [
    ['מדד אנליטי (ימי פסגה בלבד)', 'כללי (קיץ+חורף)', 'פסגות חורף', 'פסגות קיץ'],
    ['חציון צריכה בפסגה (קוט"ש)', stats.combined.medianKwh, stats.winter.medianKwh, stats.summer.medianKwh],
    ['חציון תשלום בפסגה (₪)', stats.combined.medianCost, stats.winter.medianCost, stats.summer.medianCost],
    ['ממוצע צריכה יומי מנוכה (חיתוך 15%)', stats.combined.trimmedKwh, stats.winter.trimmedKwh, stats.summer.trimmedKwh],
    ['ממוצע תשלום יומי מנוכה (חיתוך 15%)', stats.combined.trimmedCost, stats.winter.trimmedCost, stats.summer.trimmedCost],
    ['ממוצע צריכה של ה-15% הגבוהים', stats.combined.top15Kwh, stats.winter.top15Kwh, stats.summer.top15Kwh],
    ['ממוצע צריכה של ה-15% הנמוכים', stats.combined.bottom15Kwh, stats.winter.bottom15Kwh, stats.summer.bottom15Kwh]
  ];
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  _styleHeaderRow(sheet.getRange(1, 1, 1, 4));
  sheet.getRange(1, 1, rows.length, 4).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
  for (let c = 1; c <= 4; c++) sheet.autoResizeColumn(c);
}

// גיליון חדש: פרטי מקורות נתוני הצריכה שהוזנו (ר' דרישת "גיליון עם פרטי מקורות")
function _buildSourcesSheet(ss, sources, propertyType, propertyTypeLabel, shabbat) {
  const sheet = ss.insertSheet('מקורות נתונים');
  const headers = ['מקור', 'סה"כ קוט"ש שנתי לפי מקור זה', 'זמן עיבוד'];
  const rows = (sources || []).map(s => [s.label, s.annualKwh, s.capturedAt]);
  sheet.getRange(1, 1, 1, 3).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  _styleHeaderRow(sheet.getRange(1, 1, 1, 3));
  sheet.getRange(1, 1, Math.max(rows.length, 1) + 1, 3).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  let r = rows.length + 3;
  sheet.getRange(r, 1).setValue('סוג נכס:').setFontWeight('bold');
  sheet.getRange(r, 2).setValue(propertyTypeLabel || propertyType || '-');
  r++;
  if (shabbat) {
    sheet.getRange(r, 1).setValue('צריכה משוערת לשבת (קוט"ש):').setFontWeight('bold');
    sheet.getRange(r, 2).setValue(shabbat.estLoadKwh || '-');
    r++;
    sheet.getRange(r, 1).setValue('% תוספת צריכה בשבת לעומת יום חול:').setFontWeight('bold');
    sheet.getRange(r, 2).setValue(shabbat.upliftPct ? shabbat.upliftPct + '%' : '-');
  }
  for (let c = 1; c <= 3; c++) sheet.autoResizeColumn(c);
}

// גיליון חדש: מבנה התעריפים (עונות/ימים/שעות) שלפיו חושבו הנתונים
function _buildTariffStructureSheet(ss, tariffStructure) {
  const sheet = ss.insertSheet('מבנה תעריפים');
  const headers = ['עונה', 'סוג יום', 'טווח שעות', 'סוג תעריף', 'תעריף (₪/קוט"ש)'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const rows = (tariffStructure || []).map(t => [t.season, t.dayType, t.hourRange, t.tariffType, t.rate]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  _styleHeaderRow(sheet.getRange(1, 1, 1, headers.length));
  sheet.getRange(1, 1, Math.max(rows.length, 1) + 1, headers.length).setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
  if (rows.length) sheet.getRange(1, 1, rows.length + 1, headers.length).createFilter();
  for (let c = 1; c <= headers.length; c++) sheet.autoResizeColumn(c);
}

// גיליון "פירוט שנתי מלא" - הטבלה ההיררכית עם מיזוגי תאים (שנה/עונה/יום/יום עברי),
// בדיוק לפי המבנה שהיה קיים בעבר (14 עמודות + ייצור אם קיים), עכשיו מייצג נתוני עבר.
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

// מפרק אובייקט {offpeak, peak} לטקסט תצוגה "שפל: X\nפסגה: Y" (בדיוק כמו בדוח ההיסטורי)
function _fmtTariffSplit(obj) {
  if (obj == null) return '';
  if (typeof obj === 'number') return obj;
  const parts = [];
  if (obj.offpeak != null) parts.push('שפל:\n' + Number(obj.offpeak).toLocaleString('he-IL', { maximumFractionDigits: 2 }));
  if (obj.peak != null) parts.push('פסגה:\n' + Number(obj.peak).toLocaleString('he-IL', { maximumFractionDigits: 2 }));
  return parts.join('\n');
}

/**
שליפת תעריף מחברת החשמל
*/
function getTariffFromCompany() {
  try {
    return { fixed: 70.15, toz: "44.8-123.3" };
  } catch (e) {
    Logger.log("שגיאה בשליפת תעריף: " + e.toString());
    return { fixed: 70.15, toz: "44.8-123.3" };
  }
}

/**
=====================================================================
 הרצה חד-פעמית בלבד! להריץ ידנית פעם אחת מתוך עורך ה-Apps Script
 (בחירת הפונקציה מהתפריט למעלה ← Run), ולא לקרוא לה משום קוד אחר.
 לאחר הרצה מוצלחת אחת אפשר למחוק את הפונקציה הזו.

 מבצעת:
 1. תיקון כותרות עמודות 24-25 בגיליון "לקוחות ופרוייקטים" — התוכן שכבר
    שמור בעמודות האלה תקין ולא זז ממקומו; רק הכותרות היו שגויות/חסרות,
    מה שגרם לטופס לקרוא הערות-ניתוח ותמונות-לקוח מהמקום ההפוך.
 2. הוספת כותרות לעמודות 26-28 החדשות (כרטיסיות/אינדקס פעיל/עוצמת ממיר).
 3. הוספת כותרות (בלבד — לא ערכים) לעמודות החדשות הדרושות ב"מחירון".
    את הערכים בפועל (מידות/הספק/קיבולת/וכו') יש למלא ידנית לפי המפרט
    האמיתי של כל מוצר — זה לא ניתן לגזור אוטומטית משם הדגם.
=====================================================================
*/
function oneTimeSetup_v2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const custSheet = ss.getSheetByName("לקוחות ופרוייקטים");
  custSheet.getRange(1, 24).setValue("הערות ניתוח");
  custSheet.getRange(1, 25).setValue("תמונות לקוח (JSON)");
  custSheet.getRange(1, 26).setValue("רכיבי מערכת (JSON)");
  custSheet.getRange(1, 27).setValue("כרטיסייה פעילה (אינדקס)");
  custSheet.getRange(1, 28).setValue("עוצמת ממיר נדרשת");

  const catSheet = ss.getSheetByName("מחירון");
  const lastCol = catSheet.getLastColumn();
  const existingHeaders = catSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  // הסדר כאן הוא רק לצורך הוספה נוחה; לכל עמודה יש משמעות רק בקטגוריה הרלוונטית לה (ר' הודעת הליווי)
  const newCatalogHeaders = [
    "מידות", "הספק",                                              // פאנלים
    "קיבולת", "מגבלת הכפלה", "מגבלת שרשור", "BMS כלול",           // מצברים
    "עוצמה", "היברידי", "התאמה למערכת",                           // ממירים
    "קבוצת התאמה"                                                  // חוצה-קטגוריות (מצברים/ממירים/פאנלים/תוספות)
  ];
  let nextCol = lastCol + 1;
  newCatalogHeaders.forEach(h => {
    if (existingHeaders.indexOf(h) === -1) {
      catSheet.getRange(1, nextCol).setValue(h);
      nextCol++;
    }
  });

  SpreadsheetApp.getUi().alert(
    "המיגרציה הושלמה.\n\n" +
    "נותר למלא ידנית בגיליון 'מחירון': מידות+הספק לכל פאנל, קיבולת+מגבלת הכפלה+מגבלת שרשור+BMS כלול לכל מצבר, " +
    "עוצמה+היברידי+התאמה למערכת לכל ממיר, וקבוצת התאמה איפה שרלוונטי."
  );
}

/**
=====================================================================
 הרצה חד-פעמית בלבד! להריץ ידנית פעם אחת מתוך עורך ה-Apps Script
 (בחירת הפונקציה מהתפריט למעלה ← Run), ולא לקרוא לה משום קוד אחר.
 לאחר הרצה מוצלחת אחת אפשר למחוק את הפונקציה הזו.

 מוסיפה כותרת לעמודה 29 החדשה ("נתוני חישוב גולמיים (JSON)") בגיליון
 "לקוחות ופרוייקטים" - עמודה שנועדה לאחסן את מארז ה-IRR/NPV/הנחות-היסוד
 המלא שהמחשבון מפיק, כדי שעמוד ההדפסה יוכל לשלוף אותו דרך getCustomerData
 גם אם ה-localStorage שביניהם לא הועבר בהצלחה (ר' updateCalculatorResults).
 אינה נוגעת בשום נתון קיים - רק מוסיפה כותרת לעמודה ריקה.
=====================================================================
*/
function oneTimeSetup_v3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const existingHeader = custSheet.getRange(1, 29).getValue();
  if (!existingHeader) {
    custSheet.getRange(1, 29).setValue("נתוני חישוב גולמיים (JSON)");
  }
  SpreadsheetApp.getUi().alert("עמודה 29 (נתוני חישוב גולמיים) מוכנה בגיליון 'לקוחות ופרוייקטים'.");
}

/**
=====================================================================
 הרצה חד-פעמית בלבד! (ר' הנחיות בראש oneTimeSetup_v2/v3 לעיל)

 מוסיפה כותרות לעמודות 30-32 החדשות, תוצרי פיצול המחשבון לשלושה שלבים:
 30 = "נתוני צריכה מועשרים (JSON)" - תוצר שלב 1, סדרה שעתית ארוזה (base64) + מטא-דאטה קליל בלבד
 31 = "המלצת גודל מערכת (JSON)" - תוצר שלב 2 (SystemSizing.html)
 32 = "נתוני ייצור מועשרים (JSON)" - סדרה שעתית של ייצור (אם קיים), אותו פורמט ארוז כמו 30
 (עמודה 29, תוצר שלב 3, כבר קיימת מ-oneTimeSetup_v3).

 חשוב לגבי 30/32: לתא ב-Google Sheets יש תקרה של 50,000 תווים. סדרה שעתית לשנה שלמה
 (8,760 נקודות) בפורמט JSON מילולי חורגת ממנה בקלות. לכן הסדרה נשמרת ארוזה כמערך
 Uint16 (וואט-שעה שלמים) שעבר Base64 - כ-23,360 תווים לשנה מלאה, ~47% מהתקרה, במקום
 לשמור טבלאות/פירוטים מיועדים ל-Excel (אלה מיוצאים ישירות בדפדפן, לא נשמרים בגיליון).
 אינה נוגעת בשום נתון קיים - רק מוסיפה כותרות לעמודות ריקות.
=====================================================================
*/
function oneTimeSetup_v4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet = ss.getSheetByName("לקוחות ופרוייקטים");
  if (!custSheet.getRange(1, 30).getValue()) custSheet.getRange(1, 30).setValue("נתוני צריכה מועשרים (JSON)");
  if (!custSheet.getRange(1, 31).getValue()) custSheet.getRange(1, 31).setValue("המלצת גודל מערכת (JSON)");
  if (!custSheet.getRange(1, 32).getValue()) custSheet.getRange(1, 32).setValue("נתוני ייצור מועשרים (JSON)");
  SpreadsheetApp.getUi().alert("עמודות 30-32 (ניתוח צריכה + המלצת גודל + ניתוח ייצור) מוכנות בגיליון 'לקוחות ופרוייקטים'.");
}

/**
=====================================================================
 API JSON עבור אפליקציית המובייל (Flutter) - איש המכירות בשטח.
 לא משנה את דפי ה-HTML הקיימים כלל; זהו נתיב-כניסה מקביל שמחזיר JSON
 במקום HTML, ותמיד עובר דרך אותן פונקציות עסקיות (getCustomerData) כדי
 שהגיליון יישאר מקור-אמת יחיד גם כששני הצרכנים (דפדפן ומובייל) פעילים יחד.

 אבטחה: נדרש apiKey תואם למחרוזת שנשמרת ב-Script Properties (לא בקוד
 עצמו) - כי דף Apps Script שמוגש כ-Web App לכולם, בלי בדיקה כלשהי, היה
 חושף את כל נתוני הלקוחות לכל מי שמנחש את כתובת ה-URL. הרצה חד-פעמית:
 setApiKey_oneTime() (למטה) עם מפתח לבחירתכם, ואז את אותו המפתח מזינים
 באפליקציית ה-Flutter (ר' lib/services/api_service.dart).
=====================================================================
*/
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

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// רשימה קלילה לתצוגת חיפוש/גלילה באפליקציה - לא כוללת JSON כבדים (עמודות 11/12/26/29/30/32),
// רק דגלי has-stage-X (בוליאני) כדי שהאפליקציה תדע אילו כפתורי-המשך להציג, בדיוק כמו ב-Index.html.
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

// פרטי לקוח מלאים - עוטף את getCustomerData הקיימת (אותה פונקציה ש-Index.html/
// PrintQuote.html/שלושת קבצי השלבים כבר משתמשים בה), כדי לא לשמר שני מימושים.
function apiCustomerDetail(clientId) {
  return getCustomerData(clientId);
}

/**
=====================================================================
 הרצה חד-פעמית בלבד! להריץ ידנית מעורך ה-Apps Script לפני שימוש ראשון
 באפליקציית המובייל. בוחרים מחרוזת אקראית משלכם (למשל 32 תווים) במקום
 'CHANGE-ME...', מריצים פעם אחת, ואז אפשר למחוק/לשנות את הפונקציה.
 את אותו המפתח מזינים גם בהגדרות אפליקציית ה-Flutter.
=====================================================================
*/
function setApiKey_oneTime() {
  const key = 'CHANGE-ME-to-a-random-32-char-string';
  PropertiesService.getScriptProperties().setProperty('MOBILE_API_KEY', key);
  SpreadsheetApp.getUi().alert('מפתח ה-API למובייל הוגדר. זכרו להזין את אותו המפתח באפליקציית Flutter, ולערוך את המפתח בפונקציה הזו למשהו לא-נחוש לפני ההרצה.');
}
