//ABRIR FORMULÁRIO PARA CADASTRAR NOVO CLIENTE
function openForm() {

    const container = document.getElementById('formContainer');
    const form = container ? container.querySelector('form') : null;

    // Verifica se o formulário existe antes de continuar
    if (!container || !form) return;

    //LIMPA OS CAMPOS DO FORMULÁRIO
    form.reset();

    // Remove o ID oculto para indicar que é um novo cadastro
    const inputId = form.querySelector("[name='id']");

    if (inputId) {inputId.value = "";}

    // CONFIGURA FORMULÁRIO PARA CRIAÇÃO
    form.action = "/clientes/criar";


    //ALTERA TÍTULO DO FORMULÁRIO
    const titulo = form.querySelector("h2");

    if (titulo) {titulo.innerHTML = `<i class="fas fa-user-plus"></i>Novo Cliente`;}

    // ALTERA TEXTO DO BOTÃO DE SALVAR
    const btnSalvar = form.querySelector("button[type='submit']");

    if (btnSalvar) {
        btnSalvar.textContent = "Salvar";
    }

    // MOSTRA O FORMULÁRIO NA TELA
    container.style.display = "block";
}


//FILTRO DE CLIENTES

function submitFilter(event) {
    // Evita recarregar o formulário padrão
    if (event) {
        event.preventDefault();
    }

    // Captura texto pesquisado
    const q = document
        .getElementById('searchInput')
        ?.value
        .trim() || "";

    // Quantidade de registros por página
    const limit = document
        .getElementById('limitSelect')
        ?.value || "10";

    // Cria parâmetros da URL
    const params = new URLSearchParams();

    if (q) {params.set('q', q);}
    params.set('limit', limit);

    // Sempre inicia pela primeira página
    params.set('page', '1');

    // Redireciona para a lista filtrada
    window.location.href ='/clientes' +
    (params.toString()
        ? '?' + params.toString()
        : ''
    );

}


// NAVEGAÇÃO ENTRE PÁGINAS
function goToPage(page) {

    // Pega a URL atual
    const url = new URL(window.location.href);

    // Atualiza o número da página
    url.searchParams.set('page', page);

    // Recarrega com nova página
    window.location.href = url.toString();
}
//EDITAR CLIENTE
function editClient(btn) {

    const container = document.getElementById('formContainer');
    const form = container? container.querySelector('form'): null;

    // Verifica se o formulário existe
    if (!container || !form) return;

    // MOSTRA O FORMULÁRIO
    container.style.display = "block";

    //CONFIGURA AÇÃO PARA EDIÇÃO
    form.action = "/clientes/editar/" + btn.dataset.id;

    // ALTERA TÍTULO DO FORMULÁRIO
    const titulo = form.querySelector("h2");

    if (titulo) {
        titulo.innerHTML = `<i class="fas fa-user-edit"></i> Editar Cliente`;
    }

    //ALTERA TEXTO DO BOTÃO
    const btnSalvar = form.querySelector("button[type='submit']");

    if (btnSalvar) {btnSalvar.textContent = "Atualizar";}

    //PREENCHE O ID OCULTO
    const inputId = form.querySelector("[name='id']");

    if (inputId) {inputId.value = btn.dataset.id || "";}

    //PREENCHE OS CAMPOS DO CLIENTE
    const campos = {

        nome: btn.dataset.nome,
        cpf: btn.dataset.cpf,
        email: btn.dataset.email,
        telefone: btn.dataset.telefone,
        nascimento: btn.dataset.nascimento,
        rua: btn.dataset.rua,
        numero: btn.dataset.numero,
        cidade: btn.dataset.cidade,
        estado: btn.dataset.estado
    };

    // Percorre os campos e coloca os valores no formulário
    Object.keys(campos).forEach(campo => {
        const input = form.querySelector( `[name='${campo}']`);

        if (input) {input.value = campos[campo] || "";}

    });
}

// INICIALIZA EVENTOS QUANDO A PÁGINA CARREGAR

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("formulariocard");

    // Caso não exista formulário, encerra
    if (!form) return;

    // O envio será feito via AJAX (fetch)
    form.addEventListener("submit", async (event) => {

        // Impede envio tradicional do HTML
        event.preventDefault();

        // Captura todos os dados do formulário
        const dados = Object.fromEntries(new FormData(form));

        //LIMPEZA INICIAL DOS DADOS
        dados.nome = dados.nome?.trim() || "";
        dados.email = dados.email?.trim().toLowerCase() || "";
        dados.telefone = dados.telefone?.trim() || "";
        dados.cpf = dados.cpf?.trim() || "";
        dados.rua = dados.rua?.trim() || "";
        dados.numero = dados.numero?.trim() || "";
        dados.cidade = dados.cidade?.trim() || "";
        dados.estado = dados.estado?.trim() || "";

        //VALIDAÇÃO DO NOME
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

        // VALIDAÇÃO DO E-MAIL
        if (!dados.email) {
            alert("Informe o e-mail.");
            return;
        }

        const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!regexEmail.test(dados.email)) {
            alert("Informe um e-mail válido.");

            return;
        }

        //VALIDAÇÃO DO TELEFONE
        if (!dados.telefone) {
            alert("Informe o telefone.");
            return;
        }

        // Remove caracteres como (), -, espaços
        const telefone = dados.telefone.replace(/\D/g, "");

        if (
            telefone.length < 10 ||
            telefone.length > 11
        ) {
            alert( "Informe um telefone válido.");
            return;
        }

        // VALIDAÇÃO DO ENDEREÇO
        if (!dados.rua) {
            alert("Informe a rua.");
            return;
        }

        if (!dados.numero) {
            alert("Informe o número.");

             return;
        }

        const numero = Number(dados.numero);

        if (
            isNaN(numero) || numero <= 0
        ) {
            alert("Informe um número válido.");
            return;
        }

        if (!dados.cidade) {
            alert("Informe a cidade.");
            return;
        }

        if (!dados.estado) {alert("Informe o estado.");
            return;
        }

        // VALIDAÇÃO DA DATA DE NASCIMENTO
        if (dados.nascimento) {

            const nascimento = new Date(dados.nascimento);
            const hoje = new Date();

            // Remove horas para comparar somente datas
            hoje.setHours( 0, 0, 0, 0);

            if (nascimento > hoje) {
                alert("A data de nascimento não pode ser maior que a data atual.");

            }
        }

        // ENVIO DOS DADOS PARA O SERVIDOR
        try {
            const res = await fetch(
                form.action,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":"application/json",
                        "Accept":"application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            // Converte resposta do servidor para JSON
            const resposta = await res.json();

            console.log("Resposta servidor:", resposta);

            if (!res.ok) {
                throw new Error( resposta.erro || "Erro ao salvar cliente.");
            }

            alert( "Cliente salvo com sucesso!");

            // Retorna para lista de clientes
            window.location.href = "/clientes";

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
});

//BOTÃO CANCELAR FORMULÁRIO
document.addEventListener("DOMContentLoaded",() => {

        const btnCancelar = document.getElementById( "btn-cancelar-cliente" );
        const container = document.getElementById( "formContainer");

        if (btnCancelar && container) {

            btnCancelar.addEventListener( "click",() => {
                container.style.display ="none";
            });

        }
    }
);