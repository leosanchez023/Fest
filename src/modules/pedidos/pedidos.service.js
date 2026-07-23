import * as model from "./pedidos.model.js";

/**
 * Cria um novo pedido.
 * Realiza a sanitização dos dados, valida as informações,
 * calcula os valores do pedido e envia para a camada de model.
 */
export async function criarPedido(dados) {
  // Remove espaços, converte tipos e normaliza os dados recebidos
  dados = sanitizarPedido(dados);

  // Valida todas as regras de negócio
  await validarPedido(dados);

  // Calcula os itens e seus subtotais
  const itensCalculados = await calcularItens(dados.itens);

  // Soma o valor de todos os produtos
  const valorProdutos = itensCalculados.reduce(
    (soma, item) => soma + item.subtotal,
    0
  );

  // Calcula o frete
  const valorFrete = calcularFrete(dados);

  // Obtém o desconto informado
  const desconto = dados.valor_desconto;

  // Calcula o valor final do pedido
  const valorTotal =
    valorProdutos +
    valorFrete -
    desconto;

  // Impede que o valor pago seja maior que o total
  if (dados.valor_pago > valorTotal) {
    throw new Error("Valor pago maior que o total.");
  }

  // Monta o objeto que será salvo no banco
  const pedido = {
    cliente_id: dados.cliente_id,
    endereco_id: dados.endereco_id,
    telefone_contato: dados.telefone_contato,
    tipo_pedido: dados.tipo_pedido,
    data_evento: dados.data_evento,
    data_entrega: dados.data_entrega,
    data_retirada: dados.data_retirada,
    forma_pagamento: dados.forma_pagamento,
    observacao_pagamento:dados.observacao_pagamento,
    observacoes:dados.observacoes,
    distancia_km:dados.distancia_km,
    valor_pago:dados.valor_pago,
    valor_produtos:valorProdutos,
    valor_frete:valorFrete,
    valor_desconto:desconto,
    valor_total:valorTotal,
    itens:itensCalculados
  };

  return await model.criarPedido(pedido);
}

/**
 * Valida todas as informações do pedido
 * antes de permitir seu cadastro.
 */
async function validarPedido(dados) {

  //CLIENTE
  if (!dados.cliente_id) {
    throw new Error("Cliente é obrigatório.");
  }
  if (!Number.isInteger(dados.cliente_id)) {
    throw new Error("Cliente inválido.");
  }

  const cliente =
    await model.buscarClientePorId(dados.cliente_id);

  if (!cliente) {
    throw new Error("Cliente não encontrado.");
  }

  // ENDEREÇO
  if (dados.endereco_id) {
    const endereco = await model.buscarEnderecoPorId(dados.endereco_id);

    if (!endereco) {
      throw new Error("Endereço inválido.");
    }
  }


  // ITENS
  if (!Array.isArray(dados.itens)) {
    throw new Error("Itens inválidos.");
  }
  if (dados.itens.length === 0) {
    throw new Error("Pedido sem itens.");
  }
  if (dados.itens.length > 500) {
    throw new Error("Quantidade de itens acima do permitido.");
  }

  
  // DATAS
  if (!dados.data_evento) {
    throw new Error("Informe a data do evento.");
  }
  if (!dados.data_entrega) {
    throw new Error("Informe a data de entrega.");
  }
  if (!dados.data_retirada) {
    throw new Error("Informe a data de retirada.");
  }

  const entrega = new Date(dados.data_entrega);
  const evento = new Date(dados.data_evento);
  const retirada = new Date(dados.data_retirada);

  if (isNaN(entrega)) {
    throw new Error("Data entrega inválida.");
  }
  if (isNaN(evento)) {
    throw new Error("Data evento inválida.");
  }
  if (isNaN(retirada)) {
    throw new Error("Data retirada inválida.");
  }

  const hoje = new Date();

  hoje.setHours(0, 0, 0, 0);

  if (evento < hoje) {
    throw new Error("Evento não pode ser no passado.");
  }
  if (entrega > evento) {
    throw new Error("Entrega após o evento.");
  }
  if (retirada < evento) {
    throw new Error("Retirada antes do evento.");
  }

  // TELEFONE
  if (dados.telefone_contato) {
    if (
      dados.telefone_contato.length < 10 ||
      dados.telefone_contato.length > 11
    ) {
      throw new Error("Telefone inválido.");
    }
  }
  if (
    dados.telefone_contato &&
    dados.telefone_contato.length !== 10 &&
    dados.telefone_contato.length !== 11
  ) {
    throw new Error("Telefone inválido.");
  }

 
  // FRETE
  if (dados.distancia_km < 0) {
    throw new Error("Distância inválida.");
  }
  if (dados.distancia_km > 500) {
    throw new Error("Distância acima do permitido.");
  }


  // DESCONTO
  if (dados.valor_desconto < 0) {
    throw new Error("Desconto inválido.");
  }


  // PAGAMENTO
  if (dados.valor_pago < 0) {
    throw new Error("Valor pago inválido.");
  }

  const formas = [
    "PIX",
    "DINHEIRO",
    "CARTAO_DEBITO",
    "CARTAO_CREDITO",
    "TRANSFERENCIA"
  ];

  if (
    dados.forma_pagamento &&
    !formas.includes(dados.forma_pagamento)
  ) {
    throw new Error("Forma de pagamento inválida.");
  }

  // TIPO DO PEDIDO
  const tipos = [
    "VENDA",
    "ALUGUEL",
    "MISTO"
  ];

  if (!tipos.includes(dados.tipo_pedido)) {
    throw new Error("Tipo inválido.");
  }

 
  // PRODUTOS REPETIDOS
  const ids = new Set();

  for (const item of dados.itens) {
    if (ids.has(item.produto_id)) {
      throw new Error("Produto repetido.");
    }

    ids.add(item.produto_id);
  }

  // OBSERVAÇÕES
  if (
    dados.observacoes &&
    dados.observacoes.length > 1000
  ) {
    throw new Error("Observação muito grande.");
  }
}
/**
 * Calcula os itens do pedido.
 * Valida os dados, verifica estoque e calcula os subtotais.
 */
