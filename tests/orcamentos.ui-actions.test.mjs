import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/js/orcamentos.js", import.meta.url), "utf8");
let domReady;
let duplicateRequests = 0;
let resolveDuplicate;
const alerts = [];
const tbody = {
  innerHTML: "",
  addEventListener(_name, handler) {
    this.clickHandler = handler;
  }
};
const search = {
  value: "",
  addEventListener() {}
};
const newButton = { addEventListener() {} };
const document = {
  getElementById(id) {
    return ({
      q: search,
      "orcamentos-tbody": tbody,
      "btn-new": newButton
    })[id] || null;
  }
};
const window = {
  location: { href: "" },
  addEventListener(name, handler) {
    if (name === "DOMContentLoaded") domReady = handler;
  },
  FestAlert: {
    async confirm() {
      return { isConfirmed: true };
    },
    async success(_title, message) {
      alerts.push(message);
    },
    async error(_title, message) {
      alerts.push(message);
    }
  }
};
const context = {
  document,
  window,
  console: { error() {} },
  fetch(url) {
    if (url === "/orcamentos/list?search=") {
      return Promise.resolve({
        ok: true,
        async json() { return []; }
      });
    }
    if (url === "/orcamentos/55/duplicate") {
      duplicateRequests += 1;
      return new Promise(resolve => {
        resolveDuplicate = resolve;
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  },
  setTimeout,
  clearTimeout
};

vm.runInNewContext(source, context);
domReady();
await new Promise(resolve => setImmediate(resolve));

const button = {
  disabled: false,
  dataset: { action: "duplicate", id: "55" }
};
const event = { target: { closest: () => button } };
tbody.clickHandler(event);
tbody.clickHandler(event);
assert.equal(duplicateRequests, 1, "A repeated click must not create a second duplicate request");
assert.equal(button.disabled, true, "The action button must be disabled while the request is pending");

resolveDuplicate({
  ok: true,
  async json() { return { novoId: 72 }; }
});
await new Promise(resolve => setImmediate(resolve));
assert.equal(window.location.href, "/pedidos?orcamento=72");
assert.equal(button.disabled, false, "The action button must be restored after completion");

console.log("Ações de orçamento bloqueiam requisições duplicadas e redirecionam após duplicação");
