import * as model from "./clientes.model.js";

/* SANITIZAÇÃO */
function sanitizarTexto(texto) {

    if (!texto) return "";
    return texto
}

/* E-MAIL*/
function validarEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* NOME */
function validarNome(nome) {

    return /^[A-Za-zÀ-ÿ\s']+$/.test(nome);
}

/* TELEFONE */
function validarTelefone(telefone) {
    if (!telefone) return true;
    const numeros = telefone.replace(/\D/g, "");

    return numeros.length >= 10 && numeros.length <= 11;
}

/* CEP */
function validarCEP(cep) {
    if (!cep) return true;
    cep = cep.replace(/\D/g, "");

    return cep.length === 8;
}

/* DATA DE NASCIMENTO */
function validarNascimento(data) {
    if (!data) return true;
    const nascimento = new Date(data);

    if (isNaN(nascimento.getTime())) {
        return false;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (nascimento > hoje) {
        return false;
    }

    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();

    if (
        mes < 0 ||(mes === 0 && hoje.getDate() < nascimento.getDate())
    ) {
        idade--;
    }

    return idade >= 18 && idade <= 120;
}

/* ESTADOS */
const estadosValidos = [

    "AC","AL","AP","AM","BA","CE","DF",
    "ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ",
    "RN","RS","RO","RR","SC","SP",
    "SE","TO"
];

function validarEstado(estado) {

    return estadosValidos.includes(estado.toUpperCase());
}

/* NÚMERO DO ENDEREÇO */
function validarNumero(numero) {

    numero = Number(numero);
    return (Number.isInteger(numero) &&numero > 0);

}

/* RUA */
function validarRua(rua) {

  if (!rua) return false;

  return (
    rua.length >= 3 &&
    rua.length <= 120
  );
}

/* CIDADE */
function validarCidade(cidade) {

  if (!cidade) return false;

  if (cidade.length < 3) {
    return false;
  }

  return /^[A-Za-zÀ-ÿ\s]+$/.test(cidade);
}

/* PREPARAÇÃO DOS DADOS */
function prepararDados(dados) {

    dados.nome = sanitizarTexto(dados.nome);
    dados.email = sanitizarTexto(dados.email).toLowerCase();
    dados.telefone = sanitizarTexto(
    dados.telefone);
    dados.cpf = sanitizarTexto(dados.cpf);
    dados.rua = sanitizarTexto(
    dados.rua);
    dados.numero = sanitizarTexto(dados.numero);
    dados.cidade = sanitizarTexto(dados.cidade);
    dados.estado = sanitizarTexto(dados.estado).toUpperCase();
    dados.cep = sanitizarTexto(dados.cep);

    return dados;
}
/* LISTAR CLIENTES */

export async function listar(options) {
    if (
        options &&
        (
            options.q !== undefined ||
            options.page !== undefined ||
            options.limit !== undefined
        )
    ) {
        const q = options.q || "";
        const page = Number(options.page) || 1;
        const limit = Number(options.limit) || 10;
        const { rows, total } = await model.findWithFilter({q,page,limit});

        return {
            clientes: rows,
            total,
            page,
            limit,
            totalPages: Math.max(1,Math.ceil(total / limit))
        };
    }

    return await model.findAll();
}

/* CRIAR CLIENTE */
export async function criar(dados) {

    prepararDados(dados);

    /* NOME */
    if (!dados.nome) {
        throw new Error("O nome é obrigatório.");
    }

    if (dados.nome.length < 3) {
        throw new Error(
            "O nome deve possuir no mínimo 3 caracteres."
        );
    }

    if (dados.nome.length > 100) {
        throw new Error(
            "O nome deve possuir no máximo 100 caracteres."
        );
    }

    if (!validarNome(dados.nome)) {
        throw new Error(
            "O nome deve conter apenas letras e espaços."
        );
    }

    /* E-MAIL */
    if (!dados.email) {
        throw new Error("O e-mail é obrigatório.");
    }
    if (!validarEmail(dados.email)) {
        throw new Error("Informe um e-mail válido.");
    }

    /* CPF */
    if (dados.cpf) {

        const cpfExiste = await model.buscarPorCPF(dados.cpf);

        if (cpfExiste) {throw new Error("Já existe um cliente com este CPF");}
    }

    /* TELEFONE */
    if (!validarTelefone(dados.telefone)) {
        throw new Error("Telefone inválido.");
    }

    /* DATA DE NASCIMENTO */
    if (!validarNascimento(dados.nascimento)) {
        throw new Error(
            "O cliente deve possuir entre 18 e 120 anos."
        );
    }

    /* RUA */
    if (!validarRua(dados.rua)) {
        throw new Error(
            "Informe uma rua válida."
        );
    }

    /* NÚMERO */
    if (!validarNumero(dados.numero)) {
        throw new Error(
            "Informe um número de endereço válido."
        );
    }

    /* CIDADE */
    if (!validarCidade(dados.cidade)) {
        throw new Error(
            "Informe uma cidade válida."
        );
    }

    /* ESTADO */
    if (!validarEstado(dados.estado)) {
        throw new Error("Estado inválido.");
    }

    /* CEP */
    if (!validarCEP(dados.cep)) {
        throw new Error("CEP inválido.");
    }

    /* CRIA ENDEREÇO */
    const idEndereco =
        await model.criarEndereco({

            rua: dados.rua,
            numero: Number(dados.numero),
            cidade: dados.cidade,
            estado: dados.estado,
            cep: dados.cep
        }
    );

    /* CRIA CLIENTE */
    return await model.criarCliente({

        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        cpf: dados.cpf || null,
        nascimento: dados.nascimento || null,
        id_endereco: idEndereco
    });
}

/* BUSCAR CLIENTE */
export async function findById(id) {

    return await model.findById(id);
}

/* ATUALIZAR CLIENTE */
export async function atualizar(id, dados) {
    const cliente =await model.findById(id);

    if (!cliente) {
        throw new Error("Cliente não encontrado.");
    }

    prepararDados(dados);

    /* NOME */
    if (!dados.nome) {
        throw new Error("O nome é obrigatório.");
    }

    if (dados.nome.length < 3) {
        throw new Error(
            "O nome deve possuir no mínimo 3 caracteres."
        );
    }

    if (dados.nome.length > 100) {
        throw new Error(
            "O nome deve possuir no máximo 100 caracteres."
        );
    }

    if (!validarNome(dados.nome)) {
        throw new Error(
            "O nome deve conter apenas letras e espaços."
        );
    }

    /* E-MAIL */
    if (!dados.email) {
        throw new Error("O e-mail é obrigatório.");
    }

    if (!validarEmail(dados.email)) {
        throw new Error("Informe um e-mail válido.");
    }

    /* CPF */
    if (dados.cpf) {

        const cpfExiste =await model.buscarPorCPF(dados.cpf);

        if (cpfExiste &&
            cpfExiste.id !== Number(id)
        ) {
            throw new Error(
                "Já existe outro cliente utilizando este CPF."
            );
        }
    }

    /* TELEFONE */
    if (!validarTelefone(dados.telefone)) {
        throw new Error("Telefone inválido.");
    }

    /* DATA DE NASCIMENTO */
    if (!validarNascimento(dados.nascimento)) {
        throw new Error(
            "O cliente deve possuir entre 18 e 120 anos."
        );
    }

    /* RUA */
    if (!validarRua(dados.rua)) {
        throw new Error(
            "Informe uma rua válida."
        );
    }

    /* NÚMERO */
    if (!validarNumero(dados.numero)) {
        throw new Error(
            "Informe um número de endereço válido."
        );
    }

    /* CIDADE */
    if (!validarCidade(dados.cidade)) {
        throw new Error(
            "Informe uma cidade válida."
        );
    }

    /* ESTADO */
    if (!validarEstado(dados.estado)) {
        throw new Error("Estado inválido.");
    }

    /* CEP */
    if (!validarCEP(dados.cep)) {
        throw new Error("CEP inválido.");
    }

    /* ATUALIZA ENDEREÇO */
    let id_endereco = cliente.id_endereco;

    if (id_endereco) {await model.atualizarEndereco(id_endereco,{

                rua: dados.rua,
                numero: Number(dados.numero),
                cidade: dados.cidade,
                estado: dados.estado,
                cep: dados.cep
            }
        );

    } else {

        id_endereco = await model.criarEndereco({

            rua: dados.rua,
            numero: Number(dados.numero),
            cidade: dados.cidade,
            estado: dados.estado,
            cep: dados.cep
        });
    }

    /* ATUALIZA CLIENTE */
    await model.atualizarCliente(id,{
            nome: dados.nome,
            email: dados.email,
            telefone: dados.telefone,
            cpf: dados.cpf,
            nascimento: dados.nascimento,
            id_endereco
        }
    );

    return true;
}

/* EXCLUIR CLIENTE */
export async function deletar(id) {

    const cliente = await model.findById(id);

    if (!cliente) {throw new Error("Cliente não encontrado.");}
    try {

        await model.excluir(id);

    } catch (err) {
        if (err.code === "ER_ROW_IS_REFERENCED_2") {
            throw new Error(
                "Este cliente possui pedidos cadastrados e não pode ser excluído."
            );
        }
        throw err;
    }
}