const http = require('http');

function getJSON(path){
  return new Promise((resolve,reject)=>{
    http.get({host:'localhost', port:3000, path, agent:false}, res =>{
      let d=''; res.on('data', c=> d+=c); res.on('end', ()=>{
        try{ resolve(JSON.parse(d)); }catch(e){ reject(e); }
      });
    }).on('error', reject);
  });
}

function postJSON(path, body){
  return new Promise((resolve,reject)=>{
    const data = JSON.stringify(body);
    const req = http.request({host:'localhost', port:3000, path, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}}, res =>{
      let d=''; res.on('data', c=> d+=c); res.on('end', ()=>{
        try{ resolve({statusCode: res.statusCode, body: JSON.parse(d || '{}')}); }catch(e){ resolve({statusCode: res.statusCode, raw: d}); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async ()=>{
  try{
    console.log('Buscando produtos...');
    const produtos = await getJSON('/produtos/api');
    if(!Array.isArray(produtos) || produtos.length===0){ console.error('Nenhum produto disponível para teste.'); process.exit(1); }
    const produto = produtos[0];
    console.log('Usando produto:', produto.id, produto.nome);

    console.log('Tentando reservar 1 unidade...');
    const resReserva = await postJSON(`/produtos/${produto.id}/reservar`, { quantidade: 1 });
    console.log('Reserva resposta:', resReserva);

    console.log('Tentando registrar saída de 1 unidade...');
    const resSaida = await postJSON(`/produtos/${produto.id}/saida`, { quantidade: 1 });
    console.log('Saída resposta:', resSaida);

    console.log('Teste concluído. Recarregue a interface para verificar resultados.');
    process.exit(0);
  }catch(err){
    console.error('Erro no teste:', err);
    process.exit(1);
  }
})();
