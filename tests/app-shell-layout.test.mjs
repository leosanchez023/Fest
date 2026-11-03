import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layoutCss = fs.readFileSync(
  new URL("../public/css/layouts/main.css", import.meta.url),
  "utf8"
);
const sidebarCss = fs.readFileSync(
  new URL("../public/css/layouts/sidebar.css", import.meta.url),
  "utf8"
);
const globalCss = fs.readFileSync(
  new URL("../public/css/base/global.css", import.meta.url),
  "utf8"
);

test("desktop app shell reserves a dedicated sidebar grid track", () => {
  assert.match(layoutCss, /display:\s*grid/);
  assert.match(layoutCss, /grid-template-columns:\s*var\(--sidebar-width\)\s+minmax\(0,\s*1fr\)/);
  assert.match(layoutCss, /\.app-main\s*\{[^}]*grid-column:\s*2;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
  assert.match(layoutCss, /\.app-layout\.is-sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-compact-width\)/s);
  assert.doesNotMatch(layoutCss, /\.app-main\s*\{[^}]*margin-left:\s*var\(--sidebar-width\)/s);
});

test("mobile app shell removes the desktop sidebar track", () => {
  assert.match(
    layoutCss,
    /@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.app-layout,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
  assert.match(layoutCss, /\.app-main\s*\{[^}]*grid-column:\s*1;/);
  assert.match(sidebarCss, /@media \(max-width:\s*900px\)[\s\S]*?transform:\s*translateX\(-100%\)/);
});

test("inline alert and status text can wrap within the page content", () => {
  assert.match(
    layoutCss,
    /\.page-content \[role="alert"\],[\s\S]*?\.page-content \[role="status"\],[\s\S]*?overflow-wrap:\s*anywhere/
  );
  assert.match(globalCss, /\.fest-swal-container\s*\{[\s\S]*?z-index:\s*12000\s*!important/);
});
