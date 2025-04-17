// ========== Firebase 初始化 ==========
const firebaseConfig = {
  apiKey: "AIzaSyDZxuUe9KyHFa0bgWb7fCnBXU0ltFJNPNc",
  authDomain: "zdysj-32e14.firebaseapp.com",
  databaseURL: "https://zdysj-32e14-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "zdysj-32e14",
  storageBucket: "zdysj-32e14.firebasestorage.app",
  messagingSenderId: "58474599045",
  appId: "1:58474599045:web:9b0082328247b2b6ac8fec",
  measurementId: "G-RZJ2T9EBRC"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========== 错误提示 ==========
function showError(msg) {
  const e = document.getElementById('error-message');
  e.textContent = msg;
  ['username-input','password-input'].forEach(id =>
    document.getElementById(id).classList.add('input-error')
  );
  setTimeout(() => {
    e.textContent = '';
    ['username-input','password-input'].forEach(id =>
      document.getElementById(id).classList.remove('input-error')
    );
  }, 2000);
}

// ========== 更新剩余次数 ==========
function updateQuotaDisplay() {
  const el = document.getElementById('quota-display');
  if (window.currentUser && el) {
    el.textContent = `剩余次数：${window.currentUser.quota}`;
  }
}

// ========== 提取用户信息 ==========
function extractUserInfo(text) {
  const nameMatch   = text.match(/：([^()]+)\(/);
  const idMatch     = text.match(/居民身份证：(\d{15,18})/);
  const wechatMatch = text.match(/微信号：([A-Za-z0-9_]+)/);
  return {
    name:   nameMatch   ? nameMatch[1]   : '',
    id:     idMatch     ? idMatch[1]     : '',
    wechat: wechatMatch ? wechatMatch[1] : ''
  };
}
function updateUserInfoDisplay() {
  if (!window.currentUser.info) return;
  document.getElementById('info-name').textContent   = '姓名：'   + window.currentUser.info.name;
  document.getElementById('info-wechat').textContent = '微信号：' + window.currentUser.info.wechat;
  document.getElementById('info-id').textContent     = '身份证号：' + window.currentUser.info.id;
}

// ========== 饼图与统计 ==========
let statsChart = null;
function updateStats(arr) {
  let income = 0, expense = 0, other = 0;
  let maxIncome = 0, maxExpense = 0;
  // 从 D5/F5以下开始 (i=5)
  for (let i = 5; i < arr.length; i++) {
    const type = (arr[i][3] || '').toString();
    const amt  = parseFloat(arr[i][5]) || 0;
    if (type.includes('收入')) {
      income += amt;
      if (amt > maxIncome) maxIncome = amt;
    } else if (type.includes('支出')) {
      expense += amt;
      if (amt > maxExpense) maxExpense = amt;
    } else {
      other += amt;
    }
  }
  // 更新文本
  document.getElementById('stat-income').textContent  = income.toFixed(2);
  document.getElementById('stat-expense').textContent = expense.toFixed(2);
  document.getElementById('stat-other').textContent   = other.toFixed(2);
  document.getElementById('max-income').textContent  = maxIncome.toFixed(2);
  document.getElementById('max-expense').textContent = maxExpense.toFixed(2);

  // 绘制饼图
  const ctx = document.getElementById('stats-chart').getContext('2d');
  if (statsChart) statsChart.destroy();
  statsChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['收入','支出','其他'],
      datasets: [{ data: [income, expense, other] }]
    },
    options: { responsive: false, legend: { display: false } }
  });
}

// ========== 登录验证 ==========
async function verifyPassword() {
  try {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    if (!username || !password) throw new Error('请输入完整的账号和密码');

    const snap = await database.ref(`users/${username}`).once('value');
    const userData = snap.val();
    if (!userData) throw new Error('账号不存在');
    if (sha256(password) !== userData.passwordHash) throw new Error('密码错误');
    if (userData.remainingQuota <= 0) throw new Error('使用次数已用完');

    window.currentUser = { username, quota: userData.remainingQuota, info: null };
    document.getElementById('vip-username').textContent = username;
    document.getElementById('verify-btn').classList.add('success');
    await new Promise(r => setTimeout(r, 800));

    document.getElementById('password-layer').remove();
    document.getElementById('main-content').style.display = 'block';
    updateQuotaDisplay();

    database.ref(`users/${username}`).on('value', s => {
      window.currentUser.quota = s.val().remainingQuota;
      updateQuotaDisplay();
    });
  } catch (err) {
    showError(err.message);
  }
}

