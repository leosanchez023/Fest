import assert from "node:assert/strict";
import db from "../database/connection.js";
import {
  criarPedido,
  atualizarPedido,
  salvarConfiguracaoEntrega,
  buscarConfiguracaoEntrega,
  buscarSugestoesEndereco,
  calcularRota
} from "../src/modules/pedidos/pedidos.service.js";

const tag = Date.now();
process.env.SESSION_SECRET = `fest-address-route-test-${tag}-secret-with-at-least-32-chars`;
const originalFetch = globalThis.fetch;
const photonCalls = [];
const routeCalls = [];
let concurrentPhotonCalls = 0;
let maxConcurrentPhotonCalls = 0;
let clienteId;
let produtoId;
const pedidosIds = [];
let previousDeliveryConfig;
const street = `Rua Similar ${tag}`;
const originAddress = `Avenida Origem ${tag}`;
const destination = {
  rua: street,
  numero: "42",
  bairro: "Centro",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01000-000",
  referencia: "Apto 3"
};
const eventDate = new Date();
eventDate.setDate(eventDate.getDate() + 3);
const date = eventDate.toISOString().slice(0, 10);

function photonFeature({
  name,
  streetName,
  number = "",
  longitude,
  latitude,
  district = "Centro",
  city = "São Paulo",
  state = "São Paulo",
  postcode = "01000-000"
}) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: {
      name,
      street: streetName,
      housenumber: number,
      district,
      city,
      state,
      postcode
    }
  };
}

function photonResponse(query) {
  if (query.includes("sem resultados")) return [];
  if (query.includes("Cidade Sem Correspondencia")) return [];
  if (query.includes("Rua sem bairro")) {
    return [photonFeature({
      name: "Rua sem bairro",
      streetName: "Rua sem bairro",
      district: "São Paulo",
      longitude: -46.64,
      latitude: -23.55
    })];
  }
  if (query.includes("Tupã") && !query.includes("Rua Brasil")) {
    return [photonFeature({
      name: "Tupã",
      streetName: "Tupã",
      longitude: -50.5141255,
      latitude: -21.9349129,
      city: "Tupã"
    })];
  }
  if (query.includes("Rua Brasil") && query.includes("Tupã")) {
    return [
      photonFeature({
        name: "Hospital São Francisco",
        streetName: "Rua Coroados",
        longitude: -50.5135,
        latitude: -21.9363,
        district: "Centro",
        city: "Tupã",
        postcode: "17600-010"
      }),
      photonFeature({
        name: "Rua Brasil",
        streetName: "Rua Brasil",
        longitude: -50.5964709,
        latitude: -21.9042961,
        district: "Universo",
        city: "Tupã",
        postcode: "17600-000"
      }),
      photonFeature({
        name: "Rua Brasil",
        streetName: "Rua Brasil",
        longitude: -50.515,
        latitude: -21.93,
        district: "Tupã",
        city: "Tupã",
        postcode: "17600-000"
      }),
      photonFeature({
        name: "Rua Brasil",
        streetName: "Rua Brasil",
        longitude: -50.51,
        latitude: -21.93,
        district: "Centro",
        city: "Tupã",
        postcode: "17600-010"
      }),
      photonFeature({
        name: "Banco do Brasil",
        streetName: "Rua Coroados",
        longitude: -50.5141228,
        latitude: -21.9356264,
        district: "Centro",
        city: "Tupã",
        postcode: "17600-010"
      }),
      photonFeature({
        name: "Rua Brasil",
        streetName: "Rua Brasil",
        longitude: -50.51,
        latitude: -21.93,
        district: "Centro",
        city: "Tupã",
        postcode: "17600-000"
      }),
      photonFeature({
        name: "Rua Brasil",
        streetName: "Rua Brasil",
        longitude: -46.79,
        latitude: -23.53,
        district: "Centro",
        city: "Osasco",
        postcode: "06010-000"
      })
    ];
  }
  if (query.includes("Rua Brasil")) {
    return [photonFeature({
      name: "Rua Brasil",
      streetName: "Rua Brasil",
      longitude: -46.79,
      latitude: -23.53,
      district: "Centro",
      city: "Osasco",
      postcode: "06010-000"
    })];
  }
  if (query.includes("origem")) {
    return [photonFeature({
      name: originAddress,
      streetName: originAddress,
      longitude: -46.633308,
      latitude: -23.55052
    })];
  }
  if (query.includes("sem rota")) {
    return [photonFeature({
      name: `Destino sem rota ${tag}`,
      streetName: `Destino sem rota ${tag}`,
      longitude: -47,
      latitude: -24
    })];
  }
  return [
    photonFeature({
      name: street,
      streetName: street,
      number: "41",
      longitude: -46.65,
      latitude: -23.56
    }),
    photonFeature({
      name: street,
      streetName: street,
      number: "43",
      longitude: -46.6501,
      latitude: -23.5601
    })
  ];
}

