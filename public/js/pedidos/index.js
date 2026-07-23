console.log("Index carregado");

import { inicializarCliente } from "./cliente.js";
import { inicializarProduto } from "./produto.js";
import { inicializarPedido } from "./pedido.js";
// import { inicializarPedidoNew } from "./pedido.new.js";
import { inicializarEndereco } from "./endereco.js";
import { inicializarFinanceiro } from "./financeiro.js";
import { inicializarModal } from "./modal.js";

window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM carregado");

    inicializarCliente();
    console.log("Cliente OK");

    inicializarProduto();
    console.log("Produto OK");

    inicializarPedido();
    console.log("Pedido OK");

    inicializarEndereco();
    console.log("Endereço OK");

    inicializarFinanceiro();
    console.log("Financeiro OK");

    inicializarModal();
    console.log("Modal OK");
});