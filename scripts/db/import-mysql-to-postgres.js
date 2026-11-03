import dotenv from "dotenv";
import mysql from "mysql2/promise";
import db from "../../database/connection.js";

dotenv.config();

const sourceUrl = process.env.MYSQL_SOURCE_URL;
if (!sourceUrl) {
  throw new Error("MYSQL_SOURCE_URL é obrigatória para importar os dados MySQL existentes.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória como destino PostgreSQL.");
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Identificador SQL inesperado no schema: ${identifier}`);
  }
  return `"${identifier}"`;
}

function quoteMysqlIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Identificador SQL inesperado no schema MySQL: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function mysqlConnectionOptions(value) {
  const url = new URL(value);
  if (!["mysql:", "mysqls:"].includes(url.protocol)) {
    throw new Error("MYSQL_SOURCE_URL deve usar o protocolo mysql:// ou mysqls://.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) throw new Error("MYSQL_SOURCE_URL precisa indicar o banco MySQL de origem.");
  return {
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: url.protocol === "mysqls:" ? {} : undefined
  };
}

async function getMysqlTables(source) {
  const [rows] = await source.query(
    `SELECT TABLE_NAME AS table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  return rows.map((row) => row.table_name);
}

async function getPostgresTables(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'locagest_schema_migrations'
    ORDER BY table_name
  `);
  return rows.map((row) => row.table_name);
}

async function getTableMetadata(client, table) {
  const { rows: columns } = await client.query(
    `SELECT column_name, ordinal_position, is_identity, column_default, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  const { rows: primaryKey } = await client.query(
    `SELECT key_column.column_name
     FROM information_schema.table_constraints constraint_row
     JOIN information_schema.key_column_usage key_column
       ON key_column.constraint_catalog = constraint_row.constraint_catalog
      AND key_column.constraint_schema = constraint_row.constraint_schema
      AND key_column.constraint_name = constraint_row.constraint_name
      AND key_column.table_schema = constraint_row.table_schema
      AND key_column.table_name = constraint_row.table_name
     WHERE constraint_row.table_schema = 'public'
       AND constraint_row.table_name = $1
       AND constraint_row.constraint_type = 'PRIMARY KEY'
     ORDER BY key_column.ordinal_position`,
    [table]
  );
  if (!columns.length || !primaryKey.length) {
    throw new Error(`A tabela PostgreSQL ${table} não possui colunas ou chave primária.`);
  }
  return {
    columns,
    primaryKey: primaryKey.map((column) => column.column_name)
  };
}

async function orderTablesByForeignKeys(client, tables) {
  const { rows: foreignKeys } = await client.query(`
    SELECT child.relname AS child_table, parent.relname AS parent_table
    FROM pg_constraint constraint_row
    JOIN pg_class child ON child.oid = constraint_row.conrelid
    JOIN pg_class parent ON parent.oid = constraint_row.confrelid
    JOIN pg_namespace schema_row ON schema_row.oid = child.relnamespace
    WHERE constraint_row.contype = 'f'
      AND schema_row.nspname = 'public'
  `);
  const included = new Set(tables);
  const dependencies = new Map(tables.map((table) => [table, new Set()]));
  for (const { child_table: child, parent_table: parent } of foreignKeys) {
    if (included.has(child) && included.has(parent) && child !== parent) {
      dependencies.get(child).add(parent);
    }
  }

  const ordered = [];
  const ready = tables.filter((table) => dependencies.get(table).size === 0);
  while (ready.length) {
    const table = ready.shift();
    ordered.push(table);
    for (const candidate of tables) {
      if (dependencies.get(candidate).delete(table) && dependencies.get(candidate).size === 0) {
        ready.push(candidate);
      }
    }
  }
  if (ordered.length !== tables.length) {
    throw new Error("O schema possui dependências circulares entre tabelas; a ordem segura de importação não pôde ser determinada.");
  }
  return ordered;
}

async function ensureEmptyDestination(client, tables) {
  for (const table of tables) {
    const { rows } = await client.query(`SELECT COUNT(*)::bigint AS count FROM public.${quoteIdentifier(table)}`);
    if (BigInt(rows[0].count) > 0n) {
      throw new Error(`A tabela de destino ${table} já contém dados. O importador exige tabelas vazias.`);
    }
  }
}

