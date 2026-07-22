/* ======================================================
   FUNÇÕES UTILITÁRIAS
====================================================== */

// Atalho para buscar elementos pelo ID
export const $ = (id) => document.getElementById(id);

// Formata valores monetários
export const fmt = (v) =>
  "R$ " + Number(v || 0).toFixed(2).replace(".", ",");

// Escapa HTML
export const esc = (s) =>
  (s || "").toString().replace(/[&<>"]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[ch]));

// Debounce
export function debounce(fn, ms = 300) {
  let t;

  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Converte string vazia para null
export function toNull(v) {
  return v === "" ? null : v;
}