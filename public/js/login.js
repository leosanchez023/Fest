const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("togglePassword");
const loginForm = document.getElementById("loginForm");
const submitButton = document.getElementById("submitBtn");

passwordToggle?.addEventListener("click", () => {
	const showingPassword = passwordInput.type === "password";
	passwordInput.type = showingPassword ? "text" : "password";
	passwordToggle.setAttribute("aria-pressed", String(showingPassword));
	passwordToggle.setAttribute("aria-label", showingPassword ? "Ocultar senha" : "Mostrar senha");
});

loginForm?.addEventListener("submit", () => {
	submitButton.disabled = true;
	submitButton.querySelector("span").textContent = "Entrando...";
});
