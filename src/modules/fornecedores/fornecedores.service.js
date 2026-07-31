import * as model from './fornecedores.model.js';


// VALIDAR DADOS DO FORNECEDOR
function validarFornecedor(dados) {
    if (!dados.nome?.trim()) {
        throw new Error("O nome da empresa é obrigatório.");
    }
    if (!dados.cnpj?.trim()) {
        throw new Error("O CNPJ/CPF é obrigatório.");
    }
    if (!dados.categoria?.trim()) {
        throw new Error("A categoria é obrigatória.");
    }
    if (!dados.telefone?.trim()) {
        throw new Error("O telefone é obrigatório.");
    }
    if (!dados.email?.trim()) {
        throw new Error("O e-mail é obrigatório.");
    }
    if (!dados.responsavel?.trim()) {
        throw new Error("O responsável é obrigatório.");
    }
    if (!dados.rua?.trim()) {
        throw new Error("O endereço é obrigatório.");
    }
    if (!dados.numero?.trim()) {
        throw new Error("O número do endereço é obrigatório.");
    }
    if (!dados.bairro?.trim()) {
        throw new Error("O bairro é obrigatório.");
    }
    if (!dados.cidade?.trim()) {
        throw new Error("A cidade é obrigatória.");
    }
    if (!dados.estado?.trim()) {
        throw new Error("O estado é obrigatório.");
    }
    if (!dados.cep?.trim()) {
        throw new Error("O CEP é obrigatório.");
    }
    if (!dados.produtos?.trim()) {
        throw new Error(
            "Informe os produtos ou serviços."
        );
    }
    if (dados.nome.length > 150) {
        throw new Error(
            "O nome da empresa deve ter no máximo 150 caracteres."
        );
    }
    if (dados.responsavel.length > 100) {
        throw new Error(
            "O responsável deve ter no máximo 100 caracteres."
        );
    }
    if (dados.email.length > 150) {
        throw new Error(
            "O e-mail deve ter no máximo 150 caracteres."
        );
    }
    if (dados.observacoes?.length > 500) {
        throw new Error(
            "As observações devem ter no máximo 500 caracteres."
        );
    }

    const emailRegex =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dados.email)) {
        throw new Error("Informe um e-mail válido.");
    }

    const telefone = dados.telefone.replace(/\D/g, "");
    if (
        telefone.length < 10 ||
        telefone.length > 11
    ) {
        throw new Error("Telefone inválido.");
    }

    const documento = dados.cnpj.replace(/\D/g, "");
    if (
        documento.length !== 11 &&
        documento.length !== 14
    ) {
        throw new Error("CNPJ/CPF inválido.");
    }

    // CATEGORIAS PERMITIDAS
    const categorias = [
        "Alimentos",
        "Bebidas",
        "Decoração",
        "Equipamentos",
        "Transporte"
    ];

    if (!categorias.includes(dados.categoria)) {
        throw new Error(
            "Categoria inválida."
        );
    }

    // STATUS
    if (dados.status) {
        const statusPermitidos = [
            "Ativo",
            "Inativo"
        ];

        if (!statusPermitidos.includes(dados.status)) {
            throw new Error("Status inválido.");
        }
    }

    // LIMPEZA DOS DADOS
    return {
        ...dados,
        nome:dados.nome.trim(),
        cnpj:dados.cnpj.trim(),
        responsavel:dados.responsavel.trim(),
        categoria:dados.categoria.trim(),
        telefone:dados.telefone.trim(),
        whatsapp:dados.whatsapp?.trim() || null,
        email:dados.email.trim().toLowerCase(),
        site:dados.site?.trim() || null,
        rua:dados.rua.trim(),
        numero:dados.numero.trim(),
        bairro:dados.bairro.trim(),
        cidade:dados.cidade.trim(),
        estado:dados.estado.trim().toUpperCase(),
        cep:dados.cep.trim(),
        produtos:dados.produtos.trim(),
        entrega:dados.entrega?.trim() || null,
        pagamento:dados.pagamento?.trim() || null,
        observacoes:dados.observacoes?.trim() || null
    };
}

// LISTAR FORNECEDORES
export async function listar(query = {}) {
    return await model.buscarFornecedores(query);
}

// BUSCAR POR ID
export async function buscarPorId(id) {

    if (!id) {
        throw new Error("ID do fornecedor inválido.");
    }

    const fornecedor = await model.buscarFornecedorPorId(id);

    if (!fornecedor) {
        throw new Error("Fornecedor não encontrado.");
    }

    return fornecedor;
}

// CADASTRAR FORNECEDOR
export async function criar(dados) {

    const fornecedor = validarFornecedor(dados);

    return await model.criarFornecedor(fornecedor);
}

// ATUALIZAR FORNECEDOR
export async function atualizar(id, dados) {

    const fornecedorExistente =await model.buscarFornecedorPorId(id);

    if (!fornecedorExistente) {
        throw new Error("Fornecedor não encontrado.");
    }

    const fornecedor = validarFornecedor(dados);

    return await model.atualizarFornecedor(id,fornecedor);
}

// EXCLUIR FORNECEDOR
export async function excluir(id) {

    const fornecedor = await model.buscarFornecedorPorId(id);

    if (!fornecedor) {throw new Error("Fornecedor não encontrado.");}

    return await model.excluirFornecedor(id);
}