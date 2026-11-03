import * as model from "./produtos.model.js";
import * as estoqueService from "../estoque/estoque.service.js";

function booleano(valor, padrao = false) {
  if (valor === undefined || valor === null || valor === "") return padrao;
  return valor === true || valor === 1 || valor === "1" || valor === "true";
}

// ======================================
// LISTAR
// ======================================

export async function listar(filtros = {}) {

  return await model.findAll(filtros);

}



// ======================================
// BUSCAR POR ID
// ======================================

export async function buscarPorId(id) {

  return await model.buscarPorId(id);

}



// ======================================
// CRIAR PRODUTO
// ======================================

export async function criar(dados) {


  if (!dados.nome || !dados.nome.trim()) {

    throw new Error("Nome obrigatório.");

  }


  const controlaEstoque = booleano(dados.controla_estoque, true);
  const estoque = Number(dados.estoque ?? 0);
  if (!Number.isSafeInteger(estoque) || estoque < 0) {
    throw new Error("Estoque inicial deve ser um inteiro não negativo.");
  }

  return await model.create({

    nome: dados.nome.trim(),

    codigo: dados.codigo || null,

    categoria: dados.categoria || null,

    fornecedor_id:
      dados.fornecedor_id || null,


    estoque: controlaEstoque ? estoque : 0,
    controla_estoque: controlaEstoque,


    precoVenda:
      Number(dados.precoVenda || 0),


    precoAluguel:
      Number(dados.precoAluguel || 0),

    estoque_minimo:
      Number(dados.estoque_minimo || 0)

  });


}



// ======================================
// ATUALIZAR
// ======================================

export async function atualizar(id, dados) {


  if (!dados.nome || !dados.nome.trim()) {

    throw new Error("Nome obrigatório.");

  }


  const produtoAtual = await model.buscarPorId(id);
  if (!produtoAtual) throw new Error("Produto não encontrado.");

  const controleAtual = estoqueService.controlaEstoque(produtoAtual);
  const controleDesejado = booleano(dados.controla_estoque, controleAtual);
  const estoqueAtual = Number(produtoAtual.estoque || 0);
  const estoqueDesejado = Number(dados.estoque ?? estoqueAtual);
  if (!Number.isFinite(estoqueDesejado) || estoqueDesejado < 0) {
    throw new Error("Estoque inválido.");
  }

  if (controleDesejado === controleAtual && controleDesejado && estoqueDesejado !== estoqueAtual) {
    await estoqueService.registrarAjuste({
      produtoId: Number(id),
      quantidade: estoqueDesejado - estoqueAtual,
      usuarioId: dados.usuario_id || null,
      observacao: "Ajuste de estoque na edição do produto"
    });
  }

  const dadosAtualizados = {

      nome: dados.nome.trim(),

      codigo: dados.codigo === undefined ? produtoAtual.codigo : dados.codigo,

      categoria: dados.categoria === undefined ? produtoAtual.categoria : dados.categoria,

      fornecedor_id: dados.fornecedor_id === undefined
        ? produtoAtual.fornecedor_id
        : dados.fornecedor_id,

      imagem: dados.imagem === undefined ? produtoAtual.imagem : dados.imagem,

      estoque: controleDesejado ? estoqueDesejado : estoqueAtual,


      precoVenda: Number(dados.precoVenda ?? produtoAtual.preco_venda ?? 0),


      precoAluguel: Number(dados.precoAluguel ?? produtoAtual.preco_aluguel ?? 0),

      estoque_minimo: Number(dados.estoque_minimo ?? produtoAtual.estoque_minimo ?? 0),

      ativo: booleano(dados.ativo, Number(produtoAtual.ativo) === 1)

  };

  if (controleDesejado !== controleAtual) {
    return await estoqueService.alterarControleEstoqueProduto({
      produtoId: Number(id),
      controlaEstoque: controleDesejado,
      estoqueInicial: estoqueDesejado,
      usuarioId: dados.usuario_id || null,
      atualizarCadastro: (conn) => model.atualizar(id, dadosAtualizados, conn)
    });
  }
  return await model.atualizar(id, dadosAtualizados);


}

