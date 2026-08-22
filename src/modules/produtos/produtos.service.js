import * as model from "./produtos.model.js";


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


  return await model.create({

    nome: dados.nome.trim(),

    codigo: dados.codigo || null,

    categoria: dados.categoria || null,

    tipo: dados.tipo || null,
    tipo_produto: dados.tipo_produto || 'PRODUTO',

    fornecedor_id:
      dados.fornecedor_id || null,


    estoque:
      Number(dados.estoque || 0),


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


  return await model.atualizar(
    id,
    {

      nome: dados.nome.trim(),

      codigo: dados.codigo || null,

      categoria: dados.categoria || null,

      tipo: dados.tipo || null,
      tipo_produto: dados.tipo_produto || 'PRODUTO',


      fornecedor_id:
        dados.fornecedor_id || null,


      estoque:
        Number(dados.estoque || 0),


      precoVenda:
        Number(dados.precoVenda || 0),


      precoAluguel:
        Number(dados.precoAluguel || 0),

      estoque_minimo:
        Number(dados.estoque_minimo || 0)

    }
  );


}



// ======================================
// EXCLUIR
// ======================================

export async function deletar(id) {

  return await model.excluir(id);

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

export async function historico() {

  return await model.historico();

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


  return await model.entradaEstoque(

    id,

    quantidade,

    dados.observacao || ""

  );


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


  return await model.saidaEstoque(

    id,

    quantidade,

    dados.observacao || ""

  );


}



// ======================================
// RESERVAR PRODUTO
// ======================================

export async function reservar(id, quantidade) {


  quantidade =
    Number(quantidade);



  if (quantidade <= 0) {

    throw new Error(
      "Quantidade inválida."
    );

  }


  return await model.reservar(

    id,

    quantidade

  );


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


  return await model.devolver(

    id,

    quantidade

  );


}



// ======================================
// ENVIAR PARA MANUTENÇÃO
// ======================================

export async function manutencao(id) {


  return await model.manutencao(id);


}



// ======================================
// FINALIZAR MANUTENÇÃO
// ======================================

export async function finalizarManutencao(id) {


  return await model.finalizarManutencao(id);


}