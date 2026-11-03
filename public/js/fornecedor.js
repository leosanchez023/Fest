// VARIÁVEIS GLOBAIS
let suppliers = [];
let supplierSummary = { total: 0, ativos: 0, novos: 0 };
let supplierPage = 1;
let supplierLimit = 10;
let supplierSaveInFlight = false;
let supplierLoadRequest = 0;
const supplierDeletesInFlight = new Set();

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
        window.FestAlert?.error?.("Validação", "Preencha todos os campos obrigatórios.");
        return false;
    }

    const documento = document.getElementById("f-cnpj").value;
    const telefone = document.getElementById("f-phone").value;
    const whatsapp = document.getElementById("f-whatsapp").value;
    const cep = document.getElementById("f-cep").value;
    const estado = document.getElementById("f-state").value.trim();
    const email = document.getElementById("f-email").value.trim();
    const mensagem = !validarDocumento(documento)
        ? "Informe um CPF ou CNPJ válido."
        : !validarTelefone(telefone)
            ? "Informe um telefone válido."
            : whatsapp && !validarTelefone(whatsapp)
                ? "Informe um WhatsApp válido."
                : !validarEmail(email)
                    ? "Informe um e-mail válido."
                    : !validarCEP(cep)
                        ? "Informe um CEP válido."
                        : !/^[A-Za-z]{2}$/.test(estado)
                            ? "Informe a sigla de estado com duas letras."
                            : "";
    if (mensagem) {
        window.FestAlert?.error?.("Validação", mensagem);
        return false;
    }
    return true;
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

    if (supplierSaveInFlight || !validarFormulario()) {
        return;
    }

    supplierSaveInFlight = true;
    const submitButton = document.querySelector("#supplier-form button[type='submit']");
    if (submitButton) submitButton.disabled = true;

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

        await window.FestAlert?.success?.(
            id ? "Fornecedor atualizado" : "Fornecedor cadastrado",
            id ? "Fornecedor atualizado com sucesso!" : "Fornecedor cadastrado com sucesso!"
        );

    } catch (erro) {
        console.error(erro);
        window.FestAlert?.error?.("Erro ao salvar", erro.message || "Não foi possível salvar o fornecedor.");
    } finally {
        supplierSaveInFlight = false;
        if (submitButton) submitButton.disabled = false;
    }
}

// EDITAR FORNECEDOR
async function editSupplier(id) {
    try {
        const response = await fetch(`/fornecedores/${id}`);
        const f = await response.json();
        if (!response.ok || f.success === false) {
            throw new Error(f.error || "Não foi possível carregar o fornecedor.");
        }

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
        window.FestAlert?.error?.("Erro ao carregar", erro.message || "Não foi possível carregar o fornecedor.");
    }
}

// EXCLUIR FORNECEDOR
async function deleteSupplier(id) {
    const fornecedorId = Number(id);
    if (!Number.isSafeInteger(fornecedorId) || fornecedorId <= 0 || supplierDeletesInFlight.has(fornecedorId)) return;
    supplierDeletesInFlight.add(fornecedorId);

    try {
        const result = window.FestAlert?.confirm
            ? await window.FestAlert.confirm("Confirmar exclusão", "Deseja excluir este fornecedor?")
            : { isConfirmed: window.confirm("Deseja excluir este fornecedor?") };
        if (!result?.isConfirmed) return;

        const response = await fetch(`/fornecedores/${fornecedorId}`,{
            method: "DELETE"
        });

        const resultado = await response.json();

        if (!response.ok || resultado.success === false){
            throw new Error(resultado.error || "Erro ao excluir fornecedor.");
        }

        await window.FestAlert?.success?.("Fornecedor removido", "Fornecedor excluído com sucesso!");
        await fetchSuppliers();

    } catch (erro) {
        console.error(erro);
        window.FestAlert?.error?.("Erro ao excluir", erro.message || "Não foi possível excluir o fornecedor.");
    } finally {
        supplierDeletesInFlight.delete(fornecedorId);
    }
}

