"use strict";

function validatePumpCatalog(catalog) {
  const identifiers = new Set();
  for (const pump of catalog) {
    if (!pump.id || identifiers.has(pump.id) || !Number.isFinite(pump.power_kw) || pump.power_kw <= 0 || pump.points.length < 2) throw new Error("Invalid fictional pump catalog.");
    identifiers.add(pump.id);
    pump.points.forEach(([q,h],index) => {
      if (!Number.isFinite(q) || !Number.isFinite(h) || q < 0 || h <= 0 || (index && (q <= pump.points[index-1][0] || h > pump.points[index-1][1]))) throw new Error("Curve points must have increasing flow and nonincreasing positive head.");
    });
  }
}

function headAtFlow(pump, flow) {
  if (!Number.isFinite(flow) || flow < pump.points[0][0] || flow > pump.points.at(-1)[0]) return null;
  const rightIndex = pump.points.findIndex(point => point[0] >= flow);
  const right = pump.points[rightIndex];
  if (right[0] === flow) return right[1];
  const left = pump.points[rightIndex-1];
  return ((right[0]-flow)*left[1] + (flow-left[0])*right[1]) / (right[0]-left[0]);
}

function comparePumps(flow, head) {
  if (!Number.isFinite(flow) || !Number.isFinite(head) || flow <= 0 || head <= 0) throw new Error("Flow and head must be positive finite numbers.");
  return pumpCatalog.map(pump => {
    const available = headAtFlow(pump,flow);
    const margin = available === null ? null : available-head;
    const eligible = margin !== null && margin >= -1e-9;
    return {pump,available,margin,eligible,reason:available === null ? "Outside curve range" : eligible ? "Meets duty point" : "Insufficient head"};
  }).sort((a,b) => Number(b.eligible)-Number(a.eligible) || (a.eligible ? a.margin-b.margin : a.pump.id.localeCompare(b.pump.id)));
}

function systemHead(duty, flow) {
  return duty.staticHead + duty.losses * (flow/duty.flow)**2;
}

function operatingPoint(pump,duty) {
  if (duty.mode !== "system") return null;
  let low = pump.points[0][0], high = pump.points.at(-1)[0];
  const difference = flow => headAtFlow(pump,flow)-systemHead(duty,flow);
  if (difference(low) < 0 || difference(high) > 0) return null;
  for (let step=0;step<60;step++) {
    const middle = (low+high)/2;
    if (difference(middle) >= 0) low=middle;
    else high=middle;
  }
  const flow=(low+high)/2;
  return {flow,head:systemHead(duty,flow)};
}

let pumpState = null;
let selectedPumpId = null;
const pumpElement = id => document.getElementById(id);
const fmt = value => Number(value.toFixed(2)).toString();
const colors = ["#235d95","#876b32","#3a7b49","#8b4973","#4c7380","#806198","#ba603c","#555e68"];

function svgNode(tag,attributes={},text) {
  const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
  Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key,String(value)));
  if (text !== undefined) node.textContent=text;
  return node;
}

function readDuty() {
  const mode=pumpElement("head-mode").value;
  const ids=mode === "direct" ? ["flow","required-head"] : ["flow","lift","pressure","losses"];
  const values=ids.map(id => {
    const field=pumpElement(id);
    if (!field.value.trim() || !field.checkValidity()) throw new Error("Complete the active fields with valid numbers.");
    return Number(field.value);
  });
  if (mode === "direct") return {mode,flow:values[0],head:values[1]};
  const [flow,lift,pressure,losses]=values;
  return {mode,flow,head:headRequirement(flow,lift,pressure,losses),lift,pressure,losses,staticHead:lift+pressure};
}

function invalidatePump() {
  pumpState=null; selectedPumpId=null;
  pumpElement("print-pump").disabled=true;
  pumpElement("download-graph").disabled=true;
  pumpElement("pump-rows").replaceChildren();
  pumpElement("curve-chart").replaceChildren();
  pumpElement("head-chart").replaceChildren();
  pumpElement("curve-points").replaceChildren();
  ["selected-summary","selection-explanation","operating-summary","report-summary","curve-method"].forEach(id => {pumpElement(id).textContent="";});
  try {
    const duty=readDuty();
    pumpElement("total-head").textContent=fmt(duty.head);
    pumpElement("flow-result").textContent=`at ${fmt(duty.flow)} m³/h`;
    pumpElement("pump-error").textContent="";
    pumpElement("pump-status").textContent="Inputs changed. Click Calculate and select to update the curves and results.";
  } catch(error) {
    pumpElement("total-head").textContent="—";
    pumpElement("flow-result").textContent="Complete the inputs.";
    pumpElement("pump-error").textContent=error.message;
    pumpElement("pump-status").textContent="No current calculation.";
  }
}