async function calcularItens(itens) {

  // Array que armazenará os itens já calculados
  const resultado = [];

  // Percorre todos os itens do pedido
  for (const item of itens) {

    // Verifica se o ID do produto é válido
    if (!Number.isInteger(Number(item.produto_id))) {
      throw new Error("Produto inválido.");
    }

    // Verifica se a quantidade é um número inteiro
    if (!Number.isInteger(Number(item.quantidade))) {
      throw new Error("Quantidade inválida.");
    }

    // Não permite quantidade menor ou igual a zero
    if (item.quantidade <= 0) {
      throw new Error("Quantidade deve ser maior que zero.");
    }

    // Limita a quantidade máxima permitida
    if (item.quantidade > 9999) {
      throw new Error("Quantidade muito grande.");
    }

    // Busca o produto no banco de dados
    const produto =
      await model.buscarProdutoPorId(item.produto_id);

    // Verifica se o produto existe
    if (!produto) {
      throw new Error(`Produto ${item.produto_id} não encontrado.`);
    }

    // Verifica se existe estoque suficiente
    if (produto.quantidade < item.quantidade) {
      throw new Error(`Estoque insuficiente para ${produto.nome}`);
    }

    // Obtém o preço do produto
    const preco = Number(produto.preco_venda);

    // Verifica se o preço é um número válido
    if (!Number.isFinite(preco)) {
      throw new Error("Preço do produto inválido.");
    }

    // Não permite preço negativo
    if (preco < 0) {
      throw new Error("Preço do produto inválido.");
    }

    // Adiciona o item calculado ao resultado
    resultado.push({
      produto_id: produto.id,
      quantidade: item.quantidade,
      preco_unitario: preco,
      subtotal: preco * item.quantidade
    });

  }

  return resultado;
}

/**
 * Sanitiza os dados recebidos do formulário.
 * Converte tipos e remove caracteres desnecessários.
 */
function sanitizarPedido(dados) {

  return {

    // Converte o ID do cliente para número
    cliente_id:Number(dados.cliente_id),

    // Converte o endereço para número quando informado
    endereco_id: dados.endereco_id 
    ? Number(dados.endereco_id) 
    : null,

    // Remove todos os caracteres que não são números
    telefone_contato: dados.telefone_contato 
    ?.replace(/\D/g, ""),

    // Mantém o tipo do pedido
    tipo_pedido: dados.tipo_pedido,

    // Datas do pedido
    data_evento: dados.data_evento,

    data_entrega: dados.data_entrega,

    data_retirada: dados.data_retirada,

    // Forma de pagamento
    forma_pagamento: dados.forma_pagamento,

    // Remove espaços extras da observação do pagamento
    observacao_pagamento: dados.observacao_pagamento
    ?.trim()
    .replace(/\s+/g, " "),

    // Remove espaços extras das observações
    observacoes:dados.observacoes
    ?.trim()
    .replace(/\s+/g, " "),

    // Converte valores para número
    distancia_km:
      Number(dados.distancia_km || 0),

    valor_pago:
      Number(dados.valor_pago || 0),

    valor_desconto:
      Number(dados.valor_desconto || 0),

    // Mantém os itens do pedido
    itens:
      dados.itens
  };

}

/**
 * Calcula o valor do frete.
 */
function calcularFrete(dados) {

  // Obtém a distância informada
  const distancia = Number(dados.distancia_km || 0);

  // Valor cobrado por quilômetro
  const precoKm = 2.5;

  // Calcula o frete
  return distancia * precoKm;
}

/**
 * Busca clientes pelo termo informado.
 */
export async function buscarClientes(termo) {
  return await model.buscarClientes(termo);
}

/**
 * Busca produtos pelo termo informado.
 */
export async function buscarProdutos(termo) {
  return await model.buscarProdutos(termo);
}

/**
 * Cadastra um novo cliente.
 */
export async function criarCliente(dados) {
  return await model.criarCliente(dados);
}

/**
 * Busca endereços aplicando os filtros recebidos.
 */
export async function buscarEnderecos(filtros) {

  // Remove espaços dos filtros
  const f = {
    rua: (filtros.rua || "").trim(),
    numero: (filtros.numero || "").trim(),
    bairro: (filtros.bairro || "").trim(),
    cidade: (filtros.cidade || "").trim(),
    estado: (filtros.estado || "").trim()
  };

  return await model.buscarEnderecos(f);
}

/**
 * Cadastra um novo endereço.
 */
export async function criarEndereco(dados) {

  // Aceita tanto dados.endereco quanto o objeto diretamente
  const e = dados.endereco || dados;

  // Remove espaços dos campos
  const rua = e.rua?.trim();
  const numero = e.numero?.trim();
  const bairro = e.bairro?.trim();
  const cidade = e.cidade?.trim();
  const estado = e.estado?.trim();

  // Validação obrigatória
  if (!rua || !cidade) {
    throw new Error("Rua e cidade são obrigatórios");
  }

  // Salva o endereço
  return await model.criarEndereco({
    rua,
    numero,
    bairro,
    cidade,
    estado
  });
}

/**
 * Busca um pedido pelo ID.
 */
export async function buscarPedidoPorId(id) {
  return await model.buscarPedidoPorId(id);
}