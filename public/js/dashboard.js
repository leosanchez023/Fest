

const stats = [
{icon:"📋",label:"Pedidos",value:248,color:"#3b82f6"},
{icon:"🚚",label:"Entregas Pendentes",value:32,color:"#f59e0b"},
{icon:"🔄",label:"Retiradas",value:15,color:"#ef4444"},
{icon:"💰",label:"Faturamento",value:"R$ 87.450",color:"#10b981"}
]

const statsContainer = document.getElementById("stats")

stats.forEach(s=>{
statsContainer.innerHTML+=`
<div class="card stat">
<div class="stat-icon" style="background:${s.color}">${s.icon}</div>
<div>
<div class="stat-label">${s.label}</div>
<div class="stat-value">${s.value}</div>
</div>
</div>
`
})

/* CHART */

const revenue=[62300,71800,95200,68400,79100,87450]
const months=["Out","Nov","Dez","Jan","Fev","Mar"]

const max=Math.max(...revenue)
const chart=document.getElementById("chart")

revenue.forEach((v,i)=>{

const height=(v/max)*100

chart.innerHTML+=`
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
<div class="bar" style="height:${height}%">
<span>R$ ${v}</span>
</div>
<div class="label">${months[i]}</div>
</div>
`

})

/* DELIVERIES */

const deliveries=[
{nome:"Maria Silva",end:"Rua das Flores 120"},
{nome:"Pedro Almeida",end:"Av Brasil 450"},
{nome:"Fernanda Lima",end:"Rua São Paulo 88"}
]

const del=document.getElementById("deliveries")

deliveries.forEach(d=>{
del.innerHTML+=`
<div class="delivery">
<div class="delivery-icon">🚚</div>
<div class="delivery-info">
<div class="name">${d.nome}</div>
<div class="addr">${d.end}</div>
</div>
</div>
`
})

/* TABLE */

const orders=[
["#1042","Maria","R$2350","Entregue"],
["#1041","João","R$1890","Pendente"],
["#1040","Ana","R$3200","Preparando"]
]

let html=`<thead>
<tr>
<th>Pedido</th>
<th>Cliente</th>
<th>Valor</th>
<th>Status</th>
</tr>
</thead><tbody>`

orders.forEach(o=>{
html+=`
<tr>
<td>${o[0]}</td>
<td>${o[1]}</td>
<td>${o[2]}</td>
<td><span class="badge" style="background:#3b82f6">${o[3]}</span></td>
</tr>`
})

html+="</tbody>"
document.getElementById("orders").innerHTML=html

/* ACTIVITY */

const acts=[
["#10b981","Pedido entregue"],
["#3b82f6","Pagamento recebido"],
["#f59e0b","Nova entrega criada"]
]

const act=document.getElementById("activity")

acts.forEach(a=>{
act.innerHTML+=`
<div class="activity">
<div class="activity-dot" style="background:${a[0]}"></div>
<div>${a[1]}</div>
</div>
`
})

