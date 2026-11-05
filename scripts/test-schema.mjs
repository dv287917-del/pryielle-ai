import { validateFeatureConfig as v } from "../shared/featureSchema.js";
let ok=0,bad=0; const t=(n,c)=>{c?ok++:(bad++,console.log("FAIL",n))};
const good=v({title:"Dark+",theme:{accent:"#ff7a1a",bg:"#141414",font:"serif",radius:99},flags:{showTips:true},blocks:[
 {type:"banner",slot:"home-top",text:"Naya <b>update</b>!",tone:"promo",actionLabel:"Dekho",actionUrl:"https://example.com"},
 {type:"chips",slot:"home-suggestions",items:[{label:"Joke",prompt:"ek joke sunao"}]},
 {type:"toggle",slot:"drawer",label:"Compact",flag:"compact"}]});
t("good ok",good.ok); t("radius clamp",good.config.theme.radius===28); t("html stripped",good.config.blocks[0].text==="Naya update!");
const evil=v({theme:{accent:"red;background:url(x)"},blocks:[
 {type:"script",slot:"home-top"},{type:"banner",slot:"drawer",text:"x"},
 {type:"button",slot:"home-top",label:"hi",action:"openUrl",value:"javascript:alert(1)"},
 {type:"button",slot:"home-top",label:"hi",action:"eval",value:"x"},
 {type:"banner",slot:"home-top",text:"ok",actionLabel:"go",actionUrl:"http://insecure.com"}]});
t("evil: only safe banner left",evil.ok&&evil.config.blocks.length===1&&!evil.config.blocks[0].actionUrl&&!evil.config.theme.accent);
t("string json",v('```json\n{"flags":{"a1":true}}\n```').ok);
t("garbage",!v("nope").ok && !v([]).ok && !v({}).ok && !v(null).ok);
t("max blocks",v({blocks:Array.from({length:30},(_,i)=>({type:"badge",slot:"home-top",text:"b"+i}))}).config.blocks.length===12);
t("dup ids",new Set(v({blocks:[{id:"a",type:"badge",slot:"home-top",text:"1"},{id:"a",type:"badge",slot:"home-top",text:"2"}]}).config.blocks.map(b=>b.id)).size===2);
console.log(ok,"pass",bad,"fail");
