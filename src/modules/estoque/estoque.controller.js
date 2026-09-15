import * as service from './estoque.service.js';

export async function index(req, res) {
  try {
    const dados = await service.resumoEstoque();
    const [produtos] = await (await import('../../../database/connection.js')).default.query(`
      SELECT p.*, 
             (p.estoque - p.estoque_reservado - p.estoque_em_uso - p.estoque_manutencao - p.estoque_danificado) AS disponivel,
             CASE
               WHEN p.ativo = 0 THEN 'INATIVO'
               WHEN p.estoque_em_uso > 0 THEN 'EM_USO'
               WHEN p.estoque_manutencao > 0 THEN 'MANUTENCAO'
               WHEN p.estoque_danificado > 0 THEN 'DANIFICADO'
               WHEN p.estoque_reservado > 0 THEN 'RESERVADO'
               WHEN p.estoque <= p.estoque_minimo THEN 'BAIXO'
               ELSE 'NORMAL'
             END AS status_estoque
      FROM produtos p
      WHERE p.ativo = 1
      ORDER BY p.nome ASC
    `);

    res.render('pages/estoque', {
      layout: 'main',
      resumo: dados,
      produtos
    });
  } catch (error) {
    res.status(500).render('pages/estoque', {
      layout: 'main',
      resumo: { total_produtos: 0, estoque_fisico: 0, estoque_reservado: 0, estoque_em_uso: 0, estoque_manutencao: 0, estoque_danificado: 0, disponivel: 0 },
      produtos: [],
      erro: error.message
    });
  }
}

export async function resumo(req, res) {
  try {
    const dados = await service.resumoEstoque();
    res.json({ success: true, message: 'Resumo carregado com sucesso.', data: dados });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function ajustar(req, res) {
  try {
    const resultado = await service.registrarAjuste({
      produtoId: req.body.produto_id,
      quantidade: req.body.quantidade,
      usuarioId: req.body.usuario_id || null,
      observacao: req.body.observacao || 'Ajuste manual'
    });
    res.json({ success: true, message: 'Ajuste realizado com sucesso.', data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}
