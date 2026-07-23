import * as service from "./pedidos.service.js";

/* Renderiza a página de pedidos.*/
export function listar(req, res) {
  res.render("pages/pedidos");
}

/*Busca clientes pelo nome ou termo informado.*/
export async function buscarClientes(req, res) {
  try {
    const termo = req.query.q || "";
    const dados = await service.buscarClientes(termo);

    res.json(dados);
  } catch (err) {
    console.error("ERRO BACKEND:", err);

    res.status(500).json({
      erro: err.message,
    });
  }
}

/*Cadastra um novo cliente.*/
export async function criarCliente(req, res) {
  try {
    const cliente = await service.criarCliente(req.body);
    res.status(201).json(cliente);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: err.message,
    });
  }
}

/* Busca produtos pelo termo informado.*/
export async function buscarProdutos(req, res) {
  const dados = await service.buscarProdutos(req.query.q);

  res.json(dados);
}

/* Cria um novo pedido.*/
export async function criar(req, res) {
  try {
    const resultado = await service.criarPedido(req.body);
    res.status(201).json(resultado);

  } catch (err) {
    console.error(err);
    res.status(400).json({
      erro: err.message,
    });
  }
}

/* Busca endereços utilizando os filtros informados.*/
export async function buscarEnderecos(req, res) {
  try {
    const filtros = {
      rua: (req.query.rua || "").trim(),
      numero: (req.query.numero || "").trim(),
      bairro: (req.query.bairro || "").trim(),
      cidade: (req.query.cidade || "").trim(),
      estado: (req.query.estado || "").trim(),
    };

    const dados = await service.buscarEnderecos(filtros);

    res.json(dados);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      erro: err.message,
    });
  }
}

/* Cadastra um novo endereço.*/
export async function criarEndereco(req, res) {
  try {
    const endereco = await service.criarEndereco(req.body);
    res.status(201).json(endereco);

  } catch (err) {
    console.error(err);
    res.status(400).json({
      erro: err.message,
    });
  }
}

/* Busca um pedido pelo ID.*/
export async function buscarPorId(req, res) {
  try {
    const { id } = req.params;
    const dados = await service.buscarPedidoPorId(id);

    if (!dados) {
      return res.status(404).json({
        erro: "Pedido não encontrado",
      });
    }

    res.json(dados);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      erro: err.message,
    });
  }
}