  const pedidos = [
    { id: 1, cliente: 'João Silva', data: '20/03/2026', valor: 1500, status: 'Confirmado' },
    { id: 2, cliente: 'Maria Santos', data: '22/03/2026', valor: 980, status: 'Pendente' },
    { id: 3, cliente: 'Carlos Lima', data: '25/03/2026', valor: 2200, status: 'Confirmado' }
  ];

  function gerarRelatorios() {
    const tabela = document.getElementById('tabelaPedidos');
    tabela.innerHTML = '';

    let total = 0;

    pedidos.forEach(p => {
      total += p.valor;
      tabela.innerHTML += `
        <tr>
          <td>#${p.id}</td>
          <td>${p.cliente}</td>
          <td>${p.data}</td>
          <td>R$ ${p.valor.toFixed(2)}</td>
          <td>${p.status}</td>
        </tr>
      `;
    });

    document.getElementById('faturamento').innerText =
      total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    document.getElementById('totalPedidos').innerText = pedidos.length;
  }

  gerarRelatorios();