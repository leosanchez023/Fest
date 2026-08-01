import * as service from "./clientes.service.js";

/* LISTAR CLIENTES */
export async function listar(req, res) {
    try {
        const q = req.query.q || "";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const data = await service.listar({ q, page, limit});
        const pageNum = Number(data.page) || 1;
        const totalPages = Number(data.totalPages) || 1;
        const prevPage = pageNum > 1? pageNum - 1 : 1;
        const nextPage = pageNum < totalPages ? pageNum + 1 : totalPages;

        return res.render(
            "pages/clientes",
            {
                clientes: data.clientes,
                total: data.total,
                page: pageNum,
                limit: data.limit,
                totalPages,
                prevPage,
                nextPage,
                isFirst: pageNum <= 1,
                isLast: pageNum >= totalPages,q
            }
        );
    } catch (err) {
        req.flash(
            "error_msg",
            err.message
        );

        return res.redirect("/clientes");
    }
}


/* API LISTAR CLIENTES */
export async function apiList(req, res) {

    try {
        const q = req.query.q || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const data = await service.listar({ q, page, limit});
        return res.json(data);
    } catch (err) {

        return res.status(500).json({ error: err.message});
    }
}


/* CRIAR CLIENTE */
export async function criar(req, res) {

    try {
        const cliente = await service.criar(req.body);
        console.log("CLIENTE CRIADO:", cliente);

        if (
            req.headers.accept?.includes(
                "application/json"
            )
        ) {

            return res.status(201).json(cliente);
        }

        req.flash(
            "success_msg",
            "Cliente cadastrado com sucesso."
        );

        return res.redirect("/clientes");

    } catch (err) {

        console.log(err);
        return res.status(400).json({ erro: err.message});
    }
}


/* EDITAR CLIENTE */
export async function editar(req, res) {
    try {

        const cliente = await service.findById(req.params.id);
        const clientes = await service.listar();

        return res.render("pages/clientes",{cliente, clientes});
    } catch (err) {
        req.flash("error_msg", err.message);

        return res.redirect("/clientes");
    }
}

/* ATUALIZAR CLIENTE */
export async function atualizar(req, res) {
    try {


        const cliente = await service.atualizar( req.params.id, req.body);

        if ( req.headers.accept?.includes("application/json" )){

            return res.status(200).json({
                sucesso: true,
                mensagem:"Cliente atualizado com sucesso.",
                cliente}
            );
        }

        req.flash( "success_msg","Cliente atualizado com sucesso.");

        return res.redirect("/clientes");
    } catch (err) {

        console.error(err);

        if (
            req.headers.accept?.includes("application/json")
        ) {
            return res.status(400).json({ erro: err.message});
        }

        req.flash("error_msg",err.message);

        return res.redirect("/clientes");
    }
}

/* EXCLUIR CLIENTE */
export async function deletar(req, res) {

    console.log("Tentando excluir cliente ID:", req.params.id);

    try {await service.deletar(req.params.id);

        if (
            req.headers.accept?.includes("application/json")
        ) {

            return res.json({ sucesso: true});
        }

        req.flash( "success_msg","Cliente excluído com sucesso.");

        return res.redirect("/clientes");
    } catch (err) {
        console.error(err);

        if ( req.headers.accept?.includes("application/json")){

            return res.status(400).json({ erro: err.message});
        }

        req.flash("error_msg",err.message);

        return res.redirect("/clientes");
    }
}