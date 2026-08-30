const g = window;
const Texture = g.Table3dCardTexture;
if (!Texture) throw new Error('Modern Strategy art: card texture module missing');

const baseFace = Texture.drawCardFace;
const baseBack = Texture.drawCardBack;
const W = Texture.PIXEL_W || 768;
const H = Texture.PIXEL_H || 1228;
const FONT = '"Outfit","PingFang SC","Microsoft YaHei",system-ui,sans-serif';

function rounded(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else{ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}}
function wrap(ctx,text,max,lines=2){const out=[];let cur='';for(const ch of String(text||'')){const n=cur+ch;if(cur&&ctx.measureText(n).width>max){out.push(cur);cur=ch;}else cur=n;}if(cur)out.push(cur);return out.slice(0,lines);}
function sceneName(spec){return String((spec.meta||[]).find(m=>m.label==='场景')?.value||'场景');}
function sceneKey(name){if(/会议|评审|汇报/.test(name))return'meeting';if(/电梯|偶遇|走廊|途中/.test(name))return'encounter';if(/饭|餐|聚/.test(name))return'meal';if(/微信|消息|群|异步/.test(name))return'message';if(/电话|语音|视频/.test(name))return'phone';if(/私|单聊|办公室/.test(name))return'private';if(/事件|突发|临时|点名/.test(name))return'event';return'default';}

