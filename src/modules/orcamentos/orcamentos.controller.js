import * as service from './orcamentos.service.js';

export function listar(req, res) {
  res.render('pages/orcamentos');
}

export async function listarJSON(req, res) {
  try {
    const dados = await service.buscarOrcamentos(req.query);
    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
}

export async function converter(req, res) {
  try {
    const id = req.params.id;
    const sucesso = await service.converterParaPedido(id);
    if (!sucesso) return res.status(409).json({ success: false, message: 'Orçamento não encontrado, cancelado ou indisponível para conversão.' });
    res.json({ success: true, message: 'Orçamento convertido em pedido.', data: { id } });
  } catch (err) {
    console.error(err);
    res.status(err.message === 'Orçamento inválido.' ? 400 : 500)
      .json({ success: false, message: err.message });
  }
}

export async function excluir(req, res) {
  try {
    const id = req.params.id;
    const sucesso = await service.excluirOrcamento(id);
    if (!sucesso) return res.status(404).json({ erro: 'Orçamento não encontrado ou já cancelado.' });
    res.json({ sucesso: true, message: 'Orçamento cancelado.' });
  } catch (err) {
    console.error(err);
    res.status(err.message === 'Orçamento inválido.' ? 400 : 500).json({ erro: err.message });
  }
}

export async function duplicar(req, res) {
  try {
    const id = req.params.id;
    const novoId = await service.duplicarOrcamento(id);
    res.json({ novoId });
  } catch (err) {
    console.error(err);
    const status = err.message === 'Orçamento inválido.' ? 400
      : err.message.startsWith('Orçamento não encontrado') ? 404 : 500;
    res.status(status).json({ erro: err.message });
  }
}
