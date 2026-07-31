// VARIÁVEIS GLOBAIS
let suppliers = [];

// INICIALIZAÇÃO DA PÁGINA
document.addEventListener("DOMContentLoaded", () => {

    console.log("Tela de fornecedores iniciada");
    carregarEventos();
    fetchSuppliers();
});

// EVENTOS DOS CAMPOS
function carregarEventos() {

    const cnpj = document.getElementById("f-cnpj");
    const telefone = document.getElementById("f-phone");
    const whatsapp = document.getElementById("f-whatsapp");
    const cep = document.getElementById("f-cep");
    const estado = document.getElementById("f-state");

    // Máscara CPF / CNPJ
    if (cnpj) {
        cnpj.addEventListener("input", aplicarMascaraDocumento);
    }

    // Máscara telefone
    if (telefone) {
        telefone.addEventListener("input", aplicarMascaraTelefone);
    }

    // Máscara WhatsApp
    if (whatsapp) {
        whatsapp.addEventListener("input", aplicarMascaraTelefone);
    }

    // Máscara CEP
    if (cep) {
        cep.addEventListener("input", aplicarMascaraCEP);
    }

    // Estado sempre em maiúsculo
    if (estado) {
        estado.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });
    }
}

// MODAL DE CADASTRO
function openForm() {
    const modal = document.getElementById("modal-form");

    if (!modal) {
        console.error("Modal de fornecedor não encontrado!");
        return;
    }

    const form = document.getElementById("supplier-form");

    // Limpa formulário
    if (form) {
        form.reset();
    }

    // Remove ID de edição
    document.getElementById("f-id").value = "";

    // Altera título
    document.getElementById("form-title")
        .textContent = "Cadastrar Fornecedor";

    // Abre modal
    modal.classList.add("open");
}

// FECHAR MODAL DE CADASTRO
function closeForm() {
    const modal = document.getElementById("modal-form");

    if (modal) {
        modal.classList.remove("open");
    }
}

// FECHAR MODAL CLICANDO FORA
function closeFormOutside(event) {
    if(
        event.target.id === "modal-form"
    ){
        closeForm();
    }
}

// MÁSCARA CPF / CNPJ
function aplicarMascaraDocumento(event) {

    let valor =event.target.value.replace(/\D/g, "");

    // CPF
    if (valor.length <= 11) {

        valor = valor
            .replace(/(\d{3})(\d)/,"$1.$2")
            .replace(/(\d{3})(\d)/,"$1.$2")
            .replace(/(\d{3})(\d{1,2})$/,"$1-$2"
        );


     // CNPJ
    }else {
        valor =valor
            .replace(/^(\d{2})(\d)/,"$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3")
            .replace(/\.(\d{3})(\d)/,".$1/$2")
            .replace(/(\d{4})(\d)/,"$1-$2"
        );
    }
    event.target.value = valor;
}

// MÁSCARA TELEFONE
function aplicarMascaraTelefone(event) {

    let valor = event.target.value.replace(/\D/g, "");
    valor = valor
        .replace(/^(\d{2})(\d)/,"($1) $2")
        .replace(/(\d{5})(\d)/,"$1-$2")
        .substring(0, 15);

    event.target.value = valor;
}

// MÁSCARA CEP
function aplicarMascaraCEP(event) {

    let valor = event.target.value.replace(/\D/g, "");

    valor = valor
        .replace(/(\d{5})(\d)/,"$1-$2")
        .substring(0, 9);

    event.target.value = valor;
}


// VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
function validarCampo(input) {
    if (
        input &&
        input.required &&
        input.value.trim() === ""
    ){
        input.classList.add("erro");
        return false;
    }

    if (input) {input.classList.remove("erro");}

    return true;
}

