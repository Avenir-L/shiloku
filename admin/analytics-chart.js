export function chartModel(days){
 const left=58,right=700,top=32,bottom=200;
 const max=Math.max(1,...days.map(d=>Number(d.pv)||0)),raw=max/4,magnitude=10**Math.floor(Math.log10(raw));
 const fraction=raw/magnitude,step=Math.max(1,(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*magnitude),ceiling=Math.ceil(max/step)*step;
 const x=i=>days.length===1?(left+right)/2:left+i*(right-left)/Math.max(1,days.length-1);
 const y=value=>bottom-value/ceiling*(bottom-top);
 const points=days.map((d,i)=>({x:x(i),y:y(Number(d.pv)||0),date:d.date,pv:Number(d.pv)||0,uv:Number(d.uv)||0}));
 const indices=days.length<=7?days.map((_,i)=>i):Array.from({length:7},(_,i)=>Math.round(i*(days.length-1)/6));
 return {left,right,top,bottom,points,yTicks:Array.from({length:Math.round(ceiling/step)+1},(_,i)=>({value:i*step,y:y(i*step)})),xTicks:indices.map(i=>({x:x(i),date:days[i].date,label:days[i].date.slice(5).replace('-','/')}))};
}
