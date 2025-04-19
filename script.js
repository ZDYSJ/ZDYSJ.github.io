// script.js

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

// ========== 登录验证 ==========
async function verifyPassword() {
  const userEl = document.getElementById('username-input');
  const pwdEl  = document.getElementById('password-input');
  const user = userEl.value.trim(), pwd = pwdEl.value.trim();
  if (!user || !pwd) return;
  try {
    const snap = await database.ref(`users/${user}`).once('value');
    const data = snap.val();
    if (!data) throw new Error('NO_USER');
    if (sha256(pwd) !== data.passwordHash) throw new Error('WRONG_PWD');
    if (data.remainingQuota <=0) throw new Error('NO_QUOTA');
    // 成功动画
    const btn = document.getElementById('verify-btn');
    btn.classList.add('success');
    window.currentUser = {username:user,quota:data.remainingQuota,info:null};
    document.getElementById('vip-username').textContent = user;
    setTimeout(()=>{
      document.getElementById('password-layer').classList.add('slide-up');
      setTimeout(()=>{
        document.getElementById('password-layer').remove();
        document.getElementById('main-content').style.display='block';
        listenQuotaUpdates(); updateQuotaDisplay();
      },600);
    },800);
  } catch(err) {
    if(err.message==='NO_USER'){
      userEl.classList.add('input-error-shake');
      setTimeout(()=>userEl.classList.remove('input-error-shake'),300);
    } else if(err.message==='WRONG_PWD'){
      pwdEl.value = '';
      pwdEl.classList.add('input-error-shake');
      setTimeout(()=>pwdEl.classList.remove('input-error-shake'),300);
    } else if(err.message==='NO_QUOTA'){
      alert('请联系管理员购买次数');
    }
  }
}
document.getElementById('verify-btn').addEventListener('click', verifyPassword);
['username-input','password-input'].forEach(id=>{
  document.getElementById(id).addEventListener('keydown',e=>{
    if(e.key==='Enter') verifyPassword();
  });
});

// ========== 更新剩余 ==========
function listenQuotaUpdates() {
  database.ref(`users/${window.currentUser.username}`)
    .on('value',s=>{
      window.currentUser.quota = s.val().remainingQuota;
      updateQuotaDisplay();
    });
}
function updateQuotaDisplay(){
  document.getElementById('quota-display').textContent =
    `剩余：${window.currentUser.quota}`;
}

