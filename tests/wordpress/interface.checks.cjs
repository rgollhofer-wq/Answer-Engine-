const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(responses){
 const elements=new Map(),calls=[];
 const make=(id='')=>({id,children:[],handlers:{},value:'',textContent:'',hidden:false,checked:false,
  addEventListener(name,fn){this.handlers[name]=fn;},append(...items){this.children.push(...items);},
  replaceChildren(...items){this.children=[...items];},reset(){this.value='';},
  async submit(){await this.handlers.submit({preventDefault(){}});},
 });
 const el=id=>{if(!elements.has(id))elements.set(id,make(id));return elements.get(id);};
 el('bbl-config').textContent=JSON.stringify({answer:'/clone/?rest_route=/bbl/v1/answer',leads:'/clone/?rest_route=/bbl/v1/leads',nonce:'synthetic-nonce'});
 const context={document:{getElementById:el,querySelectorAll:()=>[],createElement:()=>make(),createTextNode:text=>({textContent:text})},
  Option:function(text,value){this.textContent=text;this.value=value;},
  fetch:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});const response=responses.shift();if(response instanceof Error)throw response;return {ok:true,json:async()=>response};}};
 vm.runInNewContext(fs.readFileSync('wordpress/bbl-answer-engine-mvp/sammy.js','utf8'),context);
 return {el,calls};
}
function result(){return {conversation_id:'synthetic-session',version:1,status:'Possible',message:'Evidence is incomplete.',intent:{city:'denver-co',service:'plumbing'},verified:[],possible:[{id:1,name:'<img src=x onerror=alert(1)>',status:'Possible'}]};}
test('Requests stay on injected clone routes and carry bounded session context',async()=>{
 const a=setup([result(),{...result(),version:2}]);
 a.el('sammyInput').value='Plumbing in Denver';await a.el('askForm').submit();
 a.el('sammyInput').value='Tomorrow';await a.el('askForm').submit();
 assert.equal(a.calls[1].body.conversation_id,'synthetic-session');
 assert.equal(a.calls[0].url,'/clone/?rest_route=/bbl/v1/answer');
 assert.equal(a.calls[0].options.credentials,'same-origin');
 assert.equal(a.calls[0].options.headers['X-WP-Nonce'],'synthetic-nonce');
 assert.equal(a.el('provider').children.length,1,'Possible records cannot be selected for routing');
 assert.equal(a.el('matches').children[0].textContent,'<img src=x onerror=alert(1)> — Possible');
});
test('Failed follow-up hides lead controls and displays failure',async()=>{
 const a=setup([result(),new Error('offline')]);a.el('sammyInput').value='Plumber Denver';await a.el('askForm').submit();
 a.el('sammyInput').value='Tomorrow';await a.el('askForm').submit();
 assert.equal(a.el('leadPanel').hidden,true);assert.equal(a.el('requestError').textContent,'offline');
});
test('Reset clears session and never submits a lead',async()=>{
 const a=setup([result(),result()]);a.el('sammyInput').value='Plumber Denver';await a.el('askForm').submit();
 a.el('reset').handlers.click();a.el('sammyInput').value='Another request';await a.el('askForm').submit();
 assert.equal(a.calls[1].body.conversation_id,'');assert.ok(a.calls.every(c=>!c.url.includes('/leads')));
});
