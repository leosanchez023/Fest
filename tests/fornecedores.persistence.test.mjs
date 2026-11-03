import assert from "node:assert/strict";
import db from "../database/connection.js";
import * as fornecedoresModel from "../src/modules/fornecedores/fornecedores.model.js";
import { listar } from "../src/modules/fornecedores/fornecedores.service.js";

const originalQuery = db.query;
const originalConnect = db.connect;
const statements = [];

try {
    db.query = async (sql, params = []) => {
        statements.push({ sql, params });
        if (sql.includes("COUNT(*) AS total FROM fornecedores WHERE")) {
            return { rows: [{ total: "27" }] };
        }
        if (sql.includes("COUNT(*) FILTER")) {
            return { rows: [{ total: "27", ativos: "19", novos: "2" }] };
        }
        if (sql.includes("FROM fornecedores") && sql.includes("LIMIT")) {
            return { rows: [{ id: 3, nome: "Fornecedor" }] };
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    };

    const result = await listar({
        q: "máquinas",
        categoria: "Equipamentos",
        status: "Ativo",
        page: "99",
        limit: "10"
    });
    assert.equal(result.total, 27);
    assert.equal(result.page, 3);
    assert.equal(result.totalPages, 3);
    assert.equal(result.summary.ativos, 19);
    const pageQuery = statements.find(({ sql }) => sql.includes("LIMIT"));
    assert.deepEqual(pageQuery.params, [
        "%máquinas%",
        "Equipamentos",
        "Ativo",
        10,
        20
    ]);
    assert.match(pageQuery.sql, /produtos ILIKE \$1/);

    await assert.rejects(
        () => listar({ status: "Excluído" }),
        /Status inválido/
    );

    statements.length = 0;
    await listar({ q: "12.345.678/0001-90" });
    const documentSearch = statements.find(({ sql }) => sql.includes("LIMIT"));
    assert.match(documentSearch.sql, /REGEXP_REPLACE\(cnpj/);
    assert.deepEqual(documentSearch.params, [
        "%12.345.678/0001-90%",
        "%12345678000190%",
        10,
        0
    ]);

    statements.length = 0;
    db.query = async (sql, params = []) => {
        statements.push({ sql, params });
        if (sql.includes("INSERT INTO fornecedores")) return { rows: [{ id: 12 }] };
        if (sql.includes("UPDATE fornecedores SET")) return { rowCount: 1 };
        throw new Error(`Consulta inesperada: ${sql}`);
    };
    const fornecedor = {
        nome: "Fornecedor Teste",
        cnpj: "12345678901",
        responsavel: "Pessoa Responsável",
        categoria: "Equipamentos",
        telefone: "11999999999",
        email: "teste@example.com",
        rua: "Rua Um",
        numero: "1",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01000-000",
        produtos: "Equipamentos",
        status: "Inativo"
    };
    assert.equal(await fornecedoresModel.criarFornecedor(fornecedor), 12);
    assert.equal(await fornecedoresModel.atualizarFornecedor(12, fornecedor), true);
    const insert = statements.find(({ sql }) => sql.includes("INSERT INTO fornecedores"));
    const update = statements.find(({ sql }) => sql.includes("UPDATE fornecedores SET"));
    assert.equal(insert.params[18], "Inativo");
    assert.equal(update.params[18], "Inativo");

    const deleteQueries = [];
    db.connect = async () => ({
        async query(sql) {
            deleteQueries.push(sql);
            if (sql === "SELECT id FROM fornecedores WHERE id = $1 FOR UPDATE") {
                return { rows: [{ id: 12 }] };
            }
            if (sql.includes("FROM produtos")) return { rows: [{ total: "1" }] };
            return { rows: [], rowCount: 1 };
        },
        release() {}
    });
    await assert.rejects(
        () => fornecedoresModel.excluirFornecedor(12),
        /produtos vinculados/
    );
    assert.equal(deleteQueries.includes("DELETE FROM fornecedores WHERE id = $1"), false);
    assert.equal(deleteQueries.includes("ROLLBACK"), true);
} finally {
    db.query = originalQuery;
    db.connect = originalConnect;
}

console.log("Busca, filtros, paginação, persistência de status e exclusão segura de fornecedores ok");
