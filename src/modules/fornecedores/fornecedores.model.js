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
            status
        )

        VALUES
        (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
            status = ?
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
    const [result] = await db.query(
        `
        DELETE FROM fornecedores
        WHERE id = ?
        `,
        [id]
    );

    return result.affectedRows > 0;
}