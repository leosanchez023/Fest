import * as model from "./pedidos.model.js";
import db from "../../../database/connection.js";
import {
  buscarSugestoesEndereco,
  calcularRotaEntrega,
  emitirTokenParaCoordenadas,
  resolverNumeroEndereco
} from "./pedidos.geocoding.js";

export { buscarSugestoesEndereco };

function normalizeSearchText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

/**
 * Cria um novo pedido.
 * Realiza a sanitização dos dados, valida as informações,
 * calcula os valores do pedido e envia para a camada de model.
 */
export async function criarPedido(dados) {
  // Remove espaços, converte tipos e normaliza os dados recebidos
  dados = sanitizarPedido(dados);

  if (!dados.destino_token) throw new Error("Selecione uma sugestão geocodificada para o destino e calcule a rota antes de salvar.");
  const configuracaoEntrega = await model.buscarConfiguracaoEntrega();
  const rota = await calcularRotaEntrega({
    settings: configuracaoEntrega,
    destinoToken: dados.destino_token,
    destinoNumero: dados.endereco.numero,
    destinoEndereco: dados.endereco
  });
  dados.distancia_km = rota.distanciaKm;
  dados.valor_frete = rota.valorFrete;

  // Valida todas as regras de negócio
  await validarPedido(dados);

  // Calcula os itens e seus subtotais
  const itensCalculados = await calcularItens(dados.itens, dados.tipo_pedido);
  const tiposItens = new Set(itensCalculados.map((item) => item.tipo_item));
  const tipoPedido = tiposItens.size > 1 ? "MISTO" : [...tiposItens][0];

  // Soma o valor de todos os produtos
  const valorProdutos = itensCalculados.reduce(
    (soma, item) => soma + item.subtotal,
    0
  );

  // Calcula o frete
  const valorFrete = rota.valorFrete;

  // Obtém o desconto informado
  const desconto = dados.valor_desconto;

  // Calcula o valor final do pedido
  const valorTotal =
    valorProdutos +
    valorFrete -
    desconto;

  if (desconto > valorProdutos + valorFrete) {
    throw new Error("O desconto não pode exceder o valor do pedido.");
  }

  // Impede que o valor pago seja maior que o total
  if (dados.valor_pago > valorTotal) {
    throw new Error("Valor pago maior que o total.");
  }

  // Monta o objeto que será salvo no banco
  const pedido = {
    usuario_id: dados.usuario_id || null,
    cliente_id: dados.cliente_id,
    endereco_id: dados.endereco_id,
    endereco: dados.endereco,
    status: dados.status,
    status_documento: dados.status_documento,
    telefone_contato: dados.telefone_contato,
    tipo_pedido: tipoPedido,
    data_evento: dados.data_evento,
    data_entrega: dados.data_entrega,
    data_retirada: dados.data_retirada,
    forma_pagamento: dados.forma_pagamento,
    observacao_pagamento:dados.observacao_pagamento,
    observacoes:dados.observacoes,
    distancia_km:dados.distancia_km,
    distancia_retorno_km: rota.distanciaRetornoKm,
    distancia_cobrada_km: rota.distanciaCobradaKm,
    frete_formula: rota.formula,
    origem_aproximada: rota.origemAproximada,
    destino_aproximado: rota.destinoAproximado,
    valor_pago:dados.valor_pago,
    endereco_origem: normalizeSearchText(rota.origem).slice(0, 255),
    origem_lat: rota.origemLatitude,
    origem_lon: rota.origemLongitude,
    destino_lat: rota.destinoLatitude,
    destino_lon: rota.destinoLongitude,
    valor_produtos:valorProdutos,
    valor_frete:valorFrete,
    valor_desconto:desconto,
    valor_total:valorTotal,
    rota,
    itens:itensCalculados
  };

  return await model.criarPedido(pedido);
}

/**
 * Valida todas as informações do pedido
 * antes de permitir seu cadastro.
 */