function dot(ctx,x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function line(ctx,a,b,color,width=3){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
function person(ctx,x,y,s,fill){dot(ctx,x,y-s*.58,s*.18,fill);ctx.fillStyle=fill;rounded(ctx,x-s*.25,y-s*.35,s*.5,s*.72,s*.18);ctx.fill();}
function glass(ctx,x,y,s,color){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-s*.14,y-s*.32);ctx.lineTo(x-s*.08,y);ctx.quadraticCurveTo(x,y+s*.08,x+s*.08,y);ctx.lineTo(x+s*.14,y-s*.32);ctx.stroke();line(ctx,[x,y+s*.06],[x,y+s*.30],color,3);line(ctx,[x-s*.14,y+s*.30],[x+s*.14,y+s*.30],color,3);}

function drawMeeting(ctx,x,y,w,h){
  ctx.fillStyle='rgba(170,194,226,.13)';rounded(ctx,x+w*.16,y+h*.11,w*.68,h*.30,12);ctx.fill();
  line(ctx,[x+w*.20,y+h*.37],[x+w*.80,y+h*.37],'rgba(206,222,242,.22)',2);
  const table=[[x+w*.23,y+h*.74],[x+w*.77,y+h*.74],[x+w*.66,y+h*.53],[x+w*.34,y+h*.53]];
  ctx.fillStyle='rgba(17,29,44,.82)';ctx.beginPath();ctx.moveTo(...table[0]);table.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fill();
  line(ctx,[x+w*.28,y+h*.67],[x+w*.72,y+h*.67],'rgba(216,178,104,.28)',3);
  person(ctx,x+w*.36,y+h*.52,w*.09,'rgba(225,235,247,.68)');
  person(ctx,x+w*.50,y+h*.46,w*.10,'rgba(240,245,251,.78)');
  person(ctx,x+w*.64,y+h*.52,w*.09,'rgba(225,235,247,.68)');
  line(ctx,[x+w*.48,y+h*.26],[x+w*.62,y+h*.20],'rgba(216,178,104,.58)',4);
}
function drawEncounter(ctx,x,y,w,h){
  const cx=x+w*.5;ctx.fillStyle='rgba(190,207,229,.075)';ctx.fillRect(x+w*.18,y+h*.08,w*.64,h*.84);
  line(ctx,[cx,y+h*.10],[cx,y+h*.90],'rgba(223,234,248,.28)',3);
  line(ctx,[x+w*.18,y+h*.08],[cx,y+h*.32],'rgba(223,234,248,.12)',2);
  line(ctx,[x+w*.82,y+h*.08],[cx,y+h*.32],'rgba(223,234,248,.12)',2);
  line(ctx,[x+w*.18,y+h*.92],[cx,y+h*.62],'rgba(223,234,248,.12)',2);
  line(ctx,[x+w*.82,y+h*.92],[cx,y+h*.62],'rgba(223,234,248,.12)',2);
  ctx.fillStyle='rgba(216,178,104,.62)';rounded(ctx,x+w*.70,y+h*.17,w*.055,h*.23,8);ctx.fill();
  for(let i=0;i<4;i++)dot(ctx,x+w*.727,y+h*(.205+i*.048),4,'rgba(255,241,208,.72)');
  person(ctx,x+w*.42,y+h*.72,w*.115,'rgba(228,237,248,.72)');
  person(ctx,x+w*.59,y+h*.70,w*.105,'rgba(184,205,232,.68)');
}
function drawMeal(ctx,x,y,w,h){
  const glow=ctx.createRadialGradient(x+w*.5,y+h*.22,0,x+w*.5,y+h*.22,w*.35);glow.addColorStop(0,'rgba(235,184,104,.28)');glow.addColorStop(1,'rgba(235,184,104,0)');ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
  line(ctx,[x+w*.50,y+h*.08],[x+w*.50,y+h*.27],'rgba(236,205,148,.38)',3);dot(ctx,x+w*.5,y+h*.29,w*.045,'rgba(245,211,150,.62)');
  ctx.fillStyle='rgba(29,31,35,.80)';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.67,w*.29,h*.12,0,0,Math.PI*2);ctx.fill();
  person(ctx,x+w*.34,y+h*.52,w*.10,'rgba(228,235,244,.68)');person(ctx,x+w*.66,y+h*.52,w*.10,'rgba(228,235,244,.68)');
  glass(ctx,x+w*.44,y+h*.64,w*.12,'rgba(230,238,247,.40)');glass(ctx,x+w*.56,y+h*.64,w*.12,'rgba(230,238,247,.40)');
  dot(ctx,x+w*.5,y+h*.63,6,'rgba(216,178,104,.70)');
}
function drawPrivate(ctx,x,y,w,h){
  const glow=ctx.createRadialGradient(x+w*.5,y+h*.38,0,x+w*.5,y+h*.38,w*.40);glow.addColorStop(0,'rgba(155,183,219,.18)');glow.addColorStop(1,'rgba(155,183,219,0)');ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='rgba(210,226,245,.09)';rounded(ctx,x+w*.14,y+h*.13,w*.72,h*.55,16);ctx.fill();
  person(ctx,x+w*.39,y+h*.62,w*.13,'rgba(235,241,249,.78)');person(ctx,x+w*.61,y+h*.62,w*.13,'rgba(195,214,237,.72)');
  line(ctx,[x+w*.43,y+h*.48],[x+w*.57,y+h*.48],'rgba(216,178,104,.45)',4);
  ctx.fillStyle='rgba(216,178,104,.24)';rounded(ctx,x+w*.46,y+h*.30,w*.18,h*.09,14);ctx.fill();
}
function drawMessage(ctx,x,y,w,h){
  const bubbles=[{x:.20,y:.20,w:.44,h:.19,a:.16},{x:.39,y:.46,w:.42,h:.18,a:.22},{x:.24,y:.70,w:.50,h:.14,a:.12}];
  bubbles.forEach((b,i)=>{ctx.fillStyle=i===1?'rgba(216,178,104,.19)':'rgba(174,200,231,'+b.a+')';rounded(ctx,x+w*b.x,y+h*b.y,w*b.w,h*b.h,18);ctx.fill();line(ctx,[x+w*(b.x+.07),y+h*(b.y+.07)],[x+w*(b.x+b.w-.08),y+h*(b.y+.07)],'rgba(230,238,248,.28)',3);line(ctx,[x+w*(b.x+.07),y+h*(b.y+.12)],[x+w*(b.x+b.w-.20),y+h*(b.y+.12)],'rgba(230,238,248,.18)',3);});
}
function drawPhone(ctx,x,y,w,h){
  ctx.strokeStyle='rgba(226,236,248,.62)';ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.arc(x+w*.5,y+h*.52,w*.18,Math.PI*.78,Math.PI*.22,true);ctx.stroke();
  line(ctx,[x+w*.35,y+h*.37],[x+w*.29,y+h*.28],'rgba(226,236,248,.62)',16);line(ctx,[x+w*.65,y+h*.37],[x+w*.71,y+h*.28],'rgba(226,236,248,.62)',16);
  for(let i=0;i<3;i++){ctx.strokeStyle='rgba(216,178,104,'+(.48-i*.12)+')';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+w*.5,y+h*.54,w*(.24+i*.06),Math.PI*1.18,Math.PI*1.82);ctx.stroke();}
}
function drawEvent(ctx,x,y,w,h){
  const cx=x+w*.5,cy=y+h*.48;ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.fillStyle='rgba(216,178,104,.17)';rounded(ctx,-w*.15,-w*.15,w*.30,w*.30,16);ctx.fill();ctx.strokeStyle='rgba(232,198,132,.52)';ctx.lineWidth=4;rounded(ctx,-w*.15,-w*.15,w*.30,w*.30,16);ctx.stroke();ctx.restore();
  line(ctx,[cx,cy-h*.11],[cx,cy+h*.04],'rgba(242,231,205,.80)',7);dot(ctx,cx,cy+h*.10,5,'rgba(242,231,205,.84)');
  for(let i=0;i<5;i++){const a=(-.8+i*.4);line(ctx,[cx+Math.cos(a)*w*.22,cy+Math.sin(a)*w*.22],[cx+Math.cos(a)*w*.32,cy+Math.sin(a)*w*.32],'rgba(158,187,222,.20)',3);}
}
function drawDefault(ctx,x,y,w,h){
  line(ctx,[x+w*.18,y+h*.72],[x+w*.82,y+h*.72],'rgba(205,220,239,.18)',3);
  person(ctx,x+w*.40,y+h*.58,w*.13,'rgba(232,239,248,.72)');person(ctx,x+w*.60,y+h*.58,w*.13,'rgba(195,215,238,.68)');
  line(ctx,[x+w*.45,y+h*.44],[x+w*.55,y+h*.44],'rgba(216,178,104,.42)',4);
}