// BUSCAR FORNECEDORES
async function fetchSuppliers(options = {}) {
    const requestId = ++supplierLoadRequest;
    const page = options.page ?? supplierPage;
    const selectedLimit = Number(document.getElementById("supplier-page-size")?.value);
    const limit = options.limit ?? ([10, 25, 50].includes(selectedLimit) ? selectedLimit : supplierLimit);
    const params = new URLSearchParams({
        q: document.getElementById("search")?.value.trim() || "",
        categoria: document.getElementById("filter-category")?.value || "",
        status: document.getElementById("filter-status")?.value || "",
        page: String(page),
        limit: String(limit)
    });

    try {
        const response = await fetch(`/fornecedores/data?${params.toString()}`);
        const dados = await response.json();
        if (!response.ok || !Array.isArray(dados.fornecedores)) {
            throw new Error(dados.error || "Não foi possível carregar os fornecedores.");
        }
        if (requestId !== supplierLoadRequest) return;
        suppliers = dados.fornecedores;
        supplierSummary = dados.summary || {
            total: dados.total || 0,
            ativos: suppliers.filter((fornecedor) => fornecedor.status === "Ativo").length,
            novos: 0
        };
        supplierPage = dados.page || page;
        supplierLimit = dados.limit || limit;

        renderTable();
        renderPagination(dados);
        atualizarKPIs();
        document.querySelector(".supplier-message-error")?.remove();

    } catch (erro) {
        console.error("Erro ao buscar fornecedores:", erro);
        if (requestId !== supplierLoadRequest) return;
        const tbody = document.getElementById("supplier-tbody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="7">Não foi possível carregar os fornecedores.</td></tr>';
        const pagination = document.getElementById("pagination");
        if (pagination) pagination.replaceChildren();
    }
}

// ATUALIZAR INDICADORES
function atualizarKPIs() {
    const totalElement = document.getElementById("kpi-total");
    const ativosElement = document.getElementById("kpi-active");
    const novosElement = document.getElementById("kpi-new");

    if (totalElement) totalElement.textContent = supplierSummary.total;
    if (ativosElement) ativosElement.textContent = supplierSummary.ativos;
    if (novosElement) novosElement.textContent = supplierSummary.novos;
}

function renderPagination(data) {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    const page = Number(data.page) || 1;
    const totalPages = Number(data.totalPages) || 1;
    const total = Number(data.total) || 0;
    pagination.innerHTML = `
        <button type="button" class="btn" data-supplier-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""}>Anterior</button>
        <span>Página ${page} de ${totalPages} (${total} fornecedores)</span>
        <button type="button" class="btn" data-supplier-page="${Math.min(totalPages, page + 1)}" ${page >= totalPages ? "disabled" : ""}>Próxima</button>
    `;
}


// RENDERIZAR TABELA DE FORNECEDORES
function renderTable() {


    const tbody = document.getElementById("supplier-tbody");


    if (!tbody) {
        return;
    }

    if (!suppliers.length) {
        tbody.innerHTML = '<tr><td colspan="7">Nenhum fornecedor encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = suppliers.map((fornecedor) => {
        const id = Number(fornecedor.id);
        const nome = escapeHTML(fornecedor.nome);
        return `<tr class="record-table-row supplier-table-row" data-supplier-id="${id}" data-supplier-name="${nome}" tabindex="0" aria-label="Abrir detalhes de ${nome}">
            <td>${escapeHTML(fornecedor.nome)}</td>
            <td>${escapeHTML(fornecedor.categoria || "-")}</td>
            <td>${escapeHTML(fornecedor.telefone || "-")}</td>
            <td>${escapeHTML(fornecedor.email || "-")}</td>
            <td>${escapeHTML(fornecedor.cidade || "-")}</td>
            <td>${escapeHTML(fornecedor.status || "-")}</td>
            <td class="record-row-menu-cell">
                <button type="button" class="record-row-menu-toggle" aria-label="Opções de ${nome}" aria-haspopup="menu" aria-controls="supplierRowMenu" aria-expanded="false">
                    <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                </button>
            </td>
        </tr>`;
    }).join("");
}

