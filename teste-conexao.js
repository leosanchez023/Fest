import fs from "node:fs";
import path from "node:path";
import { X509Certificate } from "node:crypto";

const inheritedDatabaseUrl = Boolean(process.env.DATABASE_URL);
let db;
let authenticated = false;
let connectionError;

function getConnectionDetails(value) {
  try {
    const url = new URL(value);
    const projectUrl = process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL)
      : undefined;
    const projectRef = projectUrl?.hostname.split(".")[0];
    let passwordEncodingValid = true;
    try {
      decodeURIComponent(url.password);
    } catch {
      passwordEncodingValid = false;
    }

    return {
      parseable: true,
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "(não informado)",
      hasUrlFragment: Boolean(url.hash),
      passwordEncodingValid,
      sessionPoolerUserMatchesProject: !/pooler\.supabase\.com$/i.test(url.hostname) ||
        !projectRef ||
        decodeURIComponent(url.username) === `postgres.${projectRef}`
    };
  } catch {
    return { parseable: false };
  }
}

function getCertificateStatus() {
  const certificatePath = process.env.DATABASE_CA_CERT;
  if (!certificatePath) return "não configurado";

  const absolutePath = path.resolve(certificatePath);
  if (!fs.existsSync(absolutePath)) return "arquivo não encontrado";

  try {
    const certificate = new X509Certificate(fs.readFileSync(absolutePath));
    return certificate.ca ? "encontrado e CA PEM válido" : "arquivo PEM não é uma CA";
  } catch {
    return "arquivo encontrado, mas PEM inválido";
  }
}

try {
  ({ default: db } = await import("./database/connection.js"));
} catch (error) {
  connectionError = error;
}

const connectionString = process.env.DATABASE_URL;
const details = connectionString ? getConnectionDetails(connectionString) : undefined;

console.log(`DATABASE_URL definida: ${connectionString ? "sim" : "não"}`);
if (connectionString) {
  console.log(`DATABASE_URL carregada de: ${inheritedDatabaseUrl ? "ambiente do processo" : ".env"}`);
}
if (details?.parseable) {
  console.log(`Host: ${details.host}`);
  console.log(`Porta: ${details.port}`);
  console.log(`Usuário: ${details.user}`);
  console.log(`Banco: ${details.database}`);
  console.log(`Formato da senha na URI: ${details.passwordEncodingValid && !details.hasUrlFragment ? "válido" : "verificar caracteres especiais"}`);
  if (/pooler\.supabase\.com$/i.test(details.host)) {
    console.log(`Usuário corresponde ao projeto Supabase: ${details.sessionPoolerUserMatchesProject ? "sim" : "não"}`);
  }
} else if (connectionString) {
  console.log("URI PostgreSQL: formato inválido");
}
console.log(`Certificado CA: ${getCertificateStatus()}`);

try {
  if (connectionError) throw connectionError;
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  const { rows } = await db.query(
    "SELECT current_database() AS database_name, NOW() AS server_time"
  );
  const { database_name: databaseName, server_time: serverTime } = rows[0];
  authenticated = true;
  console.log(`Banco conectado: ${databaseName}`);
  console.log(`Horário do servidor: ${serverTime.toISOString()}`);
} catch (error) {
  const code = error.code ? ` (${error.code})` : "";
  console.error(`Falha na conexão PostgreSQL${code}.`);
  if (error.code === "28P01") {
    console.error(
      "Confira no painel Supabase > Connect > Session pooler o usuário, host, porta e banco da URI. " +
      "Para o Session Pooler, use exatamente o usuário da URI oficial (normalmente postgres.<PROJECT_REF>) " +
      "e a senha atual do banco, codificada para URL se contiver caracteres reservados. Não tente senhas automaticamente."
    );
  } else if (connectionError) {
    console.error("A configuração TLS/CA não pôde ser carregada. Confira DATABASE_CA_CERT e o arquivo PEM.");
  }
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}

console.log(`Conexão autenticada: ${authenticated ? "sim" : "não"}`);
if (!authenticated && !process.exitCode) process.exitCode = 1;
