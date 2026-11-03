import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/js/fornecedor.js", import.meta.url), "utf8");
const elements = {
    search: { value: "equipamento" },
    "filter-category": { value: "Equipamentos" },
    "filter-status": { value: "Inativo" },
    "supplier-tbody": { innerHTML: "" },
    pagination: { innerHTML: "" },
    "kpi-total": { textContent: "" },
    "kpi-active": { textContent: "" },
    "kpi-new": { textContent: "" }
};
let requestedUrl;
const context = {
    URLSearchParams,
    document: {
        addEventListener() {},
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() {
            return null;
        }
    },
    window: {},
    console: { error() {} },
    fetch: async (url) => {
        requestedUrl = url;
        return {
            ok: true,
            async json() {
                return {
                    fornecedores: [{
                        id: 8,
                        nome: "Equipamentos Ltda",
                        categoria: "Equipamentos",
                        status: "Inativo"
                    }],
                    total: 21,
                    page: 2,
                    limit: 10,
                    totalPages: 3,
                    summary: { total: 25, ativos: 18, novos: 2 }
                };
            }
        };
    }
};

vm.runInNewContext(source, context);
await context.window.fetchSuppliers();

const query = new URL(requestedUrl, "http://localhost").searchParams;
assert.equal(query.get("q"), "equipamento");
assert.equal(query.get("categoria"), "Equipamentos");
assert.equal(query.get("status"), "Inativo");
assert.equal(query.get("page"), "1");
assert.match(elements["supplier-tbody"].innerHTML, /Equipamentos Ltda/);
assert.match(elements.pagination.innerHTML, /Página 2 de 3/);
assert.match(elements.pagination.innerHTML, /data-supplier-page="3"/);
assert.equal(elements["kpi-total"].textContent, 25);
assert.equal(elements["kpi-active"].textContent, 18);

console.log("Filtros, paginação e indicadores da interface de fornecedores ok");
