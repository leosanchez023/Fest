import * as service from "./clientes.service.js";

function wantsJson(req) {
    return req.get("Accept")?.includes("application/json");
}

function renderPage(res, data = {}) {
    return res.render("pages/clientes", {
        clientes: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        prevPage: 1,
        nextPage: 1,
        isFirst: true,
        isLast: true,
        q: "",
        formAction: "/clientes/criar",
        formTitle: "Novo Cliente",
        submitLabel: "Salvar",
        ...data
    });
}

function sendError(req, res, error) {
    const status = error.status || 500;
    const message = status < 500
        ? error.message
        : "Não foi possível concluir a operação.";
    if (wantsJson(req)) {
        return res.status(status).json({ success: false, erro: message, message });
    }
    req.flash("error_msg", message);
    return res.redirect("/clientes");
}

export async function listar(req, res) {
    try {
        const data = await service.listar(req.query);
        const page = data.page;
        const totalPages = data.totalPages;
        return renderPage(res, {
            ...data,
            prevPage: Math.max(1, page - 1),
            nextPage: Math.min(totalPages, page + 1),
            isFirst: page <= 1,
            isLast: page >= totalPages,
            q: req.query.q || ""
        });
    } catch (error) {
        return res.status(500).render("pages/clientes", {
            clientes: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
            prevPage: 1,
            nextPage: 1,
            isFirst: true,
            isLast: true,
            q: "",
            formAction: "/clientes/criar",
            pageError: "Não foi possível carregar a lista de clientes."
        });
    }
}

export async function apiList(req, res) {
    try {
        return res.json(await service.listar(req.query));
    } catch (error) {
        return res.status(500).json({
            success: false,
            erro: "Não foi possível carregar a lista de clientes."
        });
    }
}

export async function criar(req, res) {
    try {
        const cliente = await service.criar(req.body);
        if (wantsJson(req)) return res.status(201).json({ success: true, cliente });

        req.flash("success_msg", "Cliente cadastrado com sucesso.");
        return res.redirect("/clientes");
    } catch (error) {
        return sendError(req, res, error);
    }
}

export async function editar(req, res) {
    try {
        const cliente = await service.findById(req.params.id);
        if (!cliente) {
            req.flash("error_msg", "Cliente não encontrado.");
            return res.redirect("/clientes");
        }

        const data = await service.listar({
            q: req.query.q,
            page: req.query.page,
            limit: req.query.limit
        });
        return renderPage(res, {
            ...data,
            cliente,
            formAction: `/clientes/editar/${cliente.cliente_id}`,
            formTitle: "Editar Cliente",
            submitLabel: "Atualizar",
            mostrarFormulario: true,
            prevPage: Math.max(1, data.page - 1),
            nextPage: Math.min(data.totalPages, data.page + 1),
            isFirst: data.page <= 1,
            isLast: data.page >= data.totalPages,
            q: req.query.q || ""
        });
    } catch (error) {
        req.flash(
            "error_msg",
            error.status && error.status < 500
                ? error.message
                : "Não foi possível carregar o cliente."
        );
        return res.redirect("/clientes");
    }
}

export async function detalhes(req, res) {
    try {
        const cliente = await service.findById(req.params.id);
        if (!cliente) return res.status(404).json({ success: false, erro: "Cliente não encontrado." });
        return res.json({ success: true, cliente });
    } catch (error) {
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            erro: status === 404 ? error.message : "Não foi possível carregar os detalhes do cliente."
        });
    }
}

export async function atualizar(req, res) {
    try {
        const cliente = await service.atualizar(req.params.id, req.body);
        if (wantsJson(req)) {
            return res.status(200).json({
                success: true,
                mensagem: "Cliente atualizado com sucesso.",
                cliente
            });
        }

        req.flash("success_msg", "Cliente atualizado com sucesso.");
        return res.redirect("/clientes");
    } catch (error) {
        return sendError(req, res, error);
    }
}

export async function deletar(req, res) {
    try {
        await service.deletar(req.params.id);
        if (wantsJson(req)) return res.json({ success: true });

        req.flash("success_msg", "Cliente excluído com sucesso.");
        return res.redirect("/clientes");
    } catch (error) {
        return sendError(req, res, error);
    }
}
