import assert from "node:assert/strict";
import db from "../database/connection.js";
import { salvarConfiguracaoEntrega } from "../src/modules/pedidos/pedidos.model.js";

const originalQuery = db.query;
const writes = [];
db.query = async (sql, params = []) => {
  if (sql.includes("INSERT INTO configuracoes_entrega")) {
    writes.push({ sql, params });
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("SELECT origem_rua")) {
    return {
      rows: [{
        origem_rua: "Rua de teste",
        origem_aproximada: writes.at(-1).params[9]
      }],
      rowCount: 1
    };
  }
  throw new Error(`Consulta inesperada no teste: ${sql}`);
};

const configuracao = {
  origem_rua: "Rua de teste",
  origem_numero: "10",
  origem_bairro: null,
  origem_cidade: "São Paulo",
  origem_estado: "SP",
  origem_cep: null,
  origem_referencia: null,
  origem_lat: -23.55,
  origem_lon: -46.64,
  regra_cobranca: "FIXO",
  valor_fixo: 20,
  taxa_inicial: null,
  valor_por_km: null,
  taxa_minima: null,
  distancia_maxima_km: null,
  sentido_distancia: "IDA"
};

try {
  await salvarConfiguracaoEntrega({ ...configuracao, origem_aproximada: true });
  await salvarConfiguracaoEntrega({ ...configuracao, origem_aproximada: false });
  assert.deepEqual(writes.map(({ params }) => params[9]), [1, 0]);
  assert.ok(writes.every(({ params }) => Number.isInteger(params[9])));
  console.log("Persistência da aproximação da origem compatível com PostgreSQL ok");
} finally {
  db.query = originalQuery;
}
