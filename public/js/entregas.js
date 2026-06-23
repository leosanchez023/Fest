const TODAY = "2026-06-16";
const ORDERS = [
  {id:"PED-1042", customer:"Mariana Costa", phone:"(11) 98876-5432", cpf:"324.567.890-12", address:"Rua das Flores, 142 - Vila Mariana, SP",
   partyDate:"2026-06-20", partyTime:"18:00", eventLocation:"Salão Cristal - Av. Paulista, 1500",
   notes:"Tema floral. Entregar antes das 14h.",
   deliveryDate:"2026-06-16", deliveryTime:"09:00", deliveryEmployee:"Carlos Mendes", vehicle:"Fiorino - ABC-1234",
   pickupDate:"2026-06-21", pickupTime:"10:00", pickupEmployee:"André Lima",
   total:4850, paid:2425, lastPaymentDate:"2026-06-01", paymentMethod:"PIX",
   paymentStatus:"Parcialmente Pago", deliveryStatus:"Aguardando Entrega", pickupStatus:"Aguardando Retirada", generalStatus:"Agendado",
   responsible:"Carlos Mendes",
   paymentHistory:[{date:"2026-05-10", amount:1000, method:"PIX"},{date:"2026-06-01", amount:1425, method:"PIX"}],
   returnItems:[{product:"Mesa redonda 8 lugares", sent:10, returned:0, missing:0, damaged:0},
                {product:"Cadeira Tiffany", sent:80, returned:0, missing:0, damaged:0},
                {product:"Toalha de mesa branca", sent:10, returned:0, missing:0, damaged:0}],
   occurrences:[]},
  {id:"PED-1041", customer:"Rafael Almeida", phone:"(11) 99654-3210", cpf:"412.789.654-33", address:"Av. Brasil, 980 - Jardins, SP",
   partyDate:"2026-06-15", partyTime:"20:00", eventLocation:"Residência - Av. Brasil, 980", notes:"Aniversário 30 anos.",
   deliveryDate:"2026-06-15", deliveryTime:"14:00", deliveryDoneAt:"2026-06-15 14:20", deliveryEmployee:"André Lima", vehicle:"HR - DEF-5678",
   pickupDate:"2026-06-16", pickupTime:"11:00", pickupEmployee:"André Lima",
   total:3200, paid:3200, lastPaymentDate:"2026-06-14", paymentMethod:"Cartão de Crédito",
   paymentStatus:"Pago Integralmente", deliveryStatus:"Entregue", pickupStatus:"Aguardando Retirada", generalStatus:"Em Andamento",
   responsible:"André Lima",
   paymentHistory:[{date:"2026-06-14", amount:3200, method:"Cartão de Crédito"}],
   returnItems:[{product:"Sofá modular branco", sent:2, returned:0, missing:0, damaged:0},
                {product:"Puff colorido", sent:12, returned:0, missing:0, damaged:0}],
   occurrences:[]},
  {id:"PED-1040", customer:"Juliana Pereira", phone:"(11) 97712-8899", cpf:"509.123.456-77", address:"Rua Augusta, 2200 - Consolação, SP",
   partyDate:"2026-06-10", partyTime:"16:00", eventLocation:"Buffet Aurora", notes:"Casamento. Cuidado redobrado na entrega.",
   deliveryDate:"2026-06-10", deliveryTime:"08:00", deliveryDoneAt:"2026-06-10 08:15", deliveryEmployee:"Carlos Mendes", vehicle:"HR - DEF-5678",
   pickupDate:"2026-06-11", pickupTime:"09:00", pickupDoneAt:"2026-06-11 09:30", pickupEmployee:"Carlos Mendes", pickupNotes:"2 taças quebradas.",
   total:12400, paid:12400, lastPaymentDate:"2026-06-09", paymentMethod:"Transferência",
   paymentStatus:"Pago Integralmente", deliveryStatus:"Entregue", pickupStatus:"Retirado", generalStatus:"Finalizado",
   responsible:"Carlos Mendes",
   paymentHistory:[{date:"2026-05-20", amount:6000, method:"PIX"},{date:"2026-06-09", amount:6400, method:"Transferência"}],
   returnItems:[{product:"Taça de cristal", sent:200, returned:198, missing:0, damaged:2, note:"2 quebradas no transporte"},
                {product:"Prato de porcelana", sent:150, returned:150, missing:0, damaged:0},
                {product:"Talher inox", sent:450, returned:450, missing:0, damaged:0}],
   occurrences:[{date:"2026-06-11", type:"Quebrado", description:"2 taças de cristal quebradas", value:80}]},
  {id:"PED-1039", customer:"Felipe Souza", phone:"(11) 95543-2211", cpf:"678.901.234-55", address:"Rua Voluntários, 55 - Botafogo, SP",
   partyDate:"2026-06-08", partyTime:"19:00", eventLocation:"Espaço Verde", notes:"Festa infantil.",
   deliveryDate:"2026-06-08", deliveryTime:"10:00", deliveryDoneAt:"2026-06-08 10:45", deliveryEmployee:"André Lima", vehicle:"Fiorino - ABC-1234",
   pickupDate:"2026-06-09", pickupTime:"10:00", pickupEmployee:"André Lima",
   total:2100, paid:800, lastPaymentDate:"2026-06-05", paymentMethod:"PIX",
   paymentStatus:"Parcialmente Pago", deliveryStatus:"Entregue", pickupStatus:"Retirada Atrasada", generalStatus:"Pendente",
   responsible:"André Lima",
   paymentHistory:[{date:"2026-06-05", amount:800, method:"PIX"}],
   returnItems:[{product:"Pula-pula", sent:1, returned:0, missing:1, damaged:0, note:"Cliente solicitou prorrogação"},
                {product:"Mesa kids", sent:4, returned:0, missing:4, damaged:0}],
   occurrences:[{date:"2026-06-10", type:"Atraso", description:"Atraso na devolução - cliente reagendou retirada"}]},
  {id:"PED-1038", customer:"Beatriz Ramos", phone:"(11) 94321-1009", cpf:"789.456.123-00", address:"Rua das Acácias, 80 - Moema, SP",
   partyDate:"2026-06-16", partyTime:"21:00", eventLocation:"Cobertura Edifício Sol", notes:"Coquetel corporativo.",
   deliveryDate:"2026-06-16", deliveryTime:"15:00", deliveryEmployee:"Carlos Mendes", vehicle:"HR - DEF-5678",
   pickupDate:"2026-06-17", pickupTime:"09:00", pickupEmployee:"Carlos Mendes",
   total:6800, paid:0, paymentMethod:"Boleto",
   paymentStatus:"Não Pago", deliveryStatus:"Em Rota", pickupStatus:"Aguardando Retirada", generalStatus:"Em Andamento",
   responsible:"Carlos Mendes",
   paymentHistory:[],
   returnItems:[{product:"Mesa bistrô", sent:15, returned:0, missing:0, damaged:0},
                {product:"Banqueta alta", sent:30, returned:0, missing:0, damaged:0}],
   occurrences:[]},
  {id:"PED-1037", customer:"Gustavo Henrique", phone:"(11) 93210-7788", cpf:"234.876.901-44", address:"Av. Faria Lima, 4200 - Itaim, SP",
   partyDate:"2026-06-12", partyTime:"22:00", eventLocation:"Casa de eventos Lumière", notes:"Confraternização empresa.",
   deliveryDate:"2026-06-12", deliveryTime:"12:00", deliveryEmployee:"André Lima", vehicle:"Fiorino - ABC-1234",
   pickupDate:"2026-06-13", pickupTime:"09:00", pickupEmployee:"André Lima",
   total:5400, paid:2700, lastPaymentDate:"2026-05-30", paymentMethod:"PIX",
   paymentStatus:"Parcialmente Pago", deliveryStatus:"Entrega Atrasada", pickupStatus:"Aguardando Retirada", generalStatus:"Pendente",
   responsible:"André Lima",
   paymentHistory:[{date:"2026-05-30", amount:2700, method:"PIX"}],
   returnItems:[{product:"Sonorização completa", sent:1, returned:0, missing:0, damaged:0},
                {product:"Iluminação LED", sent:8, returned:0, missing:0, damaged:0}],
   occurrences:[{date:"2026-06-12", type:"Atraso", description:"Trânsito intenso - 2h de atraso na entrega"}]}
];