async function countMysqlRows(source, table) {
  const [rows] = await source.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`);
  return BigInt(rows[0].count);
}

function buildInsert(table, columns, rowCount) {
  const quotedColumns = columns.map((column) => quoteIdentifier(column)).join(", ");
  const values = [];
  let parameter = 1;
  for (let row = 0; row < rowCount; row++) {
    const placeholders = columns.map(() => `$${parameter++}`);
    values.push(`(${placeholders.join(", ")})`);
  }
  return {
    sql: `INSERT INTO public.${quoteIdentifier(table)} (${quotedColumns}) VALUES ${values.join(", ")}`,
    parameterCount: parameter - 1
  };
}

async function copyTable(source, client, table, metadata) {
  const destinationColumns = metadata.columns.map((column) => column.column_name);
  const sourceColumnRows = await source.query(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  const sourceColumns = sourceColumnRows[0].map((column) => column.column_name);
  if (sourceColumns.length !== destinationColumns.length ||
      sourceColumns.some((column) => !destinationColumns.includes(column))) {
    throw new Error(`Colunas divergentes entre MySQL e PostgreSQL na tabela ${table}. Nenhuma transferência foi confirmada.`);
  }

  const total = await countMysqlRows(source, table);
  const batchSize = Math.max(1, Math.min(500, Math.floor(60_000 / sourceColumns.length)));
  const ordering = metadata.primaryKey.map((column) => quoteMysqlIdentifier(column)).join(", ");
  let copied = 0n;

  while (copied < total) {
    const limit = Number(total - copied > BigInt(batchSize) ? BigInt(batchSize) : total - copied);
    const [rows] = await source.query(
      `SELECT ${sourceColumns.map(quoteMysqlIdentifier).join(", ")}
       FROM ${quoteMysqlIdentifier(table)}
       ORDER BY ${ordering}
       LIMIT ? OFFSET ?`,
      [limit, copied.toString()]
    );
    if (!rows.length) {
      throw new Error(`A leitura da tabela MySQL ${table} terminou antes da contagem esperada.`);
    }

    const { sql, parameterCount } = buildInsert(table, sourceColumns, rows.length);
    const values = new Array(parameterCount);
    let valueIndex = 0;
    for (const row of rows) {
      for (const column of sourceColumns) values[valueIndex++] = row[column];
    }
    await client.query(sql, values);
    copied += BigInt(rows.length);
  }

  const { rows: destinationRows } = await client.query(
    `SELECT COUNT(*)::bigint AS count FROM public.${quoteIdentifier(table)}`
  );
  if (BigInt(destinationRows[0].count) !== total) {
    throw new Error(`A contagem importada não confere para ${table}.`);
  }

  return total.toString();
}

async function resetIdentitySequences(client, tables, metadataByTable) {
  for (const table of tables) {
    for (const column of metadataByTable.get(table).columns) {
      if (column.is_identity !== "YES" && !column.column_default?.startsWith("nextval(")) continue;
      const { rows } = await client.query(
        `SELECT setval(
           pg_get_serial_sequence($1, $2),
           COALESCE(MAX(${quoteIdentifier(column.column_name)}), 1),
           COUNT(*) > 0
         )
         FROM public.${quoteIdentifier(table)}`,
        [`public.${table}`, column.column_name]
      );
      if (rows[0].setval === null) {
        throw new Error(`Não foi possível sincronizar a sequence de ${table}.${column.column_name}.`);
      }
    }
  }
}

const source = await mysql.createConnection(mysqlConnectionOptions(sourceUrl));
const client = await db.connect();
let transactionOpen = false;
try {
  const sourceTables = await getMysqlTables(source);
  const destinationTables = await getPostgresTables(client);
  const missingInSource = destinationTables.filter((table) => !sourceTables.includes(table));
  const missingInDestination = sourceTables.filter((table) => !destinationTables.includes(table));
  if (missingInSource.length || missingInDestination.length) {
    throw new Error(
      `As tabelas de origem e destino não correspondem. Faltam no MySQL: [${missingInSource.join(", ")}]; ` +
      `faltam no PostgreSQL: [${missingInDestination.join(", ")}].`
    );
  }

  await ensureEmptyDestination(client, destinationTables);
  const tableOrder = await orderTablesByForeignKeys(client, destinationTables);
  const metadataByTable = new Map();
  for (const table of tableOrder) {
    metadataByTable.set(table, await getTableMetadata(client, table));
  }

  await source.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  await client.query("BEGIN");
  transactionOpen = true;
  const report = {};
  for (const table of tableOrder) {
    report[table] = await copyTable(source, client, table, metadataByTable.get(table));
    console.log(`Importada ${table}: ${report[table]} registro(s).`);
  }
  await resetIdentitySequences(client, tableOrder, metadataByTable);
  await client.query("COMMIT");
  transactionOpen = false;
  await source.commit();
  console.log("Importação confirmada. Contagens por tabela:");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Falha ao reverter a transação PostgreSQL:", rollbackError);
    }
  }
  try {
    await source.rollback();
  } catch (rollbackError) {
    console.error("Falha ao encerrar a transação de leitura MySQL:", rollbackError);
  }
  throw error;
} finally {
  client.release();
  await source.end();
  await db.end();
}
