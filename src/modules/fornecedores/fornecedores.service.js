import * as model from './fornecedores.model.js';

/* ==========================================================
   LISTAR FORNECEDORES
========================================================== */
export async function listar(query = {}) {
    return await model.buscarFornecedores(query);
}

/* ==========================================================
   BUSCAR POR ID
========================================================== */
export async function buscarPorId(id) {

    const fornecedor = await model.buscarFornecedorPorId(id);

    if (!fornecedor) {
        throw new Error("Fornecedor não encontrado.");
    }

    return fornecedor;
}

/* ==========================================================
   CADASTRAR
========================================================== */
export async function criar(dados) {

    if (!dados.name?.trim()) {
        throw new Error("O nome é obrigatório.");
    }

    if (!dados.cnpj?.trim()) {
        throw new Error("O CNPJ/CPF é obrigatório.");
    }

    if (!dados.category?.trim()) {
        throw new Error("A categoria é obrigatória.");
    }

    if (!dados.phone?.trim()) {
        throw new Error("O telefone é obrigatório.");
    }

    if (!dados.email?.trim()) {
        throw new Error("O e-mail é obrigatório.");
    }

    return await model.criarFornecedor(dados);
}

/* ==========================================================
   ATUALIZAR
========================================================== */
export async function atualizar(id, dados) {

    const fornecedor = await model.buscarFornecedorPorId(id);

    if (!fornecedor) {
        throw new Error("Fornecedor não encontrado.");
    }

    if (!dados.name?.trim()) {
        throw new Error("O nome é obrigatório.");
    }

    if (!dados.cnpj?.trim()) {
        throw new Error("O CNPJ/CPF é obrigatório.");
    }

    if (!dados.category?.trim()) {
        throw new Error("A categoria é obrigatória.");
    }

    if (!dados.phone?.trim()) {
        throw new Error("O telefone é obrigatório.");
    }

    if (!dados.email?.trim()) {
        throw new Error("O e-mail é obrigatório.");
    }

    return await model.atualizarFornecedor(id, dados);
}

/* ==========================================================
   EXCLUIR
========================================================== */
export async function excluir(id) {

    const fornecedor = await model.buscarFornecedorPorId(id);

    if (!fornecedor) {
        throw new Error("Fornecedor não encontrado.");
    }

    return await model.excluirFornecedor(id);
}