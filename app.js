import dotenv from "dotenv";
dotenv.config();
import express from "express"
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { engine } from "express-handlebars"
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import flash from "connect-flash";
import passport from 'passport';
import auth from "./src/config/auth.js";
import { protegerAplicacao } from "./src/config/access.js";
import { csrfProtection, addCsrfToken } from "./src/config/csrf.js";



const app = express();

//model
 import "./database/connection.js"

// corrigir __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//Configuraçoes
    const skipCsrfForRoutes = (req) => req.path === "/login" && req.method === "POST";

    app.disable("x-powered-by");
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
                imgSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
                fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
        throw new Error("SESSION_SECRET não configurado.");
    }
    app.use(session({
        name: "fest.sid",
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        rolling: true,
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
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use((req, res, next) => {
        res.locals.success_msg = req.flash("success_msg");
        res.locals.error_msg = req.flash("error_msg");
        next();
    });
    app.use((req, res, next) => {
        if (skipCsrfForRoutes(req)) return next();
        return csrfProtection(req, res, next);
    });
    app.use(addCsrfToken);
    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });
    app.use(protegerAplicacao);
    app.use((req, res, next) => {
        if (req.path === "/login" || req.path === "/") return next();
        if (req.method !== "GET" && !req.body) return next();
        next();
    });
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 8,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        message: { success: false, message: "E-mail ou senha inválidos." },
        keyGenerator: (req) => `${ipKeyGenerator(req)}:${req.body?.email || "unknown"}`
    });
    app.use((req, res, next) => {
        if (req.path === "/login") return loginLimiter(req, res, next);
        next();
    });
    //handlebars
        app.engine("handlebars", engine({
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/pages/partials"),
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
import devedoresRoutes from "./src/modules/devedores/devedores.routes.js"

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
app.use("/devedores", devedoresRoutes)

app.post("/logout", (req, res, next) => {
    req.logout((erro) => {
        if (erro) return next(erro);
        req.session.destroy(() => {
            res.clearCookie("fest.sid", { path: "/" });
            res.redirect("/");
        });
    });
});

app.use((err, req, res, next) => {
    const funcionarioApi = req.path.startsWith("/usuarios/api/");
    if (err.code === "EBADCSRFTOKEN") {
        if (funcionarioApi) {
            return res.status(403).json({
                data: null,
                error: { code: "CSRF_INVALID", message: "Sessão inválida ou expirada." },
                message: "Sessão inválida ou expirada."
            });
        }
        return res.status(403).json({ success: false, message: "Sessão inválida ou expirada." });
    }

    if (err && err.status === 401) {
        if (funcionarioApi) {
            return res.status(401).json({
                data: null,
                error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." },
                message: "Autenticação necessária."
            });
        }
        return res.status(401).json({ success: false, message: "Autenticação necessária." });
    }

    console.error("Erro não tratado:", err);
    const message = req.accepts("html") ? "Não foi possível concluir a operação." : "Não foi possível concluir a operação.";
    if (funcionarioApi) {
        return res.status(err.status || 500).json({
            data: null,
            error: {
                code: err.status === 413 ? "REQUEST_TOO_LARGE" : "INTERNAL_ERROR",
                message
            },
            message
        });
    }
    if (req.accepts("html")) {
        return res.status(500).render("pages/login", { layout: false, error: message });
    }
    return res.status(500).json({ success: false, message });
});

if (process.env.NODE_ENV !== "test") {
    app.listen(3000, () => {
        console.log("servidor rodando na porta 3000");
    });
}

export default app;
