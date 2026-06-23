    let suppliers = [
  {
    id: "1", name: "Alimentos Premium Ltda", cnpj: "12.345.678/0001-90",
    responsavel: "Carlos Silva", category: "Alimentos", phone: "(11) 98765-4321",
    whatsapp: "(11) 98765-4321", email: "contato@alimentospremium.com.br",
    website: "www.alimentospremium.com.br",
    street: "Av. Paulista", number: "1000", neighborhood: "Bela Vista",
    city: "São Paulo", state: "SP", cep: "01310-100",
    product: "Alimentos industrializados e grãos", delivery: "5-7 dias úteis",
    payment: "30/60/90 dias", notes: "Fornecedor principal de alimentos",
    status: "Ativo", rating: { quality: 5, punctuality: 4, service: 5 },
    createdAt: new Date().toISOString()
  },
  {
    id: "2", name: "Decorações & Cia", cnpj: "98.765.432/0001-10",
    responsavel: "Ana Oliveira", category: "Decoração", phone: "(21) 91234-5678",
    whatsapp: "(21) 91234-5678", email: "ana@decoracoesecia.com.br", website: "",
    street: "Rua das Flores", number: "250", neighborhood: "Centro",
    city: "Rio de Janeiro", state: "RJ", cep: "20040-020",
    product: "Materiais de decoração para eventos", delivery: "3-5 dias úteis",
    payment: "À vista ou 30 dias", notes: "",
    status: "Ativo", rating: { quality: 4, punctuality: 5, service: 4 },
    createdAt: new Date().toISOString()
  },
  {
    id: "3", name: "TransLog Express", cnpj: "11.222.333/0001-44",
    responsavel: "Roberto Lima", category: "Transporte", phone: "(31) 93456-7890",
    whatsapp: "", email: "roberto@translog.com.br", website: "www.translog.com.br",
    street: "Rod. BR-040", number: "KM 12", neighborhood: "Industrial",
    city: "Belo Horizonte", state: "MG", cep: "30000-000",
    product: "Frete e logística para eventos", delivery: "Sob demanda",
    payment: "15 dias", notes: "Frota própria com rastreamento",
    status: "Inativo", rating: { quality: 3, punctuality: 3, service: 4 },
    createdAt: "2025-02-15"
  },
];

const PAGE_SIZE = 5;
let currentPage = 1;

