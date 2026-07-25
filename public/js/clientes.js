function openForm() {
  const container = document.getElementById('formContainer');
  const form = container ? container.querySelector('form') : null;

  if (!container || !form) return;

  // Limpa todos os campos
  form.reset();

  // Limpa o ID oculto
  const inputId = form.querySelector("[name='id']");
  if (inputId) {
    inputId.value = "";
  }

  // Configura o formulário para criação
  form.action = "/clientes/criar";

  // Atualiza o título
  const titulo = form.querySelector("h2");
  if (titulo) {
    titulo.innerHTML = '<i class="fas fa-user-plus"></i> Novo Cliente';
  }

  // Atualiza o botão
  const btnSalvar = form.querySelector("button[type='submit']");
  if (btnSalvar) {
    btnSalvar.textContent = "Salvar";
  }

  // Exibe o formulário
  container.style.display = "block";
}

function submitFilter(event) {
  if (event) event.preventDefault();

  const q = document.getElementById('searchInput')?.value.trim() || '';
  const limit = document.getElementById('limitSelect')?.value || '10';
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  params.set('limit', limit);
  params.set('page', '1');

  window.location.href = '/clientes' + (params.toString() ? '?' + params.toString() : '');
}

function goToPage(page) {
  const url = new URL(window.location.href);
  url.searchParams.set('page', page);
  window.location.href = url.toString();
}

function editClient(btn) {

  const container = document.getElementById('formContainer');
  const form = container ? container.querySelector('form') : null;

  if (!container || !form) return;

  container.style.display = 'block';
  form.action = '/clientes/editar/' + btn.dataset.id;

  // Atualiza o título
  const titulo = form.querySelector("h2");
  if (titulo) {
    titulo.innerHTML = '<i class="fas fa-user-plus"></i> Editar Cliente';
  }

  // Atualiza o texto do botão
  const btnSalvar = form.querySelector("button[type='submit']");
  if (btnSalvar) {
    btnSalvar.textContent = "Atualizar";
  }

  // Preenche o ID oculto
  form.querySelector("[name='id']").value = btn.dataset.id || '';

  // Preenche os campos
  form.querySelector("[name='nome']").value = btn.dataset.nome || '';
  form.querySelector("[name='cpf']").value = btn.dataset.cpf || '';
  form.querySelector("[name='email']").value = btn.dataset.email || '';
  form.querySelector("[name='telefone']").value = btn.dataset.telefone || '';
  form.querySelector("[name='nascimento']").value = btn.dataset.nascimento || '';
  form.querySelector("[name='rua']").value = btn.dataset.rua || '';
  form.querySelector("[name='numero']").value = btn.dataset.numero || '';
  form.querySelector("[name='cidade']").value = btn.dataset.cidade || '';
  form.querySelector("[name='estado']").value = btn.dataset.estado || '';
}
document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("formulariocard");

  if (!form) return;

  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const dados = Object.fromEntries(new FormData(form));

    /* ==========================================
       LIMPEZA DOS DADOS
    ========================================== */

    dados.nome = dados.nome?.trim() || "";
    dados.email = dados.email?.trim().toLowerCase() || "";
    dados.telefone = dados.telefone?.trim() || "";
    dados.cpf = dados.cpf?.trim() || "";
    dados.rua = dados.rua?.trim() || "";
    dados.numero = dados.numero?.trim() || "";
    dados.cidade = dados.cidade?.trim() || "";
    dados.estado = dados.estado?.trim() || "";

    /* ==========================================
       VALIDAÇÃO DO NOME
    ========================================== */

    if (!dados.nome) {
      alert("Informe o nome do cliente.");
      return;
    }

    if (dados.nome.length < 3) {
      alert("O nome deve possuir no mínimo 3 caracteres.");
      return;
    }

    if (dados.nome.length > 100) {
      alert("O nome deve possuir no máximo 100 caracteres.");
      return;
    }

    /* ==========================================
       VALIDAÇÃO DO E-MAIL
    ========================================== */

    if (!dados.email) {
      alert("Informe o e-mail.");
      return;
    }

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regexEmail.test(dados.email)) {
      alert("Informe um e-mail válido.");
      return;
    }

    /* ==========================================
       VALIDAÇÃO DO TELEFONE
    ========================================== */

    if (!dados.telefone) {
      alert("Informe o telefone.");
      return;
    }

    const telefone = dados.telefone.replace(/\D/g, "");

    if (telefone.length < 10 || telefone.length > 11) {
      alert("Informe um telefone válido.");
      return;
    }

    /* ==========================================
       VALIDAÇÃO DO ENDEREÇO
    ========================================== */

    if (!dados.rua) {
      alert("Informe a rua.");
      return;
    }

    if (!dados.numero) {
      alert("Informe o número.");
      return;
    }

    const numero = Number(dados.numero);

    if (isNaN(numero) || numero <= 0) {
      alert("Informe um número válido.");
      return;
    }

    if (!dados.cidade) {
      alert("Informe a cidade.");
      return;
    }

    if (!dados.estado) {
      alert("Informe o estado.");
      return;
    }

    /* ==========================================
       VALIDAÇÃO DA DATA DE NASCIMENTO
    ========================================== */

    if (dados.nascimento) {

      const nascimento = new Date(dados.nascimento);
      const hoje = new Date();

      hoje.setHours(0, 0, 0, 0);

      if (nascimento > hoje) {
        alert("A data de nascimento não pode ser maior que a data atual.");
        return;
      }

    }

    /* ==========================================
       ENVIA PARA O SERVIDOR
    ========================================== */

    try {

      const res = await fetch(form.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(dados)
      });

      const resposta = await res.json();

      console.log("Resposta servidor:", resposta);

      if (!res.ok) {
        throw new Error(resposta.erro || "Erro ao salvar cliente.");
      }

      alert("Cliente salvo com sucesso!");

      window.location.href = "/clientes";

    } catch (err) {

      console.error(err);
      alert(err.message);

    }

  });

});

/* ==========================================
   BOTÃO CANCELAR
========================================== */

document.addEventListener("DOMContentLoaded", () => {

  const btnCancelar = document.getElementById("btn-cancelar-cliente");
  const container = document.getElementById("formContainer");

  if (btnCancelar && container) {

    btnCancelar.addEventListener("click", () => {

      container.style.display = "none";

    });

  }

});