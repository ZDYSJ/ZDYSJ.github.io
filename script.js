// Firebase配置
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

// 初始化Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 显示错误提示效果
function showError(msg) {
  const errorElem = document.getElementById('error-message');
  errorElem.textContent = msg;
  // 为输入框添加错误样式
  const userInput = document.getElementById('username-input');
  const passInput = document.getElementById('password-input');
  userInput.classList.add('input-error');
  passInput.classList.add('input-error');
  // 清除错误样式和文字
  setTimeout(() => {
    errorElem.textContent = '';
    userInput.classList.remove('input-error');
    passInput.classList.remove('input-error');
  }, 2000);
}

// 验证密码函数
async function verifyPassword() {
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value.trim();
  const verifyBtn = document.getElementById('verify-btn');

  try {
    if (!username || !password) throw new Error('请输入完整的账号和密码');

    const snapshot = await database.ref(`users/${username}`).once('value');
    const userData = snapshot.val();

    if (!userData) throw new Error('账号不存在');
    
    const hashHex = sha256(password);
    if (hashHex !== userData.passwordHash) throw new Error('密码错误');
    if (userData.remainingQuota <= 0) throw new Error('使用次数已用完');

    window.currentUser = {
      username: username,
      quota: userData.remainingQuota
    };

    // 修改按钮反馈效果：切换为绿色并放大后恢复
    verifyBtn.classList.add('success');
    await new Promise(resolve => setTimeout(resolve, 800));
    document.getElementById('password-layer').remove();
    document.getElementById('main-content').style.display = 'block';
    updateQuotaDisplay();

    // 监听Firebase数据库用户数据变化
    database.ref(`users/${username}`).on('value', (snapshot) => {
      const data = snapshot.val();
      window.currentUser.quota = data.remainingQuota;
      updateQuotaDisplay();
    });
  } catch (error) {
    showError(error.message);
  }
}

// 添加键盘回车提交支持
document.getElementById('password-input').addEventListener('keydown', function(event) {
  if (event.key === "Enter") verifyPassword();
});
document.getElementById('username-input').addEventListener('keydown', function(event) {
  if (event.key === "Enter") verifyPassword();
});

// 更新剩余次数显示
function updateQuotaDisplay() {
  const quotaElement = document.getElementById('quota-display');
  if (quotaElement && window.currentUser) {
    quotaElement.textContent = `剩余次数：${window.currentUser.quota}`;
  }
}

// 文件上传处理函数
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = '0%';
  document.getElementById('progress-container').style.display = 'block';
  
  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 90) progress += 2;
    progressBar.style.width = progress + '%';
  }, 100);

  const reader = new FileReader();
  
  reader.onload = async (e) => {
    clearInterval(interval);
    let finalProgress = progress;
    
    const finalInterval = setInterval(() => {
      if (finalProgress < 100) {
        finalProgress += 2;
        progressBar.style.width = finalProgress + '%';
      } else {
        clearInterval(finalInterval);
        setTimeout(async () => {
          try {
            await database.ref(`users/${window.currentUser.username}`).update({
              remainingQuota: window.currentUser.quota - 1
            });
            processExcelData(e.target.result);
            // 上传成功后调整按钮区域和隐藏进度条
            document.getElementById('floating-buttons').classList.add('uploaded');
            document.getElementById('table-container').style.display = 'block';
            document.getElementById('progress-container').style.display = 'none';
          } catch (error) {
            showError('次数更新失败: ' + error.message);
          }
        }, 300);
      }
    }, 30);
  };

  reader.onerror = (error) => {
    clearInterval(interval);
    showError('文件读取失败: ' + error.message);
    document.getElementById('progress-container').style.display = 'none';
  };
  
  reader.readAsArrayBuffer(file);
}

// 初始化应用——绑定各个按钮的事件
function initializeApp() {
  document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  
  document.getElementById('convert-btn').addEventListener('click', () => {
    window.open('https://smallpdf.com/cn/pdf-to-excel#r=convert-to-excel', '_blank');
  });

  // 初始化隐藏部分界面元素
  document.getElementById('table-container').style.display = 'none';
  document.getElementById('progress-container').style.display = 'none';
}

// 解析Excel数据
function processExcelData(data) {
  try {
    const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const transactions = {};
    for (let i = 4; i < jsonData.length; i++) {
      const row = jsonData[i];
      const key = `${row[6]}-${row[5]}-${row[3]}`;
      if (!transactions[key]) {
        transactions[key] = { records: [], count: 0 };
      }
      transactions[key].records.push({
        transactionId: row[0],
        time: row[1],
        type: row[2],
        incomeExpense: row[3],
        method: row[4],
        amount: row[5],
        counterpart: row[6]
      });
      transactions[key].count++;
    }
    renderTable(transactions);
  } catch (error) {
    showError('文件解析失败，请使用正确模板');
  }
}

// 渲染表格数据
function renderTable(data) {
  const tbody = document.getElementById('result-body');
  tbody.innerHTML = Object.entries(data)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, item]) => {
      const [counterpart, amount, incomeExpense] = key.split('-');
      return `
        <tr>
          <td>${item.records[0].type}</td>
          <td>${incomeExpense}</td>
          <td>${item.records[0].method}</td>
          <td>¥${amount}</td>
          <td>${counterpart}</td>
          <td>${item.count}</td>
          <td><button class="details-btn" data-details='${JSON.stringify(item.records)}'>查看详情</button></td>
        </tr>
      `;
    }).join('');

  document.querySelectorAll('.details-btn').forEach(btn => {
    btn.addEventListener('click', showTransactionDetails);
  });
}

// 显示交易详情
function showTransactionDetails(event) {
  const details = JSON.parse(event.target.dataset.details);
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><style>
      body { font-family: Arial; padding: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 12px; border: 1px solid #ddd; }
      th { background: #f5f5f5; }
    </style></head>
    <body>
      <h2>交易明细 (共${details.length}笔)</h2>
      <table>
        <tr><th>时间</th><th>类型</th><th>金额</th><th>交易方式</th></tr>
        ${details.map(d => `
          <tr>
            <td>${d.time}</td>
            <td>${d.type}</td>
            <td>¥${d.amount}</td>
            <td>${d.method}</td>
          </tr>
        `).join('')}
      </table>
    </body></html>
  `);
}

// DOM加载完成后初始化应用
document.addEventListener("DOMContentLoaded", initializeApp);
