import db from '../../../database/connection.js';

// LISTAR FORNECEDORES
export async function buscarFornecedores({
    q = '',
    categoria = '',
    status = '',
    page = 1,
    limit = 10
    } = {}) {

    const where = [];
    const params = [];
    q = q.trim();
    const documentoQuery = q.replace(/\D/g, "");

    // Pesquisa geral
    if (q) {
        where.push(`(
            nome ILIKE $1
            OR email ILIKE $1
            OR cnpj ILIKE $1
            ${documentoQuery ? "OR REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') ILIKE $2" : ""}
            OR responsavel ILIKE $1
            OR categoria ILIKE $1
            OR telefone ILIKE $1
            OR whatsapp ILIKE $1
            OR site ILIKE $1
            OR rua ILIKE $1
            OR bairro ILIKE $1
            OR cidade ILIKE $1
            OR estado ILIKE $1
            OR cep ILIKE $1
            OR produtos ILIKE $1
        )`);
        params.push(`%${q}%`);
        if (documentoQuery) params.push(`%${documentoQuery}%`);
    }

    // Categoria
    if (categoria) {
        where.push(`categoria = $${params.length + 1}`);
        params.push(categoria);
    }

    // Status
    if (status) {
        where.push(`status = $${params.length + 1}`);
        params.push(status);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const { rows: countRows } = await db.query(
        `SELECT COUNT(*) AS total FROM fornecedores ${whereSql}`,
        params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * limit;
    const limitPlaceholder = `$${params.length + 1}`;
    const offsetPlaceholder = `$${params.length + 2}`;

    const sql = `
        SELECT
            id,
            nome,
            cnpj,
            responsavel,
            categoria,
            telefone,
            whatsapp,
            email,
            site,
            rua,
            numero,
            bairro,
            cidade,
            estado,
            cep,
            produtos,
            entrega,
            pagamento,
            observacoes,
            status,
            criado_em AS "criadoEm",
            atualizado_em AS "atualizadoEm"
        FROM fornecedores

        ${whereSql}
        ORDER BY criado_em DESC, id DESC
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

    const { rows } = await db.query(sql, [...params, limit, offset]);
    const { rows: summaryRows } = await db.query(
        `SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'Ativo') AS ativos,
            COUNT(*) FILTER (
                WHERE criado_em >= date_trunc('month', CURRENT_DATE)
                  AND criado_em < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
            ) AS novos
         FROM fornecedores`
    );

    return {
        fornecedores: rows,
        total,
        page: currentPage,
        limit,
        totalPages,
        summary: {
            total: Number(summaryRows[0]?.total || 0),
            ativos: Number(summaryRows[0]?.ativos || 0),
            novos: Number(summaryRows[0]?.novos || 0)
        }
    };
}

// BUSCAR FORNECEDOR POR ID
export async function buscarFornecedorPorId(id) {

    if (!id) {
        return null;
    }

    const { rows } = await db.query(
        `
        SELECT
            id,
            nome,
            cnpj,
            responsavel,
            categoria,
            telefone,
            whatsapp,
            email,
            site,
            rua,
            numero,
            bairro,
            cidade,
            estado,
            cep,
            produtos,
            entrega,
            pagamento,
            observacoes,
            status,
            criado_em AS "criadoEm",
            atualizado_em AS "atualizadoEm"
        FROM fornecedores
        WHERE id = $1
        `,
        [id]
    );

    return rows[0] || null;
}

// BUSCAR DOCUMENTO IGNORANDO MÁSCARAS
export async function buscarPorDocumento(cnpj, excluirId = null) {
    const documento = String(cnpj || "").replace(/\D/g, "");
    const { rows } = await db.query(
        `SELECT id
         FROM fornecedores
         WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = $1
           AND ($2::integer IS NULL OR id <> $3)
         LIMIT 1`,
        [documento, excluirId, excluirId]
    );
    return rows[0] || null;
}

// CADASTRAR FORNECEDOR
export async function criarFornecedor(dados) {
    const { rows } = await db.query(
        `
        INSERT INTO fornecedores
        (
            nome,
            cnpj,
            responsavel,
            categoria,
            telefone,
            whatsapp,
            email,
            site,
            rua,
            numero,
            bairro,
            cidade,
            estado,
            cep,
            produtos,
            entrega,
            pagamento,
            observacoes,
            status,
            criado_em,
            atualizado_em
        )

        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING id
        `,
        [
            dados.nome,
            dados.cnpj,
            dados.responsavel,
            dados.categoria,
            dados.telefone,
            dados.whatsapp,
            dados.email,
            dados.site,
            dados.rua,
            dados.numero,
            dados.bairro,
            dados.cidade,
            dados.estado,
            dados.cep,
            dados.produtos,
            dados.entrega,
            dados.pagamento,
            dados.observacoes,
            dados.status || "Ativo"
        ]
    );

    return rows[0].id;
}

// ATUALIZAR FORNECEDOR
export async function atualizarFornecedor(id, dados) {

    const result = await db.query(
        `UPDATE fornecedores SET
            nome = $1,
            cnpj = $2,
            responsavel = $3,
            categoria = $4,
            telefone = $5,
            whatsapp = $6,
            email = $7,
            site = $8,
            rua = $9,
            numero = $10,
            bairro = $11,
            cidade = $12,
            estado = $13,
            cep = $14,
            produtos = $15,
            entrega = $16,
            pagamento = $17,
            observacoes = $18,
            status = $19,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $20`,
        [
            dados.nome,
            dados.cnpj,
            dados.responsavel,
            dados.categoria,
            dados.telefone,
            dados.whatsapp,
            dados.email,
            dados.site,
            dados.rua,
            dados.numero,
            dados.bairro,
            dados.cidade,
            dados.estado,
            dados.cep,
            dados.produtos,
            dados.entrega,
            dados.pagamento,
            dados.observacoes,
            dados.status || "Ativo",
            id
        ]
    );

    return result.rowCount > 0;
}

// EXCLUIR FORNECEDOR
export async function excluirFornecedor(id) {
    const connection = await db.connect();
    try {
        await connection.query("BEGIN");

        const { rows: fornecedores } = await connection.query(
            "SELECT id FROM fornecedores WHERE id = $1 FOR UPDATE",
            [id]
        );
        if (!fornecedores.length) {
            await connection.query("ROLLBACK");
            return false;
        }

        const { rows: produtos } = await connection.query(
            "SELECT COUNT(*) AS total FROM produtos WHERE fornecedor_id = $1",
            [id]
        );
        if (Number(produtos[0]?.total || 0) > 0) {
            throw new Error("Este fornecedor possui produtos vinculados. Remova o vínculo dos produtos antes de excluí-lo.");
        }

        const result = await connection.query(
            "DELETE FROM fornecedores WHERE id = $1",
            [id]
        );
        await connection.query("COMMIT");
        return result.rowCount > 0;
    } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
    } finally {
        connection.release();
    }
}