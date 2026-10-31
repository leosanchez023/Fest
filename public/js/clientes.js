function alertError(title, message) {
    if (window.FestAlert?.error) {
        return window.FestAlert.error(title, message);
    }
    window.alert(`${title}: ${message}`);
}

function openForm() {
    const container = document.getElementById("formContainer");
    const form = document.getElementById("formulariocard");
    if (!container || !form) return;

    form.reset();
    ["nome", "cpf", "email", "telefone", "nascimento", "rua", "numero",
        "bairro", "cidade", "estado", "cep", "referencia"].forEach((name) => {
        const field = form.elements.namedItem(name);
        if (field) field.value = "";
    });
    form.action = "/clientes/criar";
    form.dataset.editing = "false";
    form.dataset.submitting = "false";
    const title = form.querySelector("h2");
    const submit = form.querySelector('button[type="submit"]');
    if (title) title.textContent = "Novo Cliente";
    if (submit) {
        submit.disabled = false;
        submit.textContent = "Salvar";
    }
    container.classList.add("is-open");
    form.querySelector('[name="nome"]')?.focus();
}

function submitFilter(event) {
    event.preventDefault();
    const query = document.getElementById("searchInput")?.value.trim() || "";
    const limit = document.getElementById("limitSelect")?.value || "10";
    const params = new URLSearchParams({ limit, page: "1" });
    if (query) params.set("q", query);
    window.location.assign(`/clientes?${params.toString()}`);
}

function goToPage(page) {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page);
    window.location.assign(url.toString());
}

function showClientDetails(cliente) {
    const dialog = document.getElementById("clientDetailsDialog");
    if (!dialog) return;

    const values = {
        nome: cliente.nome,
        cpf: cliente.cpf,
        email: cliente.email,
        telefone: cliente.telefone,
        nascimento: cliente.nascimento,
        rua_numero: [cliente.rua, cliente.numero].filter(Boolean).join(", "),
        bairro: cliente.bairro,
        cidade_estado: [cliente.cidade, cliente.estado].filter(Boolean).join(" / "),
        cep: cliente.cep,
        referencia: cliente.referencia
    };

    Object.entries(values).forEach(([key, value]) => {
        const field = dialog.querySelector(`[data-detail="${key}"]`);
        if (field) field.textContent = value || "—";
    });
    dialog.querySelector(".record-details-error").hidden = true;
    dialog.showModal();
}

