import assert from 'node:assert/strict';
import {
  mensajesDeConversacion,
  obtenerConversacionUsuario,
  registrarIntercambioConversacion,
  limpiarConversacionUsuario,
  resolverOCrearUsuarioPorIdentidad,
  iniciarVinculacionWeb,
  completarVinculacionConWhatsApp
} from '../../core/ai/lib-cartes-account.mjs';

class MemoryStore {
  constructor(){ this.map=new Map(); this.etags=new Map(); this.n=0; }
  async get(k){ return this.map.has(k) ? structuredClone(this.map.get(k)) : null; }
  async getWithMetadata(k){ return this.map.has(k) ? {data:structuredClone(this.map.get(k)),etag:this.etags.get(k)} : null; }
  async setJSON(k,v,opt={}){
    const exists=this.map.has(k); const etag=this.etags.get(k);
    if(opt.onlyIfNew && exists) return {modified:false};
    if(opt.onlyIfMatch && opt.onlyIfMatch!==etag) return {modified:false};
    this.map.set(k,structuredClone(v)); this.n++; this.etags.set(k,`e${this.n}`); return {modified:true};
  }
}
const store=new MemoryStore();
const A='usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B='usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

await registrarIntercambioConversacion({userId:A,question:'¿Qué es la escuadra?',answer:'Respuesta uno',channel:'web',requestId:'r1',store});
await registrarIntercambioConversacion({userId:A,question:'¿Y qué simboliza?',answer:'Respuesta dos',channel:'whatsapp',requestId:'r2',store});
let a=await obtenerConversacionUsuario({userId:A,store});
assert.equal(a.exchanges.length,2);
assert.deepEqual(mensajesDeConversacion(a).map(x=>x.role),['user','assistant','user','assistant']);
assert.deepEqual(a.exchanges.map(x=>x.channel),['web','whatsapp']);

await registrarIntercambioConversacion({userId:A,question:'duplicada',answer:'duplicada',channel:'web',requestId:'r2',store});
a=await obtenerConversacionUsuario({userId:A,store});
assert.equal(a.exchanges.length,2,'request_id duplicado no debe duplicar memoria');

const b=await obtenerConversacionUsuario({userId:B,store});
assert.equal(b.exchanges.length,0,'usuarios no vinculados deben permanecer aislados');

await limpiarConversacionUsuario({userId:A,store});
a=await obtenerConversacionUsuario({userId:A,store});
assert.equal(a.exchanges.length,0);
const store2=new MemoryStore();
const web=await resolverOCrearUsuarioPorIdentidad({tipo:'web',valor:'web_core006_test',store:store2});
const wa=await resolverOCrearUsuarioPorIdentidad({tipo:'whatsapp',valor:'5213312345678',store:store2});
await registrarIntercambioConversacion({userId:web.user_id,question:'Desde web',answer:'Contexto web',channel:'web',requestId:'web-r1',store:store2});
await registrarIntercambioConversacion({userId:wa.user_id,question:'Desde WhatsApp',answer:'Contexto WhatsApp',channel:'whatsapp',requestId:'wa-r1',store:store2});
const link=await iniciarVinculacionWeb({webIdentity:'web_core006_test',store:store2});
await completarVinculacionConWhatsApp({code:link.code,whatsappUserId:wa.user_id,store:store2});
const merged=await obtenerConversacionUsuario({userId:wa.user_id,store:store2});
assert.equal(merged.exchanges.length,2,'la vinculación debe fusionar ambas memorias');
assert.deepEqual(new Set(merged.exchanges.map(x=>x.channel)),new Set(['web','whatsapp']));

console.log('OK CORE-006 conversation memory 5/5');