// ========== 文件上传 & 解析 ==========
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const bar = document.getElementById('progress-bar');
  bar.style.width = '0%';
  document.getElementById('progress-container').style.display = 'block';

  let p = 0;
  const iv = setInterval(() => { if (p < 90) { p += 2; bar.style.width = p + '%'; } }, 100);

  const reader = new FileReader();
  reader.onload = ev => {
    clearInterval(iv);
    let fp = p;
    const fin = setInterval(() => {
      if (fp < 100) { fp += 2; bar.style.width = fp + '%'; }
      else {
        clearInterval(fin);
        setTimeout(async () => {
          try {
            await database.ref(`users/${window.currentUser.username}`)
                          .update({ remainingQuota: window.currentUser.quota - 1 });
            processExcelData(ev.target.result);
            document.getElementById('floating-buttons').classList.add('uploaded');
            document.getElementById('table-container').style.display = 'block';
            document.getElementById('progress-container').style.display = 'none';
          } catch (err) {
            showError('次数更新失败: ' + err.message);
          }
        }, 300);
      }
    }, 30);
  };
  reader.onerror = err => {
    clearInterval(iv);
    showError('文件读取失败: ' + err.message);
    document.getElementById('progress-container').style.display = 'none';
  };
  reader.readAsArrayBuffer(file);
}

function processExcelData(data) {
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
  const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

  // B3 （arr[2][1]） 读取并显示
  const dateText = (arr[2] && arr[2][1]) ? arr[2][1] : '';
  document.getElementById('file-date').textContent = dateText;

  // A2 （arr[1][0]） 提取并显示
  const raw = (arr[1] && arr[1][0]) ? arr[1][0] : '';
  window.currentUser.info = extractUserInfo(raw);
  updateUserInfoDisplay();

  // 更新饼图 & 最高单笔
  updateStats(arr);

  // 渲染交易表格
  try {
    const txns = {};
    for (let i = 4; i < arr.length; i++) {  // 从索引4(表头)开始
      const row = arr[i];
      if (!row[0]) continue;               // 跳过空行
      const key = `${row[6]}-${row[5]}-${row[3]}`;
      if (!txns[key]) txns[key] = { records:[], count:0 };
      txns[key].records.push({
        transactionId: row[0],
        time: row[1],
        type: row[2],
        incomeExpense: row[3],
        method: row[4],
        amount: row[5],
        counterpart: row[6]
      });
      txns[key].count++;
    }
    renderTable(txns);
  } catch {
    showError('文件解析失败，请使用正确模板');
  }
}

// ========== 渲染表格 & 详情 ==========
function renderTable(data) {
  const tbody = document.getElementById('result-body');
  tbody.innerHTML = Object.entries(data)
    .sort((a,b) => b[1].count - a[1].count)
    .map(([k,item]) => {
      const [cp,amt,ie] = k.split('-');
      return `
        <tr>
          <td>${item.records[0].type}</td>
          <td>${ie}</td>
          <td>${item.records[0].method}</td>
          <td>¥${amt}</td>
          <td>${cp}</td>
          <td>${item.count}</td>
          <td>
            <button class="details-btn" data-details='${JSON.stringify(item.records)}'>
              查看详情
            </button>
          </td>
        </tr>`;
    }).join('');
  document.querySelectorAll('.details-btn').forEach(btn =>
    btn.addEventListener('click', showTransactionDetails)
  );
}

function showTransactionDetails(e) {
  const details = JSON.parse(e.target.dataset.details);
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><style>
      body{font-family:Arial;padding:20px;}
      table{width:100%;border-collapse:collapse;}
      th,td{padding:12px;border:1px solid #ddd;}
      th{background:#f5f5f5;}
    </style></head><body>
      <h2>交易明细 (共${details.length}笔)</h2>
      <table>
        <tr><th>时间</th><th>类型</th><th>金额</th><th>方式</th></tr>
        ${details.map(d => `
          <tr>
            <td>${d.time}</td><td>${d.type}</td>
            <td>¥${d.amount}</td><td>${d.method}</td>
          </tr>`).join('')}
      </table>
    </body></html>
  `);
}

// ========== 初始化 ==========
function initializeApp() {
  document.getElementById('verify-btn').addEventListener('click', verifyPassword);
  ['username-input','password-input'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') verifyPassword();
    })
  );
  document.getElementById('upload-btn').addEventListener('click', () =>
    document.getElementById('file-input').click()
  );
  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  document.getElementById('convert-btn').addEventListener('click', () =>
    window.open('https://smallpdf.com/cn/pdf-to-excel#r=convert-to-excel', '_blank')
  );
  const dd = document.getElementById('analysis-dropdown'),
        btn = document.getElementById('dropdown-btn');
  btn.addEventListener('click', () => dd.classList.toggle('open'));
  document.getElementById('table-container').style.display    = 'none';
  document.getElementById('progress-container').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', initializeApp);