const fmt = v => "R$ " + v.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate = d => { if(!d) return "-"; const [y,m,da]=d.split("-"); return `${da}/${m}/${y}`; };

function payBadge(s){ const m={"Pago Integralmente":"b-success","Parcialmente Pago":"b-warning","Não Pago":"b-danger"}; return `<span class="badge ${m[s]}">${s}</span>`; }
function delivBadge(s){ const m={"Aguardando Entrega":"b-muted","Em Rota":"b-info","Entregue":"b-success","Entrega Atrasada":"b-danger"}; return `<span class="badge ${m[s]}">${s}</span>`; }
function statusBadge(s){ const m={"Agendado":"b-info","Em Andamento":"b-purple","Finalizado":"b-success","Pendente":"b-warning","Cancelado":"b-danger"}; return `<span class="badge ${m[s]}">${s}</span>`; }

function renderKPIs(){
  const active = ORDERS.filter(o=>o.generalStatus!=="Finalizado"&&o.generalStatus!=="Cancelado").length;
  const deliv = ORDERS.filter(o=>o.deliveryDate===TODAY).length;
  const pick = ORDERS.filter(o=>o.pickupDate===TODAY).length;
  const paid = ORDERS.reduce((s,o)=>s+o.paid,0);
  const late = ORDERS.filter(o=>o.paymentStatus!=="Pago Integralmente" && o.partyDate < TODAY).length;
  const due = ORDERS.reduce((s,o)=>s+(o.total-o.paid),0);
  const done = ORDERS.filter(o=>o.generalStatus==="Finalizado").length;
  const ret = ORDERS.reduce((s,o)=>s+o.returnItems.reduce((a,i)=>a+(i.sent-i.returned),0),0);
  document.getElementById("kpi-active").textContent=active;
  document.getElementById("kpi-delivery").textContent=deliv;
  document.getElementById("kpi-pickup").textContent=pick;
  document.getElementById("kpi-paid").textContent=fmt(paid);
  document.getElementById("kpi-late").textContent=late;
  document.getElementById("kpi-due").textContent=fmt(due);
  document.getElementById("kpi-done").textContent=done;
  document.getElementById("kpi-return").textContent=ret;
}