// VALIDAR FORMULÁRIO
function validarFormulario() {
    const camposObrigatorios = [
        "f-name",
        "f-cnpj",
        "f-responsavel",
        "f-category",
        "f-phone",
        "f-email",
        "f-street",
        "f-number",
        "f-neighborhood",
        "f-city",
        "f-state",
        "f-cep",
        "f-product"
    ];

    let valido = true;

    camposObrigatorios.forEach(id => {

        const campo = document.getElementById(id);

        if (!validarCampo(campo)){
            valido = false;
        }
    });

    if (!valido){
        alert("Preencha todos os campos obrigatórios.");
    }

    return valido;
}

// VALIDAÇÕES DE SEGURANÇA
function limparTexto(valor) {

    return valor.trim().replace(/[<>]/g, "");
}

// Validação CPF/CNPJ
function validarDocumento(valor) {
    const numero = valor.replace(/\D/g, "");

    return (numero.length === 11 || numero.length === 14);
}

// Validação telefone
function validarTelefone(valor) {
    const numero = valor.replace(/\D/g, "");

    return (numero.length >= 10 && numero.length <= 11);
}

// Validação email
function validarEmail(valor) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

// Validação CEP
function validarCEP(valor) {

    if (!valor) {
        return false;
    }

    const cep = valor.replace(/\D/g, "");

    return cep.length === 8;
}

// SALVAR FORNECEDOR
async function saveSupplier(event) {

    event.preventDefault();

    if (!validarFormulario()) {
        return;
    }

    const id = document.getElementById("f-id").value;
    const dados = {
        nome:document.getElementById("f-name").value.trim(),
        cnpj:document.getElementById("f-cnpj").value.trim(),
        responsavel:document.getElementById("f-responsavel").value.trim(),
        categoria:document.getElementById("f-category").value,
        telefone:document.getElementById("f-phone").value.trim(),
        whatsapp:document.getElementById("f-whatsapp").value.trim(),
        email:document.getElementById("f-email").value.trim(),
        site:document.getElementById("f-website").value.trim(),
        rua:document.getElementById("f-street").value.trim(),
        numero:document.getElementById("f-number").value.trim(),
        bairro:document.getElementById("f-neighborhood").value.trim(),
        cidade:document.getElementById("f-city").value.trim(),
        estado:document.getElementById("f-state").value.trim(),
        cep: document.getElementById("f-cep").value.trim(),
        produtos:document.getElementById("f-product").value.trim(),
        entrega:document.getElementById("f-delivery").value.trim(),
        pagamento:document.getElementById("f-payment").value.trim(),
        observacoes:document.getElementById("f-notes").value.trim(),
        status:document.getElementById("f-status").value
    };
    try {
        let response;

        // Atualizar fornecedor
        if (id) {response = await fetch(`/fornecedores/${id}`,{

            method: "PUT",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(dados)});
        }

        // Novo fornecedor
        else {response = await fetch("/fornecedores/criar",{

            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(dados)});
        }

        const resultado = await response.json();

        if (!response.ok || resultado.success === false)
            {throw new Error(
                resultado.error || "Erro ao salvar fornecedor."
            );
        }

        closeForm();
        await fetchSuppliers();

        alert(id
            ? "Fornecedor atualizado com sucesso!"
            : "Fornecedor cadastrado com sucesso!"
        );

    } catch (erro) {
        console.error(erro);
        alert(erro.message);
    }
}

// EDITAR FORNECEDOR
async function editSupplier(id) {
    try {
        const response = await fetch(`/fornecedores/${id}`);
        const f = await response.json();

        document.getElementById("f-id").value = f.id ?? "";
        document.getElementById("f-name").value = f.nome ?? "";
        document.getElementById("f-cnpj").value = f.cnpj ?? "";
        document.getElementById("f-responsavel").value = f.responsavel ?? "";
        document.getElementById("f-category").value = f.categoria ?? "";
        document.getElementById("f-phone").value = f.telefone ?? "";
        document.getElementById("f-whatsapp").value = f.whatsapp ?? "";
        document.getElementById("f-email").value = f.email ?? "";
        document.getElementById("f-website").value = f.site ?? "";
        document.getElementById("f-street").value = f.rua ?? "";
        document.getElementById("f-number").value = f.numero ?? "";
        document.getElementById("f-neighborhood").value = f.bairro ?? "";
        document.getElementById("f-city").value = f.cidade ?? "";
        document.getElementById("f-state").value = f.estado ?? "";
        document.getElementById("f-cep").value =  f.cep ?? "";
        document.getElementById("f-product").value = f.produtos ?? "";
        document.getElementById("f-delivery").value = f.entrega ?? "";
        document.getElementById("f-payment").value = f.pagamento ?? "";
        document.getElementById("f-notes").value = f.observacoes ?? "";
        document.getElementById("f-status").value = f.status ?? "Ativo";
        document.getElementById("form-title").textContent ="Editar Fornecedor";
        document.getElementById("modal-form").classList.add("open");

    } catch (erro) {
        console.error(erro);
        alert("Erro ao carregar fornecedor.");
    }
}

