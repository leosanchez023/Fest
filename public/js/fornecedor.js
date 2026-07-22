console.log("FORNECEDOR JS CARREGADO");

let suppliers = [];

const PAGE_SIZE = 5;
let currentPage = 1;


// ===============================
// BUSCAR DO BANCO
// ===============================

async function fetchSuppliers() {

  try {

    const params = new URLSearchParams();

    const q = document.getElementById("search").value;
    const category = document.getElementById("filter-category").value;
    const status = document.getElementById("filter-status").value;


    if(q) params.append("q", q);
    if(category) params.append("category", category);
    if(status) params.append("status", status);


    const response = await fetch(
      "/fornecedores/data?" + params.toString()
    );


    suppliers = await response.json();


    updateKPIs();

    renderTable();


  } catch(error){

    console.error(error);

    suppliers = [];

    renderTable();

  }

}



// ===============================
// KPIs
// ===============================

function updateKPIs(){

    document.getElementById("kpi-total").innerHTML =
        suppliers.length;


    document.getElementById("kpi-active").innerHTML =
        suppliers.filter(
            f => f.status === "Ativo"
        ).length;



    const hoje = new Date();


    document.getElementById("kpi-new").innerHTML =
        suppliers.filter(f=>{

            const data = new Date(f.created_at);


            return (
              data.getMonth() === hoje.getMonth()
              &&
              data.getFullYear() === hoje.getFullYear()
            );


        }).length;


}




// ===============================
// TABELA
// ===============================

function renderTable(){


const inicio = 
(currentPage-1)*PAGE_SIZE;


const dados =
suppliers.slice(
inicio,
inicio + PAGE_SIZE
);



const tbody =
document.getElementById(
"supplier-tbody"
);



tbody.innerHTML =
dados.map(f=>`

<tr>

<td>
<strong>${f.nome}</strong>
<br>
<small>${f.responsavel ?? ""}</small>
</td>


<td>${f.category ?? ""}</td>


<td>${f.phone ?? ""}</td>


<td>${f.email ?? ""}</td>


<td>${f.city ?? ""}</td>


<td>

<span class="status 
${f.status === "Ativo"
? "status-active"
:"status-inactive"}">

${f.status}

</span>

</td>



<td>


<button 
class="btn btn-sm btn-secondary"
onclick="viewSupplier(${f.id})">

👁

</button>


<button 
class="btn btn-sm btn-secondary"
onclick="editSupplier(${f.id})">

✏️

</button>


<button 
class="btn btn-sm btn-danger"
onclick="deleteSupplier(${f.id})">

🗑

</button>


</td>


</tr>


`).join("");

}




// ===============================
// ABRIR MODAL
// ===============================

function openForm(){


document
.getElementById("supplier-form")
.reset();



document
.getElementById("modal-form")
.classList.add("open");


}




function closeForm(){

document
.getElementById("modal-form")
.classList.remove("open");

}



// ===============================
// CADASTRAR / EDITAR
// ===============================


async function saveSupplier(event){

event.preventDefault();



const dados = {


name:
document.getElementById("f-name").value,


cnpj:
document.getElementById("f-cnpj").value,


responsavel:
document.getElementById("f-responsavel").value,


category:
document.getElementById("f-category").value,


phone:
document.getElementById("f-phone").value,


whatsapp:
document.getElementById("f-whatsapp").value,


email:
document.getElementById("f-email").value,


website:
document.getElementById("f-website").value,


street:
document.getElementById("f-street").value,


number:
document.getElementById("f-number").value,


neighborhood:
document.getElementById("f-neighborhood").value,


city:
document.getElementById("f-city").value,


state:
document.getElementById("f-state").value,


cep:
document.getElementById("f-cep").value,


product:
document.getElementById("f-product").value,


delivery:
document.getElementById("f-delivery").value,


payment:
document.getElementById("f-payment").value,


notes:
document.getElementById("f-notes").value,


status:
document.getElementById("f-status").value

};



try{


await fetch(
"/fornecedores/criar",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:
JSON.stringify(dados)

});


closeForm();


await fetchSuppliers();



}catch(err){

console.error(err);

alert("Erro ao salvar fornecedor");

}


}





// ===============================
// EDITAR
// ===============================

async function editSupplier(id){


const res =
await fetch(
`/fornecedores/${id}`
);


const f =
await res.json();



document.getElementById("f-name").value =
f.nome;


document.getElementById("f-cnpj").value =
f.cnpj;


document.getElementById("f-email").value =
f.email;


document.getElementById("f-phone").value =
f.phone;



document
.getElementById("modal-form")
.classList.add("open");



}




// ===============================
// EXCLUIR
// ===============================

async function deleteSupplier(id){


if(!confirm("Excluir fornecedor?"))
return;



await fetch(
`/fornecedores/${id}`,
{

method:"DELETE"

});



await fetchSuppliers();


}





// ===============================
// VISUALIZAR
// ===============================

async function viewSupplier(id){


const res =
await fetch(
`/fornecedores/${id}`
);


const f =
await res.json();



document.getElementById(
"profile-content"
).innerHTML = `


<h3>${f.nome}</h3>

<p><b>CNPJ:</b>${f.cnpj}</p>

<p><b>Email:</b>${f.email}</p>

<p><b>Telefone:</b>${f.phone}</p>

<p><b>Cidade:</b>${f.city}</p>

<p><b>Status:</b>${f.status}</p>

`;



document
.getElementById("modal-profile")
.classList.add("open");


}




function closeProfile(){

document
.getElementById("modal-profile")
.classList.remove("open");

}




// ===============================
// INICIO
// ===============================


document.addEventListener(
"DOMContentLoaded",
()=>{


fetchSuppliers();



document
.getElementById("search")
.addEventListener(
"input",
fetchSuppliers
);



document
.getElementById("filter-category")
.addEventListener(
"change",
fetchSuppliers
);



document
.getElementById("filter-status")
.addEventListener(
"change",
fetchSuppliers
);



}
);