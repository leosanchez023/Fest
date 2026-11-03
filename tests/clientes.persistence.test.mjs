import assert from "node:assert/strict";
import db from "../database/connection.js";
import * as clientesModel from "../src/modules/clientes/clientes.model.js";
import { deletar } from "../src/modules/clientes/clientes.service.js";

const originalQuery = db.query;
const calls = [];

try {
    db.query = async (sql, params = []) => {
        calls.push({ sql, params });
        if (sql.includes("COUNT(*) AS total FROM cliente")) {
            return { rows: [{ total: "23" }] };
        }
        if (sql.includes("FROM cliente c")) {
            return { rows: [{ cliente_id: 7 }], rowCount: 1 };
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    };

    const listing = await clientesModel.findWithFilter({
        q: "Maria",
        page: 99,
        limit: 10
    });
    assert.equal(listing.total, 23);
    assert.equal(listing.page, 3, "Página solicitada deve ser limitada à última página disponível");
    const listQuery = calls.find(({ sql }) => sql.includes("LIMIT"));
    assert.deepEqual(listQuery.params, ["%Maria%", "%Maria%", "%Maria%", 10, 20]);

    calls.length = 0;
    await clientesModel.findWithFilter({ q: "123.456-78", page: 1, limit: 10 });
    const cpfSearch = calls.find(({ sql }) => sql.includes("LIMIT"));
    assert.match(cpfSearch.sql, /REGEXP_REPLACE\(c\.cpf/);
    assert.deepEqual(cpfSearch.params, [
        "%123.456-78%",
        "%123.456-78%",
        "%123.456-78%",
        "%12345678%",
        10,
        0
    ]);

    calls.length = 0;
    db.query = async (sql, params = []) => {
        calls.push({ sql, params });
        if (sql.includes("WHERE c.id = $1")) {
            return { rows: [{ cliente_id: 9, nome: "Cliente ligado a pedido" }], rowCount: 1 };
        }
        if (sql.startsWith("DELETE FROM cliente")) {
            const error = new Error("update or delete violates foreign key constraint");
            error.code = "23503";
            throw error;
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    };

    await assert.rejects(
        () => deletar("9"),
        (error) => error.status === 409 && /pedidos cadastrados/i.test(error.message),
        "Cliente referenciado por pedido não pode ser excluído"
    );
    assert.equal(calls.some(({ sql }) => sql.startsWith("DELETE FROM cliente")), true);
} finally {
    db.query = originalQuery;
}

console.log("Paginação e proteção contra exclusão de clientes com pedidos ok");