// EXCLUIR FORNECEDOR
async function deleteSupplier(id) {
    if (!confirm("Deseja excluir este fornecedor?")
    ){
        return;
    }try {

        const response = await fetch(`/fornecedores/${id}`,{

            method: "DELETE"});

        const resultado = await response.json();

        if (!response.ok || resultado.success === false){

            throw new Error(resultado.error ||"Erro ao excluir fornecedor.");
        } alert("Fornecedor excluído com sucesso!");

        fetchSuppliers();

    } catch (erro) {
        console.error(erro);
        alert(erro.message);
    }
}

// BUSCAR FORNECEDORES
async function fetchSuppliers() {

    try {

        const response = await fetch("/fornecedores/data");
        const dados = await response.json();
        suppliers = dados;

        renderTable();
        atualizarKPIs();

    } catch (erro) {
        console.error("Erro ao buscar fornecedores:", erro);
    }
}

// ATUALIZAR INDICADORES
function atualizarKPIs() {

    const total = suppliers.length;
    const ativos = suppliers.filter(fornecedor =>fornecedor.status === "Ativo").length;
    const totalElement = document.getElementById("kpi-total");
    const ativosElement = document.getElementById("kpi-active");

    if (totalElement) {totalElement.textContent = total;}

    if (ativosElement) {ativosElement.textContent = ativos;}
}



// RENDERIZAR TABELA DE FORNECEDORES
function renderTable() {


    const tbody = document.getElementById("supplier-tbody");


    if (!tbody) {
        return;
    }

    const pesquisa = document
        .getElementById("search")
        ?.value
        .toLowerCase() || "";

    const categoria = document
        .getElementById("filter-category")
        ?.value || "";

    const status = document
        .getElementById("filter-status")
        ?.value || "";

    const lista = suppliers
    .filter(fornecedor => {

        const texto =
        `
            ${fornecedor.nome}
            ${fornecedor.email}
            ${fornecedor.telefone}
            ${fornecedor.cnpj}
            ${fornecedor.cidade}
        `
        .toLowerCase();

            const buscaOk = texto.includes(pesquisa);
            const categoriaOk = !categoria ||fornecedor.categoria === categoria;
            const statusOk = !status || fornecedor.status === status;

            return buscaOk && categoriaOk && statusOk;
        });

    tbody.innerHTML = "";

    lista.forEach(fornecedor => {

        tbody.innerHTML +=

            `<tr>
                <td>${fornecedor.nome}</td>
                <td>${fornecedor.categoria ?? "-"}</td>
                <td>${fornecedor.telefone ?? "-"}</td>
                <td>${fornecedor.email ?? "-"}</td>
                <td>${fornecedor.cidade ?? "-"}</td>
                <td>${fornecedor.status}</td>
                <td style="text-align:center">

                <button onclick="viewSupplier(${fornecedor.id})">👁</button>

                <button onclick="editSupplier(${fornecedor.id})">✏️</button>

                <button onclick="deleteSupplier(${fornecedor.id})">🗑️</button>
            </td>
        </tr>`;
    });
}

// FILTROS DA TABELA
function aplicarFiltros() {

    renderTable();
}

