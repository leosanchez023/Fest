import csrf from "csurf";

export const csrfProtection = csrf({
  cookie: false,
  ignoreMethods: ["GET", "HEAD", "OPTIONS"]
});

export function addCsrfToken(req, res, next) {
  if (!req.csrfToken) {
    return next();
  }

  res.locals.csrfToken = req.csrfToken();
  return next();
}