function setHeadMode() {
  const direct=pumpElement("head-mode").value === "direct";
  pumpElement("head-components").hidden=direct;
  pumpElement("direct-head-field").hidden=!direct;
  ["lift","pressure","losses"].forEach(id => {pumpElement(id).disabled=direct;});
  pumpElement("required-head").disabled=!direct;
  invalidatePump();
}

function renderPumpTable() {
  const body=pumpElement("pump-rows");body.replaceChildren();
  for (const result of pumpState.results) {
    const row=document.createElement("tr");
    const selectCell=addCell(row,"");
    const radio=document.createElement("input");radio.type="radio";radio.name="selected-pump";radio.value=result.pump.id;
    radio.disabled=!result.eligible;radio.checked=result.pump.id===selectedPumpId;
    radio.setAttribute("aria-label",`Select ${result.pump.name}`);
    radio.addEventListener("change",() => selectPump(result.pump.id));selectCell.appendChild(radio);
    addCell(row,result.pump.name);addCell(row,fmt(result.pump.power_kw),"number");
    addCell(row,`${result.pump.points[0][0]}–${result.pump.points.at(-1)[0]}`,"number");
    addCell(row,result.available===null ? "—" : fmt(result.available),"number");
    addCell(row,result.margin===null ? "—" : fmt(result.margin),"number");
    addCell(row,result.reason,result.eligible ? "eligible" : "rejected");
    if (radio.checked) row.classList.add("selected-row");
    body.appendChild(row);
  }
}

