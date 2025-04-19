// script.js

// Firebase 初始化
const firebaseConfig = {
  apiKey: "AIzaSyDZxuUe9KyHFa0bgWb7fCnBXU0ltFJNPNc",
  authDomain: "zdysj-32e14.firebaseapp.com",
  databaseURL: "https://zdysj-32e14-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "zdysj-32e14",
  storageBucket: "zdysj-32e14.appspot.com",
  messagingSenderId: "58474599045",
  appId: "1:58474599045:web:9b0082328247b2b6ac8fec",
  measurementId: "G-RZJ2T9EBRC"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 轻震动
function vibrate() { if (navigator.vibrate) navigator.vibrate(10); }

// 按钮反馈
const verifyBtn = document.getElementById('verify-btn');
['mousedown','touchstart'].forEach(evt =>
  verifyBtn.addEventListener(evt, () => verifyBtn.classList.add('pressed'))
);
['mouseup','touchend'].forEach(evt =>
  verifyBtn.addEventListener(evt, () => verifyBtn.classList.remove('pressed'))
);
verifyBtn.addEventListener('click', () => { vibrate(); verifyPassword(); });

['username-input','password-input'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('focus', vibrate);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { vibrate(); verifyPassword(); }
  });
});

// 登录验证
async function verifyPassword() {
  const userEl = document.getElementById('username-input'),
        pwdEl  = document.getElementById('password-input'),
        user = userEl.value.trim(), pwd = pwdEl.value.trim();
  if (!user || !pwd) return;
  try {
    const snap = await database.ref(`users/${user}`).once('value'),
          data = snap.val();
    if (!data) throw new Error('NO_USER');
    if (sha256(pwd) !== data.passwordHash) throw new Error('WRONG_PWD');
    if (data.remainingQuota <= 0) throw new Error('NO_QUOTA');
    verifyBtn.classList.add('success');
    window.currentUser = { username: user, quota: data.remainingQuota, info: null };
    document.getElementById('vip-username').textContent = user;
    setTimeout(() => {
      document.getElementById('password-layer').classList.add('slide-up');
      setTimeout(() => {
        document.getElementById('password-layer').remove();
        document.getElementById('main-content').style.display = 'block';
        showLoadingOverlay();
        listenQuotaUpdates();
        updateQuotaDisplay();
      }, 600);
    }, 800);
  } catch(err) {
    if (err.message === 'NO_USER') shake('username-input');
    else if (err.message === 'WRONG_PWD') { pwdEl.value = ''; shake('password-input'); }
    else if (err.message === 'NO_QUOTA') alert('请联系管理员购买额度');
  }
}

function shake(id) {
  const el = document.getElementById(id);
  el.classList.add('input-error-shake');
  setTimeout(() => el.classList.remove('input-error-shake'), 300);
}

// 云服务加载
function showLoadingOverlay() {
  const ov = document.getElementById('loading-overlay'),
        icon = document.getElementById('cloud-icon'),
        txt = document.getElementById('loading-text');
  ov.classList.add('show');
  setTimeout(() => {
    txt.textContent = '服务连接成功，欢迎使用！';
    icon.classList.add('connected','shrink');
  }, 3000);
}
function hideLoadingOverlay() {
  const ov = document.getElementById('loading-overlay');
  ov.classList.add('hide');
  setTimeout(() => ov.classList.remove('show','connected','shrink','hide'), 500);
}

// 限额监听
function listenQuotaUpdates() {
  database.ref(`users/${window.currentUser.username}/remainingQuota`)
    .on('value', snap => {
      window.currentUser.quota = snap.val();
      updateQuotaDisplay();
    });
}
function updateQuotaDisplay() {
  document.getElementById('quota-display').textContent = `剩余：${window.currentUser.quota}`;
}

// 其他按钮震动
['upload-btn','convert-btn','filter-button','drawer-custom-confirm']
  .forEach(id => document.getElementById(id).addEventListener('click', vibrate));

