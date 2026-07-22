import db from '../../../database/connection.js';

/* ==========================================================
   LISTAR FORNECEDORES
========================================================== */
export async function buscarFornecedores({ q = '', category = '', status = '' }) {

    const where = [];
    const params = [];

    if (q) {
        where.push(`(
            nome LIKE ?
            OR email LIKE ?
            OR cnpj LIKE ?
            OR responsavel LIKE ?
            OR category LIKE ?
        )`);

        const termo = `%${q}%`;
        params.push(termo, termo, termo, termo, termo);
    }

    if (category) {
        where.push(`category = ?`);
        params.push(category);
    }

    if (status) {
        where.push(`status = ?`);
        params.push(status);
    }

    const sql = `
        SELECT
            id,
            nome              AS name,
            cnpj,
            responsavel,
            category,
            phone,
            whatsapp,
            email,
            website,
            street,
            number,
            neighborhood,
            city,
            state,
            cep,
            product,
            delivery,
            payment,
            notes,
            status,
            created_at        AS createdAt,
            updated_at        AS updatedAt
        FROM fornecedores
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql, params);

    return rows;
}

/* ==========================================================
   BUSCAR POR ID
========================================================== */
export async function buscarFornecedorPorId(id) {

    const [rows] = await db.query(`
        SELECT
            id,
            nome              AS name,
            cnpj,
            responsavel,
            category,
            phone,
            whatsapp,
            email,
            website,
            street,
            number,
            neighborhood,
            city,
            state,
            cep,
            product,
            delivery,
            payment,
            notes,
            status,
            created_at        AS createdAt,
            updated_at        AS updatedAt
        FROM fornecedores
        WHERE id = ?
    `, [id]);

    return rows[0] || null;
}

/* ==========================================================
   CADASTRAR
========================================================== */
export async function criarFornecedor(dados) {

    const [result] = await db.query(`
        INSERT INTO fornecedores (

            nome,
            cnpj,
            responsavel,
            category,
            phone,
            whatsapp,
            email,
            website,

            street,
            number,
            neighborhood,
            city,
            state,
            cep,

            product,
            delivery,
            payment,
            notes,

            status

        )

        VALUES (

            ?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,
            ?

        )
    `,
    [

        dados.name,
        dados.cnpj,

        dados.responsavel || null,
        dados.category || null,

        dados.phone || null,
        dados.whatsapp || null,

        dados.email || null,
        dados.website || null,

        dados.street || null,
        dados.number || null,
        dados.neighborhood || null,
        dados.city || null,
        dados.state || null,
        dados.cep || null,

        dados.product || null,
        dados.delivery || null,
        dados.payment || null,
        dados.notes || null,

        dados.status || 'Ativo'

    ]);

    return result.insertId;

}

/* ==========================================================
   ATUALIZAR
========================================================== */
export async function atualizarFornecedor(id, dados) {

    const [result] = await db.query(`

        UPDATE fornecedores SET

            nome=?,
            cnpj=?,
            responsavel=?,
            category=?,

            phone=?,
            whatsapp=?,
            email=?,
            website=?,

            street=?,
            number=?,
            neighborhood=?,
            city=?,
            state=?,
            cep=?,

            product=?,
            delivery=?,
            payment=?,
            notes=?,

            status=?

        WHERE id=?

    `,

    [

        dados.name,
        dados.cnpj,

        dados.responsavel || null,
        dados.category || null,

        dados.phone || null,
        dados.whatsapp || null,

        dados.email || null,
        dados.website || null,

        dados.street || null,
        dados.number || null,
        dados.neighborhood || null,
        dados.city || null,
        dados.state || null,
        dados.cep || null,

        dados.product || null,
        dados.delivery || null,
        dados.payment || null,
        dados.notes || null,

        dados.status || 'Ativo',

        id

    ]);

    return result.affectedRows > 0;

}

/* ==========================================================
   EXCLUIR
========================================================== */
export async function excluirFornecedor(id) {

    const [result] = await db.query(

        `DELETE FROM fornecedores WHERE id = ?`,

        [id]

    );

    return result.affectedRows > 0;

}