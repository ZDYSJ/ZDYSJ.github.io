const PASSWORD_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

async function verifyPassword() {
    const input = document.getElementById('password-input').value;
    const inputElement = document.getElementById('password-input');
    const checkmark = document.querySelector('.success-check');
    
    try {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
        const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        if (hashHex === PASSWORD_HASH) {
            // 显示成功动画
            checkmark.classList.add('show-check');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            document.getElementById('password-layer').remove();
            document.getElementById('main-content').style.display = 'block';
            initializeApp();
        } else {
            throw new Error('密码错误');
        }
    } catch (error) {
        inputElement.classList.add('shake', 'input-error');
        setTimeout(() => {
            inputElement.classList.remove('shake', 'input-error');
            inputElement.value = '';
        }, 500);
    }
}

function initializeApp() {
    // 初始化界面状态
    document.getElementById('table-container').style.display = 'none';
    
    // 文件上传按钮
    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    // 文件选择处理
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    // PDF转换按钮
    document.getElementById('convert-btn').addEventListener('click', () => {
        window.open('https://www.pdfpai.com', '_blank');
    });
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    
    // 重置界面
    document.getElementById('table-container').style.display = 'none';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    // 模拟进度动画
    setTimeout(() => progressBar.style.width = '100%', 100);

    const reader = new FileReader();
    reader.onload = function(e) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            processExcelData(e.target.result);
            document.getElementById('table-container').style.display = 'block';
        }, 1000);
    };
    reader.readAsArrayBuffer(file);
}

function processExcelData(data) {
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
}

function renderTable(data) {
    const table = document.getElementById('result-table');
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('result-body');

    // 生成表头
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

    // 生成表格内容
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

    // 绑定详情按钮
    document.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const details = JSON.parse(this.dataset.details);
            showDetails(details);
        });
    });
}

function showDetails(details) {
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
}
