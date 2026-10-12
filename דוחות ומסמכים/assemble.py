import re, os, zipfile, sys

OUT = '/mnt/user-data/outputs'
WIP = os.path.join(OUT, '_wip_doc')
FINAL = os.path.join(OUT, 'bereshit_solar_technical_handoff.md')

def read(path, root=OUT):
    return open(os.path.join(root, path), encoding='utf-8').read().replace('\r\n', '\n')

def match_brace(s, i):
    d = 0
    for k in range(i, len(s)):
        if s[k] == '{': d += 1
        elif s[k] == '}':
            d -= 1
            if d == 0: return k
    raise ValueError('unbalanced braces')

def dedent_by(t, n):
    return '\n'.join(l[n:] if l.startswith(' ' * n) else l for l in t.split('\n'))

def get_func(path, name):
    s = read(path)
    ms = list(re.finditer(r'(?m)^([ \t]*)(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(', s))
    if len(ms) != 1:
        raise ValueError(f'{path}:{name}: expected exactly 1 definition, found {len(ms)}')
    m = ms[0]
    indent = len(m.group(1))
    start = m.start()
    open_idx = s.index('{', m.end())
    end = match_brace(s, open_idx) + 1
    text = s[start:end]
    last = text.split('\n')[-1]
    if last.strip() != '}' or (len(last) - len(last.lstrip())) != indent:
        raise ValueError(f'{path}:{name}: unexpected closing line {last!r}')
    if len(text.split('\n')) > 420:
        raise ValueError(f'{path}:{name}: snippet too long')
    return dedent_by(text, indent)

def get_mark(path, start_sub, end_line):
    L = read(path).split('\n')
    si = [i for i, l in enumerate(L) if start_sub in l]
    if len(si) != 1:
        raise ValueError(f'{path}: start marker {start_sub!r} found {len(si)} times')
    si = si[0]
    ei = next(i for i in range(si + 1, len(L)) if L[i].rstrip() == end_line.rstrip())
    indent = len(L[si]) - len(L[si].lstrip())
    return dedent_by('\n'.join(L[si:ei + 1]), indent)

def fence(code, lang):
    assert '```' not in code
    return f'```{lang}\n{code.rstrip()}\n```'

def funcs_list(path):
    L = read(path).split('\n')
    out = []
    for i, l in enumerate(L, 1):
        m = re.match(r'\s*(?:async\s+)?function\s+([A-Za-z_0-9$]+)\s*\(', l)
        if m: out.append(f'{m.group(1)}:{i}')
    return out

ROLES = {
 'code.js': ('Backend (Apps Script): ניתוב, JSON API, כתיבות עמודות, ייצוא Excel', '🟡 לא הורץ ב-Apps Script'),
 'Index.html': ('CRM: לקוחות, כרטיסי מערכת, כפתורי שלבים', '🟡 D1, D14'),
 'Form.html': ('טופס איסוף נתוני צריכה ללקוח (הצפנה היברידית)', '🟡 עיצוב ותיקון fetchCustomerData בלבד שונו'),
 'PrintQuote.html': ('הצעת מחיר מודפסת (13 עמודי A4) + לוח בקרה', '🟡 עיצוב לוח הבקרה בלבד שונה'),
 'Calculator.html': ('מחשבון חד-קובצי ישן (תאימות לאחור, route calculator)', 'Legacy'),
 'ConsumptionAnalysis.html': ('שלב 1: ניתוח והעשרת נתוני צריכה וייצור (עבר)', '🟡 D5-D9, D13'),
 'SystemSizing.html': ('שלב 2: המלצת גודל מערכת (קדימה)', '🟡 D2-D4, D12, D15'),
 'FinancialModel.html': ('שלב 3: מודל פיננסי ושמירה להצעת המחיר', '🟡 D2'),
 'כלי_פענוח_טופס_בראשית_סולאר.html': ('כלי פענוח עצמאי (offline, Web Crypto)', '✅ נבדק במהלך הפיתוח המוקדם'),
 'bereshit_solar_mobile_app.zip': ('אפליקציית Flutter (מעטפת + WebView + JSON API)', '🟡 לא קומפל'),
 'תכנית_השלמה_וחיבור_מערכת_בראשית_סולאר.html': ('תכנית השלמה ראשונית', 'היסטורי'),
 'מדריך_ארכיטקטורה_מלא_מערכת_בראשית_סולאר.html': ('מדריך ארכיטקטורה', '🔴 קדם לפיצול לשלושה שלבים; לא מעודכן'),
 'תכנית_פיצול_המחשבון_ל3_שלבים.html': ('תכנית פיצול המחשבון', '🟡 סכימת עמודה 30 בתכנית (JSON עשיר) הוחלפה בקידוד קומפקטי (2.9)'),
}

