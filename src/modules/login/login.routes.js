import express from "express";
import * as controller from "./login.controller.js";
import passport from 'passport';
import { GENERIC_AUTH_ERROR } from "../../config/security.js";
import { landingPageForUser } from "../../config/access.js";

const router = express.Router();

router.get("/", controller.telaLogin);
router.get("/sem-permissoes", controller.semPermissoes);

router.post("/login", (req, res, next) => {
  req.session.regenerate((err) => {
    if (err) return next(err);

    passport.authenticate("local", (error, user) => {
      if (error) return next(error);

      if (!user) {
        req.flash("error_msg", GENERIC_AUTH_ERROR);
        return res.redirect("/");
      }

      landingPageForUser(user.id)
        .then((landingPage) => {
          req.logIn(user, (loginError) => {
            if (loginError) return next(loginError);
            return res.redirect(landingPage);
          });
        })
        .catch(next);
    })(req, res, next);
  });
});

export default router;