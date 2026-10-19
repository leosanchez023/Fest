import assert from "node:assert/strict";
import { criar } from "../src/modules/clientes/clientes.service.js";
import db from "../database/connection.js";

const dadosValidos = {
    nome: "Maria da Silva",
    email: "maria@example.com",
    telefone: "(11) 99999-9999",
    cpf: "12345678901",
    nascimento: "",
    rua: "Rua das Flores",
    numero: "123",
    bairro: "Centro",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01000-000",
    referencia: "Casa azul"
};

const casosInvalidos = [
    [{ ...dadosValidos, nome: "M" }, /nome válido/i, "nome inválido"],
    [{ ...dadosValidos, email: "email-invalido" }, /e-mail válido/i, "e-mail inválido"],
    [{ ...dadosValidos, cpf: "123" }, /CPF válido/i, "CPF inválido"],
    [{ ...dadosValidos, telefone: "123" }, /telefone válido/i, "telefone inválido"],
    [{ ...dadosValidos, rua: "" }, /rua válida/i, "rua inválida"],
    [{ ...dadosValidos, estado: "XX" }, /estado válida/i, "estado inválido"],
    [{ ...dadosValidos, cep: "123" }, /CEP válido/i, "CEP inválido"]
];

try {
    for (const [dados, mensagem, descricao] of casosInvalidos) {
        await assert.rejects(
            () => criar(dados),
            mensagem,
            `O servidor deve rejeitar ${descricao}`
        );
    }
    console.log("Testes de validação de clientes ok");
} finally {
    await db.end();
}
