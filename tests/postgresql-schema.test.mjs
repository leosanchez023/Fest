import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(
  new URL("../database/schema.postgresql.sql", import.meta.url),
  "utf8"
);

function tableColumns(tableName) {
  return tableDefinition(tableName)
    .split("\n")
    .map((line) => line.match(/^\s{2}"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+/)?.[1])
    .filter((name) => name && !["CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN"].includes(name));
}

function tableDefinition(tableName) {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = schema.match(
    new RegExp(`CREATE TABLE ${escapedName} \\(([\\s\\S]*?)\\n\\);`)
  );
  assert.ok(match, `Expected table ${tableName} in PostgreSQL baseline`);

  return match[1];
}

function columnDefinition(tableName, columnName) {
  const escapedName = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tableDefinition(tableName).match(
    new RegExp(`^\\s{2}"?${escapedName}"?\\s+(.+)$`, "m")
  );
  assert.ok(match, `Expected column ${tableName}.${columnName} in PostgreSQL baseline`);

  return match[1];
}

test("PostgreSQL baseline covers every table from the audited MySQL source", () => {
  const expectedTables = [
    "cliente",
    "combo_itens",
    "combos",
    "configuracoes_entrega",
    "creditos_restituicao",
    "devolucao_itens",
    "devolucoes",
    "endereco",
    "estoque_historico",
    "fornecedores",
    "funcionario_auditoria",
    "funcionario_login_eventos",
    "funcionario_perfil_acoes",
    "funcionario_perfis_permissoes",
    "movimentacao_estoque",
    "ocorrencias",
    "pagamentos",
    "pedido_item_componentes",
    "pedido_itens",
    "pedidos",
    "produtos",
    "reservas_estoque",
    "restituicoes_pedido",
    "user_permission_actions",
    "user_permissions",
    "usuario"
  ];
  const actualTables = [...schema.matchAll(/^CREATE TABLE ([a-zA-Z_][a-zA-Z0-9_]*) \(/gm)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(actualTables, expectedTables);
});

test("PostgreSQL columns preserve MySQL order for previously missing source fields", () => {
  assert.deepEqual(tableColumns("endereco"), [
    "id", "rua", "numero", "bairro", "cidade", "estado", "cep", "complemento", "referencia"
  ]);
  assert.deepEqual(tableColumns("devolucoes"), [
    "id", "pedido_id", "usuario_id", "data_devolucao", "valor_multa",
    "valor_restituicao_prevista", "observacao", "chave_idempotencia",
    "hash_requisicao", "created_at"
  ]);
  assert.deepEqual(tableColumns("creditos_restituicao"), [
    "id", "pedido_id", "usuario_id", "valor", "descricao", "status",
    "criado_em", "atualizado_em"
  ]);
  assert.deepEqual(tableColumns("restituicoes_pedido"), [
    "id", "pedido_id", "usuario_id", "valor", "forma_pagamento",
    "observacao", "status", "criado_em", "pago_em", "pago_por",
    "chave_idempotencia"
  ]);
});

test("client address deletion matches the MySQL NO ACTION relationship", () => {
  assert.match(
    schema,
    /FOREIGN KEY \(id_endereco\) REFERENCES endereco\(id\)(?! ON DELETE)/
  );
});

test("pedido items require exactly one product or combo origin", () => {
  assert.match(
    schema,
    /CONSTRAINT chk_pedido_item_origem CHECK \(\s*\(produto_id IS NOT NULL AND combo_id IS NULL\)\s*OR \(produto_id IS NULL AND combo_id IS NOT NULL\)\s*\)/
  );
});

test("nullable source columns remain nullable in the PostgreSQL baseline", () => {
  const nullableColumns = [
    ["devolucao_itens", "quantidade_recebida"],
    ["devolucao_itens", "quantidade_faltando"],
    ["devolucao_itens", "quantidade_danificada"],
    ["devolucao_itens", "valor_cobranca"],
    ["devolucoes", "valor_multa"],
    ["movimentacao_estoque", "createdAt"],
    ["ocorrencias", "status"],
    ["pedido_itens", "quantidade_entregue"],
    ["pedido_itens", "quantidade_devolvida"],
    ["pedidos", "tipo_pedido"],
    ["pedidos", "status"],
    ["pedidos", "valor_produtos"],
    ["pedidos", "valor_frete"],
    ["pedidos", "valor_desconto"],
    ["pedidos", "valor_total"],
    ["produtos", "ativo"]
  ];

  for (const [table, column] of nullableColumns) {
    assert.doesNotMatch(
      columnDefinition(table, column),
      /\bNOT NULL\b/,
      `${table}.${column} should remain nullable`
    );
  }

  assert.match(columnDefinition("user_permissions", "estoque"), /\bNOT NULL\b/);
});

test("Supabase Data API access is protected by RLS on every table", () => {
  const tables = [...schema.matchAll(/^CREATE TABLE ([a-zA-Z_][a-zA-Z0-9_]*) \(/gm)]
    .map((match) => match[1]);

  for (const table of tables) {
    assert.match(
      schema,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`)
    );
  }
});