// Helpers
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function getStars(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

// KPI
function updateKPIs() {
  document.getElementById("kpi-total").textContent = suppliers.length;
  document.getElementById("kpi-active").textContent = suppliers.filter(s => s.status === "Ativo").length;
  const now = new Date();
  document.getElementById("kpi-new").textContent = suppliers.filter(s => {
    const d = new Date(s.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}

// Filter & render table
function getFiltered() {
  const search = document.getElementById("search").value.toLowerCase();
  const cat = document.getElementById("filter-category").value;
  const status = document.getElementById("filter-status").value;
  return suppliers.filter(s => {
    if (search && !s.name.toLowerCase().includes(search) && !s.email.toLowerCase().includes(search)) return false;
    if (cat && s.category !== cat) return false;
    if (status && s.status !== status) return false;
    return true;
  });
}

function renderTable() {
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById("supplier-tbody");
  tbody.innerHTML = page.map(s => `
    <tr>
      <td><strong>${s.name}</strong><br><small style="color:var(--muted)">${s.responsavel || ''}</small></td>
      <td>${s.category}</td>
      <td>${s.phone}</td>
      <td>${s.email}</td>
      <td>${s.city}</td>
      <td><span class="status ${s.status === 'Ativo' ? 'status-active' : 'status-inactive'}">${s.status}</span></td>
      <td class="actions">
        <button class="btn btn-sm btn-secondary" onclick="viewSupplier('${s.id}')">👁</button>
        <button class="btn btn-sm btn-secondary" onclick="editSupplier('${s.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSupplier('${s.id}')">🗑</button>
      </td>
    </tr>
  `).join("");

  // Pagination
  const pag = document.getElementById("pagination");
  if (totalPages <= 1) { pag.innerHTML = ""; return; }
  let html = "";
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  pag.innerHTML = html;
}

function goPage(p) { currentPage = p; renderTable(); }

// Form
function openForm(supplier) {
  const modal = document.getElementById("modal-form");
  const title = document.getElementById("form-title");
  const fields = ["id","name","cnpj","responsavel","category","phone","whatsapp","email","website",
    "street","number","neighborhood","city","state","cep","product","delivery","payment","notes","status"];

  if (supplier) {
    title.textContent = "Editar Fornecedor";
    fields.forEach(f => {
      const el = document.getElementById("f-" + f);
      if (el) el.value = supplier[f] || "";
    });
  } else {
    title.textContent = "Novo Fornecedor";
    document.getElementById("supplier-form").reset();
    document.getElementById("f-id").value = "";
    document.getElementById("f-status").value = "Ativo";
  }
  modal.classList.add("open");
}

function closeForm() { document.getElementById("modal-form").classList.remove("open"); }
function closeFormOutside(e) { if (e.target === e.currentTarget) closeForm(); }

function saveSupplier(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById("f-name").value,
    cnpj: document.getElementById("f-cnpj").value,
    responsavel: document.getElementById("f-responsavel").value,
    category: document.getElementById("f-category").value,
    phone: document.getElementById("f-phone").value,
    whatsapp: document.getElementById("f-whatsapp").value,
    email: document.getElementById("f-email").value,
    website: document.getElementById("f-website").value,
    street: document.getElementById("f-street").value,
    number: document.getElementById("f-number").value,
    neighborhood: document.getElementById("f-neighborhood").value,
    city: document.getElementById("f-city").value,
    state: document.getElementById("f-state").value,
    cep: document.getElementById("f-cep").value,
    product: document.getElementById("f-product").value,
    delivery: document.getElementById("f-delivery").value,
    payment: document.getElementById("f-payment").value,
    notes: document.getElementById("f-notes").value,
    status: document.getElementById("f-status").value,
  };

  const id = document.getElementById("f-id").value;
  if (id) {
    const idx = suppliers.findIndex(s => s.id === id);
    if (idx !== -1) suppliers[idx] = { ...suppliers[idx], ...data };
  } else {
    suppliers.push({ ...data, id: genId(), rating: { quality: 0, punctuality: 0, service: 0 }, createdAt: new Date().toISOString() });
  }

  closeForm();
  updateKPIs();
  renderTable();
}

function editSupplier(id) {
  const s = suppliers.find(s => s.id === id);
  if (s) openForm(s);
}

function deleteSupplier(id) {
  if (!confirm("Deseja realmente excluir este fornecedor?")) return;
  suppliers = suppliers.filter(s => s.id !== id);
  updateKPIs();
  renderTable();
}

// Profile
function viewSupplier(id) {
  const s = suppliers.find(s => s.id === id);
  if (!s) return;

  const modal = document.getElementById("modal-profile");
  document.getElementById("profile-content").innerHTML = `
    <div class="profile-section">
      <h3>📋 Dados da Empresa</h3>
      <div class="profile-row"><strong>Nome:</strong> ${s.name}</div>
      <div class="profile-row"><strong>CNPJ/CPF:</strong> ${s.cnpj}</div>
      <div class="profile-row"><strong>Responsável:</strong> ${s.responsavel || '—'}</div>
      <div class="profile-row"><strong>Categoria:</strong> ${s.category}</div>
      <div class="profile-row"><strong>Status:</strong> <span class="status ${s.status === 'Ativo' ? 'status-active' : 'status-inactive'}">${s.status}</span></div>
    </div>
    <div class="profile-section">
      <h3>📞 Contato</h3>
      <div class="profile-row"><strong>Telefone:</strong> ${s.phone}</div>
      <div class="profile-row"><strong>WhatsApp:</strong> ${s.whatsapp || '—'}</div>
      <div class="profile-row"><strong>E-mail:</strong> ${s.email}</div>
      <div class="profile-row"><strong>Website:</strong> ${s.website || '—'}</div>
    </div>
    <div class="profile-section">
      <h3>📍 Endereço</h3>
      <div class="profile-row"><strong>Endereço:</strong> ${s.street || '—'}, ${s.number || ''} — ${s.neighborhood || ''}</div>
      <div class="profile-row"><strong>Cidade:</strong> ${s.city || '—'} / ${s.state || ''}</div>
      <div class="profile-row"><strong>CEP:</strong> ${s.cep || '—'}</div>
    </div>
    <div class="profile-section">
      <h3>🛒 Informações Comerciais</h3>
      <div class="profile-row"><strong>Produto/Serviço:</strong> ${s.product || '—'}</div>
      <div class="profile-row"><strong>Prazo Entrega:</strong> ${s.delivery || '—'}</div>
      <div class="profile-row"><strong>Pagamento:</strong> ${s.payment || '—'}</div>
      <div class="profile-row"><strong>Observações:</strong> ${s.notes || '—'}</div>
    </div>
    <div class="profile-section">
      <h3>⭐ Avaliação</h3>
      <div class="profile-row"><strong>Qualidade:</strong> <span class="stars">${getStars(s.rating.quality)}</span></div>
      <div class="profile-row"><strong>Pontualidade:</strong> <span class="stars">${getStars(s.rating.punctuality)}</span></div>
      <div class="profile-row"><strong>Atendimento:</strong> <span class="stars">${getStars(s.rating.service)}</span></div>
    </div>
  `;
  modal.classList.add("open");
}

function closeProfile() { document.getElementById("modal-profile").classList.remove("open"); }
function closeProfileOutside(e) { if (e.target === e.currentTarget) closeProfile(); }

// Init
updateKPIs();
renderTable();