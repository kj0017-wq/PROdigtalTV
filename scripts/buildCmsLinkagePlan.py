from pathlib import Path
import re,html,textwrap,collections
root=Path(__file__).resolve().parents[1]
source=(root/'docs/cms-verkettungsplan.md').read_text(encoding='utf-8-sig')
def inline(t):
 t=html.escape(t)
 t=re.sub(r'`([^`]+)`',r'<code>\1</code>',t)
 return re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',t)
def diagram(lines):
 nodes={};edges=[];direction='TB'
 def node(expr):
  match=re.match(r'(\w+)(.*)',expr.strip()); key,rest=match.groups()
  if rest:nodes[key]=rest.strip('[](){}').strip()
  else:nodes.setdefault(key,key)
  return key
 for line in lines:
  line=line.strip()
  if line.startswith('flowchart '):direction=line.split()[-1];continue
  if not line:continue
  parts=re.split(r'\s*-->\s*',line)
  if len(parts)==1:node(parts[0]);continue
  a=node(parts[0]);bpart=parts[1];label=''
  if bpart.startswith('|'):_,label,bpart=bpart.split('|',2)
  edges.append((a,node(bpart),label))
 rank={n:0 for n in nodes}
 for _ in nodes:
  for a,b,_ in edges:rank[b]=max(rank[b],rank[a]+1)
 groups=collections.defaultdict(list)
 for key in nodes:groups[rank[key]].append(key)
 w,h=230,76;gapx,gapy=42,74;pos={}
 if direction=='LR':
  height=max(map(len,groups.values()))*(h+gapy)+30;width=(max(groups)+1)*(w+gapx)+30
  for r,keys in groups.items():
   for i,key in enumerate(keys):pos[key]=(20+r*(w+gapx),20+i*(h+gapy))
 else:
  width=max(map(len,groups.values()))*(w+gapx)+30;height=(max(groups)+1)*(h+gapy)+30
  for r,keys in groups.items():
   for i,key in enumerate(keys):pos[key]=(20+i*(w+gapx),20+r*(h+gapy))
 out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Verknüpfungsdiagramm"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#8392a8"/></marker></defs>']
 for a,b,label in edges:
  x,y=pos[a];xx,yy=pos[b]
  if direction=='LR':x+=w;y+=h/2;yy+=h/2;mx=(x+xx)/2;d=f'M{x} {y} C{mx} {y} {mx} {yy} {xx} {yy}'
  else:x+=w/2;xx+=w/2;y+=h;my=(y+yy)/2;d=f'M{x} {y} C{x} {my} {xx} {my} {xx} {yy}'
  out.append(f'<path d="{d}" fill="none" stroke="#8392a8" stroke-width="2" marker-end="url(#arrow)"/>')
  if label:out.append(f'<text x="{(x+xx)/2}" y="{(y+yy)/2-8}" text-anchor="middle" font-size="11" fill="#b4000e" stroke="white" stroke-width="4" paint-order="stroke">{html.escape(label)}</text>')
 for key,label in nodes.items():
  x,y=pos[key];out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#f4f7fb" stroke="#cbd7e8"/>')
  rows=textwrap.wrap(label,30);rows=rows or ['']
  for i,row in enumerate(rows):out.append(f'<text x="{x+w/2}" y="{y+h/2+(i-(len(rows)-1)/2)*17+5}" text-anchor="middle" fill="#071a33" font-size="14">{html.escape(row)}</text>')
 out.append('</svg>');return '<div class="diagram">'+''.join(out)+'</div>'
lines=source.splitlines();out=[];i=0;listtag=None
while i<len(lines):
 line=lines[i]
 if line.startswith('```mermaid'):
  block=[];i+=1
  while not lines[i].startswith('```'):block.append(lines[i]);i+=1
  out.append(diagram(block))
 elif line.startswith('|'):
  rows=[]
  while i<len(lines) and lines[i].startswith('|'):
   cells=[c.strip() for c in lines[i].strip('|').split('|')]
   if not all(re.fullmatch(r'[-: ]+',c) for c in cells):rows.append(cells)
   i+=1
  out.append('<div class="table-wrap"><table>'+''.join('<tr>'+''.join(f'<{"th" if n==0 else "td"}>{inline(c)}</{"th" if n==0 else "td"}>' for c in row)+'</tr>' for n,row in enumerate(rows))+'</table></div>');continue
 elif re.match(r'^#{1,3} ',line):
  level=len(line.split(' ')[0]);out.append(f'<h{level}>{inline(line[level+1:])}</h{level}>')
 elif line.startswith('- ') or re.match(r'^\d+\. ',line):out.append('<p class="list">'+inline(line)+'</p>')
 elif line.strip():out.append('<p>'+inline(line)+'</p>')
 i+=1
page='''<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PROdigitalTV · CMS-Verkettungsplan</title><style>
*{box-sizing:border-box}body{margin:0;color:#071a33;background:#f4f7fb;font:16px/1.6 Arial,sans-serif}main{max-width:1280px;margin:24px auto;padding:28px;background:white;border:1px solid #dce4ed;border-radius:18px}h1{font-size:32px;line-height:1.2}h2{margin-top:42px;border-top:1px solid #dce4ed;padding-top:22px}p{margin:12px 0}code{font-size:13px;background:#eef2f7;padding:2px 4px;border-radius:4px}.diagram{margin:22px 0;border:1px solid #dce4ed;padding:12px;border-radius:12px;overflow:auto}.diagram svg{display:block;width:100%;min-width:760px;height:auto}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #dce4ed}th{background:#f4f7fb}.table-wrap{overflow:auto}.list{margin:6px 0 6px 16px}.actions{display:flex;gap:14px;flex-wrap:wrap}.actions a,.actions button{font:inherit;color:#071a33;border:1px solid #dce4ed;border-radius:24px;background:white;padding:9px 18px;text-decoration:none;cursor:pointer}.actions button{background:#e30613;color:white;border-color:#e30613}@media(max-width:700px){main{margin:8px;padding:18px}h1{font-size:25px}}@media print{@page{size:A4 landscape;margin:12mm}body{background:white;font-size:11px}main{margin:0;padding:0;border:0}.actions{display:none}.diagram{break-inside:avoid}.diagram svg{min-width:0}h2{break-after:avoid}table{font-size:10px}}</style></head><body><main><div class="actions"><button onclick="window.print()">Drucken / PDF</button><a href="cms-verkettungsplan.md" download>Markdown herunterladen</a></div>'''+''.join(out)+'''</main></body></html>'''
(root/'public/docs/cms-verkettungsplan.html').write_text(page,encoding='utf-8')
(root/'public/docs/cms-verkettungsplan.md').write_text(source,encoding='utf-8')
print('Verkettungsplan: HTML mit 5 SVG-Diagrammen und Markdown erzeugt.')