// FILTROS DA TABELA
function aplicarFiltros() {
    return fetchSuppliers({ page: 1 });
}

// VISUALIZAR PERFIL DO FORNECEDOR
async function viewSupplier(id) {

    try {

        const response =
            await fetch(`/fornecedores/${id}`);


        const f = await response.json();
        if (!response.ok || f.success === false) {
            throw new Error(f.error || "Não foi possível carregar o fornecedor.");
        }

        const dialog = document.getElementById("supplierDetailsDialog");
        if (!dialog) return;
        const values = {
            nome: f.nome,
            cnpj: f.cnpj,
            responsavel: f.responsavel,
            categoria: f.categoria,
            telefone: f.telefone,
            whatsapp: f.whatsapp,
            email: f.email,
            site: f.site,
            endereco: [f.rua, f.numero, f.bairro].filter(Boolean).join(", "),
            cidade_estado: [f.cidade, f.estado].filter(Boolean).join(" / "),
            cep: f.cep,
            produtos: f.produtos,
            entrega: f.entrega,
            pagamento: f.pagamento,
            status: f.status,
            observacoes: f.observacoes
        };
        dialog.querySelectorAll("[data-supplier-detail]").forEach((field) => {
            field.textContent = values[field.dataset.supplierDetail] || "—";
        });
        dialog.querySelector(".record-details-error").hidden = true;
        dialog.showModal();

    } catch (erro) {
        console.error(erro);
        window.FestAlert?.error?.("Erro ao abrir", erro.message || "Não foi possível abrir o fornecedor.");
    }
}

// FECHAR MODAL DE PERFIL
function closeProfile() {
    document.getElementById("supplierDetailsDialog")?.close();
}

function closeProfileOutside(event) {
    if (event.target === document.getElementById("supplierDetailsDialog")) {
        closeProfile();
    }
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
    const categoria = document.getElementById("filter-category");
    const status = document.getElementById("filter-status");
    const pageSize = document.getElementById("supplier-page-size");
    const categoriaInicial = categoria?.dataset.currentCategory;
    const statusInicial = status?.dataset.currentStatus;
    const limiteInicial = Number(pageSize?.dataset.currentLimit);

    if (categoriaInicial) categoria.value = categoriaInicial;
    if (statusInicial) status.value = statusInicial;
    if ([10, 25, 50].includes(limiteInicial)) {
        pageSize.value = String(limiteInicial);
        supplierLimit = limiteInicial;
    }

    categoria?.addEventListener("change", () => fetchSuppliers({ page: 1 }));
    status?.addEventListener("change", () => fetchSuppliers({ page: 1 }));
    pageSize?.addEventListener("change", () => {
        fetchSuppliers({ page: 1, limit: Number(pageSize.value) });
    });
}

// LIMPAR FILTROS
function limparFiltros() {
    const pesquisa = document.getElementById("search");
    const categoria = document.getElementById("filter-category");
    const status = document.getElementById("filter-status");

    if (pesquisa) {pesquisa.value = "";}

    if (categoria) {categoria.value = "";}

    if (status) {status.value = "";}

    fetchSuppliers({ page: 1 });
}

// BUSCAR FORNECEDOR POR NOME
function buscarFornecedor(nome) {

    if (!nome) {return suppliers;}

    return suppliers.filter(fornecedor => {
        return String(fornecedor.nome || "")
            .toLowerCase()
            .includes(String(nome).toLowerCase());
    });
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

function escapeHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}


// FORMATAR STATUS
function badgeStatus(status) {

    if (status === "Ativo"){

        return `<span class="status ativo">Ativo</span>`;
    }

    return `<span class="status inativo">Inativo</span>`;
}


// CONFIRMAR EXCLUSÃO
async function confirmarExclusao(nome) {
    if (window.FestAlert?.confirm) {
        const resultado = await window.FestAlert.confirm("Excluir fornecedor", `Deseja excluir o fornecedor ${nome}?`);
        return !!resultado?.isConfirmed;
    }
    return window.confirm(`Deseja excluir o fornecedor ${nome}?`);
}


