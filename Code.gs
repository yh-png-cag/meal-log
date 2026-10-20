const SPREADSHEET_ID = '1MhXIRk09s3_DQgn5JNXw5ESYzWvfxFdT3MXuQzFQ41w';
const SHEET_NAME = '食事管理';
const HEADERS = ['日付','食事区分','食品・メニュー','量・単位','カロリー(kcal)','たんぱく質P(g)','脂質F(g)','炭水化物C(g)','メモ','水分量(mL)'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('食事ログ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDashboardData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('シート「' + SHEET_NAME + '」が見つかりません。');
  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('シートにヘッダーがありません。');
  const header = values[0].map(v => String(v).trim());
  const idx = {};
  HEADERS.forEach(h => {
    idx[h] = header.indexOf(h);
    if (idx[h] < 0) throw new Error('必要な列がありません: ' + h);
  });

  const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const byDate = {};
  values.slice(1).forEach(row => {
    const rawDate = row[idx['日付']];
    if (!rawDate) return;
    let key;
    if (rawDate instanceof Date) key = Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd');
    else {
      const s = String(rawDate).trim();
      const m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (m) key = m[1] + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
      else return;
    }
    if (!byDate[key]) byDate[key] = {date:key, recorded:true, entries:0, kcal:0, p:0, f:0, c:0, water:0};
    const d = byDate[key]; d.entries++;
    d.kcal += num_(row[idx['カロリー(kcal)']]);
    d.p += num_(row[idx['たんぱく質P(g)']]);
    d.f += num_(row[idx['脂質F(g)']]);
    d.c += num_(row[idx['炭水化物C(g)']]);
    d.water += num_(row[idx['水分量(mL)']]);
  });
  const makeDay = offset => {
    const dt = new Date(today + 'T12:00:00');
    dt.setDate(dt.getDate() - offset);
    const key = Utilities.formatDate(dt, tz, 'yyyy-MM-dd');
    return byDate[key] || {date:key, recorded:false, entries:0, kcal:0, p:0, f:0, c:0, water:0};
  };
  const days7 = Array.from({length:7}, (_,i)=>makeDay(6-i));
  const days30 = Array.from({length:30}, (_,i)=>makeDay(29-i));
  const recorded30 = days30.filter(d=>d.recorded);
  const avg = key => recorded30.length ? recorded30.reduce((s,d)=>s+d[key],0)/recorded30.length : 0;
  return {
    today: byDate[today] || {date:today, recorded:false, entries:0, kcal:0, p:0, f:0, c:0, water:0},
    days7, days30,
    averages30: {days:recorded30.length, kcal:avg('kcal'), p:avg('p'), f:avg('f'), c:avg('c'), water:avg('water')},
    updatedAt: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm')
  };
}
function num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v || '').replace(/,/g,''));
  return isFinite(n) ? n : 0;
}
