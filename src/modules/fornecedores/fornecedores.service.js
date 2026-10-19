import * as model from "./fornecedores.model.js";

const categorias = ["Alimentos", "Bebidas", "Decoração", "Equipamentos", "Transporte"];
const statusPermitidos = ["Ativo", "Inativo"];
const camposFornecedor = [
  "nome", "cnpj", "responsavel", "categoria", "telefone", "whatsapp", "email", "site",
  "rua", "numero", "bairro", "cidade", "estado", "cep", "produtos", "entrega",
  "pagamento", "observacoes", "status"
];
const camposObrigatorios = [
  ["nome", "O nome da empresa é obrigatório."],
  ["cnpj", "O CNPJ/CPF é obrigatório."],
  ["categoria", "A categoria é obrigatória."],
  ["telefone", "O telefone é obrigatório."],
  ["email", "O e-mail é obrigatório."],
  ["responsavel", "O responsável é obrigatório."],
  ["rua", "O endereço é obrigatório."],
  ["numero", "O número do endereço é obrigatório."],
  ["bairro", "O bairro é obrigatório."],
  ["cidade", "A cidade é obrigatória."],
  ["estado", "O estado é obrigatório."],
  ["cep", "O CEP é obrigatório."],
  ["produtos", "Informe os produtos ou serviços."]
];

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function validarId(id) {
  const valor = String(id ?? "");
  if (!/^[1-9]\d*$/.test(valor)) {
    throw new Error("ID do fornecedor inválido.");
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) throw new Error("ID do fornecedor inválido.");
  return numero;
}

function validarFornecedor(dados, statusPadrao = "Ativo") {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new Error("Dados do fornecedor inválidos.");
  }
  if (dados.status !== undefined && dados.status !== null && typeof dados.status !== "string") {
    throw new Error("Status inválido.");
  }

  const valores = Object.fromEntries(
    camposFornecedor.map((campo) => [campo, texto(dados[campo])])
  );

  for (const [campo, mensagem] of camposObrigatorios) {
    if (!valores[campo]) throw new Error(mensagem);
  }

  const limites = {
    nome: 150,
    cnpj: 25,
    responsavel: 100,
    categoria: 100,
    telefone: 30,
    whatsapp: 30,
    email: 150,
    site: 200,
    rua: 150,
    numero: 20,
    bairro: 100,
    cidade: 100,
    estado: 2,
    cep: 15,
    entrega: 100,
    pagamento: 100,
    observacoes: 500
  };
  for (const [campo, limite] of Object.entries(limites)) {
    if (valores[campo].length > limite) {
      throw new Error(`O campo ${campo} deve ter no máximo ${limite} caracteres.`);
    }
  }

  if (!categorias.includes(valores.categoria)) {
    throw new Error("Categoria inválida.");
  }

  const status = valores.status || statusPadrao;
  if (!statusPermitidos.includes(status)) {
    throw new Error("Status inválido.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(valores.email)) throw new Error("Informe um e-mail válido.");

  if (!/^[\d().\s+/-]+$/.test(valores.telefone)) {
    throw new Error("Telefone inválido.");
  }
  const telefone = valores.telefone.replace(/\D/g, "");
  if (telefone.length < 10 || telefone.length > 11) throw new Error("Telefone inválido.");

  if (valores.whatsapp) {
    if (!/^[\d().\s+/-]+$/.test(valores.whatsapp)) {
      throw new Error("WhatsApp inválido.");
    }
    const whatsapp = valores.whatsapp.replace(/\D/g, "");
    if (whatsapp.length < 10 || whatsapp.length > 11) throw new Error("WhatsApp inválido.");
  }

  if (!/^[\d./\-\s]+$/.test(valores.cnpj)) throw new Error("CNPJ/CPF inválido.");
  const documento = valores.cnpj.replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) {
    throw new Error("CNPJ/CPF inválido.");
  }

  if (!/^[A-Za-z]{2}$/.test(valores.estado)) {
    throw new Error("Informe uma sigla de estado válida.");
  }
  if (!/^\d{5}-?\d{3}$/.test(valores.cep)) throw new Error("CEP inválido.");

  return {
    nome: valores.nome,
    cnpj: valores.cnpj,
    responsavel: valores.responsavel,
    categoria: valores.categoria,
    telefone: valores.telefone,
    whatsapp: valores.whatsapp || null,
    email: valores.email.toLowerCase(),
    site: valores.site || null,
    rua: valores.rua,
    numero: valores.numero,
    bairro: valores.bairro,
    cidade: valores.cidade,
    estado: valores.estado.toUpperCase(),
    cep: valores.cep,
    produtos: valores.produtos,
    entrega: valores.entrega || null,
    pagamento: valores.pagamento || null,
    observacoes: valores.observacoes || null,
    status
  };
}

function validarFiltros(query = {}) {
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const categoria = typeof query.categoria === "string" ? query.categoria : "";
  const status = typeof query.status === "string" ? query.status : "";
  if (categoria && !categorias.includes(categoria)) throw new Error("Categoria inválida.");
  if (status && !statusPermitidos.includes(status)) throw new Error("Status inválido.");
  return { q, categoria, status };
}

export async function listar(query = {}) {
  return model.buscarFornecedores(validarFiltros(query));
}

export async function buscarPorId(id) {
  const fornecedor = await model.buscarFornecedorPorId(validarId(id));
  if (!fornecedor) throw new Error("Fornecedor não encontrado.");
  return fornecedor;
}

export async function criar(dados) {
  const fornecedor = validarFornecedor(dados);
  const duplicado = await model.buscarPorDocumento(fornecedor.cnpj);
  if (duplicado) throw new Error("Já existe um fornecedor cadastrado com este CNPJ/CPF.");
  return model.criarFornecedor(fornecedor);
}

export async function atualizar(id, dados) {
  const fornecedorId = validarId(id);
  const existente = await model.buscarFornecedorPorId(fornecedorId);
  if (!existente) throw new Error("Fornecedor não encontrado.");

  const fornecedor = validarFornecedor(dados, existente.status || "Ativo");
  const duplicado = await model.buscarPorDocumento(fornecedor.cnpj, fornecedorId);
  if (duplicado) throw new Error("Já existe um fornecedor cadastrado com este CNPJ/CPF.");

  const atualizado = await model.atualizarFornecedor(fornecedorId, fornecedor);
  if (!atualizado) throw new Error("Fornecedor não encontrado.");
  return atualizado;
}

export async function excluir(id) {
  const fornecedorId = validarId(id);
  const fornecedor = await model.buscarFornecedorPorId(fornecedorId);
  if (!fornecedor) throw new Error("Fornecedor não encontrado.");

  const excluido = await model.excluirFornecedor(fornecedorId);
  if (!excluido) throw new Error("Fornecedor não encontrado.");
  return excluido;
}
