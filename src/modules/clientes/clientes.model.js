import db from "../../../database/connection.js";

/* LISTAR CLIENTES */
export async function findAll() {
    const [rows] = await db.query(
        `SELECT
            c.id AS cliente_id,
            c.nome,
            c.email,
            c.telefone,
            c.cpf,
            DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
            e.rua,
            e.numero,
            e.cidade,
            e.estado
        FROM cliente c
        LEFT JOIN endereco e
            ON c.id_endereco = e.id
        ORDER BY c.id`
    );

    return rows;
}

/* LISTAR CLIENTES COM FILTRO */
export async function findWithFilter({
    q = "",
    page = 1,
    limit = 10
} = {}) {

    const offset =(Number(page) - 1) * Number(limit);
    const hasQuery =q && q.trim() !== "";
    let where = "";
    const params = [];

    if (hasQuery) {
        where =
            "WHERE (c.nome LIKE ? OR c.email LIKE ? OR c.cpf LIKE ?)";

        const like = `%${q}%`;

        params.push(
            like,
            like,
            like
        );
    }

    const [rows] = await db.query(
        `SELECT
            c.id AS cliente_id,
            c.nome,
            c.email,
            c.telefone,
            c.cpf,
            DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
            e.rua,
            e.numero,
            e.cidade,
            e.estado
        FROM cliente c
        LEFT JOIN endereco e
            ON c.id_endereco = e.id
        ${where}
        ORDER BY c.id
        LIMIT ? OFFSET ?`,

        [
            ...params,
            Number(limit),
            Number(offset)
        ]
    );

    const countParams = hasQuery
        ? [
            `%${q}%`,
            `%${q}%`,
            `%${q}%`
        ]: [];

    const countSql =

        `SELECT COUNT(*) AS total
         FROM cliente c
         ${hasQuery ? where : ""}`;

    const [countRows] = await db.query(countSql, countParams);
    const total = countRows[0]?.total || 0;

    return {rows,total};
}

/* BUSCAR CLIENTE */
export async function findById(id) {
    const [rows] = await db.query(
        `SELECT
            c.id AS cliente_id,
            c.id_endereco,
            c.nome,
            c.email,
            c.telefone,
            c.cpf,
            DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
            e.rua,
            e.numero,
            e.cidade,
            e.estado
        FROM cliente c
        LEFT JOIN endereco e
            ON c.id_endereco = e.id
        WHERE c.id = ?`,
        [id]
    );

    return rows[0];
}

/* ATUALIZAR CLIENTE */
export async function atualizarCliente(id,
    {
        nome,
        email,
        telefone,
        cpf,
        nascimento,
        id_endereco
    }

) {

    await db.query(
        `UPDATE cliente
        SET
            nome = ?,
            email = ?,
            telefone = ?,
            cpf = ?,
            nascimento = ?,
            id_endereco = ?
        WHERE id = ?`,

        [
            nome,
            email,
            telefone,
            cpf,
            nascimento,
            id_endereco,
            id
        ]
    );
}

/* ATUALIZAR ENDEREÇO */
export async function atualizarEndereco(id,
    {
        rua,
        numero,
        cidade,
        estado,
        cep
    }

) {

    await db.query(

        `UPDATE endereco
        SET
            rua = ?,
            numero = ?,
            cidade = ?,
            estado = ?,
            cep = ?
        WHERE id = ?`,

        [
            rua,
            numero,
            cidade,
            estado,
            cep,
            id
        ]
    );
}

/* CRIAR ENDEREÇO */
export async function criarEndereco({

    rua,
    numero,
    cidade,
    estado,
    cep

}) {

    const [result] = await db.query(

        `INSERT INTO endereco
            (
                rua,
                numero,
                cidade,
                estado,
                cep
            )
        VALUES (?, ?, ?, ?, ?)`,

        [
            rua,
            numero,
            cidade,
            estado,
            cep
        ]
    );

    return result.insertId;
}

/* CRIAR CLIENTE */
export async function criarCliente({

    nome,
    email,
    telefone,
    cpf,
    nascimento,
    id_endereco

}) {
    const [result] = await db.query(
        `INSERT INTO cliente
            (
                nome,
                email,
                telefone,
                cpf,
                nascimento,
                id_endereco
            )
        VALUES (?, ?, ?, ?, ?, ?)`,

        [
            nome,
            email,
            telefone,
            cpf,
            nascimento,
            id_endereco
        ]
    );

    return await findById(result.insertId);
}

/* EXCLUIR CLIENTE */
export async function excluir(id) {

    console.log("Entrou no model. ID =", id);

    const [result] = await db.query(
        `DELETE FROM cliente
         WHERE id = ?`,
        [id]
    );
    console.log(result);
}

/* BUSCAR CLIENTE POR CPF */
export async function buscarPorCPF(cpf) {

    const [rows] = await db.query(
        `SELECT id
        FROM cliente
        WHERE cpf = ?
        LIMIT 1`,
        [cpf]
    );

    return rows[0] || null;
}