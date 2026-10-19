import { createHmac, timingSafeEqual } from "node:crypto";

const PHOTON_DEFAULT_URL = "https://photon.komoot.io/api/";
const OSRM_DEFAULT_URL = "https://router.project-osrm.org/route/v1/driving";
const MIN_GEOCODER_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 200;
const CONTEXT_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 12;
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const STATE_UFS = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",
  ceara: "CE", "distrito federal": "DF", "espirito santo": "ES", goias: "GO",
  maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR",
  pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO",
  roraima: "RR", "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE",
  tocantins: "TO"
};

let geocoderQueue = Promise.resolve();
let geocoderPending = 0;
let lastGeocoderRequestAt = 0;
const geocoderCache = new Map();
const geocoderInFlight = new Map();
const contextLocationCache = new Map();
const routeCache = new Map();

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeMatch(value) {
  return normalize(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function normalizeContext(context = {}) {
  return {
    cidade: normalize(context.cidade).slice(0, 100),
    estado: normalize(context.estado).slice(0, 100),
    bairro: normalize(context.bairro).slice(0, 100),
    cep: normalize(context.cep).slice(0, 12)
  };
}

function contextQuery(query, context) {
  const normalizedQuery = normalizeMatch(query);
  const parts = [query];
  for (const value of [context.bairro, context.cidade, context.estado, context.cep]) {
    if (!value || normalizedQuery.includes(normalizeMatch(value))) continue;
    if (parts.some((part) => normalizeMatch(part) === normalizeMatch(value))) continue;
    parts.push(value);
  }
  return parts.join(", ");
}

function matchesAddressQuery(place, query, context) {
  const excluded = new Set(
    [context.bairro, context.cidade, context.estado, context.cep]
      .flatMap((value) => normalizeMatch(value).split(/[^\p{L}\p{N}]+/u))
      .filter(Boolean)
  );
  const terms = normalizeMatch(query).split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1 && !/^\d+$/.test(term) && !excluded.has(term));
  if (!terms.length) return true;
  return [place.rua, place.nome].some((candidate) => {
    const candidateTerms = normalizeMatch(candidate).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return terms.every((term) => candidateTerms.some((word) => word.startsWith(term)));
  });
}

function geocodingError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function providerUrl(envName, fallback, serviceName) {
  let url;
  try {
    url = new URL(process.env[envName] || fallback);
  } catch {
    throw geocodingError(`A configuração do serviço ${serviceName} é inválida.`, 500);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw geocodingError(`A configuração do serviço ${serviceName} deve usar uma URL HTTPS segura.`, 500);
  }
  return url;
}

function signingSecret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw geocodingError("SESSION_SECRET deve ter pelo menos 32 caracteres para proteger a seleção do endereço.", 500);
  }
  return process.env.SESSION_SECRET;
}

function issuePlaceToken(place) {
  const payload = Buffer.from(JSON.stringify({
    latitude: place.latitude,
    longitude: place.longitude,
    label: place.label,
    address: place.address || {},
    numeroPreciso: place.numeroPreciso === true,
    expiresAt: Date.now() + 4 * 60 * 60 * 1000
  })).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyPlaceToken(token) {
  if (typeof token !== "string" || token.length > 2048) {
    throw geocodingError("Selecione uma sugestão de endereço válida.", 400);
  }
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) {
    throw geocodingError("A seleção de endereço expirou. Selecione uma sugestão novamente.", 400);
  }

  const expected = createHmac("sha256", signingSecret()).update(payload).digest();
  const provided = Buffer.from(encodedSignature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw geocodingError("A seleção de endereço é inválida.", 400);
  }

  let place;
  try {
    place = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw geocodingError("A seleção de endereço é inválida.", 400);
  }
  if (place.expiresAt < Date.now()
      || !Number.isFinite(place.latitude) || place.latitude < -90 || place.latitude > 90
      || !Number.isFinite(place.longitude) || place.longitude < -180 || place.longitude > 180
      || typeof place.label !== "string") {
    throw geocodingError("A seleção de endereço expirou. Selecione uma sugestão novamente.", 400);
  }
  return place;
}

function stateAbbreviation(value) {
  const state = normalize(value);
  if (/^[A-Z]{2}$/i.test(state)) return state.toUpperCase();
  const unaccented = state.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return STATE_UFS[unaccented] || state.slice(0, 2).toUpperCase();
}

