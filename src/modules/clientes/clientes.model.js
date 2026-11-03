import db from "../../../database/connection.js";

const clienteSelect = `
    SELECT
        c.id AS cliente_id,
        c.id_endereco,
        c.nome,
        c.email,
        c.telefone,
        c.cpf,
        TO_CHAR(c.nascimento, 'YYYY-MM-DD') AS nascimento,
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
    const { rows } = await connection.query(
        `${clienteSelect} WHERE c.id = $1`,
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
             SET rua = $1, numero = $2, bairro = $3, cidade = $4, estado = $5, cep = $6, referencia = $7
             WHERE id = $8`,
            [...values, idEndereco]
        );
        return idEndereco;
    }

    const { rows } = await connection.query(
        `INSERT INTO endereco (rua, numero, bairro, cidade, estado, cep, referencia)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        values
    );
    return rows[0].id;
}

async function obterEnderecoSemAlterarHistorico(connection, idEndereco, dados) {
    if (!idEndereco) return gravarEndereco(connection, dados);

    const { rows } = await connection.query(
        `SELECT id, rua, numero, bairro, cidade, estado, cep, referencia
         FROM endereco WHERE id = $1 FOR UPDATE`,
        [idEndereco]
    );
    const atual = rows[0];
    if (!atual) throw new Error("Endereço do cliente não encontrado.");

    const campos = ["rua", "numero", "bairro", "cidade", "estado", "cep", "referencia"];
    const enderecoIgual = campos.every((campo) =>
        String(atual[campo] ?? "").trim() === String(dados[campo] ?? "").trim()
    );
    return enderecoIgual ? atual.id : gravarEndereco(connection, dados);
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
             SET nome = $1, email = $2, telefone = $3, cpf = $4, nascimento = $5, id_endereco = $6
             WHERE id = $7`,
            [...values, id]
        );
        return id;
    }

    const { rows } = await connection.query(
        `INSERT INTO cliente (nome, email, telefone, cpf, nascimento, id_endereco)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        values
    );
    return rows[0].id;
}

async function transact(work) {
    const connection = await db.connect();
    try {
        await connection.query("BEGIN");
        const result = await work(connection);
        await connection.query("COMMIT");
        return result;
    } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
    } finally {
        connection.release();
    }
}

export async function findAll() {
    const { rows } = await db.query(`${clienteSelect} ORDER BY c.id`);
    return rows;
}

export async function findWithFilter({ q = "", page = 1, limit = 10 } = {}) {
    const hasQuery = q.trim() !== "";
    const cpfQuery = hasQuery ? q.replace(/\D/g, "") : "";
    const where = hasQuery
        ? `WHERE (
            c.nome ILIKE $1
            OR c.email ILIKE $2
            OR c.cpf ILIKE $3
            ${cpfQuery ? "OR REGEXP_REPLACE(c.cpf, '[^0-9]', '', 'g') ILIKE $4" : ""}
        )`
        : "";
    const parameters = hasQuery ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    if (cpfQuery) parameters.push(`%${cpfQuery}%`);

    const { rows: countRows } = await db.query(
        `SELECT COUNT(*) AS total FROM cliente c ${where}`,
        parameters
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / Number(limit)));
    const currentPage = Math.min(Number(page), totalPages);
    const offset = (currentPage - 1) * Number(limit);
    const limitPlaceholder = `$${parameters.length + 1}`;
    const offsetPlaceholder = `$${parameters.length + 2}`;
    const { rows } = await db.query(
        `${clienteSelect}
         ${where}
         ORDER BY c.id
         LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
        [...parameters, Number(limit), Number(offset)]
    );

    return { rows, total, page: currentPage };
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
        const enderecoId = await obterEnderecoSemAlterarHistorico(connection, idEndereco, dados);
        await gravarCliente(connection, dados, enderecoId, id);
        return findByIdOn(connection, id);
    });
}

export async function excluir(id) {
    const result = await db.query("DELETE FROM cliente WHERE id = $1", [id]);
    return result.rowCount > 0;
}

export async function buscarPorCPF(cpf) {
    if (!cpf) return null;
    const normalizedCpf = String(cpf).replace(/\D/g, "");
    const { rows } = await db.query(
        `SELECT id
         FROM cliente
         WHERE REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = $1
         LIMIT 1`,
        [normalizedCpf]
    );
    return rows[0] || null;
}