def inventory():
    rows = ['| קובץ | בתים | שורות | תפקיד | סטטוס |', '|---|---|---|---|---|']
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        if not os.path.isfile(p) or f == os.path.basename(FINAL): continue
        size = os.path.getsize(p)
        lines = '-' if f.endswith('.zip') else str(open(p, 'rb').read().count(b'\n') + 1)
        role, status = ROLES.get(f, ('(לא מסווג)', ''))
        rows.append(f'| `{f}` | {size:,} | {lines} | {role} | {status} |')
    return '\n'.join(rows)

def zip_file(zpath, inner):
    with zipfile.ZipFile(os.path.join(OUT, zpath)) as z:
        return z.read(inner).decode('utf-8').replace('\r\n', '\n')

def render(text):
    def r_inv(m): return inventory()
    def r_funcs(m):
        path = m.group(1)
        return f'**{path}**\n\n' + fence(', '.join(funcs_list(path)), '')
    def r_code(m):
        path, name = m.group(1), m.group(2)
        lang = 'js'
        return fence(get_func(path, name), lang)
    def r_mark(m):
        path, a, b, lang = m.group(1), m.group(2), m.group(3), m.group(4)
        b = {'CLOSE8': '        }', 'CLOSE4SEMI': '    };'}.get(b, b)
        return fence(get_mark(path, a, b), lang)
    def r_file(m):
        spec, lang = m.group(1), m.group(2)
        assert spec.startswith('zip:')
        inner = spec[4:]
        return f'`{inner}`\n\n' + fence(zip_file('bereshit_solar_mobile_app.zip', inner), lang)
    text = re.sub(r'\{\{INVENTORY\}\}', r_inv, text)
    text = re.sub(r'\{\{FUNCS\|([^}|]+)\}\}', r_funcs, text)
    text = re.sub(r'\{\{CODE\|([^}|]+)\|([^}|]+)\}\}', r_code, text)
    text = re.sub(r'\{\{MARK\|([^|}]+)\|([^|}]+)\|([^|}]*)\|([^|}]+)\}\}', r_mark, text)
    text = re.sub(r'\{\{FILE\|([^|}]+)\|([^|}]+)\}\}', r_file, text)
    return text

parts = [open(os.path.join(WIP, f'part{i}.md'), encoding='utf-8').read() for i in range(1, 6)]
doc = '\n\n'.join(p.strip('\n') for p in parts) + '\n'

# תיקוני ניסוח שנצברו בזמן הביקורת
def sub_once(s, old, new):
    assert s.count(old) == 1, (s.count(old), old[:60])
    return s.replace(old, new)
doc = sub_once(doc, 'חלקם סותרים טענות שנמסרו למשתמש במהלך השיחה (למשל: שדות חיוג מחדש מטופס הלקוח, סליידר גדילת צריכה, יחס שטח גג 5.5).',
                    'חלקם סותרים טענות שנמסרו למשתמש במהלך השיחה (למשל: מילוי נתוני החיוב מקובץ ה-JSON של הטופס, סליידר גדילת צריכה, יחס שטח גג 5.5).')
doc = sub_once(doc, 'פגמים מאומתים (ביקורת והרצה של `buildExcelPayload`): D9, D10, D11 (סעיף 6.1).',
                    'פגמים מאומתים (ביקורת והרצה של `buildExcelPayload`): D8, D9, D10, D11, D13 (סעיף 6.1).')

doc = render(doc)
if '{{' in doc:
    for m in re.finditer(r'\{\{', doc):
        print('UNREPLACED near:', repr(doc[max(0, m.start()-60): m.start()+120]))
    raise SystemExit('unreplaced placeholder')

# תוכן עניינים
toc = ['## תוכן עניינים', '',
 '1. סקירת המערכת והארכיטקטורה (High-Level Architecture)',
 '2. מכלול המנגנונים והאלגוריתמים שפותחו (Deep Dive Implementation)',
 '3. יומן כישלונות, טעויות וגישות שנפסלו (Mistakes & Failed Approaches)',
 '4. סטטוס קוד נוכחי ורכיבים מוכנים (Current Codebase & Implementation State)',
 '5. מקרי קצה, אבטחה וביצועים (Edge Cases, Security & Performance)',
 '6. מפת דרכים והצעדים הבאים (Roadmap & Pending Tasks)',
 'נספח: מונחון', '']
marker = '## מקרא סטטוס'
assert doc.count(marker) == 1
doc = doc.replace(marker, '\n'.join(toc) + '\n---\n\n' + marker)

open(FINAL, 'w', encoding='utf-8').write(doc)
print('written', FINAL, 'lines:', doc.count('\n'), 'chars:', len(doc))
