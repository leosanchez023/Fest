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


const app = express();

//model
 import "./src/database/connection.js"

// corrigir __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//Configuraçoes
    // SESSION
        app.use(session({
        secret: "segredoqualquer",
        resave: false,
        saveUninitialized: true
        }));
        auth(passport);             
        app.use(passport.initialize());
        app.use(passport.session());
        app.use(flash());
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

app.use("/", loginRoutes)
app.use("/usuarios", usuariosRoutes)
app.use("/produtos", produtosRoutes)
app.use("/clientes", clientesroutes)
app.use("/dashboard", dashboardroutes)
app.use("/entregas",entregasRoutes)
app.use("/fornecedores", fornecedoresRoutes)
app.use("/pedidos", pedidosRoutes)
app.use("/relatorios", relatoriosRoutes)
//outros
app.listen(3000, () => {
    console.log("servidor rodando na porta 3000");
});