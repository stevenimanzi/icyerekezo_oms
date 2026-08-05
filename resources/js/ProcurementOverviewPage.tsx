import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Edit3, Plus, RefreshCw, X } from "lucide-react";

const PackagePlus = Plus;
const ArrowDownToLine = Plus;
const Boxes = Plus;

const csrf = () =>
  document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ||
  "";
async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": csrf(),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Purchasing data could not be read. Please sign in again.");
  }
  if (!response.ok) {
    const first = data.errors ? Object.values(data.errors).flat()[0] : null;
    const error: any = new Error(
      String(first || data.message || "The request could not be completed."),
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
const money = (value: any, currency = "RWF") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "RWF" ? 0 : 2,
  }).format(Number(value || 0));
const typeForTab: Record<string, string> = {
  requests: "purchase_request",
  orders: "purchase_order",
};
const titles: Record<string, string> = {
  requests: "Purchase requests",
  prices: "Supplier prices",
  orders: "Purchase orders",
  receipts: "Received goods",
};
const emptyItem = {
  id: 0,
  name: "",
  sku: "",
  type: "raw_material",
  unit_id: "",
  standard_cost: "0",
  reorder_level: "0",
};
const emptyMovement = {
  item_id: "",
  warehouse_id: "",
  type: "receipt",
  quantity: "",
  unit_cost: "",
  reason: "",
};

