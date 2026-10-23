/** Purpose-built SVG illustrations. Geometry is illustrative, not additional forecast data. */
export function FutureMap() {
  return <svg className="future-map" viewBox="0 0 700 650" role="img" aria-label="A path from the present splits into many possible futures">
    <defs>
      <linearGradient id="path-gold" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#edba73"/><stop offset="1" stopColor="#73ddcb"/></linearGradient>
      <radialGradient id="map-glow"><stop stopColor="#2b5f59" stopOpacity=".32"/><stop offset="1" stopColor="#132324" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="380" cy="300" r="285" fill="url(#map-glow)"/>
    {[150,230,310].map(r=><circle key={r} cx="350" cy="340" r={r} fill="none" stroke="#40524e" strokeOpacity=".35" strokeDasharray="2 10"/>)}
    <g fill="none" stroke="#374a47" strokeWidth="1">
      <path d="M350 575V415C350 340 140 370 140 240V115"/>
      <path d="M350 575V415C350 340 570 370 570 240V80"/>
      <path d="M350 415C350 310 260 310 260 220V60"/>
      <path d="M350 415C350 310 460 310 460 220V140"/>
      <path d="M140 240C140 200 70 200 70 150V100M570 240C570 170 640 190 640 105"/>
    </g>
    <path className="map-path" d="M350 575V415C350 310 260 310 260 220V60M350 415C350 310 460 310 460 220V140" fill="none" stroke="url(#path-gold)" strokeWidth="2.5"/>
    <g fill="#8aaca4">{[[140,115],[570,80],[70,100],[640,105],[260,60],[460,140]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="5"/><circle cx={x} cy={y} r="12" fill="none" stroke="currentColor" strokeOpacity=".15"/></g>)}</g>
    <g className="map-hinge"><circle cx="350" cy="415" r="27" fill="#132522" stroke="#5a766b"/><path d="M340 422v-8l10-8 10 8v8M350 406v-10" fill="none" stroke="#d1b47a" strokeWidth="1.5"/></g>
    <circle cx="350" cy="575" r="7" fill="#edba73"/><circle className="map-pulse" cx="350" cy="575" r="19" fill="none" stroke="#edba73" strokeOpacity=".3"/>
    <g className="art-mono" fill="#9baea6"><text x="380" y="580">2026 · YOU ARE HERE</text><text x="390" y="420">2039 · THE FORK</text><text x="277" y="62">MANY HANDS</text><text x="478" y="142">ONE CENTER</text></g>
    <text x="350" y="630" textAnchor="middle" fill="#6f8b81" className="art-mono">THE FUTURE IS A SET OF POSSIBILITIES.</text>
  </svg>;
}

export function Network({ concentrated }: { concentrated: boolean }) {
  const pts = Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return {x:150+Math.cos(a)*105,y:155+Math.sin(a)*86};});
  return <svg viewBox="0 0 300 300" role="img" aria-label={concentrated ? "One central actor controls the surrounding network" : "Independent actors connect across a distributed network"}>
    <ellipse cx="150" cy="225" rx="120" ry="23" fill={concentrated?"#a0694b":"#6aab92"} opacity=".06"/>
    <g stroke={concentrated?"#b98163":"#79b7a0"} strokeOpacity=".5" fill="none">
      {pts.map((p,i)=><path key={i} d={concentrated?`M${p.x} ${p.y}L150 118`:`M${p.x} ${p.y}L${pts[(i+3)%12].x} ${pts[(i+3)%12].y}`} />)}
    </g>
    {pts.map((p,i)=><g key={i} transform={`translate(${p.x},${p.y})`}><path d="M-9-5 0-10 9-5V7L0 12-9 7Z" fill={concentrated?"#694d3e":"#4b806a"} stroke={concentrated?"#bc8b6e":"#a4d6ae"}/><path d="M-9-5 0 0 9-5M0 0v12" fill="none" stroke={concentrated?"#a5775d":"#81b593"}/></g>)}
    {concentrated?<g><path d="m130 119 20-12 20 12v51l-20 12-20-12Z" fill="#9e684e" stroke="#dcaa81"/><path d="M130 119V70l20-12 20 12v49l-20 12Z" fill="#b7805a" stroke="#e4b487"/><path d="m130 70 20 12 20-12M150 82v100" fill="none" stroke="#edc397"/><circle cx="150" cy="51" r="5" fill="#f1c49c"/></g>:<g fill="#b4dcb5">{[[109,111],[186,125],[145,188]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="9" fill="#2b4d3c" stroke="#a7d5aa"/><circle cx={x} cy={y} r="3"/></g>)}</g>}
    <text x="150" y="280" textAnchor="middle" className="art-mono" fill={concentrated?"#c69a7b":"#a3c9ad"}>{concentrated?"A SINGLE CENTER OF GRAVITY":"NO SINGLE POINT OF CONTROL"}</text>
  </svg>;
}
