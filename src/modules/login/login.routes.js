import express from "express";
import * as controller from "./login.controller.js";
import passport from 'passport';

const router = express.Router();

router.get("/", controller.telaLogin);

router.post("/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/",
  })
);

export default router;