import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import db from "../../database/connection.js";

export default function (passport) {

  passport.use(new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "senha"
    },

    async (email, senha, done) => {
      try {
        const [users] = await db.query(
          "SELECT * FROM usuario WHERE email = ?",
          [email]
        );

        if (users.length === 0) {
          return done(null, false, { message: "Usuário não encontrado" });
        }

        const user = users[0];

        const senhaValida = await bcrypt.compare(senha, user.senha);

        if (!senhaValida) {
          return done(null, false, { message: "Senha inválida" });
        }

        return done(null, user);

      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [users] = await db.query(
        "SELECT * FROM usuario WHERE id = ?",
        [id]
      );

      done(null, users[0]);

    } catch (err) {
      done(err);
    }
  });

}