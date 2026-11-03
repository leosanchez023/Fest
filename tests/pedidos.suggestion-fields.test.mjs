import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enderecoCorrespondeASelecao,
  valorDaSugestaoOuAtual
} from "../public/js/pedidos/endereco.js";
import { montarPedido } from "../public/js/pedidos/pedido.js";
import { state } from "../public/js/pedidos/state.js";
import {
  buscarSugestoesEndereco,
  resolverNumeroEndereco
} from "../src/modules/pedidos/pedidos.geocoding.js";

test("bairro, número e referência podem ser ajustados sem descartar as coordenadas selecionadas", () => {
  const selected = {
    selectionToken: "selection",
    rua: "Rua das Flores",
    bairro: "Centro",
    cidade: "Campinas",
    estado: "SP",
    cep: "13000-000"
  };
  const edited = {
    ...selected,
    numero: "24",
    bairro: "Jardim Manual",
    referencia: "Bloco B"
  };

  assert.equal(enderecoCorrespondeASelecao(selected, edited), true);
  assert.equal(enderecoCorrespondeASelecao(selected, { ...edited, rua: "Outra rua" }), false);
  assert.equal(enderecoCorrespondeASelecao({ ...selected, selectionToken: "" }, edited), false);
});

test("sugestão sem bairro preserva o bairro digitado manualmente", () => {
  assert.equal(valorDaSugestaoOuAtual("", "Jardim Manual"), "Jardim Manual");
  assert.equal(valorDaSugestaoOuAtual(undefined, "Jardim Manual"), "Jardim Manual");
  assert.equal(valorDaSugestaoOuAtual("Centro", "Jardim Manual"), "Centro");
});

test("payload de criação/edição mantém o token após editar campos não geográficos", () => {
  const previousDocument = globalThis.document;
  const previousSelection = state.enderecoSelecionado;
  const previousItems = state.itens;
  const fields = {
    "end-rua": "Rua das Flores",
    "end-numero": "24",
    "end-bairro": "Jardim Manual",
    "end-cidade": "Campinas",
    "end-estado": "SP",
    "end-cep": "13000-000",
    "end-referencia": "Bloco B"
  };
  globalThis.document = {
    getElementById(id) {
      if (id === "r-total") return { textContent: "0" };
      return Object.hasOwn(fields, id) ? { value: fields[id] } : null;
    }
  };
  state.enderecoSelecionado = {
    id: 8,
    selectionToken: "selection",
    rua: fields["end-rua"],
    numero: "12",
    bairro: "Centro",
    cidade: fields["end-cidade"],
    estado: fields["end-estado"],
    cep: fields["end-cep"],
    referencia: ""
  };
  state.itens = [];

  try {
    const payload = montarPedido();
    assert.equal(payload.destino_token, "selection");
    assert.equal(payload.endereco.bairro, "Jardim Manual");
    assert.equal(payload.endereco.numero, "24");
    assert.equal(payload.endereco.referencia, "Bloco B");
    assert.equal(payload.endereco_id, null, "Endereço textual alterado é salvo sem reutilizar o ID antigo.");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    state.enderecoSelecionado = previousSelection;
    state.itens = previousItems;
  }
});

test("geocodificação aceita bairro alterado mantendo a seleção e o número editado", async () => {
  const previousSecret = process.env.SESSION_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.SESSION_SECRET = "address-suggestion-focused-test-secret-32chars";
  const photonQueries = [];
  globalThis.fetch = async (url) => {
    const target = new URL(url);
    assert.equal(target.hostname, "photon.komoot.io");
    const query = target.searchParams.get("q");
    photonQueries.push(query);
    const features = query === "Rua das Flores 123"
      ? [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [-47.06, -22.91] },
        properties: {
          name: "Rua das Flores",
          street: "Rua das Flores",
          district: "Centro",
          city: "Campinas",
          state: "São Paulo",
          postcode: "13000-000"
        }
      }]
      : [];
    return new Response(JSON.stringify({ features }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const { resultados } = await buscarSugestoesEndereco("Rua das Flores 123");
    const selected = resultados[0];
    assert.ok(selected?.selectionToken);
    const resolved = await resolverNumeroEndereco(selected.selectionToken, {
      rua: selected.rua,
      numero: "456",
      bairro: "Jardim Manual",
      cidade: selected.cidade,
      estado: selected.estado,
      cep: selected.cep,
      referencia: "Bloco B"
    });

    assert.equal(resolved.place.latitude, -22.91);
    assert.equal(resolved.place.longitude, -47.06);
    assert.equal(resolved.aproximada, true);
    assert.match(photonQueries[1], /456/);
    assert.match(photonQueries[1], /Jardim Manual/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});
