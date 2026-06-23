import * as service from "./pedidos.service.js";

export function listar(req, res) {
  res.render("pages/pedidos");
}

export async function buscarClientes(req, res) {
  try {
    const termo = req.query.q || "";
    const dados = await service.buscarClientes(termo);
    res.json(dados);
  } catch (err) {
    console.error("ERRO BACKEND:", err);
    res.status(500).json({ erro: err.message });
  }
}

export async function criarCliente(req, res) {
  try {

    const cliente = await service.criarCliente(req.body);

    res.status(201).json(cliente);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }
}

export async function buscarProdutos(req, res) {
  const dados = await service.buscarProdutos(req.query.q);
  res.json(dados);
}

export async function criar(req, res) {
  try {

    const resultado =
      await service.criarPedido(req.body);

    res.status(201).json(resultado);

  } catch (erro) {

    console.error(erro);

    res.status(400).json({
      erro: erro.message
    });

  }
}
export async function buscarEnderecos(req, res) {
  try {
    const filtros = {
      rua: (req.query.rua || '').trim(),
      numero: (req.query.numero || '').trim(),
      bairro: (req.query.bairro || '').trim(),
      cidade: (req.query.cidade || '').trim(),
      estado: (req.query.estado || '').trim()
    };

    const dados = await service.buscarEnderecos(filtros);

    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
}
export async function criarEndereco(req, res) {
  try {
    const endereco = await service.criarEndereco(req.body);
    res.status(201).json(endereco);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
}