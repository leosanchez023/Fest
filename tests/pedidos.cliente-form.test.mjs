import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("../public/js/pedidos/cliente.js", import.meta.url), "utf8"))
  .replace(/^\uFEFF/, "")
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export function inicializarCliente()", "function inicializarCliente()");

function createBrowser(fetchImpl) {
  const feedback = { hidden: true, textContent: "" };
  const submitButton = { disabled: false };
  const clientDisplay = { innerHTML: "" };
  const panel = { style: { display: "block" } };
  const clientPhone = { value: "" };
  const contactPhone = { value: "Contato preenchido antes do cadastro" };
  const form = {
    action: "/pedidos/criarCliente",
    dataset: {},
    values: { nome: "Ana", email: "ana@example.com", cpf: "12345678901" },
    resetCount: 0,
    reportValidity() { return true; },
    addEventListener(name, handler) { this.submitHandler = handler; },
    querySelector(selector) {
      if (selector === 'button[type="submit"]') return submitButton;
      if (selector === "[data-form-error]") return feedback;
      return null;
    },
    reset() { this.resetCount += 1; }
  };
  const state = { clienteSelecionado: null };
  const alerts = [];
  const document = {
    getElementById(id) {
      return ({
        "cliente-display": clientDisplay,
        "cliente-painel": panel,
        "formClientePedido": form,
        "tel-cliente": clientPhone,
        "tel-contato": contactPhone
      })[id] || null;
    }
  };
  class FormDataMock {
    constructor(element) {
      this.entries = Object.entries(element.values);
    }
    [Symbol.iterator]() {
      return this.entries[Symbol.iterator]();
    }
  }
  const context = {
    document,
    window: {
      FestAlert: {
        async error(title, message) {
          alerts.push({ title, message });
        }
      }
    },
    FormData: FormDataMock,
    console: { error() {} },
    state,
    $: (id) => document.getElementById(id),
    esc: (value) => String(value ?? ""),
    debounce: (fn) => fn,
    fetch: fetchImpl
  };
  vm.runInNewContext(`${source}\ninicializarCliente();`, context);
  return { context, form, feedback, submitButton, panel, clientPhone, contactPhone, state, alerts };
}

let resolveFetch;
let requestCount = 0;
let submittedBody;
const successBrowser = createBrowser((url, options) => {
  requestCount += 1;
  submittedBody = JSON.parse(options.body);
  assert.equal(url, "/pedidos/criarCliente");
  assert.equal(options.method, "POST");
  return new Promise((resolve) => {
    resolveFetch = resolve;
  });
});

let prevented = false;
const firstSubmit = successBrowser.form.submitHandler({
  preventDefault() { prevented = true; },
  currentTarget: successBrowser.form
});
const repeatedSubmit = successBrowser.form.submitHandler({
  preventDefault() {},
  currentTarget: successBrowser.form
});
assert.equal(prevented, true, "Form submit must not trigger document navigation");
assert.equal(requestCount, 1, "Repeated submit while saving must send a single request");
assert.equal(successBrowser.submitButton.disabled, true);
resolveFetch({
  ok: true,
  async json() {
    return {
      id: 31,
      nome: "Ana",
      email: "ana@example.com",
      cpf: "12345678901",
      telefone: "11999999999"
    };
  }
});
await Promise.all([firstSubmit, repeatedSubmit]);
assert.equal(submittedBody.nome, "Ana");
assert.equal(successBrowser.state.clienteSelecionado.id, 31);
assert.equal(successBrowser.panel.style.display, "none");
assert.equal(successBrowser.form.resetCount, 1);
assert.equal(successBrowser.contactPhone.value, "Contato preenchido antes do cadastro");
assert.equal(successBrowser.submitButton.disabled, false);

const errorBrowser = createBrowser(async () => ({
  ok: false,
  async json() {
    return { erro: "Já existe um cliente com este e-mail ou CPF." };
  }
}));
await errorBrowser.form.submitHandler({
  preventDefault() {},
  currentTarget: errorBrowser.form
});
assert.equal(errorBrowser.feedback.hidden, false);
assert.match(errorBrowser.feedback.textContent, /Já existe um cliente/);
assert.equal(errorBrowser.form.resetCount, 0, "Failed submission must preserve typed data");
assert.equal(errorBrowser.state.clienteSelecionado, null);

const orderTemplate = await readFile(new URL("../views/pages/pedidos.handlebars", import.meta.url), "utf8");
assert.ok(
  orderTemplate.indexOf('id="data-entrega"') < orderTemplate.indexOf('id="data-evento"') &&
  orderTemplate.indexOf('id="data-evento"') < orderTemplate.indexOf('id="data-retirada"'),
  "The date fields must render in delivery, event, pickup order"
);

console.log("Testes de cadastro de cliente no pedido, preservação de campos e ordem das datas ok");
