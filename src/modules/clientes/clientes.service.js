import * as model from "./clientes.model.js";

const estadosValidos = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

function erroCliente(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function texto(value) {
    return typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
}

function validarTelefone(telefone) {
    if (!telefone) return true;
    const digits = telefone.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11 && telefone.length <= 20;
}

function validarCpf(cpf) {
    if (!cpf) return true;
    return cpf.replace(/\D/g, "").length === 11 && cpf.length <= 20;
}

function validarNascimento(data) {
    if (!data) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const [ano, mes, dia] = data.split("-").map(Number);
    const nascimento = new Date(Date.UTC(ano, mes - 1, dia));
    if (
        nascimento.getUTCFullYear() !== ano ||
        nascimento.getUTCMonth() !== mes - 1 ||
        nascimento.getUTCDate() !== dia
    ) return false;

    const hoje = new Date();
    const hojeAno = hoje.getFullYear();
    const hojeMes = hoje.getMonth() + 1;
    const hojeDia = hoje.getDate();
    if (
        ano > hojeAno ||
        (ano === hojeAno && mes > hojeMes) ||
        (ano === hojeAno && mes === hojeMes && dia > hojeDia)
    ) return false;

    let idade = hojeAno - ano;
    if (hojeMes < mes || (hojeMes === mes && hojeDia < dia)) idade--;
    return idade >= 18 && idade <= 120;
}

function validarEnderecoNumero(numero) {
    if (numero.length > 10 || !/^[\p{L}\d\s./-]+$/u.test(numero)) return false;
    return !/^\d+$/.test(numero) || Number(numero) > 0;
}

function prepararDados(dados = {}) {
    return {
        nome: texto(dados.nome),
        email: texto(dados.email).toLowerCase(),
        telefone: texto(dados.telefone),
        cpf: texto(dados.cpf).replace(/\D/g, ""),
        nascimento: texto(dados.nascimento),
        rua: texto(dados.rua),
        numero: texto(dados.numero),
        bairro: texto(dados.bairro),
        cidade: texto(dados.cidade),
        estado: texto(dados.estado).toUpperCase(),
        cep: texto(dados.cep),
        referencia: texto(dados.referencia)
    };
}

function validarDados(dados) {
    if (dados.nome.length < 3 || dados.nome.length > 100 ||
        !/^[\p{L}\s'.-]+$/u.test(dados.nome)) {
        throw erroCliente("Informe um nome válido (de 3 a 100 caracteres).");
    }

    if (dados.email.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
        throw erroCliente("Informe um e-mail válido.");
    }

    if (!validarCpf(dados.cpf)) {
        throw erroCliente("Informe um CPF válido com 11 números.");
    }

    if (!validarTelefone(dados.telefone)) {
        throw erroCliente("Informe um telefone válido.");
    }

    if (!validarNascimento(dados.nascimento)) {
        throw erroCliente("A data de nascimento deve corresponder a uma idade entre 18 e 120 anos.");
    }

    if (dados.rua.length < 3 || dados.rua.length > 150) {
        throw erroCliente("Informe uma rua válida.");
    }

    if (!validarEnderecoNumero(dados.numero)) {
        throw erroCliente("Informe um número de endereço válido.");
    }

    if (dados.bairro.length > 100 ||
        dados.cidade.length < 2 || dados.cidade.length > 100 ||
        !/^[\p{L}\s'.-]+$/u.test(dados.cidade)) {
        throw erroCliente("Informe uma cidade válida.");
    }

    if (!estadosValidos.has(dados.estado)) {
        throw erroCliente("Informe uma sigla de estado válida.");
    }

    if (dados.cep && (!/^[\d-]+$/.test(dados.cep) ||
        dados.cep.replace(/\D/g, "").length !== 8 || dados.cep.length > 12)) {
        throw erroCliente("Informe um CEP válido.");
    }

    if (dados.referencia.length > 150) {
        throw erroCliente("A referência do endereço deve ter no máximo 150 caracteres.");
    }

    return {
        ...dados,
        cpf: dados.cpf || null,
        nascimento: dados.nascimento || null,
        cep: dados.cep || null,
        bairro: dados.bairro || null,
        referencia: dados.referencia || null
    };
}

function validarId(id) {
    if (!/^\d+$/.test(String(id)) || Number(id) < 1) {
        throw erroCliente("Cliente não encontrado.", 404);
    }
    return Number(id);
}

export async function listar(options = {}) {
    const q = texto(options.q);
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const requestedLimit = parseInt(options.limit, 10) || 10;
    const limit = [10, 25, 50].includes(requestedLimit) ? requestedLimit : 10;
    const { rows, total } = await model.findWithFilter({ q, page, limit });

    return {
        clientes: rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
    };
}

export async function criar(input) {
    const dados = validarDados(prepararDados(input));
    const existente = await model.buscarPorCPF(dados.cpf);
    if (existente) {
        throw erroCliente("Já existe um cliente com este CPF.", 409);
    }
    return model.criarClienteComEndereco(dados);
}

export async function findById(id) {
    return model.findById(validarId(id));
}

export async function atualizar(id, input) {
    const clienteId = validarId(id);
    const cliente = await model.findById(clienteId);
    if (!cliente) throw erroCliente("Cliente não encontrado.", 404);

    const dados = validarDados(prepararDados(input));
    const existente = await model.buscarPorCPF(dados.cpf);
    if (existente && Number(existente.id) !== clienteId) {
        throw erroCliente("Já existe outro cliente utilizando este CPF.", 409);
    }
    return model.atualizarClienteComEndereco(clienteId, dados, cliente.id_endereco);
}

export async function deletar(id) {
    const clienteId = validarId(id);
    const cliente = await model.findById(clienteId);
    if (!cliente) throw erroCliente("Cliente não encontrado.", 404);

    try {
        await model.excluir(clienteId);
    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            throw erroCliente("Este cliente possui pedidos cadastrados e não pode ser excluído.", 409);
        }
        throw error;
    }
}