async function validarPedido(dados) {

  if (!Number.isFinite(dados.distancia_km) || dados.distancia_km < 0 || dados.distancia_km > 500) {
    throw new Error("Distância inválida.");
  }
  if (!Number.isFinite(dados.valor_desconto) || dados.valor_desconto < 0) {
    throw new Error("Desconto inválido.");
  }
  if (!Number.isFinite(dados.valor_pago) || dados.valor_pago < 0) {
    throw new Error("Valor pago inválido.");
  }
  const estadosIniciais = {
    ORCAMENTO: "ORCAMENTO",
    CONFIRMADO: "PEDIDO"
  };
  if (estadosIniciais[dados.status] !== dados.status_documento) {
    throw new Error("Estado inicial do pedido inválido.");
  }

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
    if (!Number.isInteger(dados.endereco_id) || dados.endereco_id <= 0) {
      throw new Error("Endereço inválido.");
    }
    const hasAddressFields = Object.values(dados.endereco || {}).some(Boolean);
    if (!hasAddressFields) {
      const endereco = await model.buscarEnderecoPorId(dados.endereco_id);
      if (!endereco) throw new Error("Endereço inválido.");
    }
  }
  const hasAddressFields = Object.values(dados.endereco || {}).some(Boolean);
  if (hasAddressFields && (!dados.endereco.rua || !dados.endereco.cidade)) {
    throw new Error("Informe rua e cidade para salvar o endereço de entrega.");
  }
  if (hasAddressFields) {
    const limites = { rua: 150, numero: 10, bairro: 100, cidade: 100, estado: 2, cep: 12, referencia: 150 };
    if (Object.entries(limites).some(([field, limit]) => dados.endereco[field].length > limit)) {
      throw new Error("Um ou mais campos do endereço excedem o tamanho permitido.");
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

 
  // Itens repetidos
  const ids = new Set();

  for (const item of dados.itens) {
    const produtoId = item.produto_id ? Number(item.produto_id) : null;
    const comboId = item.combo_id ? Number(item.combo_id) : null;
    if ((produtoId && comboId) || (!produtoId && !comboId)) {
      throw new Error("Cada item deve ser um produto ou um combo.");
    }
    const chave = `${comboId ? "combo" : "produto"}:${comboId || produtoId}`;
    if (ids.has(chave)) throw new Error("Produto ou combo repetido.");
    ids.add(chave);
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
async function calcularItens(itens, tipoPedidoLegado = null) {

  // Array que armazenará os itens já calculados
  const resultado = [];

  // Percorre todos os itens do pedido
  for (const item of itens) {

    const produtoId = item.produto_id ? Number(item.produto_id) : null;
    const comboId = item.combo_id ? Number(item.combo_id) : null;
    if ((produtoId && comboId) || (!produtoId && !comboId)) throw new Error("Item inválido.");

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

    const entidade = comboId
      ? await model.buscarComboPorId(comboId)
      : await model.buscarProdutoPorId(produtoId);
    if (!entidade || Number(entidade.ativo ?? 1) !== 1) {
      throw new Error(`${comboId ? "Combo" : "Produto"} não encontrado ou inativo.`);
    }
    if (comboId && Number(entidade.total_componentes || 0) <= 0) {
      throw new Error(`Combo ${entidade.nome} não possui componentes.`);
    }

    const tipoItem = String(item.tipo_item || (
      tipoPedidoLegado === "VENDA" ? "VENDA" : "ALUGUEL"
    )).toUpperCase();
    if (!["VENDA", "ALUGUEL"].includes(tipoItem)) {
      throw new Error("Tipo de item inválido.");
    }
    const preco = Number(comboId
      ? entidade.preco
      : tipoItem === "VENDA" ? entidade.preco_venda : entidade.preco_aluguel);

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
      produto_id: produtoId,
      combo_id: comboId,
      tipo_item: tipoItem,
      nome: entidade.nome,
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
    usuario_id: dados.usuario_id || null,

    // Converte o ID do cliente para número
    cliente_id:Number(dados.cliente_id),

    // Converte o endereço para número quando informado
    endereco_id: dados.endereco_id 
    ? Number(dados.endereco_id) 
    : null,
    endereco: sanitizarEndereco(dados.endereco),


    // STATUS DO PEDIDO
    // Confirmar Pedido = CONFIRMADO
    // Gerar Orçamento = ORCAMENTO
    status: dados.status || "CONFIRMADO",

    status_documento: dados.status_documento || "PEDIDO",


    // Remove todos os caracteres que não são números
    telefone_contato: dados.telefone_contato 
    ?.replace(/\D/g, ""),


    // Mantém o tipo do pedido
    tipo_pedido: ["VENDA", "ALUGUEL", "MISTO"].includes(String(dados.tipo_pedido || "").toUpperCase())
      ? String(dados.tipo_pedido).toUpperCase()
      : "ALUGUEL",


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

    endereco_origem: normalizeSearchText(dados.endereco_origem).slice(0, 255),
    origem_token: typeof dados.origem_token === "string" ? dados.origem_token : "",
    destino_token: typeof dados.destino_token === "string" ? dados.destino_token : "",
    valor_frete: Number(dados.valor_frete || 0),

    // Mantém os itens do pedido
    itens:
      dados.itens
  };

}

function sanitizarEndereco(endereco = {}) {
  endereco = endereco && typeof endereco === "object" ? endereco : {};
  const clean = (value) => normalizeSearchText(value);
  return {
    rua: clean(endereco.rua),
    numero: clean(endereco.numero),
    bairro: clean(endereco.bairro),
    cidade: clean(endereco.cidade),
    estado: clean(endereco.estado).toUpperCase(),
    cep: clean(endereco.cep),
    referencia: clean(endereco.referencia)
  };
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

export async function buscarItens(termo) {
  return await model.buscarItens(termo);
}

export async function cancelarPedido(id, dados = {}) {
  return await model.cancelarPedido(id, dados);
}

export async function alterarQuantidadeItemPedido(id, produtoId, quantidade, dados = {}) {
  return await model.alterarQuantidadeItemPedido(id, produtoId, quantidade, dados);
}

/**
 * Cadastra um novo cliente.
 */
export async function criarCliente(dados) {
  const texto = (valor) => String(valor || "").trim().replace(/\s+/g, " ");
  const cliente = {
    nome: texto(dados.nome),
    email: texto(dados.email).toLowerCase(),
    telefone: String(dados.telefone || "").replace(/\D/g, ""),
    cpf: String(dados.cpf || "").replace(/\D/g, ""),
    nascimento: texto(dados.nascimento) || null,
    rua: texto(dados.rua),
    numero: texto(dados.numero),
    bairro: texto(dados.bairro),
    cidade: texto(dados.cidade),
    estado: texto(dados.estado).toUpperCase(),
    cep: String(dados.cep || "").replace(/\D/g, ""),
    referencia: texto(dados.referencia)
  };

  if (!cliente.nome || !cliente.email || !cliente.telefone || !cliente.cpf) {
    throw new Error("Nome, e-mail, telefone e CPF são obrigatórios.");
  }
  if (cliente.nome.length > 100 || cliente.email.length > 100) {
    throw new Error("Nome ou e-mail excede o tamanho permitido.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) {
    throw new Error("Informe um e-mail válido.");
  }
  if (![10, 11].includes(cliente.telefone.length)) {
    throw new Error("Informe um telefone válido.");
  }
  if (cliente.cpf.length !== 11) {
    throw new Error("Informe um CPF válido com 11 dígitos.");
  }
  if (cliente.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(cliente.nascimento)) {
    throw new Error("Data de nascimento inválida.");
  }
  if (cliente.rua && !cliente.cidade) {
    throw new Error("Informe a cidade do endereço.");
  }

  return await model.criarCliente(cliente);
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
    estado: (filtros.estado || "").trim(),
    cep: (filtros.cep || "").trim(),
    referencia: (filtros.referencia || "").trim()
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
  const cep = e.cep?.trim();
  const referencia = e.referencia?.trim();

  // Validação obrigatória
  if (!rua || !cidade) {
    throw new Error("Rua e cidade são obrigatórios");
  }
  if (rua.length > 150 || (e.numero || "").length > 10 || (bairro || "").length > 100
      || cidade.length > 100 || (estado || "").length > 2 || (cep || "").length > 12
      || (referencia || "").length > 150) {
    throw new Error("Um ou mais campos do endereço excedem o tamanho permitido.");
  }

  // Salva o endereço
  return await model.criarEndereco({
    rua,
    numero,
    bairro,
    cidade,
    estado,
    cep,
    referencia
  });
}

/**
 * Busca um pedido pelo ID.
 */
export async function buscarPedidoPorId(id) {
  const result = await model.buscarPedidoPorId(id);
  if (!result?.pedido) return result;
  const pedido = result.pedido;
  const coordenadasOrigemValidas = pedido.origem_lat != null && pedido.origem_lon != null
    && Number.isFinite(Number(pedido.origem_lat)) && Number.isFinite(Number(pedido.origem_lon))
    && Math.abs(Number(pedido.origem_lat)) <= 90 && Math.abs(Number(pedido.origem_lon)) <= 180;
  pedido.origem_token = coordenadasOrigemValidas
    ? emitirTokenParaCoordenadas({
      latitude: Number(pedido.origem_lat),
      longitude: Number(pedido.origem_lon),
      label: pedido.endereco_origem
    })
    : "";
  pedido.endereco = pedido.endereco || {};
  const coordenadasDestinoValidas = pedido.destino_lat != null && pedido.destino_lon != null
    && Number.isFinite(Number(pedido.destino_lat)) && Number.isFinite(Number(pedido.destino_lon))
    && Math.abs(Number(pedido.destino_lat)) <= 90 && Math.abs(Number(pedido.destino_lon)) <= 180;
  pedido.endereco.selectionToken = coordenadasDestinoValidas
    ? emitirTokenParaCoordenadas({
      latitude: Number(pedido.destino_lat),
      longitude: Number(pedido.destino_lon),
      label: [
        pedido.endereco.rua,
        pedido.endereco.numero,
        pedido.endereco.bairro,
        pedido.endereco.cidade,
        pedido.endereco.estado
      ].filter(Boolean).join(", "),
      address: {
        rua: pedido.endereco.rua || "",
        numero: pedido.endereco.numero || "",
        bairro: pedido.endereco.bairro || "",
        cidade: pedido.endereco.cidade || "",
        estado: pedido.endereco.estado || "",
        cep: pedido.endereco.cep || ""
      }
    })
    : "";
  return result;
}

export async function buscarConfiguracaoEntrega() {
  const config = await model.buscarConfiguracaoEntrega();
  return {
    configurado: Boolean(config),
    configuracao: config
  };
}

function numericSetting(value, field, { required = false, minimum = 0, maximum = 1000000 } = {}) {
  if (value === "" || value == null) {
    if (required) throw new Error(`Informe o valor de ${field}.`);
    return null;
  }
  const raw = String(value).trim();
  const normalized = raw.includes(",") && !raw.includes(".")
    ? raw.replace(",", ".")
    : raw;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`O valor de ${field} deve estar entre ${minimum} e ${maximum}.`);
  }
  return Math.round(number * 100) / 100;
}

export async function salvarConfiguracaoEntrega(dados = {}) {
  const origin = dados.origem && typeof dados.origem === "object" ? dados.origem : {};
  const address = sanitizarEndereco(origin);
  if (!address.rua || !address.cidade || !/^[A-Z]{2}$/.test(address.estado)) {
    throw new Error("Informe logradouro, cidade e UF da origem padrão.");
  }
  if (address.rua.length > 150 || address.numero.length > 20 || address.bairro.length > 100
      || address.cidade.length > 100 || address.cep.length > 12 || address.referencia.length > 150) {
    throw new Error("Um ou mais campos da origem excedem o tamanho permitido.");
  }
  const regra = String(dados.regra_cobranca || "").toUpperCase();
  const sentido = String(dados.sentido_distancia || "").toUpperCase();
  if (!["FIXO", "POR_KM", "FIXO_POR_KM"].includes(regra)) {
    throw new Error("Selecione um modelo de cobrança válido.");
  }
  if (!["IDA", "IDA_VOLTA"].includes(sentido)) {
    throw new Error("Selecione se o cálculo considera somente ida ou ida e volta.");
  }
  const token = typeof origin.selectionToken === "string" ? origin.selectionToken : "";
  let geocoded;
  if (token) {
    geocoded = await resolverNumeroEndereco(token, address);
  } else {
    const existing = await model.buscarConfiguracaoEntrega();
    const sameLocation = existing && ["rua", "bairro", "cidade", "estado", "cep"]
      .every((field) => normalizeSearchText(address[field]) === normalizeSearchText(
        existing[`origem_${field === "rua" ? "rua" : field}`] || ""
      ));
    if (!sameLocation) throw new Error("Selecione a origem nas sugestões para validar as coordenadas.");

    const numberChanged = normalizeSearchText(address.numero)
      !== normalizeSearchText(existing.origem_numero);
    if (numberChanged) {
      const latitude = Number(existing.origem_lat);
      const longitude = Number(existing.origem_lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
          || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error("A origem salva não possui coordenadas válidas. Selecione-a novamente nas sugestões.");
      }
      const selectionToken = emitirTokenParaCoordenadas({
        latitude,
        longitude,
        label: [existing.origem_rua, existing.origem_bairro, existing.origem_cidade, existing.origem_estado]
          .filter(Boolean).join(", "),
        address: {
          rua: existing.origem_rua || "",
          bairro: existing.origem_bairro || "",
          cidade: existing.origem_cidade || "",
          estado: existing.origem_estado || "",
          cep: existing.origem_cep || ""
        }
      });
      geocoded = await resolverNumeroEndereco(selectionToken, address);
    } else {
      geocoded = {
        place: { latitude: Number(existing.origem_lat), longitude: Number(existing.origem_lon) },
        aproximada: Boolean(existing.origem_aproximada)
      };
    }
  }
  const valorFixo = numericSetting(dados.valor_fixo, "frete fixo", {
    required: regra === "FIXO",
    maximum: 100000
  });
  const taxaInicial = numericSetting(dados.taxa_inicial, "taxa inicial", {
    required: regra === "FIXO_POR_KM",
    maximum: 100000
  });
  const valorPorKm = numericSetting(dados.valor_por_km, "valor por quilômetro", {
    required: regra !== "FIXO",
    maximum: 100000
  });
  const taxaMinima = numericSetting(dados.taxa_minima, "taxa mínima", { maximum: 100000 });
  const distanciaMaxima = numericSetting(dados.distancia_maxima_km, "distância máxima", {
    maximum: 500
  });
  if (distanciaMaxima === 0) throw new Error("A distância máxima deve ser maior que zero.");

  return model.salvarConfiguracaoEntrega({
    origem_rua: address.rua,
    origem_numero: address.numero || null,
    origem_bairro: address.bairro || null,
    origem_cidade: address.cidade,
    origem_estado: address.estado,
    origem_cep: address.cep || null,
    origem_referencia: address.referencia || null,
    origem_lat: geocoded.place.latitude,
    origem_lon: geocoded.place.longitude,
    origem_aproximada: geocoded.aproximada,
    regra_cobranca: regra,
    valor_fixo: valorFixo,
    taxa_inicial: taxaInicial,
    valor_por_km: valorPorKm,
    taxa_minima: taxaMinima,
    distancia_maxima_km: distanciaMaxima,
    sentido_distancia: sentido
  });
}

export async function calcularRota(destinoToken, destinoNumero, destinoEndereco) {
  const settings = await model.buscarConfiguracaoEntrega();
  return calcularRotaEntrega({ settings, destinoToken, destinoNumero, destinoEndereco });
}

export async function atualizarPedido(id, dados) {
  const pedido = {
    ...dados,
    endereco: sanitizarEndereco(dados.endereco),
    endereco_origem: normalizeSearchText(dados.endereco_origem).slice(0, 255),
    origem_token: typeof dados.origem_token === "string" ? dados.origem_token : "",
    destino_token: typeof dados.destino_token === "string" ? dados.destino_token : "",
    rota: null
  };
  if (pedido.recalcular_rota === true && pedido.destino_token) {
    const settings = await model.buscarConfiguracaoEntrega();
    pedido.rota = await calcularRotaEntrega({
      settings,
      destinoToken: pedido.destino_token,
      destinoNumero: pedido.endereco.numero,
      destinoEndereco: pedido.endereco
    });
    pedido.distancia_km = pedido.rota.distanciaKm;
    pedido.distancia_retorno_km = pedido.rota.distanciaRetornoKm;
    pedido.distancia_cobrada_km = pedido.rota.distanciaCobradaKm;
    pedido.frete_formula = pedido.rota.formula;
    pedido.origem_aproximada = pedido.rota.origemAproximada;
    pedido.destino_aproximado = pedido.rota.destinoAproximado;
    pedido.valor_frete = pedido.rota.valorFrete;
    pedido.endereco_origem = pedido.rota.origem;
  }

  return await model.atualizarPedido(id, pedido);
}

export async function buscarFinanceiroPedido(id) {
  return await model.buscarFinanceiroPedido(id);
}

export async function adicionarPagamentoPedido(id, dados) {
  const pagamento = sanitizarPagamento(dados);
  validarPagamento(pagamento);

  return await model.inserirPagamentoPedido(id, pagamento);
}

export async function adicionarCobrancaPedido(id, dados) {
  const cobranca = sanitizarCobranca(dados);
  validarCobranca(cobranca);

  return await model.inserirCobrancaPedido(id, cobranca);
}

function sanitizarPagamento(dados) {
  return {
    valor: Number(dados.valor || 0),
    forma_pagamento: dados.forma_pagamento || null,
    observacao: dados.observacao?.trim()?.replace(/\s+/g, " ") || null,
    usuario_id: dados.usuario_id ? Number(dados.usuario_id) : null
  };
}

function sanitizarCobranca(dados) {
  const descricao = (dados.descricao || dados.observacao || "Cobrança adicional")
    .toString()
    .trim()
    .replace(/\s+/g, " ");

  return {
    valor: Number(dados.valor || 0),
    descricao,
    observacao: descricao,
    tipo: String(dados.tipo || 'OUTRO').toUpperCase(),
    usuario_id: dados.usuario_id ? Number(dados.usuario_id) : null
  };
}

function validarPagamento(pagamento) {
  if (!Number.isFinite(pagamento.valor) || pagamento.valor <= 0) {
    throw new Error("Informe um valor de pagamento válido.");
  }

  const formas = ["PIX", "DINHEIRO", "CARTAO_DEBITO", "CARTAO_CREDITO", "TRANSFERENCIA"];
  if (pagamento.forma_pagamento && !formas.includes(pagamento.forma_pagamento)) {
    throw new Error("Forma de pagamento inválida.");
  }
}

function validarCobranca(cobranca) {
  if (!Number.isFinite(cobranca.valor) || cobranca.valor <= 0) {
    throw new Error("Informe um valor de cobrança válido.");
  }

  if (!cobranca.descricao) {
    throw new Error("Descreva a cobrança adicional.");
  }
}