// 文件上传 & 进度 & 扣减
function handleFileUpload(e) {
  vibrate();
  const file = e.target.files[0];
  if (!file) return;
  if (window.currentUser.quota <= 0) { alert('请联系管理员购买额度'); return; }
  const quotaRef = database.ref(`users/${window.currentUser.username}/remainingQuota`);
  quotaRef.transaction(cur => cur > 0 ? cur - 1 : undefined, (err, committed) => {
    if (err) alert('网络错误，请重试');
    else if (!committed) alert('请联系管理员购买额度');
    else readAndProcess(file);
  });
}

function readAndProcess(file) {
  const bar = document.getElementById('progress-bar'),
        pc = document.getElementById('progress-container'),
        reader = new FileReader();
  pc.style.display = 'block';
  reader.onprogress = ev => { if (ev.lengthComputable) bar.style.width = Math.min(ev.loaded/ev.total*90,90) + '%'; };
  reader.onload = ev => {
    bar.style.transition = 'width .6s ease'; bar.style.width = '100%';
    setTimeout(() => {
      processExcelData(ev.target.result);
      pc.style.display = 'none';
      document.getElementById('table-container').style.display = 'block';
      document.getElementById('table-container').classList.add('card-view');
      hideLoadingOverlay();
    }, 300);
  };
  reader.onerror = () => alert('文件读取失败');
  reader.readAsArrayBuffer(file);
}

// 解析 & 统计 & 渲染
let lastTxns = null;
function extractUserInfo(text) {
  const n = text.match(/：([^()]+)\(/),
        i = text.match(/居民身份证：(\d{15,18})/),
        w = text.match(/微信号：([A-Za-z0-9_]+)/);
  return { name: n ? n[1] : '', id: i ? i[1] : '', wechat: w ? w[1] : '' };
}
function updateUserInfoDisplay() {
  if (!window.currentUser.info) return;
  document.getElementById('info-name').textContent = '姓名：' + window.currentUser.info.name;
  document.getElementById('info-wechat').textContent = '微信号：' + window.currentUser.info.wechat;
  document.getElementById('info-id').textContent = '身份证号：' + window.currentUser.info.id;
}
let statsChart = null;
function updateStats(arr) {
  let inc=0,exp=0,oth=0,mI=0,mE=0;
  for (let i=5;i<arr.length;i++){
    const tp=arr[i][3]||'', amt=parseFloat(arr[i][5])||0;
    if (tp.includes('收入')) { inc+=amt; mI=Math.max(mI,amt); }
    else if (tp.includes('支出')) { exp+=amt; mE=Math.max(mE,amt); }
    else oth+=amt;
  }
  document.getElementById('stat-income').textContent = inc.toFixed(2);
  document.getElementById('stat-expense').textContent = exp.toFixed(2);
  document.getElementById('stat-other').textContent = oth.toFixed(2);
  document.getElementById('max-income').textContent = mI.toFixed(2);
  document.getElementById('max-expense').textContent = mE.toFixed(2);
  const ctx = document.getElementById('stats-chart').getContext('2d');
  if (statsChart) statsChart.destroy();
  statsChart = new Chart(ctx,{
    type:'pie',
    data:{ labels:['收入','支出','其他'], datasets:[{ data:[inc,exp,oth], backgroundColor:['#4caf50','#ff9800','#2196f3'] }] },
    options:{ plugins:{ legend:{ display:false } }, responsive:false }
  });
}

function processExcelData(data) {
  const wb = XLSX.read(new Uint8Array(data),{ type:'array' }),
        arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{ header:1 });
  document.getElementById('file-date').textContent = arr[2]?.[1]||'';
  window.currentUser.info = extractUserInfo(arr[1]?.[0]||'');
  updateUserInfoDisplay(); updateStats(arr);
  const tx={};
  for (let i=4;i<arr.length;i++){
    const r=arr[i]; if(!r[0]) continue;
    const key=`${r[6]}-${r[5]}-${r[3]}`;
    if(!tx[key]) tx[key]={ recs:[], cnt:0, ie:r[3] };
    tx[key].recs.push({ time:r[1], type:r[2], amount:r[5], method:r[4], ie:r[3] });
    tx[key].cnt++;
  }
  lastTxns = tx; renderTable(tx);
}

