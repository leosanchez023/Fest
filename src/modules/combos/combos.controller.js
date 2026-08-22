import * as service from './combos.service.js';

export async function index(req, res) {
  try {
    const combos = await service.listarCombos();
    res.render('pages/combos', {
      layout: 'main',
      combos
    });
  } catch (error) {
    res.status(500).render('pages/combos', {
      layout: 'main',
      combos: [],
      erro: error.message
    });
  }
}

export async function listar(req, res) {
  try {
    const combos = await service.listarCombos();
    res.json(combos);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
}

export async function buscar(req, res) {
  try {
    const combo = await service.buscarComboPorId(req.params.id);
    if (!combo) {
      return res.status(404).json({ erro: 'Combo não encontrado.' });
    }

    combo.itens = await service.listarItensDoCombo(combo.id);
    res.json(combo);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
}

export async function criar(req, res) {
  try {
    const combo = await service.criarCombo(req.body);
    res.status(201).json({ sucesso: true, combo });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
}

export async function atualizar(req, res) {
  try {
    await service.atualizarCombo(req.params.id, req.body);
    res.json({ sucesso: true, mensagem: 'Combo atualizado.' });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
}

export async function desativar(req, res) {
  try {
    await service.desativarCombo(req.params.id);
    res.json({ sucesso: true, mensagem: 'Combo desativado.' });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
}

export async function adicionarItem(req, res) {
  try {
    const item = await service.adicionarItemCombo(req.params.id, req.body);
    res.status(201).json({ sucesso: true, item });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
}

export async function calcularDisponibilidade(req, res) {
  try {
    const dados = await service.calcularDisponibilidadeCombo(req.params.id);
    res.json(dados);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
}