// INICIALIZAÇÃO COMPLETA
document.addEventListener("DOMContentLoaded",() => {

    console.log("Módulo fornecedores carregado");
    carregarEventos();
    carregarFiltros();
    document.getElementById("btn-new-supplier")?.addEventListener("click", openForm);
    document.getElementById("supplier-form")?.addEventListener("submit", saveSupplier);
    document.getElementById("btn-cancel-supplier")?.addEventListener("click", closeForm);
    document.getElementById("modal-form")?.addEventListener("click", closeFormOutside);
    document.getElementById("btn-search-suppliers")?.addEventListener("click", () => {
        fetchSuppliers({ page: 1 });
    });
    document.getElementById("search")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            fetchSuppliers({ page: 1 });
        }
    });
    document.getElementById("btn-clear-supplier-filters")?.addEventListener("click", limparFiltros);
    const rowMenu = document.getElementById("supplierRowMenu");
    let menuToggle = null;
    document.getElementById("supplier-tbody")?.addEventListener("click", (event) => {
        const toggle = event.target.closest(".record-row-menu-toggle");
        if (toggle) {
            event.stopPropagation();
            if (!rowMenu) return;

            if (rowMenu.matches(":popover-open")) {
                rowMenu.hidePopover();
                if (menuToggle === toggle) return;
            }

            const row = toggle.closest(".supplier-table-row");
            if (!row?.dataset.supplierId) return;
            menuToggle = toggle;
            rowMenu.showPopover();

            const buttonRect = toggle.getBoundingClientRect();
            const menuRect = rowMenu.getBoundingClientRect();
            const left = Math.max(12, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - 12));
            const top = buttonRect.bottom + menuRect.height + 8 <= window.innerHeight
                ? buttonRect.bottom + 6
                : Math.max(12, buttonRect.top - menuRect.height - 6);
            rowMenu.style.left = `${left}px`;
            rowMenu.style.top = `${top}px`;
            return;
        }

        const row = event.target.closest(".supplier-table-row");
        if (row) viewSupplier(row.dataset.supplierId);
    });
    document.getElementById("supplier-tbody")?.addEventListener("keydown", (event) => {
        const row = event.target.closest(".supplier-table-row");
        if (
            row &&
            !event.target.closest(".record-row-menu-toggle") &&
            (event.key === "Enter" || event.key === " ")
        ) {
            event.preventDefault();
            viewSupplier(row.dataset.supplierId);
        }
    });
    document.getElementById("pagination")?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-supplier-page]");
        if (!button || button.disabled) return;
        fetchSuppliers({ page: Number(button.dataset.supplierPage) });
    });
    rowMenu?.addEventListener("toggle", (event) => {
        if (event.newState === "closed") {
            document.querySelectorAll("#supplier-tbody .record-row-menu-toggle").forEach((toggle) => {
                toggle.setAttribute("aria-expanded", "false");
            });
            menuToggle = null;
        } else {
            menuToggle?.setAttribute("aria-expanded", "true");
        }
    });
    rowMenu?.addEventListener("click", (event) => {
        const action = event.target.closest("[data-record-action]");
        const supplierId = menuToggle?.closest(".supplier-table-row")?.dataset.supplierId;
        if (!action || !supplierId) return;
        rowMenu.hidePopover();
        if (action.dataset.recordAction === "edit") editSupplier(supplierId);
        else if (action.dataset.recordAction === "delete") deleteSupplier(supplierId);
    });
    const detailsDialog = document.getElementById("supplierDetailsDialog");
    detailsDialog?.addEventListener("click", closeProfileOutside);
    detailsDialog?.querySelector("[data-close-supplier-details]")?.addEventListener("click", closeProfile);
    fetchSuppliers()
});

// EXPORTAR FUNÇÕES
window.limparFiltros = limparFiltros;
window.buscarFornecedor = buscarFornecedor;
window.ordenarFornecedores = ordenarFornecedores;
window.badgeStatus = badgeStatus;
window.confirmarExclusao = confirmarExclusao;