function renderCurveChart() {
  const duty=pumpState.duty;
  const selected=pumpCatalog.find(pump => pump.id===selectedPumpId);
  const all=pumpElement("show-all-curves").checked || !selected;
  const curves=all ? pumpCatalog : [selected];
  const xMax=Math.max(duty.flow*1.2,...curves.map(p => p.points.at(-1)[0]))*1.05;
  const yMax=Math.max(duty.head*1.15,...curves.map(p => p.points[0][1]))*1.08;
  const svg=svgNode("svg",{viewBox:all ? "0 0 900 540" : "0 0 900 480",role:"img","aria-label":"Flow versus head: fictional pump curves and required duty point"});
  svg.appendChild(svgNode("title",{},`Fictional pump selection: ${fmt(duty.flow)} m³/h at ${fmt(duty.head)} m`));
  svg.appendChild(svgNode("rect",{x:0,y:0,width:900,height:all ? 540 : 480,fill:"white"}));
  const x=q => 72+q/xMax*790, y=h => 375-h/yMax*315;
  svg.appendChild(svgNode("text",{x:72,y:25,"font-size":17,"font-weight":600},selected ? `${selected.name} — fictional Q–H curve` : "Fictional catalog curves"));
  for (let tick=0;tick<=5;tick++) {
    const q=xMax*tick/5,h=yMax*tick/5;
    svg.appendChild(svgNode("line",{x1:x(q),x2:x(q),y1:60,y2:375,stroke:"#e0e4e9"}));
    svg.appendChild(svgNode("line",{x1:72,x2:862,y1:y(h),y2:y(h),stroke:"#e0e4e9"}));
    svg.appendChild(svgNode("text",{x:x(q),y:398,"text-anchor":"middle","font-size":13},fmt(q)));
    svg.appendChild(svgNode("text",{x:62,y:y(h)+5,"text-anchor":"end","font-size":13},fmt(h)));
  }
  svg.appendChild(svgNode("text",{x:470,y:425,"text-anchor":"middle","font-size":14},"Flow (m³/h)"));
  svg.appendChild(svgNode("text",{x:18,y:220,transform:"rotate(-90 18 220)","text-anchor":"middle","font-size":14},"Head (m of water)"));
  for (const pump of curves) {
    const color=colors[pumpCatalog.indexOf(pump)];
    svg.appendChild(svgNode("polyline",{points:pump.points.map(([q,h]) => `${x(q)},${y(h)}`).join(" "),fill:"none",stroke:color,"stroke-width":pump.id===selectedPumpId ? 3 : 1.7}));
    if (pump.id===selectedPumpId) pump.points.forEach(([q,h]) => svg.appendChild(svgNode("circle",{cx:x(q),cy:y(h),r:3,fill:color})));
  }
  if (duty.mode === "system") {
    const points=Array.from({length:101},(_,i) => {const q=xMax*i/100;return [q,systemHead(duty,q)];}).filter(([,h]) => h<=yMax);
    svg.appendChild(svgNode("polyline",{points:points.map(([q,h])=>`${x(q)},${y(h)}`).join(" "),fill:"none",stroke:"#222","stroke-width":2,"stroke-dasharray":"7 4"}));
  }
  svg.appendChild(svgNode("line",{x1:72,x2:x(duty.flow),y1:y(duty.head),y2:y(duty.head),stroke:"#be3434","stroke-dasharray":"3 4"}));
  svg.appendChild(svgNode("line",{x1:x(duty.flow),x2:x(duty.flow),y1:y(duty.head),y2:375,stroke:"#be3434","stroke-dasharray":"3 4"}));
  svg.appendChild(svgNode("circle",{cx:x(duty.flow),cy:y(duty.head),r:5,fill:"#be3434"}));
  const op=selected ? operatingPoint(selected,duty) : null;
  if (op) svg.appendChild(svgNode("circle",{cx:x(op.flow),cy:y(op.head),r:6,fill:"white",stroke:"#177146","stroke-width":3}));
  svg.appendChild(svgNode("text",{x:72,y:450,"font-size":13,fill:"#be3434"},"● Required point"));
  if (duty.mode==="system") svg.appendChild(svgNode("text",{x:245,y:450,"font-size":13},"- - Simplified system curve"));
  if (op) svg.appendChild(svgNode("text",{x:500,y:450,"font-size":13,fill:"#177146"},"○ Estimated intersection"));
  if (all) curves.forEach((pump,index) => {
    const left=72+(index%4)*195, top=480+Math.floor(index/4)*25;
    svg.appendChild(svgNode("line",{x1:left,x2:left+22,y1:top,y2:top,stroke:colors[pumpCatalog.indexOf(pump)],"stroke-width":3}));
    svg.appendChild(svgNode("text",{x:left+29,y:top+5,"font-size":13},pump.name));
  });
  pumpElement("curve-chart").replaceChildren(svg);
  pumpElement("operating-summary").textContent=duty.mode === "direct" ? "The red point is the requested flow/head, not a measured operating point. No system curve is inferred from total head alone." : op ? `Estimated curve intersection: ${fmt(op.flow)} m³/h at ${fmt(op.head)} m. This differs from the requested point and uses the simplified system assumption below.` : "No selected-curve intersection inside the tabulated range. No extrapolation is used.";
  pumpElement("curve-method").textContent=duty.mode === "system" ? `System illustration: H(Q) = ${fmt(duty.staticHead)} + ${fmt(duty.losses)} × (Q / ${fmt(duty.flow)})². Pressure head is treated as constant and supplied losses scale with flow squared. This is an illustrative model, not a pipe-network calculation.` : "Straight segments join catalog points. Head is interpolated only inside each model's tabulated flow range.";
}

function renderHeadChart() {
  const duty=pumpState.duty;
  const parts=duty.mode === "system" ? [["Lift",duty.lift],["Pressure",duty.pressure],["Losses",duty.losses]] : [["Total head",duty.head]];
  const svg=svgNode("svg",{viewBox:"0 0 440 220",role:"img","aria-label":"Required head components in meters"});
  svg.appendChild(svgNode("rect",{width:440,height:220,fill:"white"}));
  parts.forEach(([label,value],index) => {
    const y=20+index*55;
    svg.appendChild(svgNode("text",{x:4,y:y+18,"font-size":14},label));
    svg.appendChild(svgNode("rect",{x:102,y,width:Math.max(0,value/duty.head*230),height:25,fill:colors[index]}));
    svg.appendChild(svgNode("text",{x:345,y:y+18,"font-size":14},`${fmt(value)} m`));
  });
  svg.appendChild(svgNode("text",{x:4,y:205,"font-size":14},`Total required head: ${fmt(duty.head)} m`));
  pumpElement("head-chart").replaceChildren(svg);
}