function mapPhotonFeature(feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  const rua = normalize(properties.street || properties.name);
  const numero = normalize(properties.housenumber);
  const cidade = normalize(
    properties.city || properties.town || properties.village
    || (properties.type === "city" || properties.osm_value === "municipality" ? properties.name : "")
    || properties.county
  );
  const bairroDetalhado = normalize(properties.suburb || properties.locality);
  const bairroDistrito = normalize(properties.district);
  const bairro = bairroDetalhado || (
    normalizeMatch(bairroDistrito) !== normalizeMatch(cidade) ? bairroDistrito : ""
  );
  const estado = stateAbbreviation(properties.state);
  const cep = normalize(properties.postcode);
  const pais = normalize(properties.countrycode);
  const nome = normalize(properties.name);
  const label = normalize([
    properties.name,
    properties.street && properties.street !== properties.name ? properties.street : "",
    numero,
    bairro,
    cidade,
    properties.state
  ].filter(Boolean).join(", "));
  if (!rua && !cidade && !label) return null;

  const place = { latitude, longitude, label, numeroPreciso: Boolean(numero) };
  place.address = { rua, numero, bairro, cidade, estado, cep };
  return {
    rua,
    nome,
    numero,
    label,
    address: place.address,
    numeroPreciso: Boolean(numero),
    bairro,
    cidade,
    estado,
    cep,
    pais,
    referencia: "",
    descricao: label,
    origem: "openstreetmap",
    latitude,
    longitude,
    selectionToken: issuePlaceToken(place)
  };
}

function matchesContext(place, context) {
  const cidadeBuscada = normalizeMatch(context.cidade);
  const cidadeRetornada = normalizeMatch(place.cidade);
  if (cidadeBuscada && (!cidadeRetornada || cidadeBuscada !== cidadeRetornada)) return false;

  const estadoBuscado = normalizeMatch(stateAbbreviation(context.estado));
  const estadoRetornado = normalizeMatch(stateAbbreviation(place.estado));
  if (context.estado && (!place.estado || estadoBuscado !== estadoRetornado)) return false;

  const bairroBuscado = normalizeMatch(context.bairro);
  const bairroRetornado = normalizeMatch(place.bairro);
  if (bairroBuscado && bairroRetornado && bairroBuscado !== bairroRetornado) return false;

  return true;
}

function rankByContext(places, context) {
  const bairroBuscado = normalizeMatch(context.bairro);
  const cepBuscado = context.cep.replace(/\D/g, "");
  return places.map((place, index) => {
    let score = 0;
    if (bairroBuscado && normalizeMatch(place.bairro) === bairroBuscado) score += 4;
    if (cepBuscado && place.cep.replace(/\D/g, "") === cepBuscado) score += 8;
    return { place, index, score };
  }).sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ place }) => place);
}

async function requestPhoton(query, { bias = null, limit = 20 } = {}) {
  const url = providerUrl("FEST_PHOTON_URL", PHOTON_DEFAULT_URL, "Photon");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  if (bias) {
    url.searchParams.set("lat", String(bias.latitude));
    url.searchParams.set("lon", String(bias.longitude));
  }

  const delay = MIN_GEOCODER_INTERVAL_MS - (Date.now() - lastGeocoderRequestAt);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  lastGeocoderRequestAt = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "FestaGest/1.0 (https://github.com/leosanchez023/Fest)" },
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw geocodingError("A busca de endereços demorou demais. Você pode preencher o endereço manualmente.", 502);
    }
    throw geocodingError("Não foi possível conectar ao serviço de endereços. Você pode preencher o endereço manualmente.", 502);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 429) {
    const error = new Error("O serviço de endereços está ocupado. Aguarde e tente novamente.");
    error.statusCode = 429;
    throw error;
  }
  if (!response.ok) {
    throw geocodingError("O serviço de endereços está indisponível. Você pode preencher o endereço manualmente.", 502);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw geocodingError("O serviço de endereços retornou uma resposta inválida.", 502);
  }
  if (!Array.isArray(result?.features)) {
    throw geocodingError("O serviço de endereços retornou uma resposta inválida.", 502);
  }
  return result.features.map(mapPhotonFeature).filter(Boolean);
}

