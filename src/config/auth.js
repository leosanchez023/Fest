import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import db from "../../database/connection.js";
import * as usuariosModel from "../modules/usuarios/usuarios.model.js";
import { GENERIC_AUTH_ERROR, normalizarEmail } from "./security.js";

export default function configureAuth(passport) {
  passport.use(new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "senha",
      passReqToCallback: true
    },
    async (req, email, senha, done) => {
      const emailNormalizado = normalizarEmail(email);
      try {
        const [users] = await db.query(
          `SELECT id, nome, email, senha, ativo, login_habilitado
           FROM usuario
           WHERE email = ?
           LIMIT 1`,
          [emailNormalizado]
        );
        if (!users.length) {
          await usuariosModel.registrarEventoLogin(req, null, emailNormalizado, "failure", "invalid_credentials");
          return done(null, false, { message: GENERIC_AUTH_ERROR });
        }

        const storedUser = users[0];
        const passwordValid = await bcrypt.compare(String(senha ?? ""), storedUser.senha || "");
        if (!passwordValid) {
          await usuariosModel.registrarEventoLogin(req, storedUser.id, emailNormalizado, "failure", "invalid_credentials");
          return done(null, false, { message: GENERIC_AUTH_ERROR });
        }

        if (Number(storedUser.ativo) !== 1 || Number(storedUser.login_habilitado) !== 1) {
          const reason = Number(storedUser.ativo) !== 1 ? "account_inactive" : "login_disabled";
          await usuariosModel.registrarEventoLogin(req, storedUser.id, emailNormalizado, "failure", reason);
          return done(null, false, { message: GENERIC_AUTH_ERROR });
        }

        await usuariosModel.atualizarUltimoAcesso(storedUser.id);
        await usuariosModel.registrarEventoLogin(req, storedUser.id, emailNormalizado, "success", "authenticated");
        return done(null, {
          id: storedUser.id,
          nome: storedUser.nome,
          email: storedUser.email,
          ativo: 1,
          login_habilitado: 1
        });
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [users] = await db.query(
        `SELECT id, nome, email, ativo, login_habilitado
         FROM usuario
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      const user = users[0];
      if (!user || Number(user.ativo) !== 1 || Number(user.login_habilitado) !== 1) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  });
}
