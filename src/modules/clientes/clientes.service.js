import * as model from "./clientes.model.js";

//lisatar 
export async function listar(options) {
  // Se foram passados parâmetros, usa busca com filtro e paginação
  if (options && (options.q !== undefined || options.page !== undefined || options.limit !== undefined)) {
    const q = options.q || "";
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;

    const { rows, total } = await model.findWithFilter({ q, page, limit });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { clientes: rows, total, page, limit, totalPages };
  }

  // comportamento antigo (retorna array) quando sem opções
  return await model.findAll();
}

//criar
export async function criar(dados) {
  if (!dados.nome || !dados.email) {
    throw new Error("Nome e email são obrigatórios");
  }

  //Inserir o endereço e pegar o id
  const idEndereco = await model.criarEndereco({
    rua: dados.rua,
    numero: Number(dados.numero),
    cidade: dados.cidade,
    estado: dados.estado
  });

 const cliente = await model.criarCliente({
  nome: dados.nome,
  email: dados.email,
  telefone: dados.telefone,
  cpf: dados.cpf || null,                 // 🔥 evita erro
  nascimento: dados.nascimento || null,   // 🔥 evita erro
  id_endereco: idEndereco
});

  return cliente;
}

//editar
export async function findById(id) {
  return await model.findById(id);
}
export async function atualizar(id, dados) {
  const { nome, email, telefone, cpf, nascimento, rua, numero, cidade, estado } = dados;

  // busca cliente atual
  const cliente = await model.findById(id);

  let id_endereco = cliente.id_endereco;

  if (id_endereco) {
    await model.atualizarEndereco(id_endereco, { rua, numero, cidade, estado });
  } else {
    id_endereco = await model.criarEndereco({ rua, numero, cidade, estado });
  }

  await model.atualizarCliente(id, {
    nome,
    email,
    telefone,
    cpf,
    nascimento,
    id_endereco
  });

  return true; // 🔥 ADICIONA ISSO
}

export async function deletar(id) {
  return await model.excluir(id);
}