import * as service from "./produtos.service.js";
import * as fornecedoresService from "../fornecedores/fornecedores.service.js";

async function dadosDoFormulario() {
  const produtos = await service.listar();
  const fornecedores = await fornecedoresService.listar({ status: "Ativo" });
  const categorias = [...new Set(produtos.map((produto) => produto.categoria).filter(Boolean))].sort();
  return { fornecedores, categorias };
}


// ===============================
// PÁGINA
// ===============================

export async function listar(req, res) {
  try {
    console.log("=== ACESSANDO /PRODUTOS ===");

    const filtros = {
      busca: req.query.busca || "",
      categoria: req.query.categoria || "",
      fornecedor: req.query.fornecedor || "",
      status: req.query.status || ""
    };

    console.log("Filtros:", filtros);

    const produtos = await service.listar(filtros);
    console.log("Produtos:", produtos.length);

    const dashboard = await service.dashboard();
    console.log("Dashboard:", dashboard);

    const historico = await service.historico();
    console.log("Histórico:", historico);

    const { fornecedores, categorias } = await dadosDoFormulario();

    res.render("pages/produtos/index", {
      produtos,
      dashboard,
      historico,
      filtros,
      fornecedores,
      categorias
    });

  } catch (err) {
    console.error("=================================");
    console.error("ERRO AO ABRIR PRODUTOS");
    console.error(err);
    console.error("=================================");

    req.flash("error_msg", err.message);

    res.status(500).send(
      "Erro ao abrir produtos: " + err.message
    );
  }
}





// ===============================
// API PRODUTOS
// ===============================

export async function listarAPI(req,res){


  try{


    const filtros = {


      busca:
      req.query.busca || "",


      categoria:
      req.query.categoria || "",


      fornecedor:
      req.query.fornecedor || "",


      status:
      req.query.status || ""


    };



    const produtos =
      await service.listar(filtros);



    res.json(produtos);



  }catch(err){


    console.error(err);


    res.status(500).json({

      erro: err.message

    });


  }


}





// ===============================
// BUSCAR PRODUTO
// ===============================

export async function buscar(req,res){


  try{


    const produto =
      await service.buscarPorId(
        req.params.id
      );



    if(!produto){

      return res.status(404).json({

        erro:"Produto não encontrado."

      });

    }



    res.json(produto);



  }catch(err){


    res.status(500).json({

      erro:err.message

    });


  }


}





// ===============================
// DASHBOARD
// ===============================

export async function dashboard(req,res){


  try{


    const dados =
      await service.dashboard();



    res.json(dados);



  }catch(err){


    res.status(500).json({

      erro:err.message

    });


  }


}





// ===============================
// HISTÓRICO
// ===============================

export async function historico(req,res){


  try{


    const dados =
      await service.historico();



    res.json(dados);



  }catch(err){


    res.status(500).json({

      erro:err.message

    });


  }


}





// ===============================
// CRIAR PRODUTO
// ===============================

export async function criar(req,res){


try{


 await service.criar(req.body);



 req.flash(
  "success_msg",
  "Produto criado com sucesso."
 );



 res.redirect("/produtos");



}catch(err){


 req.flash(
  "error_msg",
  err.message
 );


 res.redirect("/produtos");


}


}





// ===============================
// EDITAR
// ===============================

export async function editar(req,res){


try{


const produto =
 await service.buscarPorId(
  req.params.id
 );


const produtos =
 await service.listar();



const dashboard =
 await service.dashboard();



const historico =
 await service.historico();

const { fornecedores, categorias } = await dadosDoFormulario();




res.render(
 "pages/produtos/index",
 {

  produto,

  produtos,

  dashboard,

  historico,
  fornecedores,
  categorias

 }

);



}catch(err){


req.flash(
 "error_msg",
 err.message
);


res.redirect("/produtos");


}



}





// ===============================
// ATUALIZAR
// ===============================

export async function atualizar(req,res){


try{


await service.atualizar(
 req.params.id,
 req.body
);



req.flash(
 "success_msg",
 "Produto atualizado com sucesso."
);



res.redirect("/produtos");



}catch(err){


req.flash(
 "error_msg",
 err.message
);


res.redirect("/produtos");


}


}







// ===============================
// EXCLUIR
// ===============================

export async function deletar(req,res){


try{


await service.deletar(
 req.params.id
);



  req.body.pedido_id || null
res.json({

 sucesso:true,

 mensagem:
 "Produto removido."

});



}catch(err){


res.status(500).json({

 sucesso:false,

 erro:err.message

});


}


}







// ===============================
// ENTRADA ESTOQUE
// ===============================

export async function entradaEstoque(req,res){


try{


await service.entradaEstoque(

 req.params.id,

 req.body

);



res.json({

 sucesso:true,

 mensagem:
 "Entrada registrada."

});



}catch(err){


res.status(500).json({

 erro:err.message

});


}


}







// ===============================
// SAÍDA ESTOQUE
// ===============================

export async function saidaEstoque(req,res){


try{


await service.saidaEstoque(

 req.params.id,

 req.body

);



res.json({

 sucesso:true,

 mensagem:
 "Saída registrada."

});



}catch(err){


res.status(500).json({

 erro:err.message

});


}


}







// ===============================
// RESERVAR
// ===============================

export async function reservar(req,res){


try{


  await service.reservar(
    req.params.id,
    req.body.quantidade,
    req.body.pedido_id || null
  );




res.json({

 sucesso:true,

 mensagem:
 "Produto reservado."

});



}catch(err){


res.status(500).json({

 erro:err.message

});


}


}







// ===============================
// DEVOLVER
// ===============================

export async function devolver(req,res){


try{


await service.devolver(

 req.params.id,

 req.body.quantidade

);



res.json({

 sucesso:true,

 mensagem:
 "Produto devolvido."

});



}catch(err){


res.status(500).json({

 erro:err.message

});


}


}







// ===============================
// MANUTENÇÃO
// ===============================

export async function manutencao(req,res){


try{


await service.manutencao(
 req.params.id
);



res.json({

 sucesso:true,

 mensagem:
 "Produto enviado para manutenção."

});



}catch(err){


res.status(500).json({

 erro:err.message

});


}


}







// ===============================
// FINALIZAR MANUTENÇÃO
// ===============================

export async function finalizarManutencao(req,res){


try{


await service.finalizarManutencao(

 req.params.id

);



res.json({

 sucesso:true,

 mensagem:
 "Manutenção finalizada."

});



}catch(err){


res.status(500).json({

 erro:err.message

});


}


}