async function resolveContextBias(context) {
  const locationQuery = context.cidade
    ? [context.cidade, context.estado].filter(Boolean).join(", ")
    : context.cep
      ? [context.cep, context.estado].filter(Boolean).join(", ")
      : context.bairro && context.estado
        ? [context.bairro, context.estado].join(", ")
        : "";
  if (!locationQuery) return null;

  const cacheKey = normalizeMatch(locationQuery);
  const cached = contextLocationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.bias;

  const candidates = await requestPhoton(locationQuery, { limit: 5 });
  const match = candidates.find((place) => {
    if (context.cidade && normalizeMatch(place.cidade) !== normalizeMatch(context.cidade)) return false;
    if (context.estado && normalizeMatch(stateAbbreviation(place.estado))
        !== normalizeMatch(stateAbbreviation(context.estado))) return false;
    if (!context.cidade && context.cep && place.cep
        && place.cep.replace(/\D/g, "") !== context.cep.replace(/\D/g, "")) return false;
    return true;
  });
  const bias = match ? { latitude: match.latitude, longitude: match.longitude } : null;
  contextLocationCache.set(cacheKey, { bias, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS });
  while (contextLocationCache.size > 100) {
    contextLocationCache.delete(contextLocationCache.keys().next().value);
  }
  return bias;
}

export async function buscarSugestoesEndereco(termo, filtros = {}, broad = false) {
  const query = normalize(termo);
  if (query.length < 3 || query.length > 200) {
    throw geocodingError("Informe uma busca de endereço entre 3 e 200 caracteres.", 400);
  }
  const context = broad ? normalizeContext() : normalizeContext(filtros);
  const hasContext = Object.values(context).some(Boolean);
  const cacheKey = JSON.stringify([normalizeMatch(query), context, broad]);
  const cached = geocoderCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { resultados: cached.results, contextoAplicado: hasContext, buscaAmpla: broad };
  }
  if (geocoderInFlight.has(cacheKey)) return geocoderInFlight.get(cacheKey);
  if (geocoderPending >= MAX_PENDING) {
    const error = new Error("A busca está ocupada. Aguarde um instante e tente novamente.");
    error.statusCode = 429;
    throw error;
  }

  geocoderPending += 1;
  const request = geocoderQueue.then(async () => {
    if (broad || !hasContext) return requestPhoton(query);
    const bias = await resolveContextBias(context);
    return requestPhoton(bias ? query : contextQuery(query, context), { bias });
  }).then((places) => {
    const results = broad || !hasContext
      ? places.slice(0, 6)
      : rankByContext(
        places.filter((place) => matchesContext(place, context) && matchesAddressQuery(place, query, context)),
        context
      ).slice(0, 6);
    geocoderCache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });
    while (geocoderCache.size > CACHE_LIMIT) {
      geocoderCache.delete(geocoderCache.keys().next().value);
    }
    return { resultados: results, contextoAplicado: hasContext, buscaAmpla: broad };
  }).finally(() => {
    geocoderPending -= 1;
    geocoderInFlight.delete(cacheKey);
  });
  geocoderInFlight.set(cacheKey, request);
  geocoderQueue = request.then(() => undefined, () => undefined);
  return request;
}

function addressMatchesPlace(address, place) {
  for (const field of ["rua", "bairro", "cidade", "estado", "cep"]) {
    if (field === "bairro" && !normalize(place.address?.bairro)) continue;
    if (normalizeMatch(address?.[field]) !== normalizeMatch(place.address?.[field])) {
      throw geocodingError("O endereço foi alterado após a seleção. Selecione novamente o resultado.", 400);
    }
  }
}

export async function resolverNumeroEndereco(selectionToken, address) {
  const selected = verifyPlaceToken(selectionToken);
  addressMatchesPlace(address, selected);
  const numero = normalize(address?.numero).slice(0, 20);
  if (!numero) {
    return { place: selected, aproximada: true, numeroLocalizado: false };
  }
  if (selected.numeroPreciso && normalizeMatch(selected.address.numero) === normalizeMatch(numero)) {
    return { place: selected, aproximada: false, numeroLocalizado: true };
  }

  const query = [
    address.rua,
    numero,
    address.bairro,
    address.cidade,
    address.estado,
    address.cep
  ].map(normalize).filter(Boolean).join(", ");
  const request = geocoderQueue.then(() => requestPhoton(query, {
    bias: { latitude: selected.latitude, longitude: selected.longitude },
    limit: 10
  }));
  geocoderQueue = request.then(() => undefined, () => undefined);
  let candidates;
  try {
    candidates = await request;
  } catch (error) {
    if (error.statusCode === 429 || error.statusCode === 502) {
      return {
        place: selected,
        aproximada: true,
        numeroLocalizado: false,
        numeroLookupFalhou: true
      };
    }
    throw error;
  }
  const exact = candidates.find((candidate) => candidate.numeroPreciso
    && normalizeMatch(candidate.address.numero) === normalizeMatch(numero)
    && normalizeMatch(candidate.address.rua) === normalizeMatch(address.rua)
    && (!address.cidade || normalizeMatch(candidate.address.cidade) === normalizeMatch(address.cidade))
    && (!address.estado || normalizeMatch(stateAbbreviation(candidate.address.estado))
      === normalizeMatch(stateAbbreviation(address.estado))));
  return exact
    ? { place: exact, aproximada: false, numeroLocalizado: true }
    : { place: selected, aproximada: true, numeroLocalizado: false, numeroLookupFalhou: false };
}