function renderAlerts(){
  const a = [];
  const late = ORDERS.filter(o=>o.paymentStatus!=="Pago Integralmente" && o.partyDate < TODAY);
  if(late.length) a.push({c:"a-danger",i:"alert-circle",t:`${late.length} Pagamento(s) em atraso`,d:late.map(o=>o.customer).join(", ")});
  const dt = ORDERS.filter(o=>o.deliveryDate===TODAY);
  if(dt.length) a.push({c:"a-info",i:"truck",t:`${dt.length} Entrega(s) para hoje`,d:dt.map(o=>`${o.deliveryTime} - ${o.customer}`).join(" • ")});
  const pt = ORDERS.filter(o=>o.pickupDate===TODAY);
  if(pt.length) a.push({c:"a-warning",i:"package",t:`${pt.length} Retirada(s) para hoje`,d:pt.map(o=>`${o.pickupTime} - ${o.customer}`).join(" • ")});
  const miss = ORDERS.filter(o=>o.returnItems.some(i=>i.missing>0));
  if(miss.length) a.push({c:"a-danger",i:"x-circle",t:`${miss.length} Pedido(s) com itens faltando`,d:miss.map(o=>o.customer).join(", ")});
  const due = ORDERS.filter(o=>o.total-o.paid>0);
  if(due.length) a.push({c:"a-warning",i:"dollar-sign",t:`${due.length} Pedido(s) com saldo devedor`,d:fmt(due.reduce((s,o)=>s+(o.total-o.paid),0))+" a receber"});
  const dmg = ORDERS.filter(o=>o.returnItems.some(i=>i.damaged>0));
  if(dmg.length) a.push({c:"a-danger",i:"alert-triangle",t:`${dmg.length} Pedido(s) com itens danificados`,d:dmg.map(o=>o.customer).join(", ")});
  if(!a.length) a.push({c:"a-success",i:"check-circle",t:"Tudo em ordem!",d:"Nenhuma pendência crítica no momento."});
  document.getElementById("alerts").innerHTML = a.map(x=>`<div class="alert ${x.c}"><i class="lucide lucide-${x.i}"></i><div><div class="title">${x.t}</div><div class="desc">${x.d}</div></div></div>`).join("");
}

