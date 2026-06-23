async function deletarProduto(id) {
  if (!confirm("Tem certeza que quer excluir?")) return;

  try {
    const res = await fetch(`/produtos/deletar/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      window.location.reload(); // recarrega a tabela
    } else {
      alert(data.mensagem || "Erro ao deletar");
    }
  } catch (err) {
    alert("Erro de conexão ao deletar");
    console.error(err);
  }
}