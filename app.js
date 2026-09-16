import dotenv from "dotenv";
dotenv.config();
import express from "express"
import { engine } from "express-handlebars"
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import flash from "connect-flash";
import passport from 'passport';
import auth from "./src/config/auth.js";
import { protegerAplicacao } from "./src/config/access.js";


const app = express();

//model
 import "./database/connection.js"

// corrigir __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//Configuraçoes
    // SESSION
        const sessionSecret = process.env.SESSION_SECRET;
        if (!sessionSecret) {
            throw new Error("SESSION_SECRET não configurado.");
        }
        app.use(session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 8
        }
        }));
        auth(passport);             
        app.use(passport.initialize());
        app.use(passport.session());
        app.use(flash());
        app.use(protegerAplicacao);
    //Middleware
        app.use((req, res, next) => {
        res.locals.success_msg = req.flash("success_msg");
        res.locals.error_msg = req.flash("error_msg");
        next();
        });
    //bordt parser
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());
    //handlebars
        app.engine("handlebars", engine({
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
        eq: (a, b) => a === b,

        moeda: (valor) => {
            if (valor == null) return "0,00";
            return Number(valor).toFixed(2).replace(".", ",");
        }
    }}));

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

    //public
        app.use(express.static(path.join(__dirname,"public")))

//Rotas
import loginRoutes from "./src/modules/login/login.routes.js"
import usuariosRoutes from "./src/modules/usuarios/usuarios.routes.js"
import produtosRoutes from "./src/modules/produtos/produtos.routes.js"
import clientesroutes from "./src/modules/clientes/clientes.routes.js"
import dashboardroutes from "./src/modules/dashboard/dashboard.routes.js"
import entregasRoutes from "./src/modules/entregas/entregas.routes.js"
import fornecedoresRoutes from "./src/modules/fornecedores/fornecedores.routes.js"
import pedidosRoutes from "./src/modules/pedidos/pedidos.routes.js"
import relatoriosRoutes from "./src/modules/relatorios/relatorios.routes.js"
import orcamentosRoutes from "./src/modules/orcamentos/orcamentos.routes.js"
import estoqueRoutes from "./src/modules/estoque/estoque.routes.js"
import combosRoutes from "./src/modules/combos/combos.routes.js"

app.use("/", loginRoutes)
app.use("/usuarios", usuariosRoutes)
app.use("/produtos", produtosRoutes)
app.use("/clientes", clientesroutes)
app.use("/dashboard", dashboardroutes)
app.use("/entregas",entregasRoutes)
app.use("/fornecedores", fornecedoresRoutes)
app.use("/pedidos", pedidosRoutes)
app.use("/orcamentos", orcamentosRoutes)
app.use("/relatorios", relatoriosRoutes)
app.use("/estoque", estoqueRoutes)
app.use("/combos", combosRoutes)

app.get("/logout", (req, res, next) => {
    req.logout((erro) => {
        if (erro) return next(erro);
        req.session.destroy(() => res.redirect("/"));
    });
});

//outros
app.listen(3000, () => {
    console.log("servidor rodando na porta 3000");
});
