// script.js
const PASSWORD_HASH = 'feb6d05b28892231da4fd5e15314bf958d83655057de561566bdccbc525c812a';

// 密码验证功能
async function verifyPassword() {
    const input = document.getElementById('password-input').value;
    const inputElement = document.getElementById('password-input');
    const checkmark = document.querySelector('.success-check');
    
    try {
        // 清除状态
        inputElement.classList.remove('input-error');
        checkmark.classList.remove('active');
        
        // 空值检测
        if (!input) throw new Error('请输入密码');
        
        // 加密处理
        let hashHex;
        if (typeof sha256 === 'function') {
            hashHex = sha256(input);
        } else if (window.crypto?.subtle) {
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
            hashHex = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } else {
            throw new Error('浏览器不支持安全加密');
        }

        if (hashHex === PASSWORD_HASH) {
            // 成功反馈
            checkmark.classList.add('active');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 切换界面
            document.getElementById('password-layer').remove();
            document.getElementById('main-content').style.display = 'block';
            
            // 初始化应用
            initializeApp();
        } else {
            throw new Error('密码错误');
        }
    } catch (error) {
        inputElement.classList.add('input-error');
        inputElement.value = '';
        setTimeout(() => {
            inputElement.classList.remove('input-error');
        }, 1000);
        alert(error.message);
    }
}

// 应用初始化
function initializeApp() {
    // 绑定事件
    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    document.getElementById('convert-btn').addEventListener('click', () => {
        window.open('https://www.pdfpai.com', '_blank');
    });
    
    // 重置状态
    document.getElementById('table-container').style.display = 'none';
    document.getElementById('progress-container').style.display = 'none';
}

// 文件处理
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '0%';
    
    // 显示进度
    document.getElementById('progress-container').style.display = 'block';
    
    // 模拟进度
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 10;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
        if (progress >= 100) clearInterval(progressInterval);
    }, 200);

    const reader = new FileReader();
    reader.onload = (e) => {
        setTimeout(() => {
            clearInterval(progressInterval);
            processExcelData(e.target.result);
            document.getElementById('floating-buttons').classList.add('uploaded');
            document.getElementById('table-container').style.display = 'block';
            document.getElementById('progress-container').style.display = 'none';
        }, 1000);
    };
    reader.onerror = (error) => {
        alert('文件读取失败: ' + error.message);
        document.getElementById('progress-container').style.display = 'none';
    };
    reader.readAsArrayBuffer(file);
}

// 数据处理
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
                transactions[key] = {
                    records: [],
                    count: 0
                };
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
        alert('文件解析失败，请确保使用正确模板');
    }
}

// 表格渲染
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
                    <td>
                        <button class="details-btn" 
                                data-details='${JSON.stringify(item.records)}'>
                            查看详情
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    // 绑定详情事件
    document.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', showTransactionDetails);
    });
}

// 交易详情
function showTransactionDetails(event) {
    const details = JSON.parse(event.target.dataset.details);
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>交易明细</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px; border-bottom: 1px solid #ddd; }
                th { background: #f8f9fa; }
            </style>
        </head>
        <body>
            <h2>交易明细 (共${details.length}笔)</h2>
            <table>
                <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>金额</th>
                    <th>交易方式</th>
                </tr>
                ${details.map(d => `
                    <tr>
                        <td>${d.time}</td>
                        <td>${d.type}</td>
                        <td>¥${d.amount}</td>
                        <td>${d.method}</td>
                    </tr>
                `).join('')}
            </table>
        </body>
        </html>
    `);
}

// 环境检测
console.log('系统初始化检查:');
console.log('支持加密:', !!window.crypto?.subtle);
console.log('支持文件API:', !!window.FileReader);
