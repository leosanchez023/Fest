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
    res.status(err.code ? 500 : 400).json({
      erro: err.code ? "Não foi possível concluir o cadastro do cliente." : err.message,
    });
  }
}

/* Busca produtos pelo termo informado.*/
export async function buscarProdutos(req, res) {
  const dados = await service.buscarProdutos(req.query.q);

  res.json(dados);
}

export async function buscarItens(req, res) {
  try {
    const dados = await service.buscarItens(req.query.q || "");
    res.json(dados);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
}

/* Cria um novo pedido.*/
export async function criar(req, res) {
  try {
    const resultado = await service.criarPedido({ ...req.body, usuario_id: req.user?.id || null });
    res.status(201).json(resultado);

  } catch (err) {
    console.error(err);
    res.status(err.code ? 500 : 400).json({
      erro: err.code ? 'Não foi possível concluir a operação.' : err.message,
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
      cep: (req.query.cep || "").trim(),
      referencia: (req.query.referencia || "").trim(),
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

export async function buscarSugestoesEndereco(req, res) {
  try {
    const resultados = await service.buscarSugestoesEndereco(
      req.query.q,
      {
        cidade: req.query.cidade,
        estado: req.query.estado,
        bairro: req.query.bairro,
        cep: req.query.cep
      },
      req.query.ampla === "1"
    );
    res.set("Cache-Control", "private, max-age=300");
    res.json(resultados);
  } catch (err) {
    const status = err.statusCode || 502;
    if (status >= 500) console.error("Erro ao consultar o Photon:", err);
    res.status(status).json({
      erro: status === 429
        ? "A busca está ocupada. Aguarde um instante e tente novamente."
        : err.message
    });
  }
}

export async function calcularRota(req, res) {
  try {
    const rota = await service.calcularRota(
      req.body?.destinoToken,
      req.body?.destinoNumero,
      req.body?.destinoEndereco
    );
    res.set("Cache-Control", "no-store");
    res.json(rota);
  } catch (err) {
    const status = err.statusCode || 502;
    if (status >= 500) console.error("Erro ao calcular rota de entrega:", err);
    res.status(status).json({ erro: err.message });
  }
}

export async function obterConfiguracaoEntrega(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await service.buscarConfiguracaoEntrega());
  } catch (err) {
    registrarErroConfiguracaoEntrega("carregar", err);
    res.status(500).json({ erro: mensagemErroConfiguracao(err, "carregar") });
  }
}

export async function atualizarConfiguracaoEntrega(req, res) {
  try {
    const config = await service.salvarConfiguracaoEntrega(req.body);
    res.json({ sucesso: true, configuracao: config });
  } catch (err) {
    const status = err.statusCode || (err.code ? 500 : 400);
    if (status >= 500) registrarErroConfiguracaoEntrega("salvar", err);
    res.status(status).json({
      erro: status >= 500
        ? mensagemErroConfiguracao(err, "salvar")
        : err.message
    });
  }
}

function registrarErroConfiguracaoEntrega(operacao, err) {
  console.error(`Erro ao ${operacao} configurações de entrega:`, {
    code: err.code || null,
    errno: err.errno || null,
    sqlState: err.sqlState || null,
    message: String(err.message || "Erro desconhecido").slice(0, 500)
  });
}

function mensagemErroConfiguracao(err, operacao) {
  if (err.code === "ER_NO_SUCH_TABLE") {
    return "A tabela de configurações de entrega ainda não existe. Aplique as migrations do banco e tente novamente.";
  }
  if (err.code === "ER_BAD_FIELD_ERROR") {
    return "A estrutura do banco está desatualizada. Aplique as migrations do banco e tente novamente.";
  }
  return `Não foi possível ${operacao} as configurações de entrega. Verifique os dados e tente novamente.`;
}

  /* Atualiza um pedido existente (edição de pedido/orçamento) */
  export async function atualizar(req, res) {
    try {
      const { id } = req.params;
      const resultado = await service.atualizarPedido(id, {
        ...req.body,
        usuario_id: req.user?.id || null
      });
      res.json(resultado);
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
      res.status(err.code ? 500 : 400).json({
        erro: err.code ? 'Não foi possível concluir a operação.' : err.message
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

export async function cancelar(req, res) {
  try {
    const { id } = req.params;
    const resultado = await service.cancelarPedido(id, {
      usuario_id: req.user?.id || null,
      observacao: req.body?.observacao || 'Cancelamento de pedido'
    });

    return res.json({ sucesso: true, ...resultado });
  } catch (err) {
    console.error('Erro ao cancelar pedido:', err);
    return res.status(err.code ? 500 : 400).json({
      erro: err.code ? 'Não foi possível concluir a operação.' : err.message
    });
  }
}

export async function alterarQuantidadeItem(req, res) {
  try {
    const { id, produtoId } = req.params;
    const quantidade = Number(req.body?.quantidade || 0);
    const resultado = await service.alterarQuantidadeItemPedido(id, Number(produtoId), quantidade, {
      usuario_id: req.user?.id || null,
      observacao: req.body?.observacao || 'Alteração de quantidade do pedido'
    });

    return res.json({ sucesso: true, ...resultado });
  } catch (err) {
    console.error('Erro ao alterar quantidade do pedido:', err);
    return res.status(err.code ? 500 : 400).json({
      erro: err.code ? 'Não foi possível concluir a operação.' : err.message
    });
  }
}