try {
  const [existingConfig] = await db.query("SELECT * FROM configuracoes_entrega WHERE id = 1");
  previousDeliveryConfig = existingConfig[0] || null;
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(url);
    if (target.hostname === "photon.komoot.io") {
      photonCalls.push({
        timestamp: Date.now(),
        query: target.searchParams.get("q"),
        latitude: target.searchParams.get("lat"),
        longitude: target.searchParams.get("lon")
      });
      assert.ok(["5", "20"].includes(target.searchParams.get("limit")));
      assert.equal(target.searchParams.has("lang"), false, "Photon não aceita pt como idioma de busca.");
      assert.match(options.headers["User-Agent"], /^FestaGest\/1\.0/);
      concurrentPhotonCalls += 1;
      maxConcurrentPhotonCalls = Math.max(maxConcurrentPhotonCalls, concurrentPhotonCalls);
      await new Promise((resolve) => setTimeout(resolve, 20));
      concurrentPhotonCalls -= 1;
      if (target.searchParams.get("q").includes("servico indisponivel")) {
        return new Response("indisponível", { status: 503 });
      }
      const query = target.searchParams.get("q")
        + (target.searchParams.has("lat") ? ", Tupã" : "");
      return new Response(JSON.stringify({ features: photonResponse(query) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    assert.equal(target.hostname, "router.project-osrm.org");
    routeCalls.push(target);
    assert.match(target.pathname, /\/route\/v1\/driving\/-46\.633308,?-?23\.55052;/);
    if (target.pathname.includes("-47,-24")) {
      return new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      code: "Ok",
      routes: [{ distance: 12500 }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const queryOrigin = `origem ${tag}`;
  const queryDestination = `Rua Similar ${tag}`;
  const [originResponse, destinationResponse, duplicateDestinationResponse] = await Promise.all([
    buscarSugestoesEndereco(queryOrigin),
    buscarSugestoesEndereco(queryDestination),
    buscarSugestoesEndereco(queryDestination)
  ]);
  const originResults = originResponse.resultados;
  const firstDestinationSearch = destinationResponse.resultados;
  const duplicateDestinationSearch = duplicateDestinationResponse.resultados;
  assert.equal(originResults[0].rua, originAddress);
  assert.equal(originResults[0].estado, "SP");
  assert.equal(originResults[0].latitude, -23.55052);
  assert.equal(firstDestinationSearch.length, 2, "Sugestões semelhantes devem permanecer selecionáveis.");
  assert.equal(firstDestinationSearch[0].numero, "41");
  assert.equal(firstDestinationSearch[1].numero, "43");
  assert.equal(firstDestinationSearch[0].cep, "01000-000");
  assert.equal(typeof firstDestinationSearch[0].selectionToken, "string");
  assert.deepEqual(duplicateDestinationSearch, firstDestinationSearch);
  assert.equal(photonCalls.length, 2, "Consultas simultâneas iguais devem ser deduplicadas.");
  assert.equal(maxConcurrentPhotonCalls, 1);
  assert.ok(photonCalls[1].timestamp - photonCalls[0].timestamp >= 1000);
  const localSearch = await buscarSugestoesEndereco("Rua Brasil", {
    cidade: "Tupã",
    estado: "São Paulo",
    bairro: "Centro",
    cep: "17600-000"
  });
  assert.equal(localSearch.contextoAplicado, true);
  assert.deepEqual(localSearch.resultados.map((place) => place.cidade), ["Tupã", "Tupã", "Tupã"]);
  assert.equal(localSearch.resultados[0].bairro, "Centro");
  assert.equal(localSearch.resultados[0].cep, "17600-000");
  assert.equal(localSearch.resultados[1].bairro, "", "O provedor não deve rotular o próprio município como bairro.");
  assert.equal(localSearch.resultados[1].cep, "17600-000");
  assert.equal(localSearch.resultados[2].cep, "17600-010", "CEP exato deve ser priorizado sem ocultar outros endereços compatíveis na cidade.");
  assert.equal(
    photonCalls.find((call) => call.query.startsWith("Rua Brasil"))?.query,
    "Rua Brasil",
    "A consulta ao Photon deve buscar a rua separadamente do contexto de localidade."
  );
  const biasedStreetCall = photonCalls.find((call) => call.query === "Rua Brasil");
  assert.equal(biasedStreetCall.latitude, "-21.9349129");
  assert.equal(biasedStreetCall.longitude, "-50.5141255");
  const broadSearch = await buscarSugestoesEndereco("Rua Brasil", {
    cidade: "Tupã",
    estado: "São Paulo",
    bairro: "Centro",
    cep: "17600-000"
  }, true);
  assert.equal(broadSearch.buscaAmpla, true);
  assert.equal(broadSearch.resultados[0].cidade, "Osasco");
  const noLocalMatch = await buscarSugestoesEndereco("Rua Brasil", {
    cidade: "Cidade Sem Correspondencia",
    estado: "SP"
  });
  assert.equal(noLocalMatch.contextoAplicado, true);
  assert.deepEqual(noLocalMatch.resultados, []);
  await assert.rejects(() => buscarSugestoesEndereco("ab"), /3 e 200 caracteres/);
  assert.deepEqual((await buscarSugestoesEndereco(`sem resultados ${tag}`)).resultados, []);
  const noRouteResults = (await buscarSugestoesEndereco(`sem rota ${tag}`)).resultados;
  await assert.rejects(
    () => buscarSugestoesEndereco(`servico indisponivel ${tag}`),
    /indisponível/
  );
  globalThis.fetch = async () => {
    throw new TypeError("network unavailable");
  };
  await assert.rejects(
    () => buscarSugestoesEndereco(`falha de rede ${tag}`),
    /Não foi possível conectar/
  );

  const origin = originResults[0];
  const originAddressFields = {
    rua: origin.rua,
    numero: "104",
    bairro: origin.bairro,
    cidade: origin.cidade,
    estado: origin.estado,
    cep: origin.cep,
    referencia: ""
  };
  let originNumberLookupQuery = "";
  globalThis.fetch = async (url) => {
    const target = new URL(url);
    if (target.hostname !== "photon.komoot.io") {
      throw new Error(`Provedor inesperado na busca do número: ${target.hostname}`);
    }
    originNumberLookupQuery = target.searchParams.get("q") || "";
    return new Response(JSON.stringify({ features: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields, selectionToken: origin.selectionToken },
    regra_cobranca: "POR_KM",
    valor_por_km: "2,50",
    sentido_distancia: "IDA"
  });
  const persistedConfig = await buscarConfiguracaoEntrega();
  assert.equal(persistedConfig.configurado, true, "A configuração de entrega deve continuar disponível após nova leitura.");
  assert.equal(persistedConfig.configuracao.regra_cobranca, "POR_KM");
  assert.equal(persistedConfig.configuracao.origem_numero, "104", "O número informado manualmente deve ser salvo separado.");
  assert.equal(Boolean(persistedConfig.configuracao.origem_aproximada), true, "Sem geocodificação exata, a origem deve permanecer sinalizada como aproximada.");
  assert.match(originNumberLookupQuery, /\b104\b/, "A tentativa de geocodificação deve incluir o número do imóvel.");
  assert.equal(Number(persistedConfig.configuracao.valor_por_km), 2.5, "Valores decimais com vírgula devem ser aceitos.");
  originAddressFields.numero = "105";
  originNumberLookupQuery = "";
  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields },
    regra_cobranca: "POR_KM",
    valor_por_km: "2,50",
    sentido_distancia: "IDA"
  });
  const updatedNumberConfig = await buscarConfiguracaoEntrega();
  assert.equal(updatedNumberConfig.configuracao.origem_numero, "105", "O número da origem deve poder ser atualizado sem selecionar outra rua.");
  assert.match(originNumberLookupQuery, /\b105\b/, "A geocodificação do número alterado deve usar as coordenadas da origem salva.");
  originAddressFields.numero = "";
  const routeAddress = (place, numero = "") => ({
    rua: place.rua,
    numero,
    bairro: place.bairro,
    cidade: place.cidade,
    estado: place.estado,
    cep: place.cep
  });
  globalThis.fetch = async (url) => {
    const target = new URL(url);
    if (target.hostname === "photon.komoot.io") {
      photonCalls.push({
        timestamp: Date.now(),
        query: target.searchParams.get("q"),
        latitude: target.searchParams.get("lat"),
        longitude: target.searchParams.get("lon")
      });
      assert.ok(["5", "10", "20"].includes(target.searchParams.get("limit")));
      return new Response(JSON.stringify({
        features: photonResponse(target.searchParams.get("q"))
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    routeCalls.push(target);
    return new Response(JSON.stringify({
      code: "Ok",
      routes: [{ distance: 12500 }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const quote = await calcularRota(firstDestinationSearch[0].selectionToken, "42", destination);
  assert.equal(quote.distanciaKm, 12.5, "A distância deve ser a distância viária devolvida pelo OSRM.");
  assert.equal(quote.valorFrete, 31.25, "A taxa existente de R$ 2,50/km deve incidir só sobre a ida.");
  assert.equal(quote.distanciaCobradaKm, 12.5);
  assert.equal(quote.sentidoDistancia, "IDA");
  assert.equal(quote.destinoAproximado, true, "Número sem geocodificação exata deve ser sinalizado como aproximado.");
  assert.equal(routeCalls[0].searchParams.get("overview"), "false");
  await calcularRota(firstDestinationSearch[0].selectionToken, "42", destination);
  assert.equal(routeCalls.length, 1, "Cálculos repetidos da mesma rota devem usar cache.");
  const missingNeighborhoodResults = await buscarSugestoesEndereco(`Rua sem bairro ${tag}`);
  assert.equal(missingNeighborhoodResults.resultados[0].bairro, "");
  const manuallyCompletedDestination = {
    rua: missingNeighborhoodResults.resultados[0].rua,
    numero: "17",
    bairro: "Centro",
    cidade: missingNeighborhoodResults.resultados[0].cidade,
    estado: missingNeighborhoodResults.resultados[0].estado,
    cep: missingNeighborhoodResults.resultados[0].cep
  };
  const manuallyCompletedQuote = await calcularRota(
    missingNeighborhoodResults.resultados[0].selectionToken,
    "17",
    manuallyCompletedDestination
  );
  assert.equal(manuallyCompletedQuote.destinoAproximado, true,
    "A rota deve aceitar o bairro informado quando o provedor não retornou esse componente.");
  const [destinationPayload, destinationSignature] = firstDestinationSearch[0].selectionToken.split(".");
  await assert.rejects(
    () => calcularRota(`${destinationPayload}.${destinationSignature[0] === "a" ? "b" : "a"}${destinationSignature.slice(1)}`,
      "42", destination),
    /inválida/
  );
  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields, selectionToken: origin.selectionToken },
    regra_cobranca: "POR_KM",
    valor_por_km: "2.50",
    sentido_distancia: "IDA_VOLTA"
  });
  const returnQuote = await calcularRota(
    firstDestinationSearch[0].selectionToken,
    "41",
    routeAddress(firstDestinationSearch[0], "41")
  );
  assert.equal(returnQuote.distanciaKm, 12.5);
  assert.equal(returnQuote.distanciaRetornoKm, 12.5, "Ida e volta devem consultar cada direção separadamente.");
  assert.equal(returnQuote.distanciaCobradaKm, 25);
  assert.equal(returnQuote.valorFrete, 62.5);
  assert.equal(routeCalls.length, 4);

  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields, selectionToken: origin.selectionToken },
    regra_cobranca: "FIXO",
    valor_fixo: "17.25",
    sentido_distancia: "IDA"
  });
  const fixedQuote = await calcularRota(
    firstDestinationSearch[0].selectionToken,
    "41",
    routeAddress(firstDestinationSearch[0], "41")
  );
  assert.equal(fixedQuote.valorFrete, 17.25);
  assert.match(fixedQuote.formula, /Frete fixo R\$ 17\.25/);
  assert.equal(routeCalls.length, 5);

  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields, selectionToken: origin.selectionToken },
    regra_cobranca: "FIXO_POR_KM",
    taxa_inicial: "3.00",
    valor_por_km: "2.50",
    taxa_minima: "40.00",
    sentido_distancia: "IDA"
  });
  const minimumQuote = await calcularRota(
    firstDestinationSearch[0].selectionToken,
    "41",
    routeAddress(firstDestinationSearch[0], "41")
  );
  assert.equal(minimumQuote.valorFrete, 40, "A taxa mínima configurada deve ser aplicada uma vez.");

  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields, selectionToken: origin.selectionToken },
    regra_cobranca: "POR_KM",
    valor_por_km: "2.50",
    distancia_maxima_km: "10",
    sentido_distancia: "IDA"
  });
  await assert.rejects(
    () => calcularRota(
      firstDestinationSearch[0].selectionToken,
      "41",
      routeAddress(firstDestinationSearch[0], "41")
    ),
    /distância máxima de entrega configurada/
  );

  await salvarConfiguracaoEntrega({
    origem: { ...originAddressFields, selectionToken: origin.selectionToken },
    regra_cobranca: "POR_KM",
    valor_por_km: "2.50",
    sentido_distancia: "IDA"
  });
  await calcularRota(
    localSearch.resultados[0].selectionToken,
    "",
    routeAddress(localSearch.resultados[0])
  );
  assert.match(routeCalls[routeCalls.length - 1].pathname, /;-50\.51,-21\.93$/);

  globalThis.fetch = async (url) => {
    if (new URL(url).hostname === "photon.komoot.io") {
      return new Response("temporarily unavailable", { status: 503 });
    }
    routeCalls.push(new URL(url));
    return new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 12500 }] }), { status: 200 });
  };
  const lookupUnavailableQuote = await calcularRota(
    firstDestinationSearch[0].selectionToken,
    "99",
    routeAddress(firstDestinationSearch[0], "99")
  );
  assert.equal(lookupUnavailableQuote.destinoAproximado, true);
  assert.equal(lookupUnavailableQuote.numeroLookupFalhou, true, "A falha do Photon deve ser exposta como rota aproximada, nunca como localização exata.");

  globalThis.fetch = async () => new Response(
    JSON.stringify({ code: "NoRoute", routes: [] }),
    { status: 200 }
  );
  await assert.rejects(
    () => calcularRota(
      noRouteResults[0].selectionToken,
      "",
      routeAddress(noRouteResults[0])
    ),
    /Não foi encontrada uma rota viária/
  );

  globalThis.fetch = async (url) => {
    const target = new URL(url);
    if (target.hostname === "photon.komoot.io") {
      photonCalls.push({
        timestamp: Date.now(),
        query: target.searchParams.get("q"),
        latitude: target.searchParams.get("lat"),
        longitude: target.searchParams.get("lon")
      });
      return new Response(JSON.stringify({
        features: photonResponse(target.searchParams.get("q"))
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 12500 }] }), { status: 200 });
  };
  const [cliente] = await db.query(
    "INSERT INTO cliente (nome, email) VALUES (?, ?)",
    [`__TESTE_ROTA_${tag}`, `__rota_${tag}@example.test`]
  );
  clienteId = cliente.insertId;
  const [produto] = await db.query(
    `INSERT INTO produtos
      (nome, tipo_produto, estoque, ativo, preco_venda, preco_aluguel)
     VALUES (?, 'PRODUTO', 2, 1, 50, 0)`,
    [`__TESTE_ROTA_${tag}`]
  );
  produtoId = produto.insertId;

  const makeOrder = (address = destination) => ({
    cliente_id: clienteId,
    endereco_id: null,
    endereco: address,
    destino_token: firstDestinationSearch[0].selectionToken,
    telefone_contato: "",
    tipo_pedido: "VENDA",
    status: "ORCAMENTO",
    status_documento: "ORCAMENTO",
    distancia_km: 999,
    valor_frete: 0,
    valor_desconto: 0,
    valor_pago: 0,
    data_evento: date,
    data_entrega: date,
    data_retirada: date,
    itens: [{ produto_id: produtoId, tipo_item: "VENDA", quantidade: 1 }]
  });

  const firstOrder = await criarPedido(makeOrder());
  const secondOrder = await criarPedido(makeOrder());
  pedidosIds.push(firstOrder.pedidoId, secondOrder.pedidoId);

  const [saved] = await db.query(
    `SELECT p.endereco_id, p.endereco_origem, p.origem_lat, p.origem_lon,
            p.destino_lat, p.destino_lon, p.distancia_km, p.valor_frete, p.valor_total,
            e.rua, e.numero, e.bairro, e.cidade, e.estado, e.cep, e.referencia
     FROM pedidos p JOIN endereco e ON e.id = p.endereco_id
     WHERE p.id IN (?, ?) ORDER BY p.id`,
    pedidosIds
  );
  assert.equal(saved.length, 2);
  assert.equal(saved[0].endereco_id, saved[1].endereco_id);
  assert.equal(Number(saved[0].distancia_km), 12.5);
  assert.equal(Number(saved[0].valor_frete), 31.25);
  assert.equal(Number(saved[0].valor_total), 81.25);
  assert.ok(saved[0].endereco_origem.includes(originAddress));
  assert.equal(Number(saved[0].origem_lat), originResults[0].latitude);
  assert.equal(Number(saved[0].destino_lon), firstDestinationSearch[0].longitude);
  assert.deepEqual(
    ["rua", "numero", "bairro", "cidade", "estado", "cep", "referencia"].map((field) => saved[0][field]),
    Object.values(destination)
  );

  await atualizarPedido(firstOrder.pedidoId, {
    ...makeOrder({ ...destination, numero: "43" }),
    recalcular_rota: true,
    endereco_id: null,
    observacoes: ""
  });
  const [updated] = await db.query(
    "SELECT distancia_km, distancia_cobrada_km, destino_aproximado, valor_frete, valor_total FROM pedidos WHERE id = ?",
    [firstOrder.pedidoId]
  );
  assert.equal(Number(updated[0].distancia_km), 12.5);
  assert.equal(Number(updated[0].valor_frete), 31.25);
  assert.equal(Number(updated[0].valor_total), 81.25);
  assert.equal(Number(updated[0].destino_aproximado), 0, `O número 43 deve ser geocodificado pelo resultado exato do Photon. Consultas: ${JSON.stringify(photonCalls)}`);
  assert.equal(Number(updated[0].distancia_cobrada_km), 12.5);
  assert.ok(photonCalls.some((call) => call.query.includes("43")), "O número digitado deve participar de uma nova busca no Photon.");
  const [orderCount] = await db.query(
    "SELECT COUNT(*) AS total FROM pedidos WHERE id IN (?, ?)",
    pedidosIds
  );
  assert.equal(Number(orderCount[0].total), 2, "Editar deve atualizar o pedido, sem criar duplicata.");

  await assert.rejects(
    () => atualizarPedido(secondOrder.pedidoId, {
      ...makeOrder({ ...destination, cidade: "Outra cidade" }),
      endereco_id: null
    }),
    /destino foi alterado/
  );

  console.log("Teste integrado de endereços e rotas ok: autocomplete Photon, cache/frequência, OSRM, tarifa, falhas, edição e persistência financeira.");
} finally {
  globalThis.fetch = originalFetch;
  if (pedidosIds.length) {
    await db.query("DELETE FROM pedido_item_componentes WHERE pedido_id IN (?, ?)", pedidosIds);
    await db.query("DELETE FROM pedido_itens WHERE pedido_id IN (?, ?)", pedidosIds);
    await db.query("DELETE FROM pedidos WHERE id IN (?, ?)", pedidosIds);
  }
  if (clienteId) await db.query("DELETE FROM cliente WHERE id = ?", [clienteId]);
  if (produtoId) await db.query("DELETE FROM produtos WHERE id = ?", [produtoId]);
  await db.query("DELETE FROM endereco WHERE rua = ?", [street]);
  await db.query("DELETE FROM configuracoes_entrega WHERE id = 1");
  if (previousDeliveryConfig) {
    const columns = [
      "id", "origem_rua", "origem_numero", "origem_bairro", "origem_cidade", "origem_estado",
      "origem_cep", "origem_referencia", "origem_lat", "origem_lon", "origem_aproximada",
      "regra_cobranca", "valor_fixo", "taxa_inicial", "valor_por_km", "taxa_minima",
      "distancia_maxima_km", "sentido_distancia"
    ];
    await db.query(
      `INSERT INTO configuracoes_entrega (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      columns.map((column) => previousDeliveryConfig[column])
    );
  }
  await db.end();
}
