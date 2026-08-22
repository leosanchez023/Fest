import db from "../../../database/connection.js";


// ==========================================
// LISTAR PRODUTOS
// ==========================================

export async function findAll(filtros = {}) {

  const {
    busca = "",
    categoria = "",
    status = "",
    fornecedor = ""
  } = filtros;


  let sql = `

  SELECT

  p.*,

  f.nome AS fornecedor,


  (
    p.estoque
    -
    p.estoque_reservado
    -
    p.estoque_em_uso
    -
    p.estoque_manutencao
    -
    p.estoque_danificado

  ) AS disponivel,


  CASE

    WHEN p.ativo = 0
    THEN 'INATIVO'


    WHEN p.estoque_manutencao > 0
    THEN 'MANUTENCAO'


    WHEN p.estoque_danificado > 0
    THEN 'DANIFICADO'


    WHEN p.estoque_reservado > 0
    THEN 'RESERVADO'


    WHEN p.estoque_em_uso > 0
    THEN 'EM_USO'


    WHEN p.estoque <= COALESCE(p.estoque_minimo, 0)
    THEN 'BAIXO_ESTOQUE'


    ELSE 'DISPONIVEL'


  END AS status


  FROM produtos p


  LEFT JOIN fornecedores f

  ON f.id = p.fornecedor_id


  WHERE 1=1

  `;


  const params = [];



  if(busca){

    sql += `

    AND (

    p.nome LIKE ?

    OR p.codigo LIKE ?

    OR p.categoria LIKE ?

    )

    `;


    params.push(
      `%${busca}%`,
      `%${busca}%`,
      `%${busca}%`
    );

  }



  if(categoria){

    sql += `
    AND p.categoria = ?
    `;

    params.push(categoria);

  }



  if(fornecedor){

    sql += `
    AND p.fornecedor_id = ?
    `;

    params.push(fornecedor);

  }



  if(status){

    sql += `
    HAVING status = ?
    `;

    params.push(status);

  }



  sql += `

  ORDER BY p.nome ASC

  `;



  const [rows] = await db.query(sql,params);


  return rows;

}



// ==========================================
// BUSCAR POR ID
// ==========================================

export async function buscarPorId(id){


const [rows] = await db.query(

`

SELECT

p.*,

f.nome AS fornecedor


FROM produtos p


LEFT JOIN fornecedores f

ON f.id = p.fornecedor_id


WHERE p.id = ?

`,

[id]

);


return rows[0];

}




// ==========================================
// CRIAR
// ==========================================

export async function create(dados){


await db.query(

`

INSERT INTO produtos

(

nome,
codigo,
categoria,
tipo,
tipo_produto,
fornecedor_id,
imagem,
localizacao,
estoque,
preco_venda,
preco_aluguel,
estoque_reservado,
estoque_em_uso,
estoque_manutencao,
estoque_danificado,
estoque_minimo,
ativo

)


VALUES

(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

`,

[

dados.nome,

dados.codigo || null,

dados.categoria || null,

dados.tipo || null,

dados.tipo_produto || 'PRODUTO',

dados.fornecedor_id || null,

dados.imagem || null,

dados.localizacao || null,

Number(dados.estoque || 0),

Number(dados.precoVenda || 0),

Number(dados.precoAluguel || 0),

0,

0,

0,

0,

Number(dados.estoque_minimo || 0),

1

]


);


}





// ==========================================
// ATUALIZAR
// ==========================================

export async function atualizar(id,dados){


await db.query(

`

UPDATE produtos

SET


nome=?,

codigo=?,

categoria=?,

tipo=?,

tipo_produto=?,

fornecedor_id=?,

imagem=?,

localizacao=?,

estoque=?,

preco_venda=?,

preco_aluguel=?,

estoque_minimo=?,

updatedAt=NOW()


WHERE id=?


`,

[

dados.nome,

dados.codigo || null,

dados.categoria || null,

dados.tipo || null,

dados.tipo_produto || 'PRODUTO',

dados.fornecedor_id || null,

dados.imagem || null,

dados.localizacao || null,

Number(dados.estoque || 0),

Number(dados.precoVenda || 0),

Number(dados.precoAluguel || 0),

Number(dados.estoque_minimo || 0),

id

]


);


}




