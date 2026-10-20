import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/js/fornecedor.js", import.meta.url), "utf8");
const values = {
  "f-id": "",
  "f-name": "Fornecedor Teste",
  "f-cnpj": "12345678901",
  "f-responsavel": "Responsável",
  "f-category": "Equipamentos",
  "f-phone": "11999999999",
  "f-whatsapp": "",
  "f-email": "teste@example.com",
  "f-website": "",
  "f-street": "Rua Um",
  "f-number": "1",
  "f-neighborhood": "Centro",
  "f-city": "São Paulo",
  "f-state": "SP",
  "f-cep": "01000-000",
  "f-product": "Equipamentos",
  "f-delivery": "",
  "f-payment": "",
  "f-notes": "",
  "f-status": "Ativo"
};
const fields = Object.fromEntries(Object.entries(values).map(([id, value]) => [
  id,
  {
    value,
    required: true,
    classList: { add() {}, remove() {} }
  }
]));
const submitButton = { disabled: false };
const errors = [];
const document = {
  addEventListener() {},
  getElementById(id) {
    return fields[id] || null;
  },
  querySelector(selector) {
    return selector === "#supplier-form button[type='submit']" ? submitButton : null;
  }
};
let requests = 0;
let resolveRequest;
const window = {
  FestAlert: {
    async error(_title, message) {
      errors.push(message);
    }
  }
};
const context = {
  document,
  window,
  console: { error() {} },
  fetch(url, options) {
    requests += 1;
    assert.equal(url, "/fornecedores/criar");
    assert.equal(options.method, "POST");
    return new Promise(resolve => {
      resolveRequest = resolve;
    });
  }
};

vm.runInNewContext(source, context);
const event = { preventDefault() {} };
const first = window.saveSupplier(event);
const repeated = window.saveSupplier(event);
assert.equal(requests, 1, "Repeated submit during an outstanding request must not create duplicates");
assert.equal(submitButton.disabled, true);
resolveRequest({
  ok: false,
  async json() { return { error: "Falha simulada" }; }
});
await Promise.all([first, repeated]);
assert.equal(submitButton.disabled, false, "The form must be available again after an error");
assert.match(errors[0], /Falha simulada/);

console.log("Formulário de fornecedor impede envios duplicados e libera após erro");
