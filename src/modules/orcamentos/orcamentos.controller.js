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
    if (!sucesso) return res.status(400).json({ erro: 'Não foi possível converter' });
    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
}

export async function excluir(req, res) {
  try {
    const id = req.params.id;
    const sucesso = await service.excluirOrcamento(id);
    if (!sucesso) return res.status(400).json({ erro: 'Não foi possível excluir' });
    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
}

export async function duplicar(req, res) {
  try {
    const id = req.params.id;
    const novoId = await service.duplicarOrcamento(id);
    res.json({ novoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
}