function renderTable(data) {
  const tbody = document.getElementById('result-body');
  tbody.innerHTML = Object.entries(data).sort((a,b)=>b[1].cnt - a[1].cnt)
    .map(([k,it])=>{
      const [cp,amt,ie] = k.split('-');
      return `<tr>
        <td data-label="交易对象：">${cp}</td>
        <td data-label="交易次数：">${it.cnt} 次</td>
        <td data-label="交易金额：">¥${amt}</td>
        <td data-label="收支类型：">${ie}</td>
        <td data-label="交易类型：">${it.recs[0].type}</td>
        <td data-label="交易方式：">${it.recs[0].method}</td>
        <td data-label="详情">
          <button class="details-btn" data-details='${JSON.stringify(it.recs)}' data-cp="${cp}">查看</button>
        </td>
      </tr>`;
    }).join('');
  document.querySelectorAll('.details-btn').forEach(b=>b.addEventListener('click', showDetails));
}

function showDetails(e) {
  const btn = e.currentTarget, d=JSON.parse(btn.dataset.details), cp=btn.dataset.cp;
  const w = window.open('','_blank'); w.document.title = cp;
  w.document.write(`<html><head><style>
    body{font-family:Arial;padding:20px;}
    table{width:100%;border-collapse:collapse;}
    th,td{padding:12px;border:1px solid #ddd;}
    th{background:#f5f5f5;}
  </style></head><body>
    <h2>交易明细 (对方：${cp}，共${d.length}笔)</h2>
    <table><tr><th>时间</th><th>类型</th><th>金额</th><th>方式</th></tr>
    ${d.map(r=>`<tr><td>${r.time}</td><td>${r.type}</td><td>¥${r.amount}</td><td>${r.method}</td></tr>`).join('')}
    </table></body></html>`);
}

// 更多分析下拉
document.getElementById('dropdown-btn')
  .addEventListener('click', ()=>document.getElementById('analysis-dropdown').classList.toggle('open'));

// 筛选按钮
const fc = document.getElementById('filter-container');
document.getElementById('filter-button').addEventListener('click', ()=>{ vibrate(); fc.classList.toggle('open'); });

// 筛选项
document.querySelectorAll('.drawer-option').forEach(b=>{
  b.addEventListener('click', ()=>{
    vibrate();
    document.querySelectorAll('.drawer-option').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const a = b.dataset.action;
    if (a==='all') applyFilter({type:'all'});
    if (a==='income') applyFilter({type:'income'});
    if (a==='expense') applyFilter({type:'expense'});
    if (a==='amount') applyFilter({type:'amount',threshold:parseFloat(b.dataset.value)});
    fc.classList.add('closing');
    setTimeout(()=>fc.classList.remove('open','closing'),300);
  });
});

// 自定义确认
document.getElementById('drawer-custom-confirm').addEventListener('click', ()=>{
  vibrate();
  const v = parseFloat(document.getElementById('drawer-custom-input').value);
  if (!isNaN(v)) {
    applyFilter({type:'amount',threshold:v});
    document.getElementById('drawer-custom-input').value = '';
    document.querySelectorAll('.drawer-option').forEach(x=>x.classList.remove('active'));
    fc.classList.add('closing');
    setTimeout(()=>fc.classList.remove('open','closing'),300);
  }
});

function applyFilter({type,threshold}) {
  if (!lastTxns) return;
  const f = {};
  Object.entries(lastTxns).forEach(([k,it])=>{
    if (type==='all') f[k]=it;
    if (type==='income' && it.ie==='收入') f[k]=it;
    if (type==='expense'&& it.ie==='支出') f[k]=it;
    if (type==='amount'&& parseFloat(it.recs[0].amount)>=threshold) f[k]=it;
  });
  renderTable(f);
}

// 初始化
function initializeApp() {
  document.getElementById('upload-btn').addEventListener('click', ()=>document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  document.getElementById('convert-btn').addEventListener('click', ()=>window.open('https://smallpdf.com/cn/pdf-to-excel','_blank'));
  document.getElementById('table-container').style.display = 'none';
  document.getElementById('progress-container').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', initializeApp);
