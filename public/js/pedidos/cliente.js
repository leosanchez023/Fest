import { state } from "./state.js";
import { $, esc, debounce } from "./utils.js";


export function inicializarCliente() {


/* ======================================================
   CLIENTE - EXIBIÇÃO
====================================================== */

function renderCliente() {

    const box = $('cliente-display');

    if (!box) return;


    if (!state.clienteSelecionado) {

        box.innerHTML = `
            <button type="button" 
            class="btn-dashed"
            id="btn-abrir-painel">
            + Buscar ou Cadastrar Cliente
            </button>
        `;

        $('btn-abrir-painel').onclick = () => {
            togglePainel(true);
        };

        return;
    }


    const c = state.clienteSelecionado;


    box.innerHTML = `
        <div class="cliente-box">

            <div class="cliente-info">

                <div class="nome">
                    ${esc(c.nome || '')}
                </div>

                <div class="meta">
                    ${esc(c.cpf || '')}
                    ${c.telefone ? ' • ' + esc(c.telefone) : ''}
                    ${c.email ? ' • ' + esc(c.email) : ''}
                </div>

            </div>


            <button 
            type="button"
            class="btn-alterar"
            id="btn-alterar">
            Alterar
            </button>

        </div>
    `;


    $('btn-alterar').onclick = () => {
        togglePainel(true);
    };


    if(c.telefone && $('tel-contato')){
        $('tel-contato').value = c.telefone;
    }

}



/* ======================================================
   PAINEL CLIENTE
====================================================== */


function togglePainel(abrir){

    const painel = $('cliente-painel');

    if(!painel) return;


    painel.style.display = abrir ? 'block' : 'none';


    if(!abrir) return;



    $('btn-fechar-painel').onclick = () => {
        togglePainel(false);
    };


    $('tab-buscar').onclick = () => {
        renderBuscaCliente();
    };


    $('tab-cadastrar').onclick = () => {
        renderCadastroCliente();
    };


    renderBuscaCliente();

}





/* ======================================================
   BUSCAR CLIENTE
====================================================== */


function renderBuscaCliente(){


    const body = $('painel-body');


    body.innerHTML = `

        <input 
        id="busca-cliente"
        class="input"
        placeholder="Buscar cliente..."
        autocomplete="off">


        <div id="lista-clientes"></div>

    `;


    const input = $('busca-cliente');
    const lista = $('lista-clientes');


    const buscar = debounce(async()=>{


        const termo = input.value.trim();


        if(!termo){

            lista.innerHTML = '';
            return;

        }



        try{


            const res = await fetch(
                `/pedidos/buscar-clientes?q=${encodeURIComponent(termo)}`
            );


            const clientes = await res.json();



            if(!clientes.length){

                lista.innerHTML =
                `<div>Nenhum cliente encontrado</div>`;

                return;

            }



            lista.innerHTML = clientes.map(c=>`

                <button 
                class="cliente-card"
                data-cliente='${esc(JSON.stringify(c))}'>

                    <b>${esc(c.nome)}</b>

                    <small>
                    ${esc(c.telefone || '')}
                    ${esc(c.email || '')}
                    </small>

                </button>


            `).join('');



            lista.querySelectorAll('.cliente-card')
            .forEach(btn=>{


                btn.onclick = ()=>{


                    state.clienteSelecionado =
                    JSON.parse(
                        btn.dataset.cliente
                    );


                    renderCliente();

                    togglePainel(false);

                };


            });



        }catch(err){

            console.error(err);

            lista.innerHTML =
            `<div>Erro ao buscar clientes</div>`;

        }



    },300);



    input.addEventListener(
        'input',
        buscar
    );


}





/* ======================================================
   CADASTRAR CLIENTE
====================================================== */


async function renderCadastroCliente(){


    const body = $('painel-body');


    const response =
    await fetch('/pedidos/cadastro_cliente');


    body.innerHTML =
    await response.text();



    $('form-novo').onsubmit = async(e)=>{


        e.preventDefault();


        const f=e.target;



        const novo={

            nome:f.nome.value.trim(),

            cpf:f.cpf.value.trim(),

            telefone:f.telefone.value.trim(),

            email:f.email.value.trim(),

            endereco:f.endereco.value.trim()

        };



        try{


            const res = await fetch(
                '/pedidos/criarCliente',
                {
                    method:'POST',

                    headers:{
                        'Content-Type':'application/json'
                    },

                    body:JSON.stringify(novo)

                }
            );



            if(!res.ok)
                throw new Error();



            const cliente =
            await res.json();



            state.clienteSelecionado =
            cliente;



            renderCliente();

            togglePainel(false);



        }catch(err){

            console.error(err);

            alert(
            'Erro ao cadastrar cliente'
            );

        }
    };
}

/* ======================================================
   INICIALIZAÇÃO DO CLIENTE
====================================================== */


renderCliente();


}
