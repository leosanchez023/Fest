function openForm() {
  const container = document.getElementById('formContainer');
  const form = container ? container.querySelector('form') : null;

  if (!container || !form) return;

  form.reset();
  form.action = '/clientes/criar';
  container.style.display = 'block';
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
