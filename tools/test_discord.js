// node tools/test_discord.js : checks brew-log/api/discord.js with a pretend Discord (nothing is sent anywhere)
var path=require("path"),h=require(path.join(__dirname,"..","brew-log","api","discord.js")),fails=0;
function check(name,ok,info){console.log((ok?"PASS ":"FAIL ")+name+(info?"  "+info:""));if(!ok)fails++}
var HOOK="https://discord.com/api/webhooks/123456789/SECRET-token_abc";
var ENV={DISCORD_WEBHOOK_URL:HOOK,ALLOWED_ORIGINS:"https://futurevoid.github.io, https://x.vercel.app/",DISCORD_TAG_IDS:JSON.stringify({V60:"111",Pulsar:"222"}),DISCORD_GUILD_ID:"999"};
var ORIGIN="https://futurevoid.github.io";
function mk(method,body,headers,env){
  var calls=[],res={headers:{},status:function(s){this.code=s;return this},json:function(o){this.body=o;return this},end:function(){this.ended=true;return this},setHeader:function(k,v){this.headers[k]=v}};
  var fetchFn=function(u,o){calls.push({url:u,opts:o,body:JSON.parse(o.body)});return Promise.resolve(mk.reply)};
  return {req:{method:method,headers:Object.assign({origin:ORIGIN,"x-forwarded-for":"1.2.3.4"},headers||{}),body:body},res:res,calls:calls,deps:{env:env||ENV,fetch:fetchFn,now:function(){return mk.now}}};
}
mk.now=1e9;mk.reply={ok:true,status:200,json:function(){return Promise.resolve({id:"555",channel_id:"777"})}};
async function run(m){await h(m.req,m.res,m.deps);return m}
(async function(){
 var m;
 h._reset();
 m=await run(mk("OPTIONS"));check("preflight from an allowed site",m.res.code===204&&m.res.headers["Access-Control-Allow-Origin"]===ORIGIN);
 m=await run(mk("OPTIONS",null,{origin:"https://evil.example"}));check("preflight from another site is refused",m.res.code===403&&!m.res.headers["Access-Control-Allow-Origin"]);
 m=await run(mk("GET"));check("GET is refused",m.res.code===405);
 m=await run(mk("POST",{title:"t",body:"b"},{origin:"https://evil.example"}));check("POST from another site is refused and nothing is sent",m.res.code===403&&m.calls.length===0);
 m=await run(mk("POST",{title:"t",body:"b"},{origin:""}));check("POST without an origin is refused",m.res.code===403&&m.calls.length===0);
 m=await run(mk("POST",{title:"t",body:"b"},null,{}));check("not configured: 500 and nothing sent",m.res.code===500&&m.calls.length===0);
 m=await run(mk("POST",{title:"t",body:"b"},null,Object.assign({},ENV,{DISCORD_WEBHOOK_URL:"https://evil.example/hook"})));check("a webhook that is not a Discord one is not used",m.res.code===500&&m.calls.length===0);
 m=await run(mk("POST","not json"));check("body that is not JSON: 400",m.res.code===400&&m.calls.length===0);
 m=await run(mk("POST",{title:"",body:"text"}));check("new post without a title: 400",m.res.code===400);
 m=await run(mk("POST",{title:"x".repeat(101),body:"text"}));check("title over 100 characters: 400",m.res.code===400);
 m=await run(mk("POST",{title:"t",body:"   "}));check("empty text: 400",m.res.code===400);
 m=await run(mk("POST",{title:"t",body:"y".repeat(4097)}));check("text over 4096: 400, nothing sent",m.res.code===400&&m.calls.length===0);

 h._reset();
 m=await run(mk("POST",{title:"[DAK] Surf Jam — V60",body:"المحمصة: DAK\nالمحصول: Surf Jam",tags:["V60","إثيوبيا"]}));
 var c=m.calls[0];
 check("new post: 200 with a link to the post",m.res.code===200&&m.res.body.ok&&m.res.body.url==="https://discord.com/channels/999/777",JSON.stringify(m.res.body));
 check("new post goes to the webhook with wait=true and no thread",c&&c.url===HOOK+"?wait=true");
 check("new post: forum title and the known tag id",c&&c.body.thread_name==="[DAK] Surf Jam — V60"&&JSON.stringify(c.body.applied_tags)==='["111"]');
 check("unknown tag is listed in the text for a moderator",c&&/🏷️ التاقات: إثيوبيا/.test(c.body.content)&&m.res.body.droppedTags[0]==="إثيوبيا");
 check("mentions are switched off",c&&JSON.stringify(c.body.allowed_mentions)==='{"parse":[]}');
 check("allowed origin is echoed back",m.res.headers["Access-Control-Allow-Origin"]===ORIGIN);
 check("the webhook url is not in the answer",!JSON.stringify(m.res.body).includes("SECRET"));

 h._reset();
 m=await run(mk("POST",{title:"t",body:"@everyone hello <@123>"}));
 check("@everyone cannot ping (parse is empty)",m.calls[0].body.allowed_mentions.parse.length===0&&/@everyone/.test(m.calls[0].body.content));
 m=await run(mk("POST",{title:"t",body:"z".repeat(3000)}));
 check("text over 2000 goes as an embed",m.res.code===200&&!m.calls[0].body.content&&m.calls[0].body.embeds[0].description.length===3000);
 m=await run(mk("POST",{title:"t",body:"b",tags:["V60","Pulsar","V60","a","b","c","d"]}));
 check("each tag id once, at most 5",JSON.stringify(m.calls[0].body.applied_tags)==='["111","222"]');
 var noguild=await run(mk("POST",{title:"t",body:"b"},null,Object.assign({},ENV,{DISCORD_GUILD_ID:""})));
 check("without a server id there is no link, but it still posts",noguild.res.code===200&&noguild.res.body.url===undefined);

 h._reset();
 m=await run(mk("POST",{body:"الصبّة الثانية كانت أحلى",threadUrl:"https://discord.com/channels/999/888"}));
 check("reply: goes to that thread, with no title or tags",m.res.code===200&&m.calls[0].url===HOOK+"?wait=true&thread_id=888"&&m.calls[0].body.thread_name===undefined&&m.calls[0].body.applied_tags===undefined);
 check("reply: link points at the new message",m.res.body.url==="https://discord.com/channels/999/777/555",m.res.body.url);
 m=await run(mk("POST",{body:"x",threadUrl:"https://discord.com/channels/999/888/12345"}));
 check("a link to a message inside the thread works too",m.calls[0]&&/thread_id=888$/.test(m.calls[0].url));
 m=await run(mk("POST",{body:"x",threadUrl:"https://evil.example/channels/1/2"}));
 check("a link that is not a Discord thread link: 400, nothing sent",m.res.code===400&&m.calls.length===0);
 m=await run(mk("POST",{body:"x",threadUrl:"https://discord.com/channels/999/888?x=1&thread_id=5"}));
 check("extra query text in the link cannot redirect the post",m.res.code===400&&m.calls.length===0);

 h._reset();
 mk.reply={ok:false,status:404,json:function(){return Promise.resolve({message:"Unknown Channel"})}};
 m=await run(mk("POST",{body:"x",threadUrl:"https://discord.com/channels/999/888"}));
 check("Discord says not found: 502 with a plain message and no secret",m.res.code===502&&/ما لقيت المنشور/.test(m.res.body.error)&&!JSON.stringify(m.res.body).includes("SECRET"));
 mk.reply={ok:false,status:429,json:function(){return Promise.resolve({retry_after:2.2})}};
 m=await run(mk("POST",{title:"t",body:"b"}));
 check("Discord rate limit is passed on with retryAfter",m.res.code===429&&m.res.body.retryAfter===3);
 mk.reply={ok:false,status:500,json:function(){return Promise.reject(new Error("x"))}};
 m=await run(mk("POST",{title:"t",body:"b"}));
 check("Discord error with no body: 502",m.res.code===502);
 mk.reply={ok:true,status:200,json:function(){return Promise.resolve({id:"555",channel_id:"777"})}};
 var boom=mk("POST",{title:"t",body:"b"});boom.deps.fetch=function(){return Promise.reject(new Error("network"))};
 m=await run(boom);check("network failure: 502, nothing leaks",m.res.code===502&&!JSON.stringify(m.res.body).includes("SECRET"));

 h._reset();mk.now=2e9;var codes=[];
 for(var i=0;i<7;i++){m=await run(mk("POST",{title:"t",body:"b"}));codes.push(m.res.code)}
 check("a sixth post from one address in 10 minutes is refused",JSON.stringify(codes)==="[200,200,200,200,200,429,429]",JSON.stringify(codes));
 mk.now=2e9+11*60*1000;m=await run(mk("POST",{title:"t",body:"b"}));
 check("allowed again after the window",m.res.code===200);
 m=await run(mk("POST",{title:"t",body:"b"},{"x-forwarded-for":"9.9.9.9"}));
 check("another address is not affected",m.res.code===200);
 console.log(fails?fails+" failed":"all passed");process.exit(fails?1:0);
})();