// VISUALIZAR PERFIL DO FORNECEDOR
async function viewSupplier(id) {

    try {

        const response =
            await fetch(`/fornecedores/${id}`);


        const f =
            await response.json();



        document.getElementById("profile-content").innerHTML = `

            <h3>${f.nome}</h3><p>
            <strong>CNPJ:</strong>${f.cnpj ?? "-"}</p>
            <p><strong>Responsável:</strong>${f.responsavel ?? "-"}</p>
            <p><strong>Telefone:</strong>${f.telefone ?? "-"}</p>
            <p><strong>Email:</strong>${f.email ?? "-"}</p>
            <p><strong>Cidade:</strong>${f.cidade ?? "-"}</p>
            <p><strong>Produtos:</strong>${f.produtos ?? "-"}</p>
            <p><strong>Status:</strong>${f.status ?? "-"}</p>
        `;

        document.getElementById("modal-profile").classList.add("open");

    } catch (erro) {
        console.error(erro);
        alert("Erro ao abrir fornecedor.");
    }
}

// FECHAR MODAL DE PERFIL
function closeProfile() {

    const modal = document.getElementById("modal-profile");

    if (modal) {modal.classList.remove("open");}
}

// LIBERAR FUNÇÕES PARA O HTML
window.openForm = openForm;
window.closeForm = closeForm;
window.saveSupplier = saveSupplier;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.viewSupplier = viewSupplier;
window.closeFormOutside = closeFormOutside;
window.closeProfile = closeProfile;
window.fetchSuppliers = fetchSuppliers;
window.renderTable = renderTable;
window.aplicarFiltros = aplicarFiltros;

// EVENTOS DOS FILTROS
function carregarFiltros() {
    const pesquisa = document.getElementById("search");
    const categoria = document.getElementById("filter-category");
    const status = document.getElementById("filter-status");

    // Pesquisa por texto
    if (pesquisa) {pesquisa.addEventListener("input",() => {renderTable();});}

    // Filtro por categoria
    if (categoria) {categoria.addEventListener("change",() => {renderTable();});}

    // Filtro por status
    if (status) {status.addEventListener("change",() => {renderTable();});}
}

// LIMPAR FILTROS
function limparFiltros() {
    const pesquisa = document.getElementById("search");
    const categoria = document.getElementById("filter-category");
    const status = document.getElementById("filter-status");

    if (pesquisa) {pesquisa.value = "";}

    if (categoria) {categoria.value = "";}

    if (status) {status.value = "";}

    renderTable();
}

// BUSCAR FORNECEDOR POR NOME
function buscarFornecedor(nome) {

    if (!nome) {return suppliers;}

    return suppliers.filter(fornecedor => {

        return
        fornecedor.nome
        .toLowerCase()
        .includes(nome.toLowerCase());}
    );
}


// ORDENAR FORNECEDORES
function ordenarFornecedores(campo){suppliers.sort((a,b) => {

        const valorA = a[campo]?.toString().toLowerCase() || "";
        const valorB = b[campo]?.toString().toLowerCase() || "";

        return valorA.localeCompare(valorB);
    });

    renderTable();
}


// FORMATAR TEXTO
function formatarTexto(valor) {

    if (!valor) {return "-";}

    return valor.toString().trim();
}


// FORMATAR STATUS
function badgeStatus(status) {

    if (status === "Ativo"){

        return `<span class="status ativo">Ativo</span>`;
    }

    return `<span class="status inativo">Inativo</span>`;
}


// CONFIRMAR EXCLUSÃO
function confirmarExclusao(nome) {

    return confirm(`Deseja excluir o fornecedor ${nome}?`);
}


// INICIALIZAÇÃO COMPLETA
document.addEventListener("DOMContentLoaded",() => {

    console.log("Módulo fornecedores carregado");
    carregarEventos();
    carregarFiltros();
    fetchSuppliers()
});

// EXPORTAR FUNÇÕES
window.limparFiltros = limparFiltros;
window.buscarFornecedor = buscarFornecedor;
window.ordenarFornecedores = ordenarFornecedores;
window.badgeStatus = badgeStatus;
window.confirmarExclusao = confirmarExclusao;