function selectPump(id) {
  const result=pumpState.results.find(item => item.pump.id===id && item.eligible);
  if (!result) return;
  selectedPumpId=id;
  pumpElement("selected-summary").textContent=`Selected: ${result.pump.name}. Available head ${fmt(result.available)} m; required ${fmt(pumpState.duty.head)} m; margin +${fmt(Math.max(0,result.margin))} m.`;
  pumpElement("selection-explanation").textContent="Select another eligible row to compare it. A larger head margin means more excess head at the requested flow; it does not prove higher efficiency.";
  pumpElement("report-summary").textContent=`${data.customer} — ${result.pump.name}. Required: ${fmt(pumpState.duty.flow)} m³/h at ${fmt(pumpState.duty.head)} m. Available head: ${fmt(result.available)} m. Nominal power: ${fmt(result.pump.power_kw)} kW (fictional).`;
  const body=pumpElement("curve-points");body.replaceChildren();
  result.pump.points.forEach(([q,h]) => {const row=document.createElement("tr");addCell(row,fmt(q),"number");addCell(row,fmt(h),"number");body.appendChild(row);});
  pumpElement("print-pump").disabled=false;pumpElement("download-graph").disabled=false;
  renderPumpTable();renderCurveChart();renderHeadChart();
}

function calculatePump(event) {
  if (event) event.preventDefault();
  try {
    const duty=readDuty();const results=comparePumps(duty.flow,duty.head);
    pumpState={duty,results};selectedPumpId=null;
    pumpElement("pump-error").textContent="";
    pumpElement("total-head").textContent=fmt(duty.head);
    pumpElement("flow-result").textContent=`at ${fmt(duty.flow)} m³/h`;
    const eligible=results.filter(row=>row.eligible);
    pumpElement("pump-status").textContent=`${eligible.length} of ${results.length} fictional models meet the requested duty point.`;
    if (eligible.length) selectPump(eligible[0].pump.id);
    else {
      pumpElement("selected-summary").textContent="No model meets this duty point.";
      pumpElement("selection-explanation").textContent="Check the rejection reasons below, or try a lower head/flow example.";
      pumpElement("report-summary").textContent=`No match at ${fmt(duty.flow)} m³/h and ${fmt(duty.head)} m. All curves below are fictional.`;
      pumpElement("curve-points").replaceChildren();
      pumpElement("print-pump").disabled=false;pumpElement("download-graph").disabled=false;
      renderPumpTable();renderCurveChart();renderHeadChart();
    }
  } catch(error) {invalidatePump();pumpElement("pump-error").textContent=error.message;}
}

function downloadPumpFile(content,type,name) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement("a");link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

validatePumpCatalog(pumpCatalog);
pumpElement("head-mode").addEventListener("change",setHeadMode);
pumpElement("pump-form").addEventListener("submit",calculatePump);
pumpElement("pump-form").querySelectorAll("input").forEach(input=>input.addEventListener("input",invalidatePump));
pumpElement("show-all-curves").addEventListener("change",()=>{if(pumpState) renderCurveChart();});
pumpElement("download-catalog").addEventListener("click",()=>downloadPumpFile(JSON.stringify({synthetic:true,description:"Invented portfolio pump catalog",pumps:pumpCatalog},null,2),"application/json","fictional-pump-catalog.json"));
pumpElement("download-graph").addEventListener("click",()=>{if(pumpState) downloadPumpFile(new XMLSerializer().serializeToString(pumpElement("curve-chart").firstElementChild),"image/svg+xml",`${selectedPumpId || "no-match"}-curve.svg`);});
pumpElement("print-pump").addEventListener("click",()=>{if(pumpState) window.print();});
document.querySelectorAll("[data-preset]").forEach(button=>button.addEventListener("click",()=>{
  const presets={standard:[6,55],"high-flow":[12,35],"high-head":[4,110],"no-match":[20,150]};
  const [flow,head]=presets[button.dataset.preset];
  pumpElement("head-mode").value="direct";setHeadMode();
  pumpElement("flow").value=flow;pumpElement("required-head").value=head;
  calculatePump();
}));
setHeadMode();calculatePump();
