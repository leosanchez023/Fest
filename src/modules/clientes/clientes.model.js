import db from "../../../database/connection.js";

const clienteSelect = `
    SELECT
        c.id AS cliente_id,
        c.id_endereco,
        c.nome,
        c.email,
        c.telefone,
        c.cpf,
        DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
        e.rua,
        e.numero,
        e.bairro,
        e.cidade,
        e.estado,
        e.cep,
        e.referencia
    FROM cliente c
    LEFT JOIN endereco e ON c.id_endereco = e.id`;

async function findByIdOn(connection, id) {
    const [rows] = await connection.query(
        `${clienteSelect} WHERE c.id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function gravarEndereco(connection, dados, idEndereco = null) {
    const values = [
        dados.rua,
        dados.numero,
        dados.bairro,
        dados.cidade,
        dados.estado,
        dados.cep,
        dados.referencia
    ];

    if (idEndereco) {
        await connection.query(
            `UPDATE endereco
             SET rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, referencia = ?
             WHERE id = ?`,
            [...values, idEndereco]
        );
        return idEndereco;
    }

    const [result] = await connection.query(
        `INSERT INTO endereco (rua, numero, bairro, cidade, estado, cep, referencia)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values
    );
    return result.insertId;
}

async function gravarCliente(connection, dados, idEndereco, id = null) {
    const values = [
        dados.nome,
        dados.email,
        dados.telefone,
        dados.cpf,
        dados.nascimento,
        idEndereco
    ];

    if (id) {
        await connection.query(
            `UPDATE cliente
             SET nome = ?, email = ?, telefone = ?, cpf = ?, nascimento = ?, id_endereco = ?
             WHERE id = ?`,
            [...values, id]
        );
        return id;
    }

    const [result] = await connection.query(
        `INSERT INTO cliente (nome, email, telefone, cpf, nascimento, id_endereco)
         VALUES (?, ?, ?, ?, ?, ?)`,
        values
    );
    return result.insertId;
}

async function transact(work) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function findAll() {
    const [rows] = await db.query(`${clienteSelect} ORDER BY c.id`);
    return rows;
}

export async function findWithFilter({ q = "", page = 1, limit = 10 } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const hasQuery = q.trim() !== "";
    const where = hasQuery
        ? "WHERE (c.nome LIKE ? OR c.email LIKE ? OR c.cpf LIKE ?)"
        : "";
    const parameters = hasQuery ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

    const [rows] = await db.query(
        `${clienteSelect}
         ${where}
         ORDER BY c.id
         LIMIT ? OFFSET ?`,
        [...parameters, Number(limit), Number(offset)]
    );
    const [countRows] = await db.query(
        `SELECT COUNT(*) AS total FROM cliente c ${where}`,
        parameters
    );

    return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function findById(id) {
    return findByIdOn(db, id);
}

export async function criarClienteComEndereco(dados) {
    return transact(async (connection) => {
        const idEndereco = await gravarEndereco(connection, dados);
        const id = await gravarCliente(connection, dados, idEndereco);
        return findByIdOn(connection, id);
    });
}

export async function atualizarClienteComEndereco(id, dados, idEndereco) {
    return transact(async (connection) => {
        const enderecoId = await gravarEndereco(connection, dados, idEndereco);
        await gravarCliente(connection, dados, enderecoId, id);
        return findByIdOn(connection, id);
    });
}

export async function excluir(id) {
    await db.query("DELETE FROM cliente WHERE id = ?", [id]);
}

export async function buscarPorCPF(cpf) {
    if (!cpf) return null;
    const normalizedCpf = String(cpf).replace(/\D/g, "");
    const [rows] = await db.query(
        `SELECT id
         FROM cliente
         WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
         LIMIT 1`,
        [normalizedCpf]
    );
    return rows[0] || null;
}
