import { state } from "./state.js";
import { $ , debounce } from "./utils.js";


export function inicializarEndereco() {


/* ======================================================
   SELECIONAR ENDEREÇO
====================================================== */


function selecionarEndereco(e) {


    state.enderecoSelecionado = e;


    if($('end-rua'))
        $('end-rua').value = e.rua || '';


    if($('end-numero'))
        $('end-numero').value = e.numero || '';


    if($('end-bairro'))
        $('end-bairro').value = e.bairro || '';


    if($('end-cidade'))
        $('end-cidade').value = e.cidade || '';


    if($('end-estado'))
        $('end-estado').value = e.estado || '';



    const painel = $('painel-endereco');

    if(painel)
        painel.style.display = 'none';

}



/* ======================================================
   BUSCAR ENDEREÇO
====================================================== */


function buscarEndereco(){


    const input = $('busca-endereco');

    const lista = $('lista-enderecos');


    if(!input || !lista)
        return;



    const buscar = debounce(async()=>{


        const termo = input.value.trim();



        if(!termo){

            lista.innerHTML='';
            return;

        }



        try{


            const res = await fetch(
                `/pedidos/buscar-enderecos?q=${encodeURIComponent(termo)}`
            );



            const dados = await res.json();



            if(!dados.length){

                lista.innerHTML =
                `<div>Nenhum endereço encontrado</div>`;

                return;

            }



            lista.innerHTML = dados.map(e=>`

                <button 
                type="button"
                class="endereco-card"
                data-endereco='${JSON.stringify(e)}'>


                    ${e.rua}, ${e.numero}<br>

                    <small>
                    ${e.bairro} -
                    ${e.cidade}/${e.estado}
                    </small>


                </button>


            `).join('');




            lista.querySelectorAll('.endereco-card')
            .forEach(btn=>{


                btn.onclick=()=>{


                    const endereco =
                    JSON.parse(btn.dataset.endereco);



                    selecionarEndereco(endereco);


                };


            });



        }catch(err){

            console.error(
                "Erro buscar endereço:",
                err
            );

        }



    },300);



    input.addEventListener(
        'input',
        buscar
    );


}



/* ======================================================
   CADASTRAR ENDEREÇO
====================================================== */


async function cadastrarEndereco(){



    const endereco={


        rua:$('end-rua').value,


        numero:$('end-numero').value,


        bairro:$('end-bairro').value,


        cidade:$('end-cidade').value,


        estado:$('end-estado').value


    };



    try{


        const res = await fetch(
            '/pedidos/criarEndereco',
            {

                method:'POST',

                headers:{
                    'Content-Type':'application/json'
                },

                body:JSON.stringify(endereco)

            }
        );



        const data =
        await res.json();




        if(!res.ok){

            alert(
                data.erro ||
                "Erro ao cadastrar endereço"
            );

            return;

        }




        selecionarEndereco({

            ...endereco,

            id:data.id

        });





        const msg=$('msg-endereco');



        if(msg){

            msg.textContent =
            "Endereço cadastrado com sucesso!";


            msg.style.display='block';



            setTimeout(()=>{

                msg.style.display='none';

            },3000);


        }



    }catch(err){

        console.error(err);

        alert(
        "Erro ao cadastrar endereço"
        );

    }



}



/* ======================================================
   EVENTOS
====================================================== */


const btnCadastrar = $('btn-cadastrar-endereco');


if(btnCadastrar){

    btnCadastrar.onclick = cadastrarEndereco;

}



buscarEndereco();



}
