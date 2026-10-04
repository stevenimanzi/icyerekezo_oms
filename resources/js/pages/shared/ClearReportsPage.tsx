import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Printer } from "lucide-react";
import { LegacyOrderMatrix, OrderDetailsModal } from "../sales/SalesOverviewPage";
import NoguchiDailySheet, { buildDays, sectionsForDepartment } from "./NoguchiDailySheet";

const csrf = () =>
  document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";

async function api(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
  });
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The report service returned an invalid response.");
  }
  if (!response.ok) throw new Error(data.message || "Unable to load the report.");
  return data;
}

function Table({ title, headers, rows }: any) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            {headers.map((header: string) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row: any[], index: number) => (
              <tr key={index}>
                {row.map((cell: any, cellIndex: number) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length}>No work was recorded for this period.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

const number = (value: any) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const quantity = (value: any, unit?: string) =>
  `${number(value)}${unit && unit !== "—" ? ` ${unit}` : ""}`;

const printCategories = [
  "Uniform",
  "Sweater",
  "Sport Uniform",
  "TVET",
  "Tourism",
  "Polo",
  "T-shirt",
  "Rain Coat",
  "Jumper",
];

function getCategoryTotal(order: any, category: string) {
  const aliases: Record<string, string[]> = {
    TVET: ["tvet", "overall", "overcoat", "overall coat"],
    "Sport Uniform": ["sport", "sport uniform"],
    "Rain Coat": ["rain coat", "raincoat"],
    Polo: ["polo", "polo lacoste"],
    "T-shirt": ["t-shirt", "t shirt"],
  };
  const names = aliases[category] || [category.toLowerCase()];
  const lines = (order.lines || []).filter((line: any) =>
    names.includes(String(line.garment_category || "").toLowerCase()),
  );
  return lines.reduce((sum: number, line: any) => sum + Number(line.quantity_ordered || 0), 0);
}

function PrintCategoryCell({ order, category }: any) {
  const total = getCategoryTotal(order, category);
  return <td className="print-category-total">{total ? number(total) : "—"}</td>;
}

function NoguchiPrintOrderTable({ rows }: any) {
  const categoryTotals = printCategories.map((category) =>
    rows.reduce((sum: number, order: any) => sum + getCategoryTotal(order, category), 0)
  );
  
  const grandTotalQty = rows.reduce((sum: number, order: any) => sum + Number(order.item_count || 0), 0);
  const grandTotalAmount = rows.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);

  return (
    <section className="noguchi-print-order-table">
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>School</th>
            {printCategories.map((category) => (
              <th key={category}>{category}</th>
            ))}
            <th>Total Qty</th>
            <th>Total Amount</th>
            <th>Contact</th>
            <th>Comment / Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order: any, index: number) => (
            <tr key={order.id}>
              <td>{index + 1}</td>
              <td>
                <b>{order.school?.name || order.customer_name}</b>
                <small>{order.document_number}</small>
              </td>
              {printCategories.map((category) => (
                <PrintCategoryCell key={category} order={order} category={category} />
              ))}
              <td>
                <b>{number(order.item_count)}</b>
              </td>
              <td>
                {order.currency_code || "RWF"} {number(order.total_amount)}
              </td>
              <td>{order.school?.phone || order.customer_email || "—"}</td>
              <td>
                {readableStatus(order.status)}
                {order.due_date ? <small>Due {reportDate(order.due_date)}</small> : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold' }}>
            <td colSpan={2} style={{ textAlign: 'right' }}>TOTAL</td>
            {categoryTotals.map((total, i) => (
              <td key={i}>{total ? number(total) : "—"}</td>
            ))}
            <td>{grandTotalQty ? number(grandTotalQty) : "—"}</td>
            <td>RWF {grandTotalAmount ? number(grandTotalAmount) : "—"}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function schoolLevelGroup(classLevel: string): "Nursery" | "Primary" | "Secondary" | "Other" {
  const value = String(classLevel || "").trim();
  if (/^nursery/i.test(value)) return "Nursery";
  if (/^p\d/i.test(value)) return "Primary";
  if (/^s\d/i.test(value)) return "Secondary";
  return "Other";
}

function NoguchiSummaryReportTable({ rows, schoolLevelFilter }: any) {
  const summary: Record<string, Record<string, Record<string, number>>> = {};

  rows.forEach((order: any) => {
    const district = order.school?.district || "Unknown District";

    (order.lines || []).forEach((line: any) => {
      const classLevel = String(line.class_level || "").trim();
      if (schoolLevelFilter && schoolLevelGroup(classLevel) !== schoolLevelFilter) return;
      if (!summary[district]) summary[district] = {};
      let level = "Unknown Level";
      if (classLevel.match(/^Nursery/i)) level = "Nursery";
      else if (classLevel.match(/^Primary/i)) level = "Primary";
      else if (classLevel.match(/^Secondary/i)) level = "Secondary";
      else if (classLevel.match(/^TVET/i)) level = "TVET";
      else level = classLevel.split(" ")[0] || "Unknown Level";

      if (!summary[district][level]) summary[district][level] = {};
      
      const aliases: Record<string, string> = {
        "tvet": "TVET", "overall": "TVET", "overcoat": "TVET", "overall coat": "TVET",
        "sport": "Sport Uniform", "sport uniform": "Sport Uniform",
        "rain coat": "Rain Coat", "raincoat": "Rain Coat",
        "polo": "Polo", "polo lacoste": "Polo",
        "t-shirt": "T-shirt", "t shirt": "T-shirt"
      };
      
      const rawCategory = String(line.garment_category || "").toLowerCase();
      const matchedCategory = printCategories.find(c => c.toLowerCase() === rawCategory);
      const category = aliases[rawCategory] || (matchedCategory ?? (line.garment_category || "Other"));
      
      if (!summary[district][level][category]) summary[district][level][category] = 0;
      summary[district][level][category] += Number(line.quantity_ordered || 0);
    });
  });

  const districts = Object.keys(summary).sort();
  let grandTotals: Record<string, number> = {};

  return (
    <section className="panel legacy-order-sheet summary-report-sheet">
      <header>
        <div>
          <h2>School order summary report</h2>
          <p>Aggregated order quantities by district and school level.</p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table legacy-order-table">
          <thead>
            <tr>
              <th>District</th>
              <th>School Level</th>
              {printCategories.map(cat => <th key={cat}>{cat}</th>)}
              <th>Total Items</th>
            </tr>
          </thead>
          <tbody>
          {districts.map(district => {
            const levels = Object.keys(summary[district]).sort();
            const districtTotals: Record<string, number> = {};
            
            return (
              <React.Fragment key={district}>
                {levels.map((level, i) => {
                  let rowTotal = 0;
                  return (
                    <tr key={`${district}-${level}`}>
                      {i === 0 ? <td rowSpan={levels.length + 1}><b>{district}</b></td> : null}
                      <td className="summary-level-cell">{level}</td>
                      {printCategories.map(cat => {
                        const val = summary[district][level][cat] || 0;
                        rowTotal += val;
                        districtTotals[cat] = (districtTotals[cat] || 0) + val;
                        grandTotals[cat] = (grandTotals[cat] || 0) + val;
                        return <td key={cat}>{val > 0 ? number(val) : "—"}</td>;
                      })}
                      <td><b>{rowTotal > 0 ? number(rowTotal) : "—"}</b></td>
                    </tr>
                  );
                })}
                <tr className="district-total-row">
                  <td><b>{district} Total</b></td>
                  {printCategories.map(cat => (
                    <td key={cat}>
                      <b>{districtTotals[cat] > 0 ? number(districtTotals[cat]) : "—"}</b>
                    </td>
                  ))}
                  <td>
                    <b>
                      {(() => {
                        const sum = Object.values(districtTotals).reduce((a, b) => a + b, 0);
                        return sum > 0 ? number(sum) : "—";
                      })()}
                    </b>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
          {districts.length === 0 && (
            <tr><td colSpan={printCategories.length + 3}>No orders found for the selected filters.</td></tr>
          )}
        </tbody>
        {districts.length > 0 && (
          <tfoot>
            <tr style={{ backgroundColor: "#2563eb", color: "white", fontWeight: "bold" }}>
              <td colSpan={2} style={{ color: "white" }}>GRAND TOTAL</td>
              {printCategories.map(cat => (
                <td key={cat} style={{ color: "white" }}>
                  {grandTotals[cat] > 0 ? number(grandTotals[cat]) : "—"}
                </td>
              ))}
              <td style={{ color: "white" }}>
                {(() => {
                  const grandSum = Object.values(grandTotals).reduce((a, b) => a + b, 0);
                  return grandSum > 0 ? number(grandSum) : "—";
                })()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </section>
  );
}

function DailyRegister({ data }: any) {
  const days = data.daily_activity || [];

  const registerHead = (
    <thead>
      <tr>
        <th rowSpan={2} style={{ verticalAlign: "middle" }}>
          DATE
        </th>
        <th colSpan={3} style={{ textAlign: "center", padding: "12px" }}>
          INPUT
        </th>
        <th colSpan={4} style={{ textAlign: "center", padding: "12px" }}>
          OUTPUT
        </th>
      </tr>
      <tr>
        <th>STYLE</th>
        <th>SIZE</th>
        <th>QTY</th>
        <th>COLOR</th>
        <th>STYLE</th>
        <th>SIZE</th>
        <th>QTY</th>
      </tr>
    </thead>
  );

  if (!days.length) {
    return (
      <article className="panel noguchi-cutting-report" style={{ marginBottom: 24 }}>
        <header>
          <div>
            <small>OFFICIAL FACTORY REGISTER</small>
            <h2>{data.factory?.name || "NOGUCHI HOLDINGS LTD"}</h2>
            <p>Daily work register</p>
          </div>
          <div>
            <span>
              REPORT DATE
              <b>{new Date(data.report.generated_at).toLocaleDateString()}</b>
            </span>
            <span>
              PREPARED BY
              <b>{data.report.generated_by}</b>
            </span>
          </div>
        </header>
        <div className="noguchi-cutting-table-wrap" style={{ overflowX: "auto" }}>
          <table>
            {registerHead}
            <tbody>
              <tr>
                <td colSpan={8} className="empty-cell">
                  No work was recorded for this period.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    );
  }

  return (
    <>
      {days.map((day: any) => (
        <article key={day.date} className="panel noguchi-cutting-report" style={{ marginBottom: 24 }}>
          <header>
            <div>
              <small>OFFICIAL FACTORY REGISTER</small>
              <h2>{data.factory?.name || "NOGUCHI HOLDINGS LTD"}</h2>
              <p>Daily work register</p>
            </div>
            <div>
              <span>
                REPORT DATE
                <b>{new Date(`${day.date}T00:00:00`).toLocaleDateString()}</b>
              </span>
              <span>
                PREPARED BY
                <b>{data.report.generated_by}</b>
              </span>
            </div>
          </header>
          <div className="noguchi-cutting-table-wrap" style={{ overflowX: "auto" }}>
            <table>
              {registerHead}
              <tbody>
                {day.departments.map((department: any) =>
                  department.records.map((record: any, index: number) => {
                    const info = splitItem(record.product);
                    const fabricColor = String(record.fabric || record.product || "").match(
                      /\b(green|blue|red|yellow|black|white|navy|grey|gray|brown|orange|purple|pink|beige|cream)\b/i,
                    )?.[1];
                    const color =
                      info.color !== "—" && info.color !== "?" ? info.color : fabricColor || "—";
                    const style = info.style !== record.product ? info.style : "—";

                    return (
                      <tr key={`${department.department_id}-${index}`}>
                        <td>{new Date(`${day.date}T00:00:00`).toLocaleDateString()}</td>
                        <td>{style}</td>
                        <td>{info.size}</td>
                        <td>{record.received > 0 ? <b>{number(record.received)}</b> : "—"}</td>
                        <td>{color}</td>
                        <td>{style}</td>
                        <td>{info.size}</td>
                        <td>{record.completed > 0 ? <b>{number(record.completed)}</b> : "—"}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </>
  );
}

function DepartmentMatrix({ data }: any) {
  const departments = data.department_activity || [];
  const metrics = [
    [data.standard.input_label, (row: any) => quantity(row.received_quantity, row.unit)],
    [data.standard.output_label, (row: any) => quantity(row.completed_quantity, row.unit)],
    ["Damaged / rejected", (row: any) => quantity(row.damaged_quantity, row.unit)],
  ];
  return (
    <Table
      title="Work totals by department"
      headers={["Recorded work", ...departments.map((row: any) => row.name)]}
      rows={metrics.map(([label, value]: any) => [label, ...departments.map((row: any) => value(row))])}
    />
  );
}

const reportDate = (value: string) => String(value || "").slice(0, 10);
const stageArea = (name: string) => {
  const value = String(name || "").toLowerCase();
  if (value.includes("cut")) return "cutting";
  if (["finish", "iron", "press", "quality", "pack"].some((word) => value.includes(word))) return "finishing";
  return "production";
};

function FlowCell({ records, input = false }: any) {
  return (
    <td>
      {records.length ? (
        records.map((record: any, index: number) => (
          <div className="noguchi-report-entry" key={`${record.id}-${index}`}>
            <b>{record.item_name || record.product_name || "Unspecified item"}</b>
            <span>
              {number(
                input
                  ? record.input_quantity ?? Math.abs(record.quantity_delta)
                  : record.output_quantity ?? Math.abs(record.quantity_delta),
              )}{" "}
              {record.unit_symbol || ""}
            </span>
            {record.order_number && <small>Order {record.order_number}</small>}
          </div>
        ))
      ) : (
        <span className="noguchi-report-empty">No activity</span>
      )}
    </td>
  );
}

function NoguchiLogisticsDocument({ data }: any) {
  const inventory = data.inventory || [];
  const production = data.production || [];
  const dates = Array.from(
    new Set(
      [
        ...inventory.map((row: any) => reportDate(row.occurred_at)),
        ...production.map((row: any) => reportDate(row.updated_at)),
      ].filter(Boolean),
    ),
  ).sort();
  const reportDates = dates.length ? dates : [data.report.to];
  const total = (rows: any[], key: string) =>
    rows.reduce((sum: number, row: any) => sum + Math.abs(Number(row[key] || 0)), 0);
  const warehouseIn = inventory.filter((row: any) => Number(row.quantity_delta) > 0);
  const warehouseOut = inventory.filter((row: any) => Number(row.quantity_delta) < 0);
  const stages = (area: string) => production.filter((row: any) => stageArea(row.stage_name) === area);
  const flowTotals = [
    ["Warehouse received", total(warehouseIn, "quantity_delta")],
    ["Warehouse issued", total(warehouseOut, "quantity_delta")],
    ["Cutting output", total(stages("cutting"), "output_quantity")],
    ["Production output", total(stages("production"), "output_quantity")],
    ["Finishing output", total(stages("finishing"), "output_quantity")],
    [
      "Items in stock",
      (data.stock_register || []).reduce((sum: number, row: any) => sum + Number(row.closing_balance || 0), 0),
    ],
  ];
  const onDate = (rows: any[], field: string, date: string) =>
    rows.filter((row: any) => reportDate(row[field]) === date);

  return (
    <article className="report-document report-landscape noguchi-logistics-report">
      <style>{"@media print{@page{size:A4 landscape;margin:7mm}}"}</style>
      <header>
        <div>
          <h1>{data.factory.name}</h1>
          <p>School garment logistics</p>
        </div>
        <div>
          <b>DAILY LOGISTICS REPORT</b>
          <span>
            {data.report.from} to {data.report.to}
          </span>
        </div>
      </header>
      <section className="report-meta">
        <span>Prepared by: {data.report.generated_by}</span>
        <span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span>
        <span>Live warehouse and factory flow</span>
      </section>
      <div className="report-summary">
        {flowTotals.map(([label, value]: any) => (
          <div key={label}>
            <span>{label}</span>
            <b>{number(value)}</b>
          </div>
        ))}
      </div>
      <section className="report-section">
        <h2>Daily movement through factory sections</h2>
        <div className="noguchi-report-scroll">
          <table className="noguchi-flow-table">
            <thead>
              <tr>
                <th rowSpan={2}>Date</th>
                <th colSpan={2}>Warehouse</th>
                <th colSpan={2}>Cutting</th>
                <th colSpan={2}>Production</th>
                <th colSpan={2}>Finishing</th>
                <th rowSpan={2}>Warehouse quantity in stock</th>
              </tr>
              <tr>
                <th>Input</th>
                <th>Output</th>
                <th>Input</th>
                <th>Output</th>
                <th>Input</th>
                <th>Output</th>
                <th>Input</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {reportDates.map((date: string, index: number) => {
                const dayInventory = onDate(inventory, "occurred_at", date);
                const dayProduction = onDate(production, "updated_at", date);
                const area = (name: string) => dayProduction.filter((row: any) => stageArea(row.stage_name) === name);
                return (
                  <tr key={date}>
                    <td>
                      <b>{new Date(`${date}T00:00:00`).toLocaleDateString()}</b>
                    </td>
                    <FlowCell records={dayInventory.filter((row: any) => Number(row.quantity_delta) > 0)} input />
                    <FlowCell records={dayInventory.filter((row: any) => Number(row.quantity_delta) < 0)} />
                    <FlowCell records={area("cutting")} input />
                    <FlowCell records={area("cutting")} />
                    <FlowCell records={area("production")} input />
                    <FlowCell records={area("production")} />
                    <FlowCell records={area("finishing")} input />
                    <FlowCell records={area("finishing")} />
                    <td>
                      {index === reportDates.length - 1 ? (
                        (data.stock_register || []).map((row: any) => (
                          <div className="noguchi-report-entry" key={`${row.sku}-${row.warehouse}`}>
                            <b>{row.item}</b>
                            <span>{number(row.closing_balance)}</span>
                            <small>{row.warehouse}</small>
                          </div>
                        ))
                      ) : (
                        <span className="noguchi-report-empty">See closing day</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <footer>{data.factory.name} · Logistics daily report · Generated by ICYEREKEZO OMS</footer>
    </article>
  );
}

const noguchiFactoryName = (value: any) => String(value || "").trim().toLowerCase().includes("noguchi");
const itemKind = (name: any) =>
  /thread|zip|button|elastic|label|accessor/i.test(String(name || "")) ? "accessory" : "fabric";

const splitItem = (name: any) => {
  const text = String(name || "Unspecified");
  const parts = text
    .split(/\s[-–—|/]\s/)
    .map((value) => value.trim())
    .filter(Boolean);

  let style = parts[0] || text;
  let color = parts[1] || "—";
  let size = parts[2] || "—";

  // Two-part names like "Short - M" mean the second part is a size, not a color.
  if (parts.length === 2 && (color.length <= 4 || !isNaN(Number(color)))) {
    size = color;
    color = "—";
  }

  return { style, color, size };
};

function emptyRegisterMessage(report: any, department?: string) {
  const show = (value?: string) => {
    if (!value) return "";
    const dateStr = `${String(value).slice(0, 10)}T00:00:00`;
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  const range = `${show(report?.from)} – ${show(report?.to)}`;
  const when: Record<string, string> = {
    day: `today (${show(report?.to)})`,
    week: `in the last 7 days (${range})`,
    month: `so far this month (${range})`,
    year: `so far this year (${range})`,
    custom: `between ${show(report?.from)} and ${show(report?.to)}`,
    all: "on any date",
  };
  const subject = department
    ? `${department} entries`
    : "warehouse, cutting, production or finishing entries";
  const period = String(report?.period || "");
  const timeDesc = when[period] || `between ${show(report?.from)} and ${show(report?.to)}`;
  return {
    title: `No ${subject} were recorded ${timeDesc}.`,
    hint: period === "all"
      ? "Entries appear here as soon as stock movements or production steps are recorded."
      : "Choose a longer period, or All dates, to see earlier records.",
  };
}

function NoguchiDailyDocument({ data, departmentId }: any) {
  const department = (data.filters?.departments || []).find(
    (item: any) => String(item.id) === String(departmentId || "")
  );
  const sections = sectionsForDepartment(department?.name);
  const hasRegister = sections.length > 0;
  const days = React.useMemo(() => buildDays(data, department?.name || ""), [data, department?.name]);

  return (
    <article className="noguchi-paper">
      <style>{"@media print{@page{size:A3 landscape;margin:6mm}}"}</style>
      <NoguchiDailySheet
        department={department?.name}
        days={hasRegister ? days : []}
        sections={sections}
        emptyMessage={
          hasRegister
            ? emptyRegisterMessage(data.report, department?.name)
            : {
                title: `${department?.name || "This department"} has no entries in the daily register.`,
                hint: "Only departments that record stock movements or production steps appear in this report.",
              }
        }
      />
    </article>
  );
}

const readableStatus = (value: any) =>
  (
    {
      pending: "Pending",
      accepted: "Accepted",
      rejected: "Rejected",
      partial: "Partially delivered",
      delivered: "Delivered",
      planned: "Planned",
      ready: "Ready to dispatch",
      in_transit: "In transit",
      cancelled: "Cancelled",
      maintenance: "In maintenance",
      available: "Available",
      assigned: "Assigned",
    } as any
  )[value] || String(value || "Not set").replaceAll("_", " ");

const shortOrder = (value: any) => String(value || "").replace(/^LEGACY-NOGUCHI-/i, "");

function LogisticsDocument({ data }: any) {
  const report = data.logistics || {};
  const summary = report.summary || {};
  const orders = report.orders || [];
  const shipments = report.shipments || [];
  const vehicles = report.vehicles || [];

  return (
    <article className="report-document report-landscape logistics-status-report">
      <style>{"@media print{@page{size:A4 landscape;margin:7mm}}"}</style>
      <header>
        <div>
          <h1>{data.factory.name}</h1>
          <p>Logistics and dispatch operations</p>
        </div>
        <div>
          <b>LOGISTICS STATUS REPORT</b>
          <span>
            {data.report.from} to {data.report.to}
          </span>
        </div>
      </header>
      <section className="report-meta">
        <span>Prepared by: {data.report.generated_by}</span>
        <span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span>
        <span>Department: Logistics</span>
      </section>
      <div className="report-summary logistics-report-summary">
        {[
          ["Orders processed", summary.orders_processed],
          ["Items ordered", summary.items_ordered],
          ["Items delivered", summary.items_delivered],
          ["Remaining", summary.items_remaining],
          ["Returned / rejected", summary.items_returned],
          ["Order value", `RWF ${number(summary.total_value)}`],
          ["Shipments", summary.shipments],
          ["Deliveries completed", summary.deliveries_completed],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{typeof value === "number" ? number(value) : value}</b>
          </div>
        ))}
      </div>
      <div className="logistics-report-pair">
        <Table
          title="Order status"
          headers={["Status", "Orders"]}
          rows={(report.order_statuses || []).map((row: any) => [readableStatus(row.status), number(row.count)])}
        />
        <Table
          title="Returned or rejected items"
          headers={["Reason", "Items"]}
          rows={(report.return_reasons || []).map((row: any) => [row.reason, number(row.quantity)])}
        />
      </div>
      <Table
        title="School and customer orders"
        headers={[
          "Date",
          "Order",
          "School / customer",
          "District and sector",
          "Items",
          "Delivered",
          "Remaining",
          "Value",
          "Status",
        ]}
        rows={orders.map((row: any) => {
          const delivered = (row.lines || []).reduce(
            (sum: number, line: any) => sum + Number(line.quantity_delivered || 0),
            0,
          );
          return [
            reportDate(row.document_date),
            shortOrder(row.document_number),
            row.school?.name || row.customer_name,
            [row.school?.district, row.school?.sector].filter(Boolean).join(" / ") || "Not set",
            number(row.item_count),
            number(delivered),
            number(Math.max(0, Number(row.item_count) - delivered)),
            `${row.currency_code || "RWF"} ${number(row.total_amount)}`,
            readableStatus(row.status),
          ];
        })}
      />
      <Table
        title="Shipments and delivery confirmations"
        headers={[
          "Shipment",
          "Order",
          "Customer",
          "Destination",
          "Packages",
          "Vehicle",
          "Driver",
          "Status",
          "Planned",
          "Delivered",
          "Received by",
          "Proof",
        ]}
        rows={shipments.map((row: any) => [
          row.shipment_number,
          shortOrder(row.sales_document?.document_number),
          row.customer_name,
          row.destination,
          number(row.package_count),
          row.vehicle?.registration_number || "Not assigned",
          row.vehicle?.driver_name || "Not assigned",
          readableStatus(row.status),
          row.planned_dispatch_at ? new Date(row.planned_dispatch_at).toLocaleString() : "Not set",
          row.delivered_at ? new Date(row.delivered_at).toLocaleString() : "Not delivered",
          row.received_by || "Not recorded",
          row.proof_reference || "Not recorded",
        ])}
      />
      <Table
        title="Vehicles and drivers"
        headers={["Registration", "Vehicle type", "Driver", "Phone", "Capacity", "Status"]}
        rows={vehicles.map((row: any) => [
          row.registration_number,
          row.vehicle_type,
          row.driver_name || "Not assigned",
          row.driver_phone || "Not set",
          row.capacity ? `${number(row.capacity)} ${row.capacity_unit || ""}` : "Not set",
          readableStatus(row.status),
        ])}
      />
      <Table
        title="Warehouse stock balances"
        headers={["Item", "Code", "Warehouse", "Opening", "Received", "Issued", "Closing"]}
        rows={(data.stock_register || []).map((row: any) => [
          row.item,
          row.sku,
          row.warehouse,
          number(row.opening_balance),
          number(row.quantity_in),
          number(row.quantity_out),
          number(row.closing_balance),
        ])}
      />
      <footer>{data.factory.name} · Logistics and dispatch report · Generated by ICYEREKEZO OMS</footer>
    </article>
  );
}

function Document({ data, departmentId }: any) {
  if (data.report.scope === "logistics") {
    return String(data.factory?.name || "").trim().toLowerCase().includes("noguchi")
      ? null
      : <LogisticsDocument data={data} />;
  }
  if (data.report.scope === "factory" && noguchiFactoryName(data.factory?.name)) {
    return <NoguchiDailyDocument data={data} departmentId={departmentId} />;
  }
  const departmentOnly = data.report.scope === "department";

  return (
    <article className={`report-document report-${data.standard.orientation || "landscape"}`}>
      <style>{
        `@media print {
          @page {
            size: A4 ${data.standard.orientation === "portrait" ? "portrait" : "landscape"};
            margin: 10mm;
          }
        }`
      }</style>
      <header>
        <div>
          <h1>{data.factory.name}</h1>
          <p>{String(data.factory.industry_type).replaceAll("_", " ")}</p>
        </div>
        <div>
          <b>{data.standard.title.toUpperCase()}</b>
          <span>
            {data.report.from} to {data.report.to}
          </span>
        </div>
      </header>
      <section className="report-meta">
        <span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span>
        <span>Prepared by: {data.report.generated_by}</span>
        <span>Scope: {data.report.scope_label}</span>
      </section>
      {data.standard.show_summary && (
        <div className="report-summary">
          <div>
            <span>Total received</span>
            <b>{number(data.summary.quantity_received)}</b>
          </div>
          <div>
            <span>Total completed</span>
            <b>{number(data.summary.quantity_completed)}</b>
          </div>
          <div>
            <span>Damaged / rejected</span>
            <b>{number(data.summary.damaged_quantity)}</b>
          </div>
        </div>
      )}

      {data.standard.show_daily_register && (
        <div className="noguchi-cutting-report">
          <DailyRegister data={data} />
        </div>
      )}

      {!departmentOnly && data.standard.show_stock_register && (
        <Table
          title="Warehouse stock register"
          headers={["Item", "Code", "Warehouse", "Opening balance", "Quantity in", "Quantity out", "Closing balance"]}
          rows={(data.stock_register || []).map((row: any) => [
            row.item,
            row.sku,
            row.warehouse,
            number(row.opening_balance),
            number(row.quantity_in),
            number(row.quantity_out),
            number(row.closing_balance),
          ])}
        />
      )}

      {data.standard.show_guidance && (
        <section className="report-guidance">
          <h2>Information used for this industry</h2>
          <p>
            Record these details on products, batches and orders when they apply:{" "}
            {data.standard.attributes.join(", ")}.
          </p>
          <p>
            Typical units: {data.standard.unit_examples.join(", ")}.{" "}
            The report always shows the unit saved with each product.
          </p>
        </section>
      )}

      <footer>
        {data.factory.name} · {data.standard.footer_text || "Generated by ICYEREKEZO OMS"} ·{" "}
        {new Date(data.report.generated_at).toLocaleDateString()}
      </footer>
    </article>
  );
}

export default function ClearReportsPage({ canExport, productionOnly = false, forcedScope }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const searchParams = new URLSearchParams(window.location.search);
  const initialFilters = {
    period: searchParams.get("period") || "day",
    type: searchParams.get("type") || (productionOnly ? "production" : "all"),
    department_id: searchParams.get("department_id") || "",
    from: searchParams.get("from") || today,
    to: searchParams.get("to") || today,
    status: searchParams.get("status") || "",
    district: searchParams.get("district") || "",
    sector: searchParams.get("sector") || "",
    school_id: searchParams.get("school_id") || "",
    school_level: searchParams.get("school_level") || "",
  };
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [reportPage, setReportPage] = useState(1);
  const [reportTab, setReportTab] = useState<'quantity' | 'summary' | 'daily_sheet'>('quantity');

  const hasInitialPeriod = useRef(searchParams.has("period"));
  const defaultPeriodApplied = useRef(false);
  const periodChosen = useRef(false);
  const emptyFallbackDone = useRef(false);

  const reportScope = data?.report?.scope;
  const logisticsOnly = reportScope === "logistics";
  const warehouseOnly = reportScope === "warehouse";
  const departmentOnly = reportScope === "department";
  const factoryWide = reportScope === "factory";
  const isNoguchi = noguchiFactoryName(data?.factory?.name);
  const noguchiOrdersOnly = isNoguchi && reportTab !== 'daily_sheet';
  const noguchiFactoryWide = factoryWide && isNoguchi;

  const allDepartments: any[] = data?.filters?.departments || [];
  const registerDepartments = noguchiFactoryWide
    ? allDepartments.filter((department) => sectionsForDepartment(department.name).length > 0)
    : allDepartments;
  const reportOrders = data?.logistics?.orders || [];
  const reportPageSize = 10;
  const reportLastPage = Math.max(1, Math.ceil(reportOrders.length / reportPageSize));
  const visibleReportOrders = reportOrders.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize);

  // A department that is not part of the register (e.g. from an old link) falls back to all departments.
  useEffect(() => {
    const isValidDept = registerDepartments.some(
      (dept) => String(dept.id) === String(filters.department_id)
    );
    if (data && noguchiFactoryWide && filters.department_id && !isValidDept) {
      setFilters((current) => ({ ...current, department_id: "" }));
    }
  }, [data, filters.department_id]);

  useEffect(() => {
    setReportPage(1);
  }, [
    filters.period, filters.status, filters.district, filters.sector,
    filters.school_id, filters.from, filters.to,
  ]);

  const changeReportPage = (nextPage: number) => {
    setReportPage(nextPage);
    window.requestAnimationFrame(() =>
      document.querySelector(".legacy-order-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  useEffect(() => {
    let active = true;
    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        // Only include non-empty filters in the URL.
        const activeFilters: Record<string, any> = Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== "" && value !== null && value !== undefined),
        );
        if (forcedScope) {
          activeFilters.scope = forcedScope;
        }
        const params = new URLSearchParams(activeFilters as any);
        // Do not put scope in the URL query to avoid cluttering, but do put the other filters.
        const urlParams = new URLSearchParams(activeFilters as any);
        if (forcedScope) urlParams.delete("scope");
        window.history.replaceState(null, "", `?${urlParams.toString()}`);

        const result = await api(`/api/reports?${params.toString()}`);
        if (active) {
          setData(result);
          setError("");
          setUpdated(new Date());

          const noguchiResult = noguchiFactoryName(result.factory?.name);
          const hasEntries = Boolean(result.inventory?.length || result.production?.length);
          const emptyRegister = result.report?.scope === "factory" && noguchiResult && !hasEntries;
          const emptyOrders = result.report?.scope === "logistics" && noguchiResult
            && !result.logistics?.orders?.length;

          if (!emptyFallbackDone.current && !periodChosen.current && filters.period !== "all"
            && (emptyRegister || emptyOrders)) {
            emptyFallbackDone.current = true;
            setFilters((current) => ({ ...current, period: "all" }));
          }

          // Apply the server's suggested default period only once, and only if the user didn't pick one.
          if (!defaultPeriodApplied.current) {
            defaultPeriodApplied.current = true;
            const suggested = result.standard?.default_period;
            if (!hasInitialPeriod.current && suggested && suggested !== filters.period) {
              setFilters((current) => ({ ...current, period: suggested }));
            }
          }
        }
      } catch (exception: any) {
        if (active) setError(exception.message);
      } finally {
        if (active && !silent) setLoading(false);
      }
    };
    const wait = setTimeout(() => load(), 200);
    return () => {
      active = false;
      clearTimeout(wait);
    };
  }, [
    forcedScope, filters.period, filters.type, filters.department_id,
    filters.from, filters.to, filters.status, filters.district,
    filters.sector, filters.school_id,
  ]);

  return (
    <section className="module-page report-page">
      <div className="no-print">
        <div className="module-hero">
          <div className="module-title">
            <span>
              <FileText />
            </span>
            <div>
              <div className="eyebrow">
                <i />
                FACTORY WORK
              </div>
              <h1>
                {noguchiOrdersOnly
                  ? "School order reports"
                  : noguchiFactoryWide
                    ? "NOGUCHI HOLDINGS LTD daily report"
                    : logisticsOnly
                      ? "Daily logistics report"
                      : warehouseOnly
                        ? "Daily stock report"
                        : departmentOnly
                          ? `${data?.report?.scope_label || "Department"} daily report`
                          : productionOnly
                            ? "Daily production report"
                            : "Daily factory report"}
              </h1>
              <p>
                {noguchiOrdersOnly
                  ? "Review school order quantities, delivery progress, values and statuses by district and sector."
                  : noguchiFactoryWide
                    ? "Warehouse, cutting, production, finishing and closing stock in the official Noguchi daily "
                      + "register format."
                    : logisticsOnly
                      ? "See only goods received, goods issued and warehouse balances handled by logistics."
                      : warehouseOnly
                        ? "Review stock received, issued and current balances across every warehouse you manage."
                        : departmentOnly
                          ? "See only your department input, output, rejected quantity and waste."
                          : "Combined factory report for management, covering every department and warehouse."}
              </p>
            </div>
          </div>
          <div className="workflow-actions report-action-row">
            {isNoguchi && (
              <a
                className="secondary-btn"
                href={
                  reportTab === "summary"
                    ? `/api/reports/summary.xlsx?${new URLSearchParams(filters)}`
                    : reportTab === "daily_sheet"
                      ? `/api/reports/daily.xlsx?${new URLSearchParams(filters)}`
                      : `/api/reports/orders.xlsx?${new URLSearchParams(filters)}`
                }
              >
                Export Excel
              </a>
            )}
            <button className="primary-btn" disabled={!data} onClick={() => window.print()}>
              <Printer size={17} />
              Print filtered report
            </button>
          </div>
        </div>
        {error && <div className="admin-alert error">{error}</div>}
        <div className="panel report-filters">
          <label>
            Report period
            <select
              value={filters.period}
              onChange={(event) => {
                periodChosen.current = true;
                setFilters({ ...filters, period: event.target.value });
              }}
            >
              {isNoguchi && <option value="all">All order dates</option>}
              <option value="day">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">This month</option>
              <option value="year">Yearly</option>
              <option value="custom">Choose dates</option>
            </select>
          </label>
          {factoryWide && (!isNoguchi || reportTab === "daily_sheet") && (
            <label>
              Department
              <select
                value={filters.department_id}
                onChange={(event) => setFilters({ ...filters, department_id: event.target.value })}
              >
                <option value="">All departments</option>
                {registerDepartments.map((department: any) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(logisticsOnly || (isNoguchi && reportTab !== "daily_sheet")) && (
            <>
              <label>
                Order status
                <select
                  value={filters.status}
                  onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                >
                  <option value="">All order statuses</option>
                  <option value="pending">Incoming / pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="processing">In preparation</option>
                  <option value="ready">Ready for delivery</option>
                  <option value="partial">Partially delivered</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label>
                District
                <select
                  value={filters.district}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      district: event.target.value,
                      sector: "",
                      school_id: "",
                    })
                  }
                >
                  <option value="">All districts</option>
                  {(data?.filters?.districts || []).map((district: string) => (
                    <option key={district}>{district}</option>
                  ))}
                </select>
              </label>
              <label>
                Sector
                <select
                  disabled={!filters.district}
                  value={filters.sector}
                  onChange={(event) =>
                    setFilters({ ...filters, sector: event.target.value, school_id: "" })
                  }
                >
                  <option value="">
                    {filters.district ? "All sectors" : "Choose district first"}
                  </option>
                  {(data?.filters?.sectors_by_district?.[filters.district] || []).map(
                    (sector: string) => (
                      <option key={sector}>{sector}</option>
                    )
                  )}
                </select>
              </label>
              <label>
                School
                <select
                  disabled={!filters.sector}
                  value={filters.school_id}
                  onChange={(event) =>
                    setFilters({ ...filters, school_id: event.target.value })
                  }
                >
                  <option value="">
                    {filters.sector ? "All schools" : "Choose sector first"}
                  </option>
                  {(data?.filters?.schools_by_sector?.[filters.sector] || []).map(
                    (school: any) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    )
                  )}
                </select>
              </label>
              {isNoguchi && reportTab === "summary" && (
                <label>
                  School level
                  <select
                    value={filters.school_level}
                    onChange={(event) =>
                      setFilters({ ...filters, school_level: event.target.value })
                    }
                  >
                    <option value="">All levels</option>
                    <option value="Nursery">Nursery</option>
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                  </select>
                </label>
              )}
            </>
          )}
          {filters.period === "custom" && (
            <>
              <label>
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilters({ ...filters, from: event.target.value })}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => setFilters({ ...filters, to: event.target.value })}
                />
              </label>
            </>
          )}
          <div className="live-report-status">
            <i />
            <span>
              {loading ? "Updating…" : updated ? `Live · ${updated.toLocaleTimeString()}` : "Connecting…"}
            </span>
          </div>
        </div>
      </div>
      {noguchiOrdersOnly && data && (
        <>
        <style>{"@media print{@page{size:A4 landscape;margin:0} body{padding:10mm!important}}"}</style>
        <header className="noguchi-print-header">
          <div>
            <b>{data.factory.name}</b>
            <span>ICYEREKEZO OMS · School Garment Logistics</span>
          </div>
          <div>
            <h1>{reportTab === 'summary' ? 'School Order Summary Report' : 'School Order Quantity Report'}</h1>
            <p>
              {data.report.from} to {data.report.to}
            </p>
          </div>
          <section>
            <span>
              <strong>Status:</strong> {filters.status || "All order statuses"}
            </span>
            <span>
              <strong>District:</strong> {filters.district || "All districts"}
            </span>
            <span>
              <strong>Sector:</strong> {filters.sector || "All sectors"}
            </span>
            <span>
              <strong>School:</strong>{" "}
              {(data?.filters?.schools_by_sector?.[filters.sector] || []).find(
                (s: any) => String(s.id) === String(filters.school_id)
              )?.name || "All schools"}
            </span>
            <span>
              <strong>Generated:</strong> {new Date(data.report.generated_at).toLocaleString()}
            </span>
          </section>
        </header>
        </>
      )}
      {isNoguchi && data && (
        <div
          className="no-print"
          style={{
            marginBottom: "24px",
            display: "flex",
            gap: "12px",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "16px",
          }}
        >
          <button
            className={reportTab === "quantity" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportTab("quantity")}
          >
            Quantity sheet
          </button>
          <button
            className={reportTab === "summary" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportTab("summary")}
          >
            Summary report
          </button>
          <button
            className={reportTab === "daily_sheet" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportTab("daily_sheet")}
          >
            Daily register sheet
          </button>
        </div>
      )}
      <div className={isNoguchi && reportTab !== "quantity" ? "hidden" : ""}>
        {isNoguchi && data && <NoguchiPrintOrderTable rows={reportOrders} />}
        {isNoguchi && data && (
          <LegacyOrderMatrix rows={visibleReportOrders} open={setSelectedOrder} />
        )}
        {isNoguchi && reportLastPage > 1 && (
          <nav className="school-pagination no-print" aria-label="School order report pages">
            <button
              className="secondary-btn"
              disabled={reportPage <= 1}
              onClick={() => changeReportPage(reportPage - 1)}
            >
              Previous
            </button>
            <span>
              Page {reportPage} of {reportLastPage} · {reportOrders.length.toLocaleString()} orders
            </span>
            <button
              className="secondary-btn"
              disabled={reportPage >= reportLastPage}
              onClick={() => changeReportPage(reportPage + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
      <div className={isNoguchi && reportTab !== "summary" ? "hidden" : ""}>
        {isNoguchi && data && (
          <NoguchiSummaryReportTable
            rows={reportOrders}
            schoolLevelFilter={filters.school_level}
          />
        )}
      </div>
      <div className={isNoguchi && reportTab !== "daily_sheet" ? "hidden" : ""}>
        {isNoguchi && data && (
          <NoguchiDailyDocument
            data={data}
            departmentId={filters.department_id}
          />
        )}
      </div>
      {isNoguchi && data && (
        <footer className="noguchi-print-footer">
          <span>{data.factory.name} · Operational report</span>
          <span>Powered by ICYEREKEZO OMS</span>
        </footer>
      )}
      {!isNoguchi && data && <Document data={data} departmentId={data.report?.department_id ?? ""} />}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          editable={false}
          busy={null}
          run={async () => false}
          close={() => setSelectedOrder(null)}
        />
      )}
    </section>
  );
}
