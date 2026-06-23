import * as model from "./clientes.model.js";

//lisatar 
export async function listar(dados) {
    return await model.findAll()
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