function getFiltered(){
  const s = document.getElementById("f-search").value.toLowerCase();
  const from = document.getElementById("f-from").value;
  const to = document.getElementById("f-to").value;
  const pay = document.getElementById("f-pay").value;
  const dv = document.getElementById("f-deliv").value;
  const st = document.getElementById("f-status").value;
  return ORDERS.filter(o => {
    if(s && !(o.customer.toLowerCase().includes(s)||o.id.toLowerCase().includes(s))) return false;
    if(from && o.partyDate < from) return false;
    if(to && o.partyDate > to) return false;
    if(pay && o.paymentStatus!==pay) return false;
    if(dv && o.deliveryStatus!==dv) return false;
    if(st && o.generalStatus!==st) return false;
    return true;
  });
}

function renderTable(){
  const list = getFiltered();
  document.getElementById("count-badge").textContent = list.length + " pedidos";
  document.getElementById("orders-tbody").innerHTML = list.map(o=>{
    const pct = Math.round((o.paid/o.total)*100);
    return `<tr>
      <td><strong>${o.id}</strong></td>
      <td><div style="font-weight:600;">${o.customer}</div><div class="muted" style="font-size:11px;">${o.phone}</div></td>
      <td>${fmtDate(o.partyDate)}<div class="muted" style="font-size:11px;">${o.partyTime}</div></td>
      <td>${fmtDate(o.deliveryDate)} ${o.deliveryTime}<br/>${delivBadge(o.deliveryStatus)}</td>
      <td>${fmtDate(o.pickupDate)} ${o.pickupTime}</td>
      <td><strong>${fmt(o.total)}</strong><div class="progress" style="margin-top:4px;"><div style="width:${pct}%"></div></div><div class="muted" style="font-size:11px;">${pct}% pago</div></td>
      <td>${payBadge(o.paymentStatus)}</td>
      <td>${statusBadge(o.generalStatus)}</td>
      <td><button class="btn" onclick="openModal('${o.id}')"><i class="lucide lucide-eye"></i> Ver</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--muted);">Nenhum pedido encontrado</td></tr>`;
}

function openModal(id){
  const o = ORDERS.find(x=>x.id===id); if(!o) return;
  document.getElementById("m-id").textContent = o.id;
  document.getElementById("m-customer").textContent = o.customer;

  // Timeline
  const steps = [
    {t:"Pedido Criado", d:"Cadastro do pedido", done:true},
    {t:"Pagamento Inicial", d:o.paymentHistory[0]?`${fmtDate(o.paymentHistory[0].date)} - ${fmt(o.paymentHistory[0].amount)}`:"Aguardando", done:o.paymentHistory.length>0},
    {t:"Entrega Realizada", d:o.deliveryDoneAt||"Aguardando entrega", done:!!o.deliveryDoneAt},
    {t:"Evento", d:`${fmtDate(o.partyDate)} ${o.partyTime}`, done:o.partyDate<TODAY},
    {t:"Retirada Realizada", d:o.pickupDoneAt||"Aguardando retirada", done:!!o.pickupDoneAt},
    {t:"Conferência dos Itens", d:o.returnItems.every(i=>i.returned+i.missing+i.damaged>=i.sent)?"Concluída":"Pendente", done:o.returnItems.every(i=>i.returned+i.missing+i.damaged>=i.sent)},
    {t:"Pedido Finalizado", d:o.generalStatus==="Finalizado"?"Finalizado":"Em aberto", done:o.generalStatus==="Finalizado"}
  ];
  let activeFound=false;
  document.getElementById("m-timeline").innerHTML = steps.map((s,i)=>{
    let cls = s.done?"done":""; if(!s.done && !activeFound){cls="active"; activeFound=true;}
    return `<div class="tl-step ${cls}"><div class="tl-dot">${s.done?'<i class="lucide lucide-check"></i>':i+1}</div><div class="tl-content"><h5>${s.t}</h5><p>${s.d}</p></div></div>`;
  }).join("");

  // Dados
  document.getElementById("m-dados").innerHTML = `
    <div><div class="field-row"><span class="l">Cliente</span><span class="v">${o.customer}</span></div>
    <div class="field-row"><span class="l">Telefone</span><span class="v">${o.phone}</span></div>
    <div class="field-row"><span class="l">CPF/CNPJ</span><span class="v">${o.cpf}</span></div>
    <div class="field-row"><span class="l">Endereço</span><span class="v">${o.address}</span></div></div>
    <div><div class="field-row"><span class="l">Data do Evento</span><span class="v">${fmtDate(o.partyDate)} às ${o.partyTime}</span></div>
    <div class="field-row"><span class="l">Local</span><span class="v">${o.eventLocation}</span></div>
    <div class="field-row"><span class="l">Responsável</span><span class="v">${o.responsible}</span></div>
    <div class="field-row"><span class="l">Observações</span><span class="v">${o.notes||"-"}</span></div></div>`;

  // Financeiro
  const due = o.total - o.paid;
  document.getElementById("m-fin").innerHTML = `
    <div class="grid grid-3" style="margin-bottom:18px;">
      <div class="kpi g-primary"><h4>Total</h4><div class="val">${fmt(o.total)}</div></div>
      <div class="kpi g-success"><h4>Pago</h4><div class="val">${fmt(o.paid)}</div></div>
      <div class="kpi ${due>0?'g-danger':'g-slate'}"><h4>Saldo</h4><div class="val">${fmt(due)}</div></div>
    </div>
    <h3>Histórico de Pagamentos</h3>
    <table><thead><tr><th>Data</th><th>Método</th><th>Valor</th></tr></thead><tbody>
      ${o.paymentHistory.map(p=>`<tr><td>${fmtDate(p.date)}</td><td>${p.method}</td><td><strong>${fmt(p.amount)}</strong></td></tr>`).join("")||'<tr><td colspan="3" style="text-align:center;color:var(--muted);">Sem pagamentos registrados</td></tr>'}
    </tbody></table>
    <div style="margin-top:16px;"><button class="btn-primary btn"><i class="lucide lucide-plus"></i> Registrar Pagamento</button></div>`;

  // Logística
  document.getElementById("m-log").innerHTML = `
    <div class="card" style="padding:16px;"><h3>🚚 Entrega</h3>
      <div class="field-row"><span class="l">Status</span><span class="v">${delivBadge(o.deliveryStatus)}</span></div>
      <div class="field-row"><span class="l">Data/Hora</span><span class="v">${fmtDate(o.deliveryDate)} às ${o.deliveryTime}</span></div>
      <div class="field-row"><span class="l">Funcionário</span><span class="v">${o.deliveryEmployee}</span></div>
      <div class="field-row"><span class="l">Veículo</span><span class="v">${o.vehicle}</span></div>
      <div class="field-row"><span class="l">Realizada em</span><span class="v">${o.deliveryDoneAt||"-"}</span></div>
      <button class="btn-primary btn" style="margin-top:10px;"><i class="lucide lucide-check"></i> Marcar como Entregue</button>
    </div>
    <div class="card" style="padding:16px;"><h3>📦 Retirada</h3>
      <div class="field-row"><span class="l">Status</span><span class="v"><span class="badge b-muted">${o.pickupStatus}</span></span></div>
      <div class="field-row"><span class="l">Data/Hora</span><span class="v">${fmtDate(o.pickupDate)} às ${o.pickupTime}</span></div>
      <div class="field-row"><span class="l">Funcionário</span><span class="v">${o.pickupEmployee}</span></div>
      <div class="field-row"><span class="l">Realizada em</span><span class="v">${o.pickupDoneAt||"-"}</span></div>
      <div class="field-row"><span class="l">Notas</span><span class="v">${o.pickupNotes||"-"}</span></div>
      <button class="btn-primary btn" style="margin-top:10px;"><i class="lucide lucide-check"></i> Marcar como Retirado</button>
    </div>`;

  // Devolução
  document.getElementById("m-dev").innerHTML = `
    <h3>Conferência dos Itens</h3>
    <table><thead><tr><th>Produto</th><th>Enviado</th><th>Devolvido</th><th>Faltante</th><th>Danificado</th><th>Observação</th></tr></thead><tbody>
      ${o.returnItems.map(i=>`<tr>
        <td><strong>${i.product}</strong></td>
        <td>${i.sent}</td>
        <td><span class="badge b-success">${i.returned}</span></td>
        <td>${i.missing>0?`<span class="badge b-danger">${i.missing}</span>`:i.missing}</td>
        <td>${i.damaged>0?`<span class="badge b-warning">${i.damaged}</span>`:i.damaged}</td>
        <td class="muted">${i.note||"-"}</td>
      </tr>`).join("")}
    </tbody></table>
    <div style="margin-top:14px; display:flex; gap:8px;">
      <button class="btn-primary btn"><i class="lucide lucide-clipboard-check"></i> Finalizar Conferência</button>
      <button class="btn"><i class="lucide lucide-dollar-sign"></i> Gerar Cobrança Extra</button>
    </div>`;

  // Ocorrências
  document.getElementById("m-oco").innerHTML = `
    ${o.occurrences.length? o.occurrences.map(oc=>`
      <div class="alert a-warning" style="margin-bottom:10px;"><i class="lucide lucide-alert-circle"></i>
        <div><div class="title">${oc.type} — ${fmtDate(oc.date)}</div>
        <div class="desc">${oc.description}${oc.value?` <strong>(${fmt(oc.value)})</strong>`:""}</div></div></div>`).join("")
      : '<div class="alert a-success"><i class="lucide lucide-check-circle"></i><div><div class="title">Sem ocorrências</div><div class="desc">Nenhum problema registrado para este pedido.</div></div></div>'}
    <button class="btn-primary btn" style="margin-top:12px;"><i class="lucide lucide-plus"></i> Registrar Ocorrência</button>`;

  document.getElementById("modal").classList.add("open");
}

function closeModal(){ document.getElementById("modal").classList.remove("open"); }

document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.getElementById("tab-"+t.dataset.tab).classList.add("active");
}));

["f-search","f-from","f-to","f-pay","f-deliv","f-status"].forEach(id=>document.getElementById(id).addEventListener("input",renderTable));

document.getElementById("modal").addEventListener("click",e=>{ if(e.target.id==="modal") closeModal(); });

renderKPIs(); renderAlerts(); renderTable();