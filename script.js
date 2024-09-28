document.getElementById('upload-btn').addEventListener('click', function() {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const resultTable = document.getElementById('result-table');

        // 隐藏表格
        resultTable.style.display = 'none';

        // 显示进度条
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        setTimeout(() => {
            progressBar.style.width = '100%';
        }, 100);

        const reader = new FileReader();
        reader.onload = function(e) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
                resultTable.style.display = 'table';
            }, 3000);

            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const transactions = {};
            for (let i = 4; i < json.length; i++) {
                const row = json[i];
                const transactionId = row[0]; // 假设第1列为交易单号
                const time = row[1]; // 假设第2列为交易时间
                const type = row[2]; // 假设第3列为交易类型
                const incomeExpense = row[3]; // 假设第4列为收/支/其他
                const method = row[4]; // 假设第5列为交易方式
                const amount = row[5]; // 假设第6列为金额(元)
                const counterpart = row[6]; // 假设第7列为交易对方

                if (counterpart && amount) {
                    const key = `${counterpart}-${amount}-${incomeExpense}`;
                    if (!transactions[key]) {
                        transactions[key] = {
                            records: [],
                            count: 0
                        };
                    }
                    transactions[key].records.push({ transactionId, time, type, incomeExpense, method, amount, counterpart });
                    transactions[key].count++;
                }
            }

            // 将结果转换为数组
            const resultArray = Object.entries(transactions).sort((a, b) => b[1].count - a[1].count);
            const tbody = document.getElementById('result-body');
            tbody.innerHTML = '';

            resultArray.forEach(([key, item]) => {
                const row = document.createElement('tr');
                const [counterpart, amount, incomeExpense] = key.split('-');
                row.innerHTML =
                    `<td>${item.records[0].type}</td>
                    <td>${incomeExpense}</td>
                    <td>${item.records[0].method}</td>
                    <td>${amount}</td>
                    <td>${counterpart}</td>
                    <td>${item.count}</td>
                    <td><button class="details-btn" data-details='${JSON.stringify(item.records)}'>详情</button></td>`;
                tbody.appendChild(row);
            });

            const detailsButtons = document.querySelectorAll('.details-btn');
            detailsButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const details = JSON.parse(button.getAttribute('data-details'));
                    showDetails(details);
                });
            });
        };
        reader.readAsArrayBuffer(file);
    }
});

// 在新标签页中显示所有交易详情
function showDetails(details) {
    const detailWindow = window.open('about:blank', '_blank'); // 打开新标签页
    detailWindow.document.write(`
    <html>
    <head>
        <title>发生详情</title>
        <style>
            body {
                font-family: 'Helvetica Neue', Arial, sans-serif;
                background-color: #f9f9f9;
                color: #333;
                text-align: center;
                padding: 20px;
            }
            table {
                margin: 20px auto; /* 表格居中 */
                border-collapse: collapse; /* 合并边框 */
                width: 80%; /* 调整宽度 */
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* 添加阴影 */
            }
            th, td {
                border: 1px solid #bbb; /* 添加边框 */
                padding: 12px;
                text-align: left;
            }
            th {
                background-color: #e1e1e1; /* 表头背景色 */
                color: #333;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9; /* 偶数行背景色 */
            }
            tr:hover {
                background-color: #f1f1f1; /* 鼠标悬停行背景色 */
            }
        </style>
    </head>
    <body>
        <h1>发生详情</h1>
        <table>
            <thead>
                <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>收/支</th>
                    <th>交易方式</th>
                    <th>金额</th>
                    <th>交易对方</th>
                </tr>
            </thead>
            <tbody>
    `);
    details.forEach(record => {
        detailWindow.document.write(`<tr>
            <td>${record.time}</td>
            <td>${record.type}</td>
            <td>${record.incomeExpense}</td>
            <td>${record.method}</td>
            <td>${record.amount}</td>
            <td>${record.counterpart}</td>
        </tr>`);
    });
    detailWindow.document.write(`
            </tbody>
        </table>
    </body>
    </html>`);
    detailWindow.document.close();
}

// 添加转换按钮的事件
document.getElementById('convert-btn').addEventListener('click', function() {
    window.open('https://www.ilovepdf.com/zh-cn/pdf_to_excel', '_blank');
});
