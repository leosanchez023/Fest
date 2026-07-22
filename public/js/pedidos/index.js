import { inicializarCliente } from "./cliente.js";
import { inicializarProduto } from "./produto.js";
import { inicializarPedido } from "./pedido.js";
import { inicializarEndereco } from "./endereco.js";
import { inicializarFinanceiro } from "./financeiro.js";
import { inicializarModal } from "./modal.js";


window.addEventListener("DOMContentLoaded", () => {

    inicializarCliente();

    inicializarProduto();

    inicializarPedido();

    inicializarEndereco();

    inicializarFinanceiro();

    inicializarModal();

});