async function solicitarDistanciaRota(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "FestaGest/1.0 (https://github.com/leosanchez023/Fest)" },
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("O cálculo da rota demorou demais. Tente novamente; o pedido não foi salvo.");
    }
    throw new Error("Não foi possível conectar ao serviço de rotas. O pedido não foi salvo.");
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 429) {
    const error = new Error("O serviço de rotas está ocupado. Aguarde e tente novamente.");
    error.statusCode = 429;
    throw error;
  }
  if (!response.ok) throw new Error("O serviço de rotas está indisponível. O pedido não foi salvo.");

  let result;
  try {
    result = await response.json();
  } catch {
    throw geocodingError("O serviço de rotas retornou uma resposta inválida. O pedido não foi salvo.", 502);
  }
  const route = result?.code === "Ok" && Array.isArray(result.routes) ? result.routes[0] : null;
  if (!route || !Number.isFinite(Number(route.distance)) || Number(route.distance) <= 0) {
    throw geocodingError("Não foi encontrada uma rota viária entre a origem e o destino.", 422);
  }
  return Number(route.distance) / 1000;
}

function validateFreightSettings(settings) {
  if (!settings || !["FIXO", "POR_KM", "FIXO_POR_KM"].includes(settings.regra_cobranca)
      || !["IDA", "IDA_VOLTA"].includes(settings.sentido_distancia)) {
    throw geocodingError("Configure o endereço de origem e a regra de frete antes de calcular.", 409);
  }
  for (const field of ["origem_lat", "origem_lon"]) {
    const value = Number(settings[field]);
    if (!Number.isFinite(value) || (field === "origem_lat" && Math.abs(value) > 90)
        || (field === "origem_lon" && Math.abs(value) > 180)) {
      throw geocodingError("A origem padrão não possui coordenadas válidas. Atualize as configurações de entrega.", 409);
    }
  }
  const requiredRates = settings.regra_cobranca === "FIXO"
    ? ["valor_fixo"]
    : settings.regra_cobranca === "POR_KM"
      ? ["valor_por_km"]
      : ["taxa_inicial", "valor_por_km"];
  for (const field of requiredRates) {
    if (settings[field] == null || !Number.isFinite(Number(settings[field])) || Number(settings[field]) < 0) {
      throw geocodingError("A regra de cobrança não possui todos os valores necessários configurados.", 409);
    }
  }
  for (const field of ["taxa_minima", "distancia_maxima_km"]) {
    if (settings[field] != null && (!Number.isFinite(Number(settings[field])) || Number(settings[field]) < 0)) {
      throw geocodingError("A configuração da taxa mínima ou da distância máxima é inválida.", 409);
    }
  }
}

