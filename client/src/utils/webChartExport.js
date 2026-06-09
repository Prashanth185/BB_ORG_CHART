/**
 * webChartExport.js
 *
 * Generates a fully self-contained standalone HTML file for the Traditional Org Chart.
 * The output is a single index.html with all JS/CSS inlined — no server needed.
 * Users can double-click index.html to open the interactive chart in any browser.
 *
 * Also supports downloading as a ZIP package (index.html + chart-data.json).
 */

import JSZip from 'jszip';

// ─── Department colour (must match TraditionalOrgChart.jsx exactly) ───────────
const DEPT_COLORS = [
  '#2563eb','#059669','#d97706','#7c3aed',
  '#dc2626','#0891b2','#c026d3','#65a30d',
];
function deptColor(dept) {
  if (!dept) return DEPT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = (hash * 31 + dept.charCodeAt(i)) | 0;
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

// ─── Build the standalone HTML string ────────────────────────────────────────
export function buildStandaloneHtml(chartData) {
  const {
    roots = [],
    title = 'Org Chart',
    employeeCount = 0,
    nodeColors = {},
    lineColor = '#94a3b8',
    lineThickness = 2,
  } = chartData;
  const dataJson = JSON.stringify(chartData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(title)} — Interactive Org Chart</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;height:100vh;display:flex;flex-direction:column;overflow:hidden}
#topbar{background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.06);z-index:20}
#topbar h1{font-size:15px;font-weight:700;color:#1e293b;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#topbar p{font-size:11px;color:#94a3b8}
.tb-btn{background:none;border:1px solid #e2e8f0;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;color:#475569;display:flex;align-items:center;gap:5px;transition:background .15s,color .15s;white-space:nowrap}
.tb-btn:hover{background:#f1f5f9;color:#1e293b}
.tb-btn.active{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8}
.zoom-lbl{font-size:12px;color:#64748b;min-width:36px;text-align:center;font-weight:500}
#search-wrap{position:relative}
#search-input{border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px 5px 28px;font-size:12px;outline:none;width:180px;transition:border-color .15s}
#search-input:focus{border-color:#3b82f6}
#search-icon{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#94a3b8;pointer-events:none}
#search-results{position:absolute;top:calc(100% + 4px);left:0;width:220px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:50;max-height:200px;overflow-y:auto;display:none}
#search-results.open{display:block}
.sr-item{padding:7px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f8fafc}
.sr-item:hover{background:#eff6ff}
.sr-name{font-weight:600;color:#1e293b}
.sr-sub{color:#94a3b8;margin-left:4px}
#viewport{flex:1;overflow:hidden;position:relative;background-image:radial-gradient(circle,#cbd5e1 1px,transparent 1px);background-size:24px 24px}
#canvas-wrap{position:absolute;top:0;left:0;transform-origin:top left}
#hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.85);backdrop-filter:blur(4px);border:1px solid #e2e8f0;border-radius:999px;padding:6px 16px;font-size:11px;color:#64748b;pointer-events:none;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.node{position:absolute;z-index:10}
.node-card{width:100%;height:100%;border-radius:8px;overflow:hidden;display:flex;border:1px solid #e2e8f0;background:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,.08)}
.node-card.highlight{border:2px solid #f59e0b;background:#fffbeb;box-shadow:0 0 0 3px rgba(245,158,11,.25),0 4px 6px -1px rgba(0,0,0,.1)}
.node-strip{width:5px;flex-shrink:0}
.node-body{flex:1;padding:8px 10px;min-width:0;overflow:hidden}
.node-name{font-weight:700;font-size:13px;color:#1e3a5f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node-desig{font-size:11px;color:#475569;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node-dept{font-size:11px;font-weight:500;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node-id{font-size:10px;color:#94a3b8;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.toggle-btn{position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:background .15s}
.toggle-btn:hover{background:#1d4ed8}
.toggle-btn svg{width:13px;height:13px;stroke:#fff;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round}
</style>
</head>
<body>

<div id="topbar">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
  <div style="flex:1;min-width:0">
    <h1>${escHtml(title)}</h1>
    <p>${employeeCount} employees · Interactive view</p>
  </div>
  <div id="search-wrap">
    <svg id="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input id="search-input" type="text" placeholder="Search employee…" autocomplete="off"/>
    <div id="search-results"></div>
  </div>
  <button class="tb-btn" onclick="zoomOut()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
  </button>
  <span class="zoom-lbl" id="zoom-lbl">100%</span>
  <button class="tb-btn" onclick="zoomIn()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
  </button>
  <button class="tb-btn" onclick="fitToScreen()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    Fit
  </button>
  <button class="tb-btn" id="pan-btn" onclick="togglePan()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
    Pan
  </button>
  <button class="tb-btn" onclick="toggleFullscreen()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    Full Screen
  </button>
</div>

<div id="viewport">
  <div id="canvas-wrap"></div>
  <div id="hint">Click ▶ to expand · ▾ to collapse · Ctrl+scroll to zoom · Drag in Pan mode</div>
</div>

<script>
(function(){
const CARD_W=176,CARD_H=80,H_GAP=36,V_GAP=60;
const DEPT_COLORS=['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0891b2','#c026d3','#65a30d'];
function deptColor(d){if(!d)return DEPT_COLORS[0];let h=0;for(let i=0;i<d.length;i++)h=(h*31+d.charCodeAt(i))|0;return DEPT_COLORS[Math.abs(h)%DEPT_COLORS.length];}
function textColorFor(hex){try{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);const l=(0.299*r+0.587*g+0.114*b)/255;return l>0.55?'#1e293b':'#ffffff';}catch{return'#ffffff';}}

const DATA = ${dataJson};
const roots = DATA.roots||[];
const nodeColors = DATA.nodeColors||{};
const CONNECTOR = DATA.lineColor||'#94a3b8';
const LINE_W = DATA.lineThickness||2;
let expandedSet = new Set(roots.map(r=>r.id));
let zoom=1, panX=0, panY=0, isPan=false, searchId=null;
let panStart=null;

function subtreeWidth(n,exp){
  if(!exp.has(n.id)||!n.children||!n.children.length)return CARD_W;
  const cw=n.children.map(c=>subtreeWidth(c,exp));
  return Math.max(CARD_W,cw.reduce((s,w)=>s+w,0)+H_GAP*(n.children.length-1));
}
function measureCanvas(rts,exp){
  if(!rts.length)return{w:0,h:0};
  const rw=rts.map(r=>subtreeWidth(r,exp));
  const tw=rw.reduce((s,w)=>s+w,0)+H_GAP*(rts.length-1);
  function h(n){if(!exp.has(n.id)||!n.children||!n.children.length)return CARD_H;return CARD_H+V_GAP+Math.max(...n.children.map(h));}
  return{w:Math.max(tw,400),h:Math.max(Math.max(...rts.map(h))+60,300)};
}
function findNode(id,list){for(const n of list){if(n.id===id)return n;if(n.children){const f=findNode(id,n.children);if(f)return f;}}return null;}
function allDesc(n){const ids=[];function c(x){for(const ch of(x.children||[])){ids.push(ch.id);c(ch);}}c(n);return ids;}

function render(){
  const wrap=document.getElementById('canvas-wrap');
  const {w:cw,h:ch}=measureCanvas(roots,expandedSet);
  const pad=60;
  const tw=cw+pad*2,th=ch+pad*2;
  const ox=cw/2+pad,oy=pad;

  // Build lines
  const lines=[];
  function buildLines(n,x,y){
    if(!expandedSet.has(n.id)||!n.children||!n.children.length)return;
    const cws=n.children.map(c=>subtreeWidth(c,expandedSet));
    const tot=cws.reduce((s,w)=>s+w,0)+H_GAP*(n.children.length-1);
    const cy=y+CARD_H+V_GAP;
    const cxs=[];let rx=x-tot/2;
    for(let i=0;i<n.children.length;i++){cxs.push(rx+cws[i]/2);rx+=cws[i]+H_GAP;}
    const pbx=x,pby=y+CARD_H;
    if(n.children.length===1){lines.push([pbx,pby,pbx,cy]);}
    else{const ey=pby+V_GAP/2;lines.push([pbx,pby,pbx,ey]);lines.push([cxs[0],ey,cxs[cxs.length-1],ey]);for(let i=0;i<cxs.length;i++)lines.push([cxs[i],ey,cxs[i],cy]);}
    for(let i=0;i<n.children.length;i++)buildLines(n.children[i],cxs[i],cy);
  }
  const rw=roots.map(r=>subtreeWidth(r,expandedSet));
  const rtot=rw.reduce((s,w)=>s+w,0)+H_GAP*(roots.length-1);
  let rrx=-rtot/2;
  for(let i=0;i<roots.length;i++){buildLines(roots[i],rrx+rw[i]/2,0);rrx+=rw[i]+H_GAP;}

  const svgLines=lines.map(([x1,y1,x2,y2])=>
    \`<line x1="\${x1+ox}" y1="\${y1+oy}" x2="\${x2+ox}" y2="\${y2+oy}" stroke="\${CONNECTOR}" stroke-width="\${LINE_W}" stroke-linecap="round"/>\`
  ).join('');
  const svg=\`<svg width="\${tw}" height="\${th}" style="position:absolute;top:0;left:0;pointer-events:none;z-index:1">\${svgLines}</svg>\`;

  // Build cards
  const cardHtml=[];
  function buildCards(n,x,y){
    const isExp=expandedSet.has(n.id),hasC=n.children&&n.children.length>0,isM=n.id===searchId;
    const nc=nodeColors[n.id]||n.node_color||null;
    const isColorized=!!nc;
    const bgColor=isColorized?nc:'#ffffff';
    const accent=isColorized?nc:deptColor(n.department);
    const textColor=isColorized?textColorFor(bgColor):'#1e3a5f';
    const subColor=isColorized?textColorFor(bgColor)+'cc':'#475569';
    const deptClr=isColorized?textColorFor(bgColor)+'dd':accent;
    const strip=isColorized?'':(\`<div class="node-strip" style="background:\${accent}"></div>\`);
    const lx=(x-CARD_W/2)+ox,ly=y+oy;
    const tog=hasC?\`<button class="toggle-btn" onclick="toggle(\${n.id})">\${isExp?'<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>':'<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>'}</button>\`:'';
    cardHtml.push(\`<div class="node" style="left:\${lx}px;top:\${ly}px;width:\${CARD_W}px;height:\${CARD_H}px">\${tog}<div class="node-card\${isM?' highlight':''}" style="background:\${bgColor}\${isM?';border:2px solid #f59e0b':''}">\${strip}<div class="node-body"><div class="node-name" style="color:\${textColor}" title="\${esc(n.name)}">\${esc(n.name)}</div>\${n.designation?\`<div class="node-desig" style="color:\${subColor}">\${esc(n.designation)}</div>\`:''}\${n.department?\`<div class="node-dept" style="color:\${deptClr}">\${esc(n.department)}</div>\`:''}<div class="node-id" style="color:\${isColorized?textColorFor(bgColor)+'99':'#94a3b8'}">\${esc(n.employee_id||'')}</div></div></div></div>\`);
    if(!isExp||!hasC)return;
    const cws=n.children.map(c=>subtreeWidth(c,expandedSet));
    const tot=cws.reduce((s,w)=>s+w,0)+H_GAP*(n.children.length-1);
    const cy=y+CARD_H+V_GAP;let rx2=x-tot/2;
    for(let i=0;i<n.children.length;i++){buildCards(n.children[i],rx2+cws[i]/2,cy);rx2+=cws[i]+H_GAP;}
  }
  let rrx2=-rtot/2;
  for(let i=0;i<roots.length;i++){buildCards(roots[i],rrx2+rw[i]/2,0);rrx2+=rw[i]+H_GAP;}

  wrap.innerHTML=\`<div style="position:relative;width:\${tw}px;height:\${th}px;transform:scale(\${zoom});transform-origin:top left">\${svg}\${cardHtml.join('')}</div>\`;
  wrap.style.transform=\`translate(\${panX}px,\${panY}px)\`;
  document.getElementById('zoom-lbl').textContent=Math.round(zoom*100)+'%';
}

window.toggle=function(id){
  if(expandedSet.has(id)){expandedSet.delete(id);const n=findNode(id,roots);if(n)for(const d of allDesc(n))expandedSet.delete(d);}
  else{expandedSet.add(id);}
  render();
};

window.zoomIn=function(){zoom=Math.min(2.5,+(zoom+0.15).toFixed(2));render();};
window.zoomOut=function(){zoom=Math.max(0.3,+(zoom-0.15).toFixed(2));render();};
window.fitToScreen=function(){
  const {w:cw,h:ch}=measureCanvas(roots,expandedSet);
  const pad=60,vp=document.getElementById('viewport');
  zoom=Math.max(0.3,Math.min(0.99,(vp.clientWidth-40)/(cw+pad*2),(vp.clientHeight-40)/(ch+pad*2)));
  panX=0;panY=0;render();
};
window.togglePan=function(){isPan=!isPan;document.getElementById('pan-btn').classList.toggle('active',isPan);document.getElementById('canvas-wrap').style.cursor=isPan?'grab':'default';};
window.toggleFullscreen=function(){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();};

// Pan
const vp=document.getElementById('viewport');
vp.addEventListener('mousedown',e=>{
  if(!isPan)return;e.preventDefault();
  panStart={x:e.clientX-panX,y:e.clientY-panY};
  document.getElementById('canvas-wrap').style.cursor='grabbing';
});
window.addEventListener('mousemove',e=>{
  if(!panStart)return;
  panX=e.clientX-panStart.x;panY=e.clientY-panStart.y;
  document.getElementById('canvas-wrap').style.transform=\`translate(\${panX}px,\${panY}px)\`;
});
window.addEventListener('mouseup',()=>{panStart=null;if(isPan)document.getElementById('canvas-wrap').style.cursor='grab';});

// Ctrl+wheel zoom
vp.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey){e.preventDefault();zoom=Math.max(0.3,Math.min(2.5,+(zoom+(e.deltaY<0?.1:-.1)).toFixed(2)));render();}
},{passive:false});

// Search
function getAllEmps(list){const r=[];function c(n){r.push(n);(n.children||[]).forEach(c);}list.forEach(c);return r;}
const allEmps=getAllEmps(roots);
const inp=document.getElementById('search-input');
const res=document.getElementById('search-results');
inp.addEventListener('input',()=>{
  const q=inp.value.trim().toLowerCase();
  if(!q){res.classList.remove('open');return;}
  const matches=allEmps.filter(e=>e.name.toLowerCase().includes(q)||(e.designation||'').toLowerCase().includes(q)||(e.department||'').toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){res.classList.remove('open');return;}
  res.innerHTML=matches.map(e=>\`<div class="sr-item" onclick="selectEmp(\${e.id},'\${esc(e.name)}')">\${esc(e.name)}\${e.designation?\`<span class="sr-sub">— \${esc(e.designation)}</span>\`:''}</div>\`).join('');
  res.classList.add('open');
});
document.addEventListener('click',e=>{if(!e.target.closest('#search-wrap'))res.classList.remove('open');});
window.selectEmp=function(id,name){
  searchId=id;inp.value=name;res.classList.remove('open');
  function pathTo(nid,list,path){for(const n of list){if(n.id===nid)return[...path,n.id];const f=pathTo(nid,n.children||[],[...path,n.id]);if(f)return f;}return null;}
  const p=pathTo(id,roots,[]);if(p)for(const pid of p.slice(0,-1))expandedSet.add(pid);
  render();
};

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

render();
window.addEventListener('resize',()=>render());
})();
</script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Download as single standalone HTML file ─────────────────────────────────
export function downloadStandaloneHtml(chartData, filename = 'org-chart.html') {
  const html  = buildStandaloneHtml(chartData);
  const blob  = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url   = URL.createObjectURL(blob);
  const link  = document.createElement('a');
  link.href   = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── Download as ZIP package (index.html + chart-data.json) ─────────────────
export async function downloadZipPackage(chartData, filename = 'org-chart-web.zip') {
  const html     = buildStandaloneHtml(chartData);
  const dataJson = JSON.stringify(chartData, null, 2);

  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('chart-data.json', dataJson);
  zip.file('README.txt',
    'Traditional Org Chart — Standalone Web Package\n' +
    '================================================\n\n' +
    '1. Extract this ZIP file.\n' +
    '2. Double-click index.html to open the chart in any modern browser.\n' +
    '3. No internet connection required.\n' +
    '4. No server required.\n\n' +
    'Interactive features:\n' +
    '  - Click ▶ on any node to expand one reporting level\n' +
    '  - Click ▾ to collapse\n' +
    '  - Ctrl+scroll or use zoom buttons\n' +
    '  - Drag in Pan mode\n' +
    '  - Search employees by name or designation\n' +
    '  - Fit to Screen button\n' +
    '  - Full Screen button\n'
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href  = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