// ==========================================
// EXCLUIR
// ==========================================

export async function excluir(id){


await db.query(

`

UPDATE produtos

SET ativo = 0

WHERE id=?

`,

[id]

);


}




// ==========================================
// DASHBOARD
// ==========================================

export async function dashboard(){


const [rows] = await db.query(

`

SELECT


COUNT(*) total,


COALESCE(SUM(
estoque -
estoque_reservado -
estoque_em_uso -
estoque_manutencao -
estoque_danificado
),0) disponiveis,


COALESCE(SUM(estoque_reservado),0) reservados,


COALESCE(SUM(estoque_em_uso),0) em_uso,


COALESCE(SUM(estoque_manutencao),0) manutencao,


COALESCE(SUM(estoque_danificado),0) danificados,


SUM(

CASE

WHEN estoque <= COALESCE(estoque_minimo, 0)
),
0
) valor_estoque


FROM produtos


WHERE ativo=1


`

);


return rows[0];

}





// ==========================================
// HISTÓRICO
// ==========================================

export async function historico(){


const [rows] = await db.query(

`

SELECT


m.*,

p.nome AS produto


FROM movimentacao_estoque m


INNER JOIN produtos p

ON p.id=m.produto_id


ORDER BY

m.data_movimentacao DESC


LIMIT 100


`

);


return rows;

}




// ==========================================
// ENTRADA
// ==========================================

export async function entradaEstoque(
id,
quantidade,
observacao=""
){


await db.query(

`

UPDATE produtos

SET estoque = estoque + ?

WHERE id=?

`,

[
quantidade,
id
]

);



await db.query(

`

INSERT INTO movimentacao_estoque

(
produto_id,
tipo,
quantidade,
observacao
)

VALUES(?,?,?,?)

`,

[
id,
"ENTRADA",
quantidade,
observacao
]

);


}







// ==========================================
// SAÍDA
// ==========================================

export async function saidaEstoque(
id,
quantidade,
observacao=""
){


const [produto] = await db.query(

`

SELECT estoque

FROM produtos

WHERE id=?

`,

[id]

);


if(produto[0].estoque < quantidade){

throw new Error(
"Estoque insuficiente."
);

}



await db.query(

`

UPDATE produtos

SET estoque = estoque - ?

WHERE id=?

`,

[
quantidade,
id
]

);



await db.query(

`

INSERT INTO movimentacao_estoque

(
produto_id,
tipo,
quantidade,
observacao
)

VALUES(?,?,?,?)

`,

[
id,
"SAIDA",
quantidade,
observacao
]

);


}






// ==========================================
// RESERVAR
// ==========================================

export async function reservar(id,quantidade){


const [produto]=await db.query(

`

SELECT

estoque,
estoque_reservado

FROM produtos

WHERE id=?

`,

[id]

);



const disponivel =
produto[0].estoque -
produto[0].estoque_reservado;



if(disponivel < quantidade){

throw new Error(
"Quantidade indisponível."
);

}



await db.query(

`

UPDATE produtos

SET estoque_reservado =
estoque_reservado + ?

WHERE id=?

`,

[
quantidade,
id
]

);


}






// ==========================================
// DEVOLVER
// ==========================================

export async function devolver(id,quantidade){


await db.query(

`

UPDATE produtos

SET estoque_reservado =
GREATEST(
estoque_reservado-?,
0
)

WHERE id=?

`,

[
quantidade,
id
]

);



await db.query(

`

INSERT INTO movimentacao_estoque

(
produto_id,
tipo,
quantidade
)

VALUES(?,?,?)

`,

[
id,
"RETORNO",
quantidade
]

);


}






// ==========================================
// MANUTENÇÃO
// ==========================================

export async function manutencao(id){


await db.query(

`

UPDATE produtos

SET estoque_manutencao =
estoque_manutencao + 1

WHERE id=?

`,

[id]

);


}





// ==========================================
// FINALIZAR MANUTENÇÃO
// ==========================================

export async function finalizarManutencao(id){


await db.query(

`

UPDATE produtos

SET estoque_manutencao =
GREATEST(
estoque_manutencao-1,
0
)

WHERE id=?

`,

[id]

);


}