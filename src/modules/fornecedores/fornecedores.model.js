import db from '../../../database/connection.js';

// LISTAR FORNECEDORES
export async function buscarFornecedores({
    q = '',
    categoria = '',
    status = ''
    } = {}) {

    const where = [];
    const params = [];
    q = q.trim();

    // Pesquisa geral
    if (q) {

    where.push(`
        (
            nome LIKE ?
            OR email LIKE ?
            OR cnpj LIKE ?
            OR responsavel LIKE ?
            OR categoria LIKE ?
            OR cidade LIKE ?
        )
    `);

    const termo = `%${q}%`;
        params.push(
            termo,
            termo,
            termo,
            termo,
            termo,
            termo
        );
    }

    // Categoria
    if (categoria) {
        where.push('categoria = ?');
        params.push(categoria);
    }

    // Status
    if (status) {
        where.push('status = ?');
        params.push(status);
    }

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
            criado_em AS criadoEm,
            atualizado_em AS atualizadoEm
        FROM fornecedores

        ${where.length
            ? "WHERE " + where.join(" AND "): ""
        }
        ORDER BY criado_em DESC`;

    const [rows] = await db.query(
        sql,
        params
    );

    return rows;
}

// BUSCAR FORNECEDOR POR ID
export async function buscarFornecedorPorId(id) {

    if (!id) {
        return null;
    }

    const [rows] = await db.query(
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
            criado_em AS criadoEm,
            atualizado_em AS atualizadoEm
        FROM fornecedores
        WHERE id = ?
        `,
        [id]
    );

    return rows[0] || null;
}

// BUSCAR DOCUMENTO IGNORANDO MÁSCARAS
export async function buscarPorDocumento(cnpj, excluirId = null) {
    const documento = String(cnpj || "").replace(/\D/g, "");
    const [rows] = await db.query(
        `SELECT id
         FROM fornecedores
         WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '') = ?
           AND (? IS NULL OR id <> ?)
         LIMIT 1`,
        [documento, excluirId, excluirId]
    );
    return rows[0] || null;
}

// CADASTRAR FORNECEDOR
export async function criarFornecedor(dados) {
    const [result] = await db.query(
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
        (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
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

    return result.insertId;
}

// ATUALIZAR FORNECEDOR
export async function atualizarFornecedor(id, dados) {

    const [result] = await db.query(
        `UPDATE fornecedores SET
            nome = ?,
            cnpj = ?,
            responsavel = ?,
            categoria = ?,
            telefone = ?,
            whatsapp = ?,
            email = ?,
            site = ?,
            rua = ?,
            numero = ?,
            bairro = ?,
            cidade = ?,
            estado = ?,
            cep = ?,
            produtos = ?,
            entrega = ?,
            pagamento = ?,
            observacoes = ?,
            status = ?,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?`,
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

    return result.affectedRows > 0;
}

// EXCLUIR FORNECEDOR
export async function excluirFornecedor(id) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [fornecedores] = await connection.query(
            "SELECT id FROM fornecedores WHERE id = ? FOR UPDATE",
            [id]
        );
        if (!fornecedores.length) {
            await connection.rollback();
            return false;
        }

        const [produtos] = await connection.query(
            "SELECT COUNT(*) AS total FROM produtos WHERE fornecedor_id = ?",
            [id]
        );
        if (Number(produtos[0]?.total || 0) > 0) {
            throw new Error("Este fornecedor possui produtos vinculados. Remova o vínculo dos produtos antes de excluí-lo.");
        }

        const [result] = await connection.query(
            "DELETE FROM fornecedores WHERE id = ?",
            [id]
        );
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}