export async function atualizarQuantidadesEstoque(id, dados, usuarioId = null) {
  const quantidade = (campo, nome) => {
    if (dados[campo] === undefined || dados[campo] === null || String(dados[campo]).trim() === "") {
      throw new Error(`${nome} é obrigatório.`);
    }
    const numero = Number(dados[campo]);
    if (!Number.isSafeInteger(numero) || numero < 0) {
      throw new Error(`${nome} deve ser um inteiro não negativo.`);
    }
    return numero;
  };

  return await estoqueService.atualizarQuantidadesProduto({
    produtoId: id,
    estoque: quantidade("estoque", "Estoque físico"),
    estoque_reservado: quantidade("estoque_reservado", "Quantidade reservada"),
    estoque_danificado: quantidade("estoque_danificado", "Quantidade danificada"),
    estoque_minimo: quantidade("estoque_minimo", "Estoque mínimo"),
    usuarioId
  });
}



// ======================================
// EXCLUIR
// ======================================

export async function deletar(id) {

  return await model.excluir(id);

}

export async function atualizarStatus(id, ativo) {
  if (typeof ativo !== "boolean") {
    throw new Error("Estado do produto inválido.");
  }
  const produto = await model.buscarPorId(id);
  if (!produto) throw new Error("Produto não encontrado.");
  return model.atualizarStatus(id, ativo);
}



// ======================================
// DASHBOARD
// ======================================

export async function dashboard() {

  return await model.dashboard();

}



// ======================================
// HISTÓRICO
// ======================================

export async function historico(filtros = {}) {

  return await estoqueService.historicoMovimentacoes(filtros);

}



// ======================================
// ENTRADA ESTOQUE
// ======================================

export async function entradaEstoque(id, dados) {


  const quantidade =
    Number(dados.quantidade);



  if (quantidade <= 0) {

    throw new Error(
      "Quantidade inválida."
    );

  }


  return await estoqueService.registrarEntrada({
    produtoId: Number(id),
    quantidade,
    usuarioId: dados.usuario_id || null,
    observacao: dados.observacao || ''
  });


}



// ======================================
// SAÍDA ESTOQUE
// ======================================

export async function saidaEstoque(id, dados) {


  const quantidade =
    Number(dados.quantidade);



  if (quantidade <= 0) {

    throw new Error(
      "Quantidade inválida."
    );

  }


  return await estoqueService.registrarSaida({
    produtoId: Number(id),
    quantidade,
    usuarioId: dados.usuario_id || null,
    observacao: dados.observacao || ''
  });


}



// ======================================
// RESERVAR PRODUTO
// ======================================

export async function reservar(id, quantidade, pedidoId = null) {


  quantidade =
    Number(quantidade);



  if (quantidade <= 0) {

    throw new Error(
      "Quantidade inválida."
    );

  }


  return await estoqueService.reservarEstoque({
    produtoId: Number(id),
    quantidade,
    pedidoId: pedidoId || null,
    usuarioId: null,
    observacao: 'Reserva via produtos módulo'
  });


}



// ======================================
// DEVOLVER PRODUTO
// ======================================

export async function devolver(id, quantidade) {


  quantidade =
    Number(quantidade);



  if (quantidade <= 0) {

    throw new Error(
      "Quantidade inválida."
    );

  }


  return await estoqueService.registrarDevolucao({
    produtoId: Number(id),
    quantidade,
    tipo: 'BOA',
    pedidoId: null,
    usuarioId: null,
    observacao: 'Devolução via produtos módulo'
  });


}



// ======================================
// ENVIAR PARA MANUTENÇÃO
// ======================================

export async function manutencao(id) {

  return await estoqueService.enviarParaManutencao({
    produtoId: Number(id),
    quantidade: 1,
    usuarioId: null,
    observacao: 'Envio para manutenção via produtos módulo'
  });


}



// ======================================
// FINALIZAR MANUTENÇÃO
// ======================================

export async function finalizarManutencao(id) {

  return await estoqueService.finalizarManutencao({
    produtoId: Number(id),
    quantidade: 1,
    status: 'REPARADO',
    usuarioId: null,
    observacao: 'Finalizar manutenção via produtos módulo'
  });


}