// ========== 用户信息 & 统计 ==========
function extractUserInfo(text){
  const nameM=text.match(/：([^()]+)\(/),
        idM=text.match(/居民身份证：(\d{15,18})/),
        wechatM=text.match(/微信号：([A-Za-z0-9_]+)/);
  return {name:nameM?nameM[1]:'',id:idM?idM[1]:'',wechat:wechatM?wechatM[1]:''};
}
function updateUserInfoDisplay(){
  if(!window.currentUser.info) return;
  document.getElementById('info-name').textContent =
    '姓名：'+window.currentUser.info.name;
  document.getElementById('info-wechat').textContent =
    '微信号：'+window.currentUser.info.wechat;
  document.getElementById('info-id').textContent =
    '身份证号：'+window.currentUser.info.id;
}
let statsChart=null;
function updateStats(arr){
  let income=0,expense=0,other=0,maxI=0,maxE=0;
  for(let i=5;i<arr.length;i++){
    const tp=(arr[i][3]||''),amt=parseFloat(arr[i][5])||0;
    if(tp.includes('收入')){income+=amt;maxI=Math.max(maxI,amt);}
    else if(tp.includes('支出')){expense+=amt;maxE=Math.max(maxE,amt);}
    else other+=amt;
  }
  document.getElementById('stat-income').textContent  = income.toFixed(2);
  document.getElementById('stat-expense').textContent = expense.toFixed(2);
  document.getElementById('stat-other').textContent   = other.toFixed(2);
  document.getElementById('max-income').textContent  = maxI.toFixed(2);
  document.getElementById('max-expense').textContent = maxE.toFixed(2);
  const ctx = document.getElementById('stats-chart').getContext('2d');
  if(statsChart) statsChart.destroy();
  statsChart=new Chart(ctx,{
    type:'pie',
    data:{
      labels:['收入','支出','其他'],
      datasets:[{data:[income,expense,other],
      backgroundColor:['#4caf50','#ff9800','#2196f3'] }]
    },
    options:{plugins:{legend:{display:false}},responsive:false}
  });
}

// ========== 文件上传 & 解析 ==========
let lastTxns=null;
function handleFileUpload(e){
  const file=e.target.files[0]; if(!file) return;
  const bar=document.getElementById('progress-bar');
  document.getElementById('progress-container').style.display='block';
  const reader=new FileReader();
  reader.onprogress=ev=>{
    if(ev.lengthComputable){
      const pct=Math.min(ev.loaded/ev.total*90,90);
      bar.style.width=pct+'%';
    }
  };
  reader.onload=ev=>{
    bar.style.transition='width .6s ease'; bar.style.width='100%';
    setTimeout(()=>{
      processExcelData(ev.target.result);
      document.getElementById('table-container').style.display='block';
      document.getElementById('progress-container').style.display='none';
      database.ref(`users/${window.currentUser.username}`)
        .update({remainingQuota:window.currentUser.quota-1});
    },300);
  };
  reader.onerror=()=>alert('文件读取失败');
  reader.readAsArrayBuffer(file);
}
function processExcelData(data){
  const wb=XLSX.read(new Uint8Array(data),{type:'array'});
  const arr=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
  document.getElementById('file-date').textContent=
    (arr[2]&&arr[2][1])?arr[2][1]:'';
  window.currentUser.info=extractUserInfo((arr[1]&&arr[1][0])?arr[1][0]:'');
  updateUserInfoDisplay(); updateStats(arr);
  const txns={};
  for(let i=4;i<arr.length;i++){
    const r=arr[i]; if(!r[0]) continue;
    const key=`${r[6]}-${r[5]}-${r[3]}`;
    if(!txns[key]) txns[key]={records:[],count:0,ie:r[3]};
    txns[key].records.push({time:r[1],type:r[2],amount:r[5],method:r[4],ie:r[3]});
    txns[key].count++;
  }
  lastTxns=txns; renderTable(txns);
}
function renderTable(data){
  const tbody=document.getElementById('result-body');
  tbody.innerHTML=Object.entries(data).sort((a,b)=>b[1].count-a[1].count)
    .map(([k,it])=>{
      const [cp,amt,ie]=k.split('-');
      return `<tr>
        <td>${it.records[0].type}</td>
        <td>${ie}</td>
        <td>${it.records[0].method}</td>
        <td>¥${amt}</td>
        <td>${cp}</td>
        <td>${it.count}</td>
        <td><button class="details-btn" data-details='${JSON.stringify(it.records)}'>
          查看详情
        </button></td>
      </tr>`;
    }).join('');
  document.querySelectorAll('.details-btn').forEach(btn=>
    btn.addEventListener('click',showTransactionDetails)
  );
}
function showTransactionDetails(e){
  const d=JSON.parse(e.target.dataset.details),
        w=window.open('','_blank');
  w.document.write(`<html><head><style>
    body{font-family:Arial;padding:20px;}
    table{width:100%;border-collapse:collapse;}
    th,td{padding:12px;border:1px solid #ddd;}
    th{background:#f5f5f5;}
  </style></head><body>
    <h2>交易明细 (共${d.length}笔)</h2>
    <table><tr><th>时间</th><th>类型</th>
      <th>金额</th><th>方式</th></tr>
    ${d.map(r=>`<tr><td>${r.time}</td><td>${r.type}</td>
      <td>¥${r.amount}</td><td>${r.method}</td></tr>`).join('')}
    </table></body></html>`);
}

// ========== 更多分析 ========== 
document.getElementById('dropdown-btn')
  .addEventListener('click',()=>document
    .getElementById('analysis-dropdown').classList.toggle('open'));

// ========== 筛选 & 过滤 ========== 
const fc=document.getElementById('filter-container'),
      fb=document.getElementById('filter-button'),
      opts=document.querySelectorAll('.drawer-option'),
      ci=document.getElementById('drawer-custom-input'),
      cc=document.getElementById('drawer-custom-confirm');

fb.addEventListener('click',()=>fc.classList.toggle('open'));

opts.forEach(b=>{
  b.addEventListener('click',()=>{
    opts.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const a=b.dataset.action;
    if(a==='all')applyFilter({type:'all'});
    if(a==='income')applyFilter({type:'income'});
    if(a==='expense')applyFilter({type:'expense'});
    if(a==='amount')applyFilter({type:'amount',threshold:parseFloat(b.dataset.value)});
    fc.classList.add('closing');
    setTimeout(()=>fc.classList.remove('open','closing'),300);
  });
});
cc.addEventListener('click',()=>{
  const v=parseFloat(ci.value);
  if(!isNaN(v)){
    applyFilter({type:'amount',threshold:v});
    ci.value=''; opts.forEach(x=>x.classList.remove('active'));
    fc.classList.add('closing');
    setTimeout(()=>fc.classList.remove('open','closing'),300);
  }
});

function applyFilter({type,threshold}){
  if(!lastTxns) return;
  const f={};
  Object.entries(lastTxns).forEach(([k,it])=>{
    if(type==='all')f[k]=it;
    if(type==='income'&&it.ie==='收入')f[k]=it;
    if(type==='expense'&&it.ie==='支出')f[k]=it;
    if(type==='amount'&&parseFloat(it.records[0].amount)>=threshold)f[k]=it;
  });
  renderTable(f);
}

// ========== 初始化 ==========
function initializeApp(){
  document.getElementById('upload-btn')
    .addEventListener('click',()=>document.getElementById('file-input').click());
  document.getElementById('file-input')
    .addEventListener('change',handleFileUpload);
  document.getElementById('convert-btn')
    .addEventListener('click',()=>window.open('https://smallpdf.com/cn/pdf-to-excel','_blank'));
  document.getElementById('table-container').style.display='none';
  document.getElementById('progress-container').style.display='none';
}
document.addEventListener('DOMContentLoaded',initializeApp);
