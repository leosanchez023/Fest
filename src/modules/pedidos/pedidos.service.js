import * as model from "./pedidos.model.js";

export async function criarPedido(dados) {

  validarPedido(dados);

  const itensCalculados =
    await calcularItens(dados.itens);

  const valorProdutos =
    itensCalculados.reduce(
      (s, i) => s + i.subtotal,
      0
    );

  const valorFrete =
    calcularFrete(dados);

  const desconto =
    Number(dados.valor_desconto || 0);

  const valorTotal =
    valorProdutos +
    valorFrete -
    desconto;

  const pedido = {

    ...dados,

    valor_produtos:
      valorProdutos,

    valor_frete:
      valorFrete,

    valor_desconto:
      desconto,

    valor_total:
      valorTotal,

    itens: itensCalculados
  };

  return await model.criarPedido(pedido);
}

// ---------------- VALIDAR ----------------
function validarPedido(dados) {

  if (!dados.cliente_id) {
    throw new Error("Cliente é obrigatório");
  }

  if (!dados.itens?.length) {
    throw new Error("Pedido sem itens");
  }
}

// ---------------- ITENS ----------------
async function calcularItens(itens) {

  const resultado = [];

  for (const item of itens) {

    const produto =
      await model.buscarProdutoPorId(
        item.produto_id
      );

    if (!produto) {
      throw new Error(
        `Produto ${item.produto_id} não encontrado`
      );
    }

    if (produto.quantidade < item.quantidade) {
      throw new Error(
        `Estoque insuficiente para ${produto.nome}`
      );
    }

    const preco =
      Number(produto.preco_venda);

    resultado.push({

      produto_id: produto.id,

      quantidade: item.quantidade,

      preco_unitario: preco,

      subtotal: preco * item.quantidade
    });
  }

  return resultado;
}

// ---------------- FRETE ----------------
function calcularFrete(dados) {

  const distancia =
    Number(dados.distancia_km || 0);

  const precoKm = 2.5;

  return distancia * precoKm;
}
export async function buscarClientes(termo) {
  return await model.buscarClientes(termo);
}

export async function buscarProdutos(termo) {
  return await model.buscarProdutos(termo);
}

export async function criarCliente(dados) {
  return await model.criarCliente(dados);
}
export async function buscarEnderecos(filtros) {

  const f = {
    rua: (filtros.rua || '').trim(),
    numero: (filtros.numero || '').trim(),
    bairro: (filtros.bairro || '').trim(),
    cidade: (filtros.cidade || '').trim(),
    estado: (filtros.estado || '').trim()
  };

  return await model.buscarEnderecos(f);
}
export async function criarEndereco(dados) {
  const e = dados.endereco || dados;

  const rua = e.rua?.trim();
  const numero = e.numero?.trim();
  const bairro = e.bairro?.trim();
  const cidade = e.cidade?.trim();
  const estado = e.estado?.trim();

  if (!rua || !cidade) {
    throw new Error("Rua e cidade são obrigatórios");
  }

  return await model.criarEndereco({
    rua, numero, bairro, cidade, estado
  });
}
export async function buscarPedidoPorId(id) {
  return await model.buscarPedidoPorId(id);
}