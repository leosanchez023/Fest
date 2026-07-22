import * as service from './fornecedores.service.js';

/* ==========================================================
   PÁGINA DE FORNECEDORES
========================================================== */
export async function listar(req, res) {

    try {

        const fornecedores = await service.listar({

            q: req.query.q || '',
            category: req.query.category || '',
            status: req.query.status || ''

        });

        return res.render('pages/fornecedor', {

            fornecedores

        });

    } catch (erro) {

        console.error(erro);

        return res.status(500).render('pages/fornecedor', {

            fornecedores: [],
            error: erro.message

        });

    }

}

/* ==========================================================
   LISTA JSON
========================================================== */
export async function listarJSON(req, res) {

    try {

        const fornecedores = await service.listar({

            q: req.query.q || '',
            category: req.query.category || '',
            status: req.query.status || ''

        });

        return res.json(fornecedores);

    } catch (erro) {

        console.error(erro);

        return res.status(500).json({

            success: false,
            error: erro.message

        });

    }

}

/* ==========================================================
   BUSCAR POR ID
========================================================== */
export async function buscar(req, res) {

    try {

        const fornecedor = await service.buscarPorId(req.params.id);

        return res.json(fornecedor);

    } catch (erro) {

        console.error(erro);

        return res.status(404).json({

            success: false,
            error: erro.message

        });

    }

}

/* ==========================================================
   CADASTRAR
========================================================== */
export async function criar(req, res) {

    try {

        const id = await service.criar(req.body);

        return res.status(201).json({

            success: true,
            id

        });

    } catch (erro) {

        console.error(erro);

        return res.status(400).json({

            success: false,
            error: erro.message

        });

    }

}

/* ==========================================================
   ATUALIZAR
========================================================== */
export async function atualizar(req, res) {

    try {

        await service.atualizar(

            req.params.id,
            req.body

        );

        return res.json({

            success: true

        });

    } catch (erro) {

        console.error(erro);

        return res.status(400).json({

            success: false,
            error: erro.message

        });

    }

}

/* ==========================================================
   EXCLUIR
========================================================== */
export async function excluir(req, res) {

    try {

        await service.excluir(req.params.id);

        return res.json({

            success: true

        });

    } catch (erro) {

        console.error(erro);

        return res.status(400).json({

            success: false,
            error: erro.message

        });

    }

}