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
    dialog.querySelector(".client-details-error").hidden = true;
    dialog.showModal();
}

document.addEventListener("DOMContentLoaded", () => {
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

    document.querySelectorAll(".js-client-details").forEach((button) => {
        button.addEventListener("click", async () => {
            const dialog = document.getElementById("clientDetailsDialog");
            const errorBox = dialog?.querySelector(".client-details-error");
            dialog?.querySelectorAll("[data-detail]").forEach((field) => {
                field.textContent = "—";
            });
            if (errorBox) {
                errorBox.hidden = true;
                errorBox.textContent = "";
            }
            try {
                const response = await fetch(`/clientes/detalhes/${encodeURIComponent(button.dataset.clientId)}`, {
                    headers: { "Accept": "application/json" }
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(result.erro || "Não foi possível carregar os detalhes.");
                }
                showClientDetails(result.cliente);
            } catch (error) {
                if (dialog && errorBox) {
                    errorBox.textContent = error.message || "Não foi possível carregar os detalhes.";
                    errorBox.hidden = false;
                    dialog.showModal();
                } else {
                    alertError("Erro", error.message || "Não foi possível carregar os detalhes.");
                }
            }
        });
    });

    document.getElementById("clientDetailsDialog")
        ?.querySelector("[data-close-details]")
        ?.addEventListener("click", () => {
            document.getElementById("clientDetailsDialog")?.close();
        });

    document.querySelectorAll(".js-delete-client").forEach((deleteForm) => {
        deleteForm.addEventListener("submit", async (event) => {
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
});
