/* New portfolio-only implementation. No private application modules or data. */
"use strict";
const fixtureText = `{
  "schema": "portfolio-demo-v1",
  "synthetic": true,
  "customer": "Sakura Residence Demo Project",
  "project": "Three-sector irrigation example",
  "sectors": ["North lawn", "South lawn", "Garden beds"],
  "materials": [
    {"sector":"North lawn","code":"DEMO-SPRAY","name":"Generic spray head","unit":"each","quantity":6},
    {"sector":"South lawn","code":"DEMO-SPRAY","name":"Generic spray head","unit":"each","quantity":6},
    {"sector":"Garden beds","code":"DEMO-DRIP","name":"Generic dripline","unit":"m","quantity":90},
    {"sector":"North lawn","code":"DEMO-VALVE","name":"Generic irrigation valve","unit":"each","quantity":1},
    {"sector":"South lawn","code":"DEMO-VALVE","name":"Generic irrigation valve","unit":"each","quantity":1},
    {"sector":"Garden beds","code":"DEMO-VALVE","name":"Generic irrigation valve","unit":"each","quantity":1},
    {"sector":"North lawn","code":"DEMO-PIPE","name":"Generic PVC pipe","unit":"m","quantity":60},
    {"sector":"South lawn","code":"DEMO-PIPE","name":"Generic PVC pipe","unit":"m","quantity":75}
  ],
  "duty":{"flow_m3h":6,"lift_m":20,"pressure_head_m":30,"assumed_losses_m":5}
}`;
const data = JSON.parse(fixtureText);
const number = value => Number(value.toFixed(3)).toString();

function groupMaterials(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Add at least one material row.");
  const groups = new Map();
  for (const row of rows) {
    if (typeof row.code !== "string" || !row.code.startsWith("DEMO-") || typeof row.name !== "string" || !row.name.trim()) throw new Error("Each demo material needs an identifier and description.");
    if (!["each", "m"].includes(row.unit)) throw new Error("Use a supported unit: each or m.");
    if (typeof row.quantity !== "number" || !Number.isFinite(row.quantity) || row.quantity <= 0 || row.quantity > 100000) throw new Error("Quantities must be greater than zero and no more than 100,000.");
    if (row.unit === "each" && !Number.isInteger(row.quantity)) throw new Error("Counted items require whole quantities.");
    const key = JSON.stringify([row.code, row.unit]);
    const existing = groups.get(key);
    if (existing && existing.name !== row.name) throw new Error("Conflicting descriptions require review before grouping.");
    if (existing) existing.quantity += row.quantity;
    else groups.set(key, {code: row.code, name: row.name, unit: row.unit, quantity: row.quantity});
  }
  return [...groups.values()];
}

function headRequirement(flow, lift, pressure, losses) {
  if (![flow, lift, pressure, losses].every(value => typeof value === "number" && Number.isFinite(value) && value <= 1000)) throw new Error("Enter finite values no greater than 1,000.");
  if (flow <= 0 || [lift, pressure, losses].some(value => value < 0)) throw new Error("Flow must be positive; head components cannot be negative.");
  const head = lift + pressure + losses;
  if (head <= 0) throw new Error("Total required head must be greater than zero.");
  return head;
}

function showView(id) {
  if (!document.querySelector(`.view#${id}`)) return;
  document.querySelectorAll(".view").forEach(view => { view.hidden = view.id !== id; });
  document.querySelectorAll("nav button").forEach(button => {
    if (button.dataset.view === id) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

function addCell(row, text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  cell.className = className;
  row.appendChild(cell);
  return cell;
}

function renderInput() {
  const body = document.getElementById("input-rows");
  for (const [index, material] of data.materials.entries()) {
    const row = document.createElement("tr");
    addCell(row, material.sector); addCell(row, material.name); addCell(row, material.unit);
    const cell = addCell(row, "", "number");
    const input = document.createElement("input");
    input.type = "number"; input.min = material.unit === "each" ? "1" : "0.001";
    input.max = "100000"; input.step = material.unit === "each" ? "1" : "0.001";
    input.value = material.quantity; input.required = true;
    input.setAttribute("aria-label", `${material.sector}: ${material.name} quantity`);
    input.dataset.index = index;
    cell.appendChild(input); body.appendChild(row);
  }
}

let grouped = groupMaterials(data.materials);
function renderResult() {
  const body = document.getElementById("result-rows"); body.replaceChildren();
  for (const material of grouped) {
    const row = document.createElement("tr");
    addCell(row, material.code); addCell(row, material.name); addCell(row, material.unit); addCell(row, number(material.quantity), "number");
    body.appendChild(row);
  }
  document.getElementById("group-count").textContent = `${grouped.length} material groups`;
}

document.querySelectorAll("[data-view], [data-go]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view || button.dataset.go)));
document.getElementById("process").addEventListener("click", () => {
  const status = document.getElementById("input-status");
  try {
    const fields = [...document.querySelectorAll("#input-rows input")];
    if (fields.some(field => field.value.trim() === "" || !field.checkValidity())) throw new Error("Enter positive quantities; counted items must be whole numbers.");
    const rows = data.materials.map((row, index) => ({...row, quantity: Number(fields[index].value)}));
    grouped = groupMaterials(rows); renderResult();
    status.textContent = "Validation complete. The material result has been updated.";
    document.getElementById("download-csv").disabled = false;
  } catch (failure) { status.textContent = failure.message; }
});
document.querySelector("#input-rows").addEventListener("input", () => {
  document.getElementById("input-status").textContent = "Input changed. Validate and group materials to update the result.";
  document.getElementById("download-csv").disabled = true;
  document.getElementById("group-count").textContent = "Previous result — validate edited input";
});
document.getElementById("download-csv").addEventListener("click", () => {
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [["Demo identifier","Material","Unit","Quantity"], ...grouped.map(row => [row.code,row.name,row.unit,number(row.quantity)])];
  const csv = rows.map(row => row.map(quote).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
  const link = document.createElement("a"); link.href = url; link.download = "synthetic-materials.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
renderInput(); renderResult();
