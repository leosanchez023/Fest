const base = 'http://localhost:3000';

async function getJSON(path){
  const res = await fetch(base+path);
  return res.json();
}

async function postJSON(path, body){
  const res = await fetch(base+path, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  let data;
  try{ data = await res.json(); }catch(e){ data = await res.text(); }
  return { status: res.status, data };
}

try{
  console.log('Buscando produtos...');
  const produtos = await getJSON('/produtos/api');
  if(!Array.isArray(produtos) || produtos.length===0){ console.error('Nenhum produto disponível para teste.'); process.exit(1); }
  const produto = produtos[0];
  console.log('Usando produto:', produto.id, produto.nome);

  // Criar cliente para associar ao pedido
  console.log('Criando cliente de teste...');
  const resCliente = await postJSON('/pedidos/criarCliente', { nome: 'Cliente Teste', email: 'teste@example.com' });
  const cliente = resCliente.data;
  console.log('Cliente criado:', cliente);

  // Criar pedido em ORÇAMENTO para obter pedidoId
  console.log('Criando pedido (ORCAMENTO) com 1 item...');
  const precoUnit = produto.preco_venda || produto.preco_aluguel || 0;
  // Datas: entrega <= evento <= retirada
  const hoje = new Date();
  const data_entrega = new Date(hoje.getTime() + 24*60*60*1000); // amanhã
  const data_evento = new Date(hoje.getTime() + 2*24*60*60*1000); // depois
  const data_retirada = new Date(hoje.getTime() + 3*24*60*60*1000);

  const pedidoBody = {
    cliente_id: cliente.id,
    tipo_pedido: 'ALUGUEL',
    status: 'ORCAMENTO',
    data_entrega: data_entrega.toISOString().split('T')[0],
    data_evento: data_evento.toISOString().split('T')[0],
    data_retirada: data_retirada.toISOString().split('T')[0],
    itens: [
      { produto_id: produto.id, quantidade: 1, preco_unitario: precoUnit, subtotal: precoUnit }
    ],
    valor_produtos: precoUnit
  };
  const resPedido = await postJSON('/pedidos/criar', pedidoBody);
  console.log('Pedido criado:', resPedido);
  const pedidoId = resPedido.data && resPedido.data.pedidoId ? resPedido.data.pedidoId : (resPedido.data && resPedido.data.pedidoId ? resPedido.data.pedidoId : null);

  console.log('Tentando reservar 1 unidade usando pedidoId...');
  const resReserva = await postJSON(`/produtos/${produto.id}/reservar`, { quantidade: 1, pedido_id: pedidoId });
  console.log('Reserva resposta:', resReserva);

  console.log('Tentando registrar saída de 1 unidade...');
  const resSaida = await postJSON(`/produtos/${produto.id}/saida`, { quantidade: 1 });
  console.log('Saída resposta:', resSaida);

  console.log('Teste concluído.');
  process.exit(0);
}catch(err){
  console.error('Erro no teste:', err);
  process.exit(1);
}
