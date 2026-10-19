const reportTag = document.getElementById('report-data');
const payload = JSON.parse(reportTag.textContent || '{}');
if (!Array.isArray(payload.pedidos) || !Array.isArray(payload.clientes) || !Array.isArray(payload.produtos)) {
  throw new Error('A resposta de relatórios não contém as listas esperadas.');
}

const toDate = (value) => {
  if (value == null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('A API retornou uma data inválida no relatório.');
  return parsed;
};

const reportNumber = (value, field) => {
  const parsed = Number(value);
  if (value == null || !Number.isFinite(parsed)) {
    throw new TypeError(`A API retornou um valor inválido para "${field}".`);
  }
  return parsed;
};

const normalizarProdutos = (produtos) => produtos.map((produto) => ({
  id: reportNumber(produto.id, 'produto.id'),
  nome: produto.nome,
  categoria: produto.categoria,
  estoque: reportNumber(produto.estoque, 'produto.estoque'),
  alugados: reportNumber(produto.alugados, 'produto.alugados'),
  reservados: reportNumber(produto.reservados, 'produto.reservados'),
  manutencao: reportNumber(produto.manutencao, 'produto.manutencao'),
  danificados: reportNumber(produto.danificados, 'produto.danificados'),
  estoqueMinimo: reportNumber(produto.estoqueMinimo, 'produto.estoqueMinimo'),
  disp: reportNumber(produto.disp, 'produto.disp'),
  preco: reportNumber(produto.preco, 'produto.preco'),
  valorEstoque: reportNumber(produto.valorEstoque, 'produto.valorEstoque'),
  situacao: produto.situacao
}));
let PRODUTOS = normalizarProdutos(payload.produtos);
let CATEGORIAS_PRODUTOS = Array.isArray(payload.categorias)
  ? payload.categorias
  : [...new Set(PRODUTOS.map((produto) => produto.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const normalizarPedidos = (pedidos) => pedidos.map((pedido) => ({
  num: reportNumber(pedido.num, 'pedido.num'),
  clienteId: reportNumber(pedido.clienteId, 'pedido.clienteId'),
  date: toDate(pedido.date),
  dataEvento: toDate(pedido.dataEvento),
  dataEntrega: toDate(pedido.dataEntrega),
  dataPrevista: toDate(pedido.dataPrevista),
  dataEfetiva: toDate(pedido.dataEfetiva),
  dataRetirada: toDate(pedido.dataRetirada),
  dataOperacao: toDate(pedido.dataOperacao),
  cliente: pedido.cliente,
  telefone: pedido.telefone,
  email: pedido.email,
  cliTipo: pedido.cliTipo,
  itens: pedido.itens,
  quantidadeItens: reportNumber(pedido.quantidadeItens, 'pedido.quantidadeItens'),
  entregador: pedido.entregador,
  tipo: pedido.tipo,
  status: pedido.status,
  valor: reportNumber(pedido.valor, 'pedido.valor'),
  recebido: reportNumber(pedido.recebido, 'pedido.recebido'),
  reembolsado: reportNumber(pedido.reembolsado, 'pedido.reembolsado'),
  cobrancasAdicionais: reportNumber(pedido.cobrancasAdicionais, 'pedido.cobrancasAdicionais'),
  reembolsado: reportNumber(pedido.reembolsado, 'pedido.reembolsado'),
  cobrancasAdicionais: reportNumber(pedido.cobrancasAdicionais, 'pedido.cobrancasAdicionais'),
  saldo: reportNumber(pedido.saldo, 'pedido.saldo'),
  forma: pedido.forma,
  fin: pedido.fin,
  entTipo: pedido.entTipo,
  bairro: pedido.bairro,
  ent: pedido.ent,
  atraso: pedido.dataPrevista && !['Concluída','Cancelada'].includes(pedido.ent) && toDate(pedido.dataPrevista) < HOJE
    ? 'Atrasada'
    : 'No atraso'
})).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
let ORDERS = normalizarPedidos(payload.pedidos);

/* ============ Utilitários ============ */
const $ = s => document.querySelector(s);
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const brlShort = v => v>=1000 ? 'R$ '+(v/1000).toFixed(1).replace('.',',')+' mil' : brl(v);
const fdate = d => d ? d.toLocaleDateString('pt-BR') : '—';
const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseIso = s => new Date(s+'T00:00:00');
const sum = (a,f) => a.reduce((t,x)=>t+f(x),0);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const COLORS = ['#6d4aff','#ff5c8a','#2f7cf6','#1fa971','#e8a317','#8a6bff','#14b8c6','#e5484d'];
const BADGE = {'Concluído':'ok','Pago':'ok','Concluída':'ok','Entregue':'ok','Em andamento':'info','Agendada':'info','Em rota':'info','Parcial':'info',
  'Orçamento':'warn','Pendente':'warn','Aguardando':'warn','Cancelado':'bad','Cancelada':'bad','Atrasado':'bad'};
const badge = t => `<span class="badge b-${BADGE[t]||'def'}">${escapeHtml(t)}</span>`;
const valid = o => o.status==='Concluído'||o.status==='Em andamento';
const groupCount = (rows,f)=>{const m=new Map();rows.forEach(r=>{const k=f(r);m.set(k,(m.get(k)||0)+1)});return [...m].map(([label,value])=>({label,value}))};
const groupSum = (rows,f,v)=>{const m=new Map();rows.forEach(r=>{const k=f(r);m.set(k,(m.get(k)||0)+v(r))});return [...m].map(([label,value])=>({label,value}))};

/* ============ Definição de cada relatório ============ */
function timeSeries(rows, valueFn, from, to){
  const days = Math.round((to-from)/864e5)+1;
  const byDay = days<=45;
  const m = new Map();
  if (byDay){ for(let i=0;i<days;i++){const d=addDays(from,i);m.set(iso(d),{label:String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'),value:0});} }
  else { const c=new Date(from.getFullYear(),from.getMonth(),1);
    while(c<=to){const k=c.getFullYear()+'-'+(c.getMonth()+1);m.set(k,{label:c.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')+'/'+String(c.getFullYear()).slice(2),value:0});c.setMonth(c.getMonth()+1);} }
  rows.forEach(r=>{if(!r.date)return;const k=byDay?iso(r.date):r.date.getFullYear()+'-'+(r.date.getMonth()+1);const e=m.get(k);if(e)e.value+=valueFn(r)});
  return [...m.values()];
}

const REPORTS = {
  pedidos:{
    label:'Pedidos', title:'Pedidos do período', dated:true,
    statusKey:'status', statuses:['Concluído','Em andamento','Orçamento','Cancelado'], statusLabel:'Status',
    source:()=>ORDERS,
    cols:[{k:'num',l:'Nº'},{k:'date',l:'Data',f:fdate},{k:'cliente',l:'Cliente'},{k:'itens',l:'Itens e quantidades'},{k:'quantidadeItens',l:'Qtd.',r:1},{k:'tipo',l:'Tipo'},{k:'status',l:'Status',b:1},{k:'valor',l:'Valor',f:brl,r:1},{k:'recebido',l:'Recebido',f:brl,r:1},{k:'saldo',l:'Saldo',f:brl,r:1}],
    extraFilter:{key:'tipo',label:'Tipo de pedido',options:['Locação','Venda','Misto']},
    kpis:(rows,prev)=>{
      const v=rows.filter(valid), pv=prev.filter(valid);
      const fat=sum(v,o=>o.valor), pfat=sum(pv,o=>o.valor);
      const canc=rows.filter(o=>o.status==='Cancelado').length;
      return [
        {l:'Faturamento',v:brl(fat),d:delta(fat,pfat),c:'#6d4aff'},
        {l:'Pedidos',v:rows.length,d:delta(rows.length,prev.length),c:'#2f7cf6'},
        {l:'Ticket médio',v:brl(v.length?fat/v.length:0),d:delta(v.length?fat/v.length:0,pv.length?pfat/pv.length:0),c:'#1fa971'},
        {l:'Cancelamentos',v:canc,d:rows.length?(canc/rows.length*100).toFixed(1).replace('.',',')+'% dos pedidos':'—',c:'#e5484d'}];
    },
    charts:(rows,from,to)=>[
      {type:'bars',title:'Faturamento ao longo do período',data:timeSeries(rows.filter(valid),o=>o.valor,from,to),fmt:brlShort},
      {type:'donut',title:'Pedidos por status',data:groupCount(rows,o=>o.status)}]
  },
  financeiro:{
    label:'Financeiro', title:'Movimentação financeira', dated:true,
    statusKey:'fin', statuses:['Pago','Parcial','Pendente','Atrasado','Cancelado'], statusLabel:'Situação',
    source:()=>ORDERS.filter(o=>o.status!=='Orçamento'),
    cols:[{k:'num',l:'Pedido'},{k:'date',l:'Data',f:fdate},{k:'cliente',l:'Cliente'},{k:'forma',l:'Forma pgto.'},{k:'fin',l:'Situação',b:1},{k:'valor',l:'Total',f:brl,r:1},{k:'recebido',l:'Recebido',f:brl,r:1},{k:'reembolsado',l:'Restituído',f:brl,r:1},{k:'cobrancasAdicionais',l:'Cobranças adicionais',f:brl,r:1},{k:'saldo',l:'A receber',f:brl,r:1}],
    extraFilter:{key:'forma',label:'Forma de pagamento',options:['Dinheiro','Pix','Cartão de débito','Cartão de crédito','Transferência','Não informado']},
    kpis:(rows,prev)=>{
      const recebido=sum(rows,o=>o.recebido), recebidoAnterior=sum(prev,o=>o.recebido);
      const restituido=sum(rows,o=>o.reembolsado);
      const cobrancasAdicionais=sum(rows,o=>o.cobrancasAdicionais);
      const abertas=rows.filter(o=>o.fin!=='Cancelado'&&o.saldo>0);
      const pendente=sum(abertas,o=>o.saldo);
      const atrasadas=abertas.filter(o=>o.fin==='Atrasado');
      const valorAtrasado=sum(atrasadas,o=>o.saldo);
      return [
        {l:'Pedidos no período',v:rows.length,d:delta(rows.length,prev.length),c:'#6d4aff'},
        {l:'Total recebido',v:brl(recebido),d:delta(recebido,recebidoAnterior),c:'#1fa971'},
        {l:'Valores a receber',v:brl(pendente),d:abertas.length+' pedidos em aberto',c:'#e8a317'},
        {l:'Restituído',v:brl(restituido),d:'registrado separadamente dos recebimentos',c:'#2f7cf6'},
        {l:'Cobranças adicionais',v:brl(cobrancasAdicionais),d:'valores de ocorrências não canceladas',c:'#8a6bff'},
        {l:'Pagamentos em atraso',v:brl(valorAtrasado),d:atrasadas.length+' pedidos vencidos',c:'#e5484d'},
        {l:'Inadimplência',v:(pendente?valorAtrasado/pendente*100:0).toFixed(1).replace('.',',')+'%',d:`${atrasadas.length} vencidos de ${abertas.filter(o=>o.saldo>0).length} em aberto`,c:'#6d4aff'}];
    },
    charts:(rows,from,to)=>[
      {type:'bars',title:'Recebimentos associados a pedidos do período',data:timeSeries(rows.filter(o=>o.recebido>0),o=>o.recebido,from,to),fmt:brlShort},
      {type:'donut',title:'Valor por forma de pagamento',data:groupSum(rows.filter(o=>o.recebido>0),o=>o.forma,o=>o.recebido),fmt:brlShort}]
  },
  entregas:{
    label:'Entregas', title:'Entregas e retiradas', dated:true, dateKey:'dataOperacao',
    statusKey:'ent', statuses:['Concluída','Agendada','Em rota','Aguardando','Cancelada'], statusLabel:'Situação',
    source:()=>ORDERS.filter(o=>o.status!=='Orçamento'),
    extraFilter:{key:'entTipo',label:'Operação',options:['Entrega','Retirada']},
    cols:[{k:'num',l:'Pedido'},{k:'dataPrevista',l:'Data prevista',f:fdate},{k:'dataEfetiva',l:'Data efetiva',f:fdate},{k:'cliente',l:'Cliente'},{k:'entregador',l:'Entregador'},{k:'bairro',l:'Bairro'},{k:'entTipo',l:'Operação'},{k:'ent',l:'Situação',b:1},{k:'atraso',l:'Prazo',b:1}],
    kpis:(rows,prev)=>{
      const ok=rows.filter(o=>o.ent==='Concluída'), ag=rows.filter(o=>o.ent==='Agendada'||o.ent==='Em rota');
      return [
        {l:'Total de operações',v:rows.length,d:delta(rows.length,prev.length),c:'#6d4aff'},
        {l:'Concluídas',v:ok.length,d:(rows.length?ok.length/rows.length*100:0).toFixed(0)+'% do total',c:'#1fa971'},
        {l:'Em andamento',v:ag.length,d:'agendadas ou em rota',c:'#2f7cf6'},
        {l:'Entregas / Retiradas',v:rows.filter(o=>o.entTipo==='Entrega').length+' / '+rows.filter(o=>o.entTipo==='Retirada').length,d:'no período',c:'#e8a317'}];
    },
    charts:(rows)=>[
      {type:'hbars',title:'Operações por bairro',data:groupCount(rows,o=>o.bairro).sort((a,b)=>b.value-a.value)},
      {type:'donut',title:'Situação das operações',data:groupCount(rows,o=>o.ent)}]
  },
  clientes:{
    label:'Clientes', title:'Ranking de clientes', dated:true,
    statusKey:null,
    extraFilter:{key:'tipo',label:'Tipo de cliente',options:['PF','Não informado']},
    source:(from,to)=>{
      const m=new Map();
      ORDERS.filter(o=>valid(o)&&o.date&&o.date>=from&&o.date<addDays(to,1)).forEach(o=>{
        const c=m.get(o.clienteId)||{clienteId:o.clienteId,cliente:o.cliente,telefone:o.telefone,email:o.email,tipo:o.cliTipo,pedidos:0,total:0,date:o.date};
        c.pedidos++;c.total+=o.valor;if(o.date>c.date)c.date=o.date;m.set(o.clienteId,c);});
      return [...m.values()].sort((a,b)=>b.total-a.total);
    },
    prebuilt:true,
    cols:[{k:'cliente',l:'Cliente'},{k:'telefone',l:'Telefone'},{k:'email',l:'E-mail'},{k:'tipo',l:'Tipo'},{k:'pedidos',l:'Pedidos',r:1},{k:'total',l:'Total gasto',f:brl,r:1},{k:'date',l:'Último pedido',f:fdate}],
    kpis:(rows)=>{
      const t=sum(rows,c=>c.total);
      return [
        {l:'Clientes ativos',v:rows.length,d:'com pedidos no período',c:'#6d4aff'},
        {l:'Receita total',v:brl(t),d:'de clientes ativos',c:'#1fa971'},
        {l:'Média por cliente',v:brl(rows.length?t/rows.length:0),d:'no período',c:'#2f7cf6'},
        {l:'Cliente destaque',v:rows[0]?rows[0].cliente:'—',d:rows[0]?brl(rows[0].total):'Sem clientes no período',c:'#ff5c8a'}];
    },
    charts:(rows)=>[
      {type:'hbars',title:'Top 8 clientes por valor',data:rows.slice(0,8).map(c=>({label:c.cliente,value:c.total})),fmt:brl},
      {type:'donut',title:'Tipo de cliente informado',data:groupCount(rows,c=>c.tipo==='PF'?'Pessoa física':'Não informado')}]
  },
  estoque:{
    label:'Estoque', title:'Posição de estoque', dated:false,
    statusKey:'situacao', statuses:['Disponível','Estoque baixo','Esgotado'], statusLabel:'Situação',
    source:()=>PRODUTOS,
    cols:[{k:'nome',l:'Produto'},{k:'categoria',l:'Categoria'},{k:'estoque',l:'Estoque físico',r:1},{k:'reservados',l:'Reservado',r:1},{k:'alugados',l:'Em uso',r:1},{k:'manutencao',l:'Manutenção',r:1},{k:'danificados',l:'Danificado',r:1},{k:'disp',l:'Disponível',r:1},{k:'estoqueMinimo',l:'Estoque mínimo',r:1},{k:'preco',l:'Locação (diária)',f:brl,r:1},{k:'situacao',l:'Indicador',b:1}],
    extraFilter:{key:'categoria',label:'Categoria',options:()=>CATEGORIAS_PRODUTOS},
    kpis:(rows)=>{
      const tot=sum(rows,p=>p.estoque), al=sum(rows,p=>p.alugados);
      return [
        {l:'Produtos cadastrados',v:rows.length,d:tot+' unidades no total',c:'#6d4aff'},
        {l:'Unidades alugadas',v:al,d:(tot?al/tot*100:0).toFixed(1).replace('.',',')+'% do estoque',c:'#2f7cf6'},
        {l:'Estoque baixo',v:rows.filter(p=>p.situacao==='Estoque baixo').length,d:'abaixo do mínimo cadastrado',c:'#e8a317'},
        {l:'Valor em estoque',v:brl(sum(rows,p=>p.valorEstoque)),d:'preço de venda × unidades',c:'#1fa971'}];
    },
    charts:(rows)=>[
      {type:'hbars',title:'Itens mais alugados agora',data:[...rows].sort((a,b)=>b.alugados-a.alugados).slice(0,8).map(p=>({label:p.nome,value:p.alugados}))},
      {type:'donut',title:'Unidades por categoria',data:groupSum(rows,p=>p.categoria,p=>p.estoque)}]
  }
};

function delta(cur, prev) {
  const current = Number(cur);
  const previous = Number(prev);

  if (cur == null || prev == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return 'Sem comparação com o período anterior';
  }

  if (previous === 0) {
    return 'Sem comparação com o período anterior';
  }

  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1).replace('.', ',')}% vs. período anterior`;
}

/* ============ Estado e renderização ============ */
const state={tab:'pedidos',from:addDays(HOJE,-89),to:HOJE,status:'',extra:'',q:'',sort:null,dir:1,page:1,size:10,chip:90,printing:false};
let currentRows=[], currentDef=null;
let reportRequestId=0;

async function refreshReportData(){
  const requestId=++reportRequestId;
  const loading=$('#reportLoading');
  const errorBox=$('#reportError');
  loading.hidden=false;
  errorBox.hidden=true;
  if(state.from>state.to){
    const start=state.from;
    state.from=state.to;
    state.to=start;
    syncInputs();
  }
  const def=REPORTS[state.tab];
  const params=new URLSearchParams({tab:state.tab});
  if(def.dated){
    const span=Math.round((state.to-state.from)/864e5)+1;
    params.set('from',iso(addDays(state.from,-span)));
    params.set('to',iso(state.to));
  }
  if(state.status) params.set('status',state.status);
  if(def.extraFilter){
    params.set('extraKey',def.extraFilter.key);
    if(state.extra) params.set('extra',state.extra);
  }
  if(state.q) params.set('q',state.q);

  try{
    const response=await fetch(`/relatorios/data?${params.toString()}`,{headers:{Accept:'application/json'}});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Não foi possível consultar os dados do relatório.');
    if(!Array.isArray(data.pedidos)||!Array.isArray(data.produtos)) throw new Error('A resposta do relatório está incompleta.');
    if(requestId!==reportRequestId) return;
    ORDERS=normalizarPedidos(data.pedidos);
    PRODUTOS=normalizarProdutos(data.produtos);
    if(Array.isArray(data.categorias)) CATEGORIAS_PRODUTOS=data.categorias;
    errorBox.hidden=true;
    render();
  }catch(error){
    if(requestId!==reportRequestId) return;
    errorBox.textContent=`Falha ao atualizar o relatório: ${error.message}`;
    errorBox.hidden=false;
    console.error('Falha ao atualizar dados do relatório:',error);
  }finally{
    if(requestId===reportRequestId) loading.hidden=true;
  }
}

function setRange(days){
  state.to=HOJE; state.from=days==='mes'?new Date(HOJE.getFullYear(),HOJE.getMonth(),1):addDays(HOJE,-(days-1));
  state.chip=days; syncInputs(); state.page=1; refreshReportData();
}
function syncInputs(){
  $('#from').value=iso(state.from); $('#to').value=iso(state.to);
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',String(c.dataset.d)===String(state.chip)));
}

function buildStatic(){
  $('#tabs').innerHTML=Object.entries(REPORTS).map(([k,r])=>`<button class="tab" data-k="${k}">${r.label}</button>`).join('');
  $('#chips').innerHTML=[[7,'7 dias'],[30,'30 dias'],['mes','Este mês'],[90,'90 dias'],[365,'12 meses']]
    .map(([d,l])=>`<button class="chip" data-d="${d}">${l}</button>`).join('');
  $('#tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;state.tab=b.dataset.k;state.status='';state.extra='';state.sort=null;state.page=1;refreshReportData();};
  $('#chips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;const d=b.dataset.d;setRange(d==='mes'?'mes':+d);};
  $('#from').onchange=e=>{const value=parseIso(e.target.value);if(!value||Number.isNaN(value.getTime()))return syncInputs();state.from=value;state.chip=null;state.page=1;syncInputs();refreshReportData();};
  $('#to').onchange=e=>{const value=parseIso(e.target.value);if(!value||Number.isNaN(value.getTime()))return syncInputs();state.to=value;state.chip=null;state.page=1;syncInputs();refreshReportData();};
  $('#status').onchange=e=>{state.status=e.target.value;state.page=1;refreshReportData();};
  $('#extraFilter').onchange=e=>{state.extra=e.target.value;state.page=1;refreshReportData();};
  let searchTimer;
  $('#q').oninput=e=>{
    state.q=e.target.value.trim().toLowerCase();
    state.page=1;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(refreshReportData,180);
  };
  $('#thead').onclick=e=>{const th=e.target.closest('th');if(!th)return;const k=th.dataset.k;
    if(state.sort===k)state.dir*=-1;else{state.sort=k;state.dir=1;} render();};
  $('#prev').onclick=()=>{state.page--;render();};
  $('#next').onclick=()=>{state.page++;render();};
  $('#btnCsv').onclick=exportCsv;
  $('#btnPrint').onclick=()=>window.print();
  window.addEventListener('beforeprint',()=>{state.printing=true;render();});
  window.addEventListener('afterprint',()=>{state.printing=false;render();});
  $('#menuBtn').onclick=()=>{
    const sidebar=document.getElementById('appSidebar');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('is-open');
    sidebar.setAttribute('aria-hidden', String(!isOpen));
  };
}

function rowsFor(def,from,to){
  let rows=def.source(from,to);
  if(def.dated&&!def.prebuilt) {
    const dateKey=def.dateKey||'date';
    rows=rows.filter(o=>o[dateKey]&&o[dateKey]>=from&&o[dateKey]<addDays(to,1));
  }
  return rows;
}

function render(){
  const def=REPORTS[state.tab]; currentDef=def;
  if(state.from>state.to){const t=state.from;state.from=state.to;state.to=t;syncInputs();}
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.k===state.tab));

  // Filtros
  const st=$('#status');
  if(def.statusKey){
    st.disabled=false; $('#statusLabel').textContent=def.statusLabel;
    st.innerHTML='<option value="">Todos</option>'+def.statuses.map(s=>`<option ${s===state.status?'selected':''}>${s}</option>`).join('');
  } else { st.disabled=true; st.innerHTML='<option>—</option>'; }
  const extraFilter=$('#extraFilter');
  if(def.extraFilter){
    const options=typeof def.extraFilter.options==='function'?def.extraFilter.options():def.extraFilter.options;
    extraFilter.disabled=false;
    extraFilter.innerHTML=`<option value="">Todos</option>${options.map(option=>`<option value="${escapeHtml(option)}" ${option===state.extra?'selected':''}>${escapeHtml(option)}</option>`).join('')}`;
    extraFilter.parentElement.hidden=false;
    extraFilter.previousElementSibling.textContent=def.extraFilter.label;
  }else{
    extraFilter.disabled=true;
    extraFilter.value='';
    extraFilter.parentElement.hidden=true;
    state.extra='';
  }
  const dateInputs=[$('#from'),$('#to')]; dateInputs.forEach(i=>i.disabled=!def.dated);
  document.querySelectorAll('.chip').forEach(c=>c.disabled=!def.dated);
  const note=$('#note'); note.style.display=def.dated?'none':'block';
  note.textContent='Este relatório mostra a posição atual do estoque e não depende do período selecionado.';

  // Dados
  const span=Math.round((state.to-state.from)/864e5)+1;
  const prevTo=addDays(state.from,-1), prevFrom=addDays(prevTo,-(span-1));
  const base=rowsFor(def,state.from,state.to);
  const previousBase=def.dated?rowsFor(def,prevFrom,prevTo):[];
  const applyFilters=items=>{
    let filtered=items;
    if(def.statusKey&&state.status) filtered=filtered.filter(r=>r[def.statusKey]===state.status);
    if(def.extraFilter&&state.extra) filtered=filtered.filter(r=>{
      const value=r[def.extraFilter.key];
      return def.extraFilter.key==='forma'
        ? String(value||'').split(',').map(part=>part.trim()).includes(state.extra)
        : value===state.extra;
    });
    if(state.q) filtered=filtered.filter(r=>
      def.cols.some(c=>String(c.f?c.f(r[c.k]):r[c.k]??'').toLowerCase().includes(state.q))
      ||String(r.num??r.clienteId??'').includes(state.q));
    return filtered;
  };
  const rows=applyFilters(base);
  const prevRows=applyFilters(previousBase);
  currentRows=rows;

  $('#subtitle').textContent=def.dated?`${def.label} · ${fdate(state.from)} a ${fdate(state.to)}`:`${def.label} · posição atual`;
  const period=def.dated?`${fdate(state.from)} a ${fdate(state.to)}`:'posição atual';
  const selectedFilters=[state.status,state.extra].filter(Boolean);
  $('#printHead').innerHTML=`<strong>Fest | Relatório de ${escapeHtml(def.label)}</strong><span>${escapeHtml(period)}${selectedFilters.length?` · ${escapeHtml(selectedFilters.join(' · '))}`:''}</span><span>Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</span>`;

  // KPIs
  $('#kpis').innerHTML=def.kpis(rows,prevRows).map(k=>`<div class="kpi" style="--c:${k.c}"><div class="l">${escapeHtml(k.l)}</div><div class="v">${escapeHtml(k.v)}</div><div class="d">${escapeHtml(k.d)}</div></div>`).join('');

  // Gráficos
  const ch=def.charts(rows,state.from,state.to);
  $('#charts').innerHTML=ch.map(c=>`<div class="card"><h3>${escapeHtml(c.title)}</h3>${chartHtml(c)}</div>`).join('');

  // Tabela
  const sorted=[...rows];
  if(state.sort){const k=state.sort;sorted.sort((a,b)=>{const x=a[k],y=b[k];return (x>y?1:x<y?-1:0)*state.dir;});}
  const pages=Math.max(1,Math.ceil(sorted.length/state.size)); state.page=Math.min(state.page,pages);
  const slice=state.printing?sorted:sorted.slice((state.page-1)*state.size,state.page*state.size);
  $('#tableTitle').textContent=def.title;
  $('#count').textContent=`${rows.length} registro${rows.length===1?'':'s'}`;
  $('#thead').innerHTML='<tr>'+def.cols.map(c=>`<th data-k="${c.k}" class="${c.r?'r':''}">${c.l}<span class="ar">${state.sort===c.k?(state.dir>0?'▲':'▼'):'↕'}</span></th>`).join('')+'</tr>';
  $('#tbody').innerHTML=slice.length?slice.map(r=>'<tr>'+def.cols.map(c=>{
    const raw=r[c.k], txt=c.f?c.f(raw):raw;
    return `<td class="${c.r?'r':''}">${c.b?badge(txt):escapeHtml(txt)}</td>`;}).join('')+'</tr>').join('')
    :`<tr><td colspan="${def.cols.length}" class="empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
  $('#pageInfo').textContent=`Página ${state.page} de ${pages}`;
  $('#prev').disabled=state.page<=1; $('#next').disabled=state.page>=pages;
}

function chartHtml(c){
  const data=c.data, fmt=c.fmt||(v=>v);
  if(!data.length||data.every(d=>!d.value)) return '<div class="empty">Sem dados para o período.</div>';
  if(c.type==='bars'){
    const max=Math.max(...data.map(d=>d.value))||1, step=Math.ceil(data.length/10);
    return '<div class="bars">'+data.map((d,i)=>`<div class="bar"><div style="height:${d.value/max*100}%" title="${escapeHtml(d.label)}: ${escapeHtml(fmt(d.value))}"></div><small>${i%step===0?escapeHtml(d.label):''}</small></div>`).join('')+'</div>';
  }
  if(c.type==='donut'){
    const total=sum(data,d=>d.value); let acc=0;
    const grad=data.map((d,i)=>{const s=acc/total*100;acc+=d.value;return `${COLORS[i%COLORS.length]} ${s}% ${acc/total*100}%`}).join(',');
    return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${grad})" data-total="${escapeHtml(c.fmt?fmt(total):total)}"></div>
      <div class="legend">${data.map((d,i)=>`<div><i style="background:${COLORS[i%COLORS.length]}"></i>${escapeHtml(d.label)}<b>${escapeHtml(c.fmt?fmt(d.value):d.value)}</b></div>`).join('')}</div></div>`;
  }
  const max=Math.max(...data.map(d=>d.value))||1;
  return '<div class="hbars">'+data.map(d=>`<div class="hbar"><div class="t"><span>${escapeHtml(d.label)}</span><b>${escapeHtml(fmt(d.value))}</b></div><div class="tr"><div style="width:${d.value/max*100}%"></div></div></div>`).join('')+'</div>';
}

function exportCsv(){
  const def=currentDef;
  const esc=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const lines=[def.cols.map(c=>esc(c.l)).join(';')];
  currentRows.forEach(r=>lines.push(def.cols.map(c=>esc(c.f?c.f(r[c.k]):r[c.k])).join(';')));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`relatorio-${state.tab}-${iso(HOJE)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

const reportError = $('#reportError');
if (reportError.textContent.trim()) {
  reportError.hidden = false;
} else {
  buildStatic(); setRange(90);
}
