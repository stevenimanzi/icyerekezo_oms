import React from "react";

/**
 * The Noguchi daily register: one block of rows per date, with the sections
 * Warehouse -> Cutting -> Production -> Finishing -> Warehouse stock side by side.
 * Every entry sits on its own row and the date cell spans the block, as in the
 * factory's Excel daily report.
 */

type Row = string[];

const fmt = (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const dash = "";

const localDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const clean = (part: string) => part.replace(/^[-–—|/\s]+|[-–—|/\s]+$/g, "");

/** "Short - - M" -> style Short, size M. "Skirt - Navy Blue - XS" -> all three. */
const parseProduct = (name: any, fallbackColor = "") => {
  const parts = String(name || "")
    .split(/\s+[-–—|/]\s+/)
    .map(clean)
    .filter(Boolean);
  let style = parts[0] || "";
  let color = "";
  let size = "";
  if (parts.length === 2) {
    if (parts[1].length <= 4 || !Number.isNaN(Number(parts[1]))) size = parts[1];
    else color = parts[1];
  } else if (parts.length >= 3) {
    color = parts[1];
    size = parts[2];
  }
  return { style, color: color || fallbackColor, size };
};

const isAccessory = (name: any) => /thread|zip|button|elastic|label|accessor|sharpener/i.test(String(name || ""));

const stageArea = (name: string) => {
  const value = String(name || "").toLowerCase();
  if (value.includes("cut")) return "cutting";
  if (["finish", "iron", "press", "quality", "pack"].some((word) => value.includes(word))) return "finishing";
  return "production";
};

const departmentTag = /^\s*\[(cut|cutting|sewing|finishing|packing)/i;
const departmentWarehouse = /cutting|sewing|finishing|packing/i;

/** "Buttons - Black" -> "Buttons Black" (accessories keep their whole name, as in "thread sky blue"). */
const accessoryName = (itemName: any) => String(itemName || "").replace(/\s+[-–—]\s+/g, " ").trim();

const colorOf = (itemName: any) => {
  const parsed = parseProduct(itemName);
  return parsed.color || String(itemName || "");
};

// "240x Trousers / Green (XL) produced" or "400x Short (M) produced" -> quantity, style, [colour], size
const CUT_OUTPUT = /(\d[\d,.]*)\s*x\s*(.+?)(?:\s*\/\s*(.+?))?\s*\(([^)]+)\)\s*produced/i;

/** Entries that were cancelled by a reversal, and the reversal entries themselves, never belong in the register. */
function withoutReversals(rows: any[]) {
  const cancelled = new Set<number>();
  rows.forEach((row) => {
    if (row.reverses_transaction_id) cancelled.add(Number(row.reverses_transaction_id));
    const match = String(row.reason || "").match(/^REVERSAL of transaction\s+(\d+)/i);
    if (match) cancelled.add(Number(match[1]));
  });
  return rows.filter((row) => !cancelled.has(Number(row.id)) && !row.reverses_transaction_id && !/^REVERSAL of transaction/i.test(String(row.reason || "")));
}

/**
 * @param department  the department chosen in the filter (name), used to keep only that department's own warehouse entries
 */
export function buildDays(data: any, department = "") {
  const inventory: any[] = withoutReversals(data.inventory || []);
  const production: any[] = data.production || [];
  const stock: any[] = data.stock_register || [];

  const ownDepartment = (row: any) => !department || !row.performer_department || row.performer_department === department;
  const warehouse = inventory.filter(
    (row) =>
      ownDepartment(row) &&
      Number(row.quantity_delta) !== 0 &&
      row.type !== "production_output" &&
      !departmentTag.test(String(row.reason || "")) &&
      !departmentWarehouse.test(String(row.warehouse_name || "")),
  );
  const cuttingLedger = inventory.filter(
    (row) => /\[cut output\]/i.test(String(row.reason || "")) && row.type === "issue" && Number(row.quantity_delta) < 0,
  );

  const dates = Array.from(
    new Set(
      [
        ...warehouse.map((row) => localDate(row.occurred_at)),
        ...cuttingLedger.map((row) => localDate(row.occurred_at)),
        ...production.map((row) => localDate(row.updated_at)),
      ].filter(Boolean),
    ),
  ).sort();
  const days = dates;
  const lastDay = days[days.length - 1];

  const closingStock: Row[] = stock
    .filter((row) => Number(row.closing_balance) > 0 && !departmentWarehouse.test(String(row.warehouse || "")))
    .map((row) => (isAccessory(row.item)
      ? ["", accessoryName(row.item), "", fmt(row.closing_balance)]
      : [colorOf(row.item), "", "", fmt(row.closing_balance)]));

  return days.map((date) => {
    const dayInventory = warehouse.filter((row) => localDate(row.occurred_at) === date);
    const dayProduction = production.filter((row) => localDate(row.updated_at) === date);
    const movement = (direction: "in" | "out", accessory: boolean): Row[] =>
      dayInventory
        .filter((row) => (direction === "in" ? Number(row.quantity_delta) > 0 : Number(row.quantity_delta) < 0))
        .filter((row) => isAccessory(row.item_name) === accessory)
        .map((row) => [accessory ? accessoryName(row.item_name) : colorOf(row.item_name), fmt(Math.abs(Number(row.quantity_delta)))]);

    const cutting: Row[] = [
      ...cuttingLedger
        .filter((row) => localDate(row.occurred_at) === date)
        .map((row) => {
          const match = String(row.reason).match(CUT_OUTPUT);
          return match
            ? [(match[3] || colorOf(row.item_name)).trim(), fmt(Math.abs(Number(row.quantity_delta))), match[2].trim(), match[4].trim(), fmt(match[1].replace(/,/g, ""))]
            : [colorOf(row.item_name), fmt(Math.abs(Number(row.quantity_delta))), dash, dash, dash];
        }),
      ...dayProduction
        .filter((row) => stageArea(row.stage_name) === "cutting")
        .map((row) => {
          const parsed = parseProduct(row.product_name, colorOf(row.fabric_name));
          return [parsed.color, fmt(row.input_quantity), parsed.style, parsed.size, fmt(row.output_quantity)];
        }),
    ];

    const stage = (area: string, field: "input_quantity" | "output_quantity"): Row[] =>
      dayProduction
        .filter((row) => stageArea(row.stage_name) === area && Number(row[field]) > 0)
        .map((row) => {
          const parsed = parseProduct(row.product_name, colorOf(row.fabric_name));
          return [parsed.color, parsed.style, parsed.size, fmt(row[field])];
        });

    const sizeRank = (value: string) => {
      const known = ["4XS", "3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"].indexOf(String(value).toUpperCase());
      return known === -1 ? 99 : known;
    };
    const arrange = (rows: Row[], color: number, style: number, size: number): Row[] =>
      [...rows].sort((x, y) => x[color].localeCompare(y[color]) || x[style].localeCompare(y[style]) || sizeRank(x[size]) - sizeRank(y[size]));

    return {
      date,
      groups: [
        movement("in", false), movement("in", true), movement("out", false), movement("out", true),
        arrange(cutting, 0, 2, 3),
        arrange(stage("production", "input_quantity"), 0, 1, 2), arrange(stage("production", "output_quantity"), 0, 1, 2),
        arrange(stage("finishing", "input_quantity"), 0, 1, 2), arrange(stage("finishing", "output_quantity"), 0, 1, 2),
        date === lastDay ? arrange(closingStock, 0, 1, 2) : [],
      ] as Row[][],
    };
  });
}

type SectionKey = "wh" | "cut" | "prod" | "fin" | "stock";
type Head = { label: string; span?: number; rows?: number };

type SectionSpec = {
  key: SectionKey;
  title: string;
  fill: string;
  size: number; // heading font size (pt), as in the Excel sheet
  groups: number[]; // indexes into GROUP_COLUMNS
  row5: Head[];
  row6: Head[];
  row7: string[];
};

// Columns of each entry group: alignment, width (px, from the Excel column widths) and which columns merge vertically.
const GROUP_COLUMNS: { kind: ("center" | "cnum" | "size" | "num")[]; widths: number[]; merge: number[] }[] = [
  { kind: ["center", "cnum"], widths: [80, 64], merge: [] }, // warehouse in: fabric (COLOR, METER)
  { kind: ["cnum", "cnum"], widths: [136, 62], merge: [] }, // warehouse in: accessories (COLOR, QTY)
  { kind: ["center", "cnum"], widths: [73, 59], merge: [] }, // warehouse out: fabric
  { kind: ["cnum", "cnum"], widths: [82, 55], merge: [] }, // warehouse out: accessories
  { kind: ["center", "center", "center", "size", "num"], widths: [80, 67, 64, 46, 53], merge: [0, 2] }, // cutting
  { kind: ["center", "center", "size", "num"], widths: [77, 60, 54, 50], merge: [0, 1] }, // production in
  { kind: ["center", "center", "size", "num"], widths: [85, 60, 54, 56], merge: [0, 1] }, // production out
  { kind: ["center", "center", "size", "num"], widths: [76, 60, 46, 64], merge: [0, 1] }, // finishing in
  { kind: ["center", "center", "size", "num"], widths: [59, 60, 46, 47], merge: [0, 1] }, // finishing out
  { kind: ["center", "center", "size", "num"], widths: [80, 60, 48, 47], merge: [0, 1] }, // warehouse stock
];

const SECTIONS: SectionSpec[] = [
  {
    key: "wh", title: "WAREHOUSE", fill: "#2E75B5", size: 14, groups: [0, 1, 2, 3],
    row5: [{ label: "INPUT", span: 4 }, { label: "OUTPUT", span: 4 }],
    row6: [{ label: "FABRIC", span: 2 }, { label: "ACCESSORIES", span: 2 }, { label: "FABRIC", span: 2 }, { label: "ACCESSORIES", span: 2 }],
    row7: ["COLOR", "METER", "COLOR", "QTY", "COLOR", "METER", "COLOR", "QTY"],
  },
  {
    key: "cut", title: "CUTTING", fill: "#92D050", size: 14, groups: [4],
    row5: [{ label: "INPUT", span: 2 }, { label: "OUTPUT", span: 3 }],
    row6: [{ label: "FABRIC", span: 2 }, { label: "STYLE", rows: 2 }, { label: "SIZE", rows: 2 }, { label: "QTY", rows: 2 }],
    row7: ["COLOR", "METERS"],
  },
  {
    key: "prod", title: "PRODUCTION", fill: "#C55A11", size: 14, groups: [5, 6],
    row5: [{ label: "INPUT", span: 4 }, { label: "OUTPUT", span: 4 }],
    row6: [{ label: "STYLE", span: 2 }, { label: "SIZE", rows: 2 }, { label: "QTY", rows: 2 }, { label: "STYLE", span: 2 }, { label: "SIZE", rows: 2 }, { label: "QTY", rows: 2 }],
    row7: ["COLOR", "STYLE", "COLOR", "STYLE"],
  },
  {
    key: "fin", title: "FINISHING", fill: "#8F3EC4", size: 14, groups: [7, 8],
    row5: [{ label: "INPUT", span: 4 }, { label: "OUTPUT", span: 4 }],
    row6: [{ label: "STYLE", span: 2 }, { label: "SIZE", rows: 2 }, { label: "QTY", rows: 2 }, { label: "STYLE", span: 2 }, { label: "SIZE", rows: 2 }, { label: "QTY", rows: 2 }],
    row7: ["COLOR", "STYLE", "COLOR", "STYLE"],
  },
  {
    key: "stock", title: "WAREHOUSE", fill: "#0070C0", size: 14, groups: [9],
    row5: [{ label: "QTY IN STOCK", span: 4 }],
    row6: [{ label: "STYLE", span: 2 }, { label: "SIZE", rows: 2 }, { label: "QTY", rows: 2 }],
    row7: ["COLOR", "STYLE"],
  },
];
export const ALL_SECTIONS: SectionKey[] = ["wh", "cut", "prod", "fin", "stock"];

/** Which register sections belong to the chosen department (empty = whole factory). */
export function sectionsForDepartment(name: string | undefined): SectionKey[] {
  const value = String(name || "").trim().toLowerCase();
  if (!value) return ALL_SECTIONS;
  if (/raw|warehouse|store/.test(value)) return ["wh", "stock"];
  if (/cut/.test(value)) return ["cut"];
  if (/sew|produc/.test(value)) return ["prod"];
  if (/finish|packag|packing/.test(value)) return ["fin"];
  return [];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Excel's d-mmm-yy, e.g. 21-Jul-25. */
const sheetDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day}-${MONTHS[month - 1]}-${String(year).slice(-2)}`;
};

/**
 * For one group of entries over `height` rows, work out which cells start a vertically merged block and how
 * many rows it covers. Equal consecutive colours / styles merge like the Excel sheet, and the last block
 * stretches to the bottom of the day so every column lines up.
 */
function spans(rows: Row[], columns: number, mergeColumns: number[], height: number): number[][] {
  const result: number[][] = Array.from({ length: columns }, () => Array(height).fill(0));
  for (let column = 0; column < columns; column++) {
    if (!rows.length) {
      result[column][0] = height;
      continue;
    }
    let start = 0;
    for (let line = 1; line <= rows.length; line++) {
      const previous = rows[line - 1];
      const current = rows[line];
      const sameBlock =
        current !== undefined &&
        mergeColumns.includes(column) &&
        mergeColumns.filter((m) => m <= column).every((m) => current[m] === previous[m]);
      if (!sameBlock) {
        result[column][start] = line - start;
        start = line;
      }
    }
    if (height > rows.length) {
      const lastStart = result[column].map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0).pop() as number;
      result[column][lastStart] += height - rows.length;
    }
  }
  return result;
}

function EmptyNote({ message }: { message: string | { title: string; hint?: string } }) {
  const note = typeof message === "string" ? { title: message } : message;
  return (
    <>
      <b>{note.title}</b>
      {note.hint ? <span>{note.hint}</span> : null}
    </>
  );
}

export default function NoguchiDailySheet({
  days: allDays,
  sections,
  emptyMessage,
  department,
}: {
  days: ReturnType<typeof buildDays>;
  sections: SectionKey[];
  emptyMessage: string | { title: string; hint?: string };
  department?: string;
}) {
  const visible = SECTIONS.filter((section) => sections.includes(section.key));
  // The register's Production columns hold sewing work and its Finishing columns hold packing work, so name the
  // section after the department that was chosen.
  const titleOf = (section: SectionSpec) => {
    if (section.key === "prod" && /sew/i.test(department || "")) return "SEWING";
    if (section.key === "fin" && /packag|packing/i.test(department || "")) return "PACKAGING";
    return section.title;
  };
  // Only dates that have something in the chosen sections.
  const withData = allDays.filter((day) => visible.some((section) => section.groups.some((group) => day.groups[group].length)));
  const isEmpty = !withData.length;
  // With nothing to show, still print the sheet (headings and one blank block) so the format is always visible.
  const days = isEmpty ? [{ date: "", groups: Array.from({ length: GROUP_COLUMNS.length }, () => [] as Row[]) }] : withData;

  const sectionWidth = (section: SectionSpec) => section.groups.reduce((n, g) => n + GROUP_COLUMNS[g].kind.length, 0);
  // date column + (spacer + section) for each visible section
  const totalColumns = 1 + visible.reduce((n, section) => n + 1 + sectionWidth(section), 0);

  // A department that has no part in the register: just the report title and a message, no invented sections.
  if (!visible.length) {
    return (
      <div className="noguchi-sheet-wrap">
        <table className="noguchi-sheet">
          <thead>
            <tr className="sheet-subtitle"><th>&nbsp;DAILY REPORT{department ? ` – ${department}` : ""}</th></tr>
          </thead>
          <tbody>
            <tr><td className="sheet-message"><EmptyNote message={emptyMessage} /></td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="noguchi-sheet-wrap">
      <table className="noguchi-sheet">
        <colgroup>
          <col style={{ width: 96 }} />
          {visible.flatMap((section) => [
            <col key={`${section.key}-gap`} style={{ width: 28 }} />,
            ...section.groups.flatMap((group) => GROUP_COLUMNS[group].widths.map((width, i) => <col key={`${group}-${i}`} style={{ width }} />)),
          ])}
        </colgroup>
        <thead>
          <tr className="sheet-subtitle">
            <th colSpan={totalColumns}>&nbsp;DAILY REPORT{department ? ` – ${department}` : ""}</th>
          </tr>
          <tr className="r4">
            <th className="sheet-sections">SECTIONS</th>
            {visible.flatMap((section) => [
              <th key={`${section.key}-gap`} rowSpan={4} className="sheet-gap" />,
              <th key={section.key} colSpan={sectionWidth(section)} style={{ background: section.fill, fontSize: `${section.size}pt` }}>
                {titleOf(section)}
              </th>,
            ])}
          </tr>
          <tr className="r5">
            <th rowSpan={3} className="sheet-datehead">DATE</th>
            {visible.flatMap((section) => section.row5.map((cell, i) => <th key={`${section.key}-${i}`} colSpan={cell.span}>{cell.label}</th>))}
          </tr>
          <tr className="r6">
            {visible.flatMap((section) =>
              section.row6.map((cell, i) => (
                <th key={`${section.key}-${i}`} colSpan={cell.span} rowSpan={cell.rows}>{cell.label}</th>
              )),
            )}
          </tr>
          <tr className="r7">
            {visible.flatMap((section) => section.row7.map((label, i) => <th key={`${section.key}-${i}`}>{label}</th>))}
          </tr>
        </thead>
        {days.map((day) => {
          const height = Math.max(1, ...visible.flatMap((section) => section.groups.map((g) => day.groups[g].length)));
          const layout = new Map<number, number[][]>();
          visible.forEach((section) =>
            section.groups.forEach((group) =>
              layout.set(group, spans(day.groups[group], GROUP_COLUMNS[group].kind.length, GROUP_COLUMNS[group].merge, height)),
            ),
          );
          return (
            <tbody key={day.date || "empty"} className="sheet-day">
              {Array.from({ length: height }, (_, line) => (
                <tr key={line}>
                  {line === 0 && <td rowSpan={height} className="sheet-date">{day.date ? sheetDate(day.date) : ""}</td>}
                  {visible.flatMap((section) => [
                    <td key={`${section.key}-gap`} className="sheet-gap" />,
                    ...section.groups.flatMap((group) =>
                      GROUP_COLUMNS[group].kind.map((type, column) => {
                        const span = layout.get(group)![column][line];
                        if (!span) return null;
                        return (
                          <td key={`${group}-${column}`} rowSpan={span > 1 ? span : undefined} className={`c-${type}`}>
                            {day.groups[group][line]?.[column] ?? ""}
                          </td>
                        );
                      }),
                    ),
                  ])}
                </tr>
              ))}
              <tr className="sheet-blank">
                <td className="sheet-date" />
                {visible.flatMap((section) => [
                  <td key={`${section.key}-gap`} className="sheet-gap" />,
                  ...Array.from({ length: sectionWidth(section) }, (_, i) => <td key={`${section.key}-b${i}`} />),
                ])}
              </tr>
              {isEmpty && (
                <tr>
                  <td colSpan={totalColumns} className="sheet-message" style={{ borderBottom: "none" }}>
                    <EmptyNote message={emptyMessage} />
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
      
    </div>
  );
}

const sumColumn = (days: ReturnType<typeof buildDays>, group: number, column: number) =>
  days.reduce(
    (total, day) => total + day.groups[group].reduce((inner, row) => inner + (Number(String(row[column]).replace(/,/g, "")) || 0), 0),
    0,
  );

/** Totals that match exactly what the sheet shows. */
export function summarize(days: ReturnType<typeof buildDays>, sections: SectionKey[]) {
  const tiles: [string, number][] = [];
  if (sections.includes("wh")) tiles.push(["Received (fabric m)", sumColumn(days, 0, 1)], ["Issued (fabric m)", sumColumn(days, 2, 1)]);
  if (sections.includes("cut")) tiles.push(["Garments cut", sumColumn(days, 4, 4)]);
  if (sections.includes("prod")) tiles.push(["Sewing completed", sumColumn(days, 6, 3)]);
  if (sections.includes("fin")) tiles.push(["Finishing completed", sumColumn(days, 8, 3)]);
  return tiles;
}
