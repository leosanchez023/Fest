// usuarios.routes.js
import express from "express";
import * as controller from "./usuarios.controller.js";

const router = express.Router();

router.get("/", controller.listarUsuarios);
router.post("/registro", controller.criarUsuario);

export default router;