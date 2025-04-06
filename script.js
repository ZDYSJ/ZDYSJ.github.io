// script.js
const PASSWORD_HASH = 'feb6d05b28892231da4fd5e15314bf958d83655057de561566bdccbc525c812a';

async function verifyPassword() {
    const inputElement = document.getElementById('password-input');
    const checkmark = document.querySelector('.success-check');
    
    try {
        const input = inputElement.value;
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
            throw new Error('浏览器不支持安全加密功能');
        }

        if (hashHex === PASSWORD_HASH) {
            checkmark.classList.add('show-check');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            document.getElementById('password-layer').remove();
            document.getElementById('main-content').style.display = 'block';
            initializeApp();
        } else {
            throw new Error('密码错误');
        }
    } catch (error) {
        console.error('验证失败:', error);
        inputElement.classList.add('shake', 'input-error');
        setTimeout(() => {
            inputElement.classList.remove('shake', 'input-error');
            inputElement.value = '';
        }, 500);
        alert(`操作失败: ${error.message}`);
    }
}

function initializeApp() {
    try {
        document.getElementById('table-container').style.display = 'none';
        
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', handleFileUpload);
        
        document.getElementById('convert-btn').addEventListener('click', () => {
            window.open('https://www.pdfpai.com', '_blank');
        });
    } catch (error) {
        console.error('初始化失败:', error);
        alert(`系统错误: ${error.message}`);
        window.location.reload();
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    
    document.getElementById('table-container').style.display = 'none';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    setTimeout(() => progressBar.style.width = '100%', 100);

    const reader = new FileReader();
    reader.onload = function(e) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            processExcelData(e.target.result);
            document.getElementById('table-container').style.display = 'block';
            // 添加has-table类使按钮上移
            document.body.classList.add('has-table');
        }, 1000);
    };
    reader.onerror = (error) => {
        console.error('文件读取失败:', error);
        alert('文件读取失败，请重试');
        progressContainer.style.display = 'none';
    };
    reader.readAsArrayBuffer(file);
}

function processExcelData(data) {
    try {
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const transactions = {};

        for (let i = 4; i < json.length; i++) {
            const row = json[i];
            const key = `${row[6]}-${row[5]}-${row[3]}`;
            transactions[key] = transactions[key] || { records: [], count: 0 };
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
        console.error('数据处理失败:', error);
        alert('文件格式错误，请使用标准账单模板');
    }
}

function renderTable(data) {
    const table = document.getElementById('result-table');
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('result-body');

    thead.innerHTML = `
        <tr>
            <th>交易类型</th>
            <th>收/支</th>
            <th>交易方式</th>
            <th>金额</th>
            <th>交易对方</th>
            <th>发生次数</th>
            <th>详情</th>
        </tr>
    `;

    tbody.innerHTML = Object.entries(data)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([key, item]) => {
            const [counterpart, amount, incomeExpense] = key.split('-');
            return `
                <tr>
                    <td>${item.records[0].type}</td>
                    <td>${incomeExpense}</td>
                    <td>${item.records[0].method}</td>
                    <td>${amount}</td>
                    <td>${counterpart}</td>
                    <td>${item.count}</td>
                    <td><button class="details-btn" data-details='${JSON.stringify(item.records)}'>详情</button></td>
                </tr>
            `;
        }).join('');

    document.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            try {
                const details = JSON.parse(this.dataset.details);
                showDetails(details);
            } catch (error) {
                console.error('详情解析失败:', error);
                alert('无法显示详情数据');
            }
        });
    });
}

function showDetails(details) {
    try {
        const win = window.open('', '_blank');
        win.document.write(`
            <html><head>
            <title>交易详情</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
            </head>
            <body>
                <h2>交易详情 (共${details.length}笔)</h2>
                <table>
                    <tr><th>时间</th><th>类型</th><th>金额</th><th>对方</th></tr>
                    ${details.map(d => `
                        <tr>
                            <td>${d.time}</td>
                            <td>${d.type}</td>
                            <td>¥${d.amount}</td>
                            <td>${d.counterpart}</td>
                        </tr>
                    `).join('')}
                </table>
            </body></html>
        `);
    } catch (error) {
        console.error('弹窗创建失败:', error);
        alert('无法显示详情窗口');
    }
}

// 环境检测
console.log('运行环境检测:');
console.log('UserAgent:', navigator.userAgent);
console.log('HTTPS:', window.location.protocol === 'https:');
console.log('加密支持:', !!window.crypto?.subtle);
console.log('文件API:', !!window.FileReader);