export async function calcularRotaEntrega({ settings, destinoToken, destinoNumero, destinoEndereco }) {
  validateFreightSettings(settings);
  const origem = {
    latitude: Number(settings.origem_lat),
    longitude: Number(settings.origem_lon),
    label: [
      settings.origem_rua,
      settings.origem_numero,
      settings.origem_bairro,
      settings.origem_cidade,
      settings.origem_estado
    ].filter(Boolean).join(", "),
    address: {
      rua: settings.origem_rua,
      numero: settings.origem_numero || "",
      bairro: settings.origem_bairro || "",
      cidade: settings.origem_cidade,
      estado: settings.origem_estado,
      cep: settings.origem_cep || "",
      referencia: settings.origem_referencia || ""
    }
  };
  const cacheKey = JSON.stringify([
    origem.latitude, origem.longitude,
    origem.label,
    Boolean(settings.origem_aproximada),
    destinoToken,
    normalize(destinoNumero || destinoEndereco?.numero || ""),
    ["rua", "bairro", "cidade", "estado", "cep"]
      .map((field) => normalize(destinoEndereco?.[field])),
    settings.sentido_distancia,
    settings.regra_cobranca,
    settings.valor_fixo,
    settings.taxa_inicial,
    settings.valor_por_km,
    settings.taxa_minima,
    settings.distancia_maxima_km
  ]);
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  const destinoResolvido = await resolverNumeroEndereco(destinoToken, {
    ...destinoEndereco,
    numero: destinoNumero || destinoEndereco?.numero || ""
  });
  const destino = destinoResolvido.place;

  const url = providerUrl("FEST_OSRM_ROUTE_URL", OSRM_DEFAULT_URL, "OSRM");
  if (!url.pathname.endsWith("/route/v1/driving")) {
    throw geocodingError("A URL do OSRM deve terminar em /route/v1/driving.", 500);
  }
  const medir = async (start, end) => {
    const routeUrl = new URL(url);
    routeUrl.pathname = `${routeUrl.pathname}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    routeUrl.searchParams.set("overview", "false");
    routeUrl.searchParams.set("steps", "false");
    routeUrl.searchParams.set("alternatives", "false");
    return solicitarDistanciaRota(routeUrl);
  };
  const distanciaBrutaIda = await medir(origem, destino);
  if (distanciaBrutaIda > 500) throw geocodingError("A rota excede o limite de entrega de 500 km.", 422);
  if (settings.distancia_maxima_km != null
      && distanciaBrutaIda > Number(settings.distancia_maxima_km)) {
    throw geocodingError("O endereço excede a distância máxima de entrega configurada.", 422);
  }
  const distanciaIda = Math.round(distanciaBrutaIda * 100) / 100;
  const distanciaBrutaRetorno = settings.sentido_distancia === "IDA_VOLTA"
    ? await medir(destino, origem)
    : 0;
  const distanciaRetorno = Math.round(distanciaBrutaRetorno * 100) / 100;
  const distanciaCobradaKm = Math.round((distanciaBrutaIda + distanciaBrutaRetorno) * 100) / 100;
  let valorFrete = settings.regra_cobranca === "FIXO"
    ? Number(settings.valor_fixo)
    : Number(settings.regra_cobranca === "FIXO_POR_KM" ? settings.taxa_inicial : 0)
      + distanciaCobradaKm * Number(settings.valor_por_km);
  if (settings.taxa_minima != null) valorFrete = Math.max(valorFrete, Number(settings.taxa_minima));
  valorFrete = Math.round(valorFrete * 100) / 100;
  const ruleLabel = settings.regra_cobranca === "FIXO"
    ? `Frete fixo R$ ${Number(settings.valor_fixo).toFixed(2)}`
    : settings.regra_cobranca === "POR_KM"
      ? `${distanciaCobradaKm.toFixed(2)} km × R$ ${Number(settings.valor_por_km).toFixed(2)}/km`
      : `R$ ${Number(settings.taxa_inicial).toFixed(2)} + ${distanciaCobradaKm.toFixed(2)} km × R$ ${Number(settings.valor_por_km).toFixed(2)}/km`;
  const formula = `${ruleLabel} (${settings.sentido_distancia === "IDA" ? "só ida" : `${distanciaIda.toFixed(2)} km ida + ${distanciaRetorno.toFixed(2)} km retorno`})${settings.taxa_minima != null ? `; mínimo R$ ${Number(settings.taxa_minima).toFixed(2)}` : ""}`;
  const quote = {
    distanciaKm: distanciaIda,
    distanciaRetornoKm: distanciaRetorno,
    distanciaCobradaKm,
    sentidoDistancia: settings.sentido_distancia,
    valorFrete,
    formula,
    origem: origem.label,
    destino: normalizeMatch(destino.address?.numero) === normalizeMatch(destinoEndereco?.numero || destinoNumero)
      ? destino.label
      : [destino.label, destinoEndereco?.numero || destinoNumero].filter(Boolean).join(", "),
    origemEndereco: origem.address,
    destinoEndereco: destino.address,
    origemLatitude: origem.latitude,
    origemLongitude: origem.longitude,
    destinoLatitude: destino.latitude,
    destinoLongitude: destino.longitude,
    origemAproximada: Boolean(settings.origem_aproximada),
    destinoAproximado: destinoResolvido.aproximada,
    numeroLocalizado: destinoResolvido.numeroLocalizado,
    numeroLookupFalhou: Boolean(destinoResolvido.numeroLookupFalhou)
  };
  routeCache.set(cacheKey, { quote, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
  while (routeCache.size > 500) routeCache.delete(routeCache.keys().next().value);
  return quote;
}

export function emitirTokenParaCoordenadas(place) {
  if (place?.latitude == null || place?.longitude == null
      || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) {
    return null;
  }
  return issuePlaceToken({
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    label: normalize(place.label),
    address: place.address || {},
    numeroPreciso: false
  });
}