export default function ProcurementOverviewPage() {
  const [data, setData] = useState<any>(null),
    [tools, setTools] = useState<any>(null),
    [tab, setTab] = useState("requests"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [updated, setUpdated] = useState<Date | null>(null),
    [modal, setModal] = useState<"item" | "movement" | null>(null),
    [busy, setBusy] = useState(false);
  const [itemForm, setItemForm] = useState<any>(emptyItem),
    [movement, setMovement] = useState<any>(emptyMovement);
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await request("/api/procurement/overview"));
      setUpdated(new Date());
      setError("");
    } catch (reason: any) {
      if (!silent) setError(reason.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  const loadTools = async () => {
    try {
      setTools(await request("/api/inventory/tools"));
    } catch (reason: any) {
      if (reason.status !== 403) setError(reason.message);
    }
  };
  useEffect(() => {
    load();
    loadTools();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const codeInput = document.querySelector<HTMLInputElement>(
      ".warehouse-form label:nth-child(2) input",
    );
    if (modal === "item" && codeInput) {
      codeInput.disabled = true;
      codeInput.placeholder = itemForm.id
        ? itemForm.sku
        : "Generated automatically";
    }
  }, [modal, itemForm.id, itemForm.sku]);
  const summary = data?.summary || {},
    rows = useMemo(
      () =>
        (data?.documents?.data || []).filter(
          (item: any) => item.document_type === typeForTab[tab],
        ),
      [data, tab],
    ),
    canManage = Boolean(tools);
  const notify = (message: string) => {
    setSuccess(message);
    setError("");
    window.setTimeout(() => setSuccess(""), 3500);
  };
  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const url = itemForm.id
        ? `/api/inventory/items/${itemForm.id}`
        : "/api/inventory/items";
      await request(url, {
        method: itemForm.id ? "PATCH" : "POST",
        body: JSON.stringify(itemForm),
      });
      notify(
        itemForm.id
          ? "Stock item updated successfully."
          : "Stock item created successfully.",
      );
      setModal(null);
      setItemForm(emptyItem);
      await loadTools();
      await load();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  const saveMovement = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request("/api/inventory/transactions", {
        method: "POST",
        body: JSON.stringify(movement),
      });
      notify("Stock movement recorded successfully.");
      setModal(null);
      setMovement(emptyMovement);
      setTab(
        movement.type === "receipt" ||
          movement.type === "production_output" ||
          movement.type === "return_in" ||
          movement.type === "adjustment_in"
          ? "receipts"
          : tab,
      );
      await loadTools();
      await load();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  const editItem = (id: string) => {
    const item = tools.items.find((entry: any) => String(entry.id) === id);
    if (item) {
      setItemForm({
        ...item,
        unit_id: String(item.unit_id),
        standard_cost: String(item.standard_cost || 0),
        reorder_level: String(item.reorder_level || 0),
      });
      setModal("item");
    }
  };
  return (
    <section className="module-page procurement-live-page">
      <div className="module-hero">
        <div className="module-title">
          <div>
            <div className="eyebrow">
              <i></i>LIVE PURCHASING DATA
            </div>
            <h1>Purchasing and stock receipts</h1>
            <p>
              {canManage
                ? "Record materials received and manage the factory stock catalogue."
                : "Monitor purchase requests, supplier prices, purchase orders and received goods."}
            </p>
            <small className="sales-updated">
              {updated
                ? "Last updated " +
                  updated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Connecting to purchasing records…"}
            </small>
          </div>
        </div>
        <div className="warehouse-toolbar">
          {canManage && (
            <>
              <button
                className="secondary-btn"
                onClick={() => {
                  setItemForm(emptyItem);
                  setModal("item");
                }}
              >
                <PackagePlus />
                Add stock item
              </button>
              <button
                className="primary-btn"
                onClick={() => setModal("movement")}
              >
                <ArrowDownToLine />
                Record stock movement
              </button>
            </>
          )}
          <button
            className="secondary-btn"
            disabled={loading}
            onClick={() => load()}
          >
            <RefreshCw className={loading ? "spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {error && (
        <div className="admin-alert error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {success && <div className="admin-alert success">{success}</div>}
      {canManage && tools.items.length > 0 && (
        <div className="warehouse-edit-strip">
          <Edit3 />
          <span>
            <b>Edit an existing stock item</b>
            <small>
              Only catalogue details can be edited. Recorded ledger entries
              never change.
            </small>
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              editItem(e.target.value);
              e.currentTarget.value = "";
            }}
          >
            <option value="" disabled>
              Choose an item to edit
            </option>
            {tools.items.map((item: any) => (
              <option value={item.id} key={item.id}>
                {item.name} ({item.sku})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sales-metrics">
        <Metric label="Pending requests" value={summary.pending_requests} />
        <Metric label="Open purchase orders" value={summary.open_orders} />
        <Metric label="Ordered value" value={money(summary.ordered_value)} />
        <Metric label="Active suppliers" value={summary.active_suppliers} />
      </div>
      <div className="module-tabs sales-tabs">
        {[
          ["requests", "Purchase requests", summary.requests],
          ["prices", "Supplier prices", summary.suppliers],
          ["orders", "Purchase orders", summary.purchase_orders],
          ["receipts", "Received goods", summary.receipts],
        ].map(([key, label, count]: any) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
            <span>{Number(count || 0).toLocaleString()}</span>
          </button>
        ))}
      </div>
      {tab === "prices" ? (
        <PriceTable suppliers={data?.supplier_prices || []} />
      ) : tab === "receipts" ? (
        <ReceiptTable rows={data?.stock_receipts || []} />
      ) : (
        <DocumentTable rows={rows} tab={tab} />
      )}
      {modal && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="panel warehouse-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h2>
                  {modal === "item"
                    ? itemForm.id
                      ? "Edit stock item"
                      : "Add stock item"
                    : "Record stock movement"}
                </h2>
                <p>
                  {modal === "item"
                    ? "Create or update a material kept in this factory."
                    : "Every receipt, issue or correction creates a permanent audit record."}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModal(null)}>
                <X />
              </button>
            </header>
            {modal === "item" ? (
              <form className="warehouse-form" onSubmit={saveItem}>
                <Field label="Item name">
                  <input
                    value={itemForm.name}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, name: e.target.value })
                    }
                    placeholder="Example: Cotton fabric"
                    required
                  />
                </Field>
                <Field label="Stock code">
                  <input
                    value={itemForm.sku}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        sku: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Example: RAW-COT-001"
                    required
                  />
                </Field>
                <Field label="Item type">
                  <select
                    value={itemForm.type}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, type: e.target.value })
                    }
                  >
                    {[
                      ["raw_material", "Raw material"],
                      ["semi_finished", "Work in progress"],
                      ["finished_good", "Finished good"],
                      ["packaging", "Packaging"],
                      ["spare_part", "Spare part"],
                      ["waste", "Waste"],
                      ["by_product", "By-product"],
                    ].map(([v, l]) => (
                      <option value={v} key={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit">
                  <select
                    value={itemForm.unit_id}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, unit_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Choose unit</option>
                    {tools.units.map((unit: any) => (
                      <option value={unit.id} key={unit.id}>
                        {unit.name} ({unit.symbol})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cost per unit">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.standard_cost}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        standard_cost: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Low-stock warning level">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={itemForm.reorder_level}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        reorder_level: e.target.value,
                      })
                    }
                  />
                </Field>
                <button className="primary-btn" disabled={busy}>
                  <Boxes />
                  {busy
                    ? "Saving…"
                    : itemForm.id
                      ? "Save item changes"
                      : "Create stock item"}
                </button>
              </form>
            ) : (
              <form className="warehouse-form" onSubmit={saveMovement}>
                <Field label="Stock item">
                  <select
                    value={movement.item_id}
                    onChange={(e) =>
                      setMovement({ ...movement, item_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Choose item</option>
                    {tools.items.map((item: any) => (
                      <option value={item.id} key={item.id}>
                        {item.name} ({item.sku})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Warehouse">
                  <select
                    value={movement.warehouse_id}
                    onChange={(e) =>
                      setMovement({ ...movement, warehouse_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Choose warehouse</option>
                    {tools.warehouses.map((warehouse: any) => (
                      <option value={warehouse.id} key={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Movement">
                  <select
                    value={movement.type}
                    onChange={(e) =>
                      setMovement({ ...movement, type: e.target.value })
                    }
                  >
                    {[
                      ["receipt", "Receive purchased or delivered stock"],
                      ["production_output", "Receive finished production output"],
                      ["return_in", "Receive returned stock"],
                      ["issue", "Issue materials to production or internal use"],
                      ["dispatch", "Dispatch stock to a customer"],
                      ["adjustment_in", "Increase stock after a correction"],
                      ["adjustment_out", "Reduce stock after a correction"],
                      ["waste", "Record damaged, expired or wasted stock"],
                      ["reserve", "Reserve stock for planned work"],
                      ["release_reservation", "Release reserved stock"],
                      ["quarantine", "Place stock in quarantine"],
                      ["release_quarantine", "Release stock from quarantine"],
                    ].map(([v, l]) => (
                      <option value={v} key={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    value={movement.quantity}
                    onChange={(e) =>
                      setMovement({ ...movement, quantity: e.target.value })
                    }
                    placeholder="Enter quantity"
                    required
                  />
                </Field>
                <Field label="Unit cost (optional)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={movement.unit_cost}
                    onChange={(e) =>
                      setMovement({ ...movement, unit_cost: e.target.value })
                    }
                    placeholder="Uses item cost if blank"
                  />
                </Field>
                <Field label="Reason or reference">
                  <textarea
                    value={movement.reason}
                    onChange={(e) =>
                      setMovement({ ...movement, reason: e.target.value })
                    }
                    placeholder="Example: Supplier delivery note DN-104"
                    required
                  />
                </Field>
                <button className="primary-btn" disabled={busy}>
                  <ArrowDownToLine />
                  {busy ? "Recording…" : "Record movement"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
function DocumentTable({ rows, tab }: any) {
  return (
    <section className="panel sales-records">
      <header>
        <div>
          <h2>{titles[tab]}</h2>
          <p>
            Records shown below come directly from this factory’s purchasing
            database.
          </p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Expected date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.document_number}</b>
                  </td>
                  <td>
                    {item.supplier?.name || "Not assigned"}
                    <small>{item.supplier?.code || ""}</small>
                  </td>
                  <td>
                    {new Date(
                      item.document_date + "T12:00:00",
                    ).toLocaleDateString()}
                  </td>
                  <td>{Number(item.line_count || 0).toLocaleString()}</td>
                  <td>{money(item.total_amount, item.currency_code)}</td>
                  <td>
                    <span className={"admin-status " + item.status}>
                      {String(item.status).replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    {item.expected_date
                      ? new Date(
                          item.expected_date + "T12:00:00",
                        ).toLocaleDateString()
                      : "Not set"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty
                    text={
                      "No " +
                      titles[tab].toLowerCase() +
                      " have been recorded yet."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ReceiptTable({ rows }: any) {
  return (
    <section className="panel sales-records">
      <header>
        <div>
          <h2>Received goods</h2>
          <p>Stock receipts recorded by the assigned Warehouse Keeper.</p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th>Warehouse</th>
              <th>Quantity</th>
              <th>Balance</th>
              <th>Recorded by</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item: any) => (
                <tr key={item.id}>
                  <td>{new Date(item.occurred_at).toLocaleString()}</td>
                  <td>
                    <b>{item.item_name}</b>
                    <small>{item.sku}</small>
                  </td>
                  <td>{item.warehouse_name}</td>
                  <td>
                    {Number(item.quantity_delta).toLocaleString()} {item.unit}
                  </td>
                  <td>
                    {Number(item.balance_after).toLocaleString()} {item.unit}
                  </td>
                  <td>{item.recorded_by || "System"}</td>
                  <td>{item.reason}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty text="No goods have been received yet." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function PriceTable({ suppliers }: any) {
  const rows = suppliers.flatMap((supplier: any) =>
    (supplier.items || []).map((item: any) => ({
      supplier,
      item,
      ...item.pivot,
    })),
  );
  return (
    <section className="panel sales-records">
      <header>
        <div>
          <h2>Supplier prices</h2>
          <p>
            Current item prices and lead times registered for factory suppliers.
          </p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Item</th>
              <th>Supplier SKU</th>
              <th>Unit price</th>
              <th>Lead time</th>
              <th>Minimum order</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row: any) => (
                <tr key={row.supplier.id + "-" + row.item.id}>
                  <td>
                    <b>{row.supplier.name}</b>
                  </td>
                  <td>
                    {row.item.name}
                    <small>{row.item.sku}</small>
                  </td>
                  <td>{row.supplier_sku || "Not set"}</td>
                  <td>{money(row.unit_price)}</td>
                  <td>{Number(row.lead_time_days || 0)} days</td>
                  <td>
                    {Number(row.minimum_order_quantity || 0).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <Empty text="No supplier prices have been registered yet." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Field({ label, children }: any) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Metric({ label, value }: any) {
  return (
    <article className="panel">
      <small>{label}</small>
      <strong>
        {typeof value === "string"
          ? value
          : Number(value || 0).toLocaleString()}
      </strong>
    </article>
  );
}
function Empty({ text }: any) {
  return (
    <div className="sales-empty">
      <b>No records available</b>
      <span>{text}</span>
    </div>
  );
}
