import * as model from "./clientes.model.js";


 //Valida o formato do e-mail.
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


 //Aceita telefones com 10 ou 11 dígitos.

function validarTelefone(telefone) {
  if (!telefone) return true;

  const numeros = telefone.replace(/\D/g, "");

  return numeros.length >= 10 && numeros.length <= 11;
}

//Verifica se a data de nascimento é válida.

function validarNascimento(data) {
  if (!data) return true;

  const nascimento = new Date(data);

  if (isNaN(nascimento.getTime())) {
    return false;
  }

  return nascimento <= new Date();
}


//LISTAR CLIENTES


export async function listar(options) {

  // Busca com paginação
  if (
    options &&
    (
      options.q !== undefined ||
      options.page !== undefined ||
      options.limit !== undefined
    )
  )
  {
    const q = options.q || "";
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;

    const { rows, total } = await model.findWithFilter({
      q,
      page,
      limit
    });

    return {
      clientes: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  return await model.findAll();
}


  //CRIAR CLIENTE
export async function criar(dados) {

  //Padronização dos dados
  dados.nome = dados.nome?.trim();
  dados.email = dados.email?.trim().toLowerCase();
  dados.telefone = dados.telefone?.trim();
  dados.cpf = dados.cpf?.trim();

  //Nome
  if (!dados.nome) {
    throw new Error("O nome é obrigatório.");
  }

  if (dados.nome.length < 3) {
    throw new Error("O nome deve possuir no mínimo 3 caracteres.");
  }

  if (dados.nome.length > 100) {
    throw new Error("O nome deve possuir no máximo 100 caracteres.");
  }

  //Email
  if (!dados.email) {
    throw new Error("O e-mail é obrigatório.");
  }

  if (!validarEmail(dados.email)) {
    throw new Error("Informe um e-mail válido.");
  }
  
  //CPF(duplicidade)
  if (dados.cpf) {

    const cpfExiste = await model.buscarPorCPF(dados.cpf);

    if (cpfExiste) {
      throw new Error("Já existe um cliente com este CPF.");
    }

  }

  //Telefone
  if (!validarTelefone(dados.telefone)) {
    throw new Error("Telefone inválido.");
  }

  
  //Data de nascimento
  if (!validarNascimento(dados.nascimento)) {
    throw new Error("Data de nascimento inválida.");
  }

  //Endereço
  if (!dados.rua) {
    throw new Error("A rua é obrigatória.");
  }

  if (!dados.numero) {
    throw new Error("O número é obrigatório.");
  }

  if (!dados.cidade) {
    throw new Error("A cidade é obrigatória.");
  }

  if (!dados.estado) {
    throw new Error("O estado é obrigatório.");
  }

  //Cria endereço
  const idEndereco = await model.criarEndereco({
    rua: dados.rua,
    numero: Number(dados.numero),
    cidade: dados.cidade,
    estado: dados.estado
  });

 
  //Cria cliente
  return await model.criarCliente({
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    cpf: dados.cpf || null,
    nascimento: dados.nascimento || null,
    id_endereco: idEndereco
  });

}

  //BUSCAR CLIENTE POR ID
export async function findById(id) {

  return await model.findById(id);
}

  //ATUALIZAR CLIENTE
export async function atualizar(id, dados) {
 
  //Busca cliente
  const cliente = await model.findById(id);

  if (!cliente) {
    throw new Error("Cliente não encontrado.");
  }

  //Padronização
  dados.nome = dados.nome?.trim();
  dados.email = dados.email?.trim().toLowerCase();
  dados.telefone = dados.telefone?.trim();
  dados.cpf = dados.cpf?.trim();

  
  //Nome
  if (!dados.nome) {
    throw new Error("O nome é obrigatório.");
  }

  if (dados.nome.length < 3) {
    throw new Error("O nome deve possuir no mínimo 3 caracteres.");
  }

  
  //Email
  if (!dados.email) {
    throw new Error("O e-mail é obrigatório.");
  }

  if (!validarEmail(dados.email)) {
    throw new Error("Informe um e-mail válido.");
  }

  //CPF(somente duplicidade)
  if (dados.cpf) {
    const cpfExiste = await model.buscarPorCPF(dados.cpf);

    if (cpfExiste && cpfExiste.id !== Number(id)) {
      throw new Error("Já existe outro cliente utilizando este CPF.");
    }

  }

  //Telefone
  if (!validarTelefone(dados.telefone)) {
    throw new Error("Telefone inválido.");
  }

  //Data nascimento
  if (!validarNascimento(dados.nascimento)) {
    throw new Error("Data de nascimento inválida.");
  }

  //Endereço
  if (!dados.rua) {
    throw new Error("A rua é obrigatória.");
  }

  if (!dados.numero) {
    throw new Error("O número é obrigatório.");
  }

  if (!dados.cidade) {
    throw new Error("A cidade é obrigatória.");
  }

  if (!dados.estado) {
    throw new Error("O estado é obrigatório.");
  }

  
  //Atualiza endereço
  let id_endereco = cliente.id_endereco;

  if (id_endereco) {
    await model.atualizarEndereco(id_endereco, {
      rua: dados.rua,
      numero: dados.numero,
      cidade: dados.cidade,
      estado: dados.estado
    });

  } else {
    id_endereco = await model.criarEndereco({
      rua: dados.rua,
      numero: dados.numero,
      cidade: dados.cidade,
      estado: dados.estado
    });

  }

  //Atualiza cliente
  
  await model.atualizarCliente(id, {
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    cpf: dados.cpf,
    nascimento: dados.nascimento,
    id_endereco
  });

  return true;
}

  //EXCLUIR CLIENTE

export async function deletar(id) {

  const cliente = await model.findById(id);

  if (!cliente) {
    throw new Error("Cliente não encontrado.");
  }

  await model.excluir(id);

  return true;
}