async function loadClientDetails(clientId) {
    const dialog = document.getElementById("clientDetailsDialog");
    const errorBox = dialog?.querySelector(".record-details-error");
    if (!dialog || !errorBox) return;

    dialog.querySelectorAll("[data-detail]").forEach((field) => {
        field.textContent = "—";
    });
    errorBox.hidden = true;
    errorBox.textContent = "";

    try {
        const response = await fetch(`/clientes/detalhes/${encodeURIComponent(clientId)}`, {
            headers: { "Accept": "application/json" }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.erro || "Não foi possível carregar os detalhes.");
        }
        showClientDetails(result.cliente);
    } catch (error) {
        errorBox.textContent = error.message || "Não foi possível carregar os detalhes.";
        errorBox.hidden = false;
        dialog.showModal();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const filterForm = document.querySelector(".filter-form");
    const limitSelect = document.getElementById("limitSelect");
    const currentLimit = limitSelect?.dataset.currentLimit;
    if (limitSelect && currentLimit) limitSelect.value = currentLimit;
    filterForm?.addEventListener("submit", submitFilter);
    document.getElementById("btn-new-client")?.addEventListener("click", openForm);

    document.querySelector(".pagination-row")?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-page]");
        if (!button || button.disabled) return;
        const page = Number(button.dataset.page);
        if (Number.isInteger(page)) goToPage(page);
    });

    const form = document.getElementById("formulariocard");
    const container = document.getElementById("formContainer");
    const submitButton = form?.querySelector('button[type="submit"]');
    const originalSubmitText = submitButton?.textContent.trim() || "Salvar";

    if (form) {
        form.dataset.editing = form.action.includes("/editar/") ? "true" : "false";
        form.dataset.submitting = "false";

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (form.dataset.submitting === "true") return;

            if (!form.reportValidity()) return;

            form.dataset.submitting = "true";
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Salvando…";
            }

            try {
                const response = await fetch(form.action, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });

                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(result.erro || result.message || "Não foi possível salvar o cliente.");
                }

                if (window.FestAlert?.success) {
                    await window.FestAlert.success(
                        "Cliente salvo",
                        form.dataset.editing === "true"
                            ? "Cliente atualizado com sucesso."
                            : "Cliente cadastrado com sucesso."
                    );
                }
                window.location.assign("/clientes");
            } catch (error) {
                alertError("Erro ao salvar", error.message || "Tente novamente.");
                form.dataset.submitting = "false";
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalSubmitText;
                }
            }
        });
    }

    document.getElementById("btn-cancelar-cliente")?.addEventListener("click", () => {
        container?.classList.remove("is-open");
        if (form) form.dataset.submitting = "false";
    });

    const rowMenu = document.getElementById("clientRowMenu");
    const editLink = document.getElementById("clientMenuEdit");
    const deleteForm = document.getElementById("clientMenuDelete");
    let menuToggle = null;

    document.querySelector(".client-table tbody")?.addEventListener("click", (event) => {
        const toggle = event.target.closest(".record-row-menu-toggle");
        if (toggle) {
            event.stopPropagation();
            if (!rowMenu || !editLink || !deleteForm) return;

            if (rowMenu.matches(":popover-open")) {
                rowMenu.hidePopover();
                if (menuToggle === toggle) return;
            }

            const row = toggle.closest(".client-table-row");
            const clientId = row?.dataset.clientId;
            if (!clientId) return;

            editLink.href = `/clientes/editar/${encodeURIComponent(clientId)}`;
            deleteForm.action = `/clientes/excluir/${encodeURIComponent(clientId)}`;
            deleteForm.dataset.clientName = row.dataset.clientName || "este cliente";
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

        const row = event.target.closest(".client-table-row");
        if (row) loadClientDetails(row.dataset.clientId);
    });

    document.querySelector(".client-table tbody")?.addEventListener("keydown", (event) => {
        const row = event.target.closest(".client-table-row");
        if (
            row &&
            !event.target.closest(".record-row-menu-toggle") &&
            (event.key === "Enter" || event.key === " ")
        ) {
            event.preventDefault();
            loadClientDetails(row.dataset.clientId);
        }
    });

    rowMenu?.addEventListener("toggle", (event) => {
        if (event.newState === "closed") {
            document.querySelectorAll(".record-row-menu-toggle").forEach((toggle) => {
                toggle.setAttribute("aria-expanded", "false");
            });
            menuToggle = null;
        } else {
            menuToggle?.setAttribute("aria-expanded", "true");
        }
    });

    document.getElementById("clientDetailsDialog")
        ?.addEventListener("click", (event) => {
            const dialog = event.currentTarget;
            if (event.target === dialog || event.target.closest("[data-close-details]")) dialog.close();
        });

    deleteForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (
            deleteForm.dataset.submitting === "true" ||
            deleteForm.dataset.confirming === "true"
        ) return;
        deleteForm.dataset.confirming = "true";
        const button = deleteForm.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        const name = deleteForm.dataset.clientName || "este cliente";
        let confirmation;
        try {
            confirmation = window.FestAlert?.confirm
                ? await window.FestAlert.confirm("Excluir cliente", `Deseja excluir ${name}?`)
                : { isConfirmed: window.confirm(`Deseja excluir ${name}?`) };
        } catch {
            confirmation = { isConfirmed: false };
            alertError("Erro", "Não foi possível confirmar a exclusão.");
        }
        if (!confirmation?.isConfirmed) {
            deleteForm.dataset.confirming = "false";
            if (button) button.disabled = false;
            return;
        }

        deleteForm.dataset.submitting = "true";
        deleteForm.submit();
    });
});