function overlaySceneArt(ctx,spec){
  if(spec.kind!=='scene'||!spec.summary)return;
  const x=58,max=W-116;let y=58+58;
  ctx.font=`800 58px ${FONT}`;
  const titleLines=wrap(ctx,spec.title,max,2);
  y+=titleLines.length*61+20;
  const h=340;
  ctx.save();rounded(ctx,x,y,max,h,18);ctx.clip();
  const bg=ctx.createLinearGradient(x,y,x+max,y+h);bg.addColorStop(0,'#263a57');bg.addColorStop(.52,'#15263b');bg.addColorStop(1,'#0a1523');ctx.fillStyle=bg;ctx.fillRect(x,y,max,h);
  const key=sceneKey(sceneName(spec));
  ({meeting:drawMeeting,encounter:drawEncounter,meal:drawMeal,private:drawPrivate,message:drawMessage,phone:drawPhone,event:drawEvent,default:drawDefault}[key]||drawDefault)(ctx,x,y,max,h);
  const shade=ctx.createLinearGradient(x,y,x,y+h);shade.addColorStop(0,'rgba(255,255,255,.015)');shade.addColorStop(.72,'rgba(0,0,0,.02)');shade.addColorStop(1,'rgba(0,0,0,.18)');ctx.fillStyle=shade;ctx.fillRect(x,y,max,h);
  ctx.restore();ctx.strokeStyle='rgba(185,207,239,.23)';ctx.lineWidth=2;rounded(ctx,x,y,max,h,18);ctx.stroke();
}

function drawFace(ctx,spec){baseFace(ctx,spec);overlaySceneArt(ctx,spec);}
function createPainter({THREE}){
  const cache=new Map();
  const key=s=>JSON.stringify([s.kind,s.rank,s.title,s.quote,s.summary,s.meta,s.back,s.artChar]);
  function tex(spec,isBack){const k=(isBack?'B':'F')+key(spec);if(cache.has(k))return cache.get(k);const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');if(isBack)baseBack(ctx,spec);else drawFace(ctx,spec);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace||'srgb';t.anisotropy=6;cache.set(k,t);return t;}
  return{CARD_W:Texture.CARD_W,CARD_H:Texture.CARD_H,PIXEL_W:W,PIXEL_H:H,frontTexture:s=>tex(s,false),backTexture:s=>tex(s,true),clearCache(){for(const t of cache.values())t.dispose?.();cache.clear();}};
}

Texture.drawCardFace=drawFace;
Texture.createCardTexturePainter=createPainter;
export const modernStrategyArtInstalled=true;
