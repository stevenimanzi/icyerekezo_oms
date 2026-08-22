import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  ClipboardCheck,
  Edit3,
  Plus,
  Power,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

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
    throw new Error("Stock data could not be read. Please sign in again.");
  }
  if (!response.ok) {
    const first = data.errors ? Object.values(data.errors).flat()[0] : null;
    throw new Error(
      String(
        first || data.message || "The stock action could not be completed.",
      ),
    );
  }
  return data;
}
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
const emptyTransfer = {
  item_id: "",
  from_warehouse_id: "",
  to_warehouse_id: "",
  quantity: "",
  reason: "",
};
const emptyCount = {
  item_id: "",
  warehouse_id: "",
  counted_quantity: "",
  reason: "",
};

export default function InventoryManagementPage({
  user,
  locale,
}: {
  user: any;
  locale: "en" | "fr";
}) {
  const [data, setData] = useState<any>(null),
    [tools, setTools] = useState<any>({ items: [], units: [], warehouses: [] }),
    [tab, setTab] = useState(user?.workspace === "logistics" ? "stock" : "items"),
    [modal, setModal] = useState<
      "item" | "movement" | "transfer" | "count" | null
    >(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [updated, setUpdated] = useState<Date | null>(null);
  const canManageStock =
    user?.workspace === "warehouse" ||
    Boolean(user?.roles?.some((role: any) => role.slug === "warehouse-keeper"));
  const isLogisticsView = user?.workspace === "logistics";
  const [item, setItem] = useState<any>(emptyItem),
    [movement, setMovement] = useState<any>(emptyMovement),
    [transfer, setTransfer] = useState<any>(emptyTransfer),
    [count, setCount] = useState<any>(emptyCount);
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const overview = await request("/api/inventory/overview");
      const control = canManageStock
        ? await request("/api/inventory/tools")
        : { items: [], units: [], warehouses: [] };
      setData(overview);
      setTools(control);
      setUpdated(new Date());
      setError("");
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const currency =
    user?.current_factory?.currency_code ||
    user?.system?.currency_code ||
    "RWF";
  const money = (value: any) =>
    `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const quantity = (value: any, unit?: string) =>
    `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;
  const notify = (message: string) => {
    setSuccess(message);
    setError("");
    window.setTimeout(() => setSuccess(""), 3500);
  };
  const submit = async (
    event: FormEvent,
    url: string,
    payload: any,
    successMessage: string,
  ) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request(url, {
        method: url.includes("/items/") && item.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      notify(successMessage);
      setModal(null);
      await load();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  const editItem = (entry: any) => {
    setItem({
      ...entry,
      unit_id: String(entry.unit_id),
      standard_cost: String(entry.standard_cost || 0),
      reorder_level: String(entry.reorder_level || 0),
    });
    setModal("item");
  };

  const changeStatus = async (entry: any) => {
    setBusy(true);
    try {
      const result = await request(`/api/inventory/items/${entry.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !entry.is_active }),
      });
      notify(result.message);
      await load();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  const transactions = data?.recent_transactions || [];
  const visibleTransactions = useMemo(
    () =>
      transactions.filter((entry: any) =>
        tab === "transfers"
          ? String(entry.reason || "").startsWith("TRANSFER-")
          : tab === "counts"
            ? String(entry.reason || "").startsWith("STOCK COUNT")
            : true,
      ),
    [transactions, tab],
  );
  const managementTabs = [
    ["items", locale === "fr" ? "Articles" : "Stock items"],
    ["stock", locale === "fr" ? "Stock actuel" : "Current stock"],
    ["movements", locale === "fr" ? "Mouvements" : "Stock movements"],
    ["transfers", locale === "fr" ? "Transferts" : "Transfers"],
    ["counts", locale === "fr" ? "Comptages" : "Stock counts"],
  ];
  const tabs = isLogisticsView
    ? [["stock", locale === "fr" ? "Produits disponibles" : "Available goods"]]
    : managementTabs;
  const dispatchStock = data?.stock || [];
  const dispatchReady = dispatchStock.reduce((sum:number, entry:any) => sum + Number(entry.available_quantity || 0), 0);
  const dispatchReserved = dispatchStock.reduce((sum:number, entry:any) => sum + Number(entry.quantity_reserved || 0), 0);
  return (
    <section className="module-page inventory-live-page inventory-management-page">
      <div className="module-hero inventory-management-hero">
        <div className="module-title">
          <div>
            <div className="eyebrow">
              <i></i>
              {isLogisticsView ? (locale === "fr" ? "DISPONIBILITÉ EN DIRECT" : "LIVE GOODS AVAILABILITY") : (locale === "fr" ? "STOCK EN DIRECT" : "LIVE STOCK DATA")}
            </div>
            <h1>{isLogisticsView ? (locale === "fr" ? "Produits disponibles" : "Available goods") : (locale === "fr" ? "Gestion du stock" : "Stock management")}</h1>
            <p>
              {isLogisticsView
                ? (locale === "fr" ? "Vérifiez les produits prêts ou réservés avant de planifier une livraison." : "Check goods ready or reserved for customer deliveries before planning dispatch.")
                : locale === "fr"
                ? "Contrôlez les articles, quantités, transferts et comptages de votre usine."
                : "Control every item, quantity, transfer and stock count in your factory."}
            </p>
            <small className="sales-updated">
              {updated
                ? (locale === "fr" ? "Mis à jour " : "Updated ") +
                  updated.toLocaleTimeString()
                : locale === "fr"
                  ? "Connexion…"
                  : "Connecting…"}
            </small>
          </div>
        </div>
        <div className="inventory-control-actions">
          {canManageStock && <>
          <button
            className="secondary-btn"
            onClick={() => {
              setItem(emptyItem);
              setModal("item");
            }}
          >
            <Plus />
            Add item
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              setError("");
              setMovement(emptyMovement);
              setModal("movement");
            }}
          >
            <Plus />
            Record movement
          </button>
          <button
            className="secondary-btn"
            onClick={() => {
              setTransfer(emptyTransfer);
              setModal("transfer");
            }}
          >
            <ArrowRightLeft />
            Transfer
          </button>
          <button
            className="secondary-btn"
            onClick={() => {
              setCount(emptyCount);
              setModal("count");
            }}
          >
            <ClipboardCheck />
            Stock count
          </button>
          </>}
          <button
            className="secondary-btn"
            disabled={loading}
            onClick={() => load()}
          >
            <RefreshCw className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      {success && <div className="admin-alert success">{success}</div>}
      <div className="inventory-metrics">
        {isLogisticsView ? <>
        <article>
          <small>Goods ready</small>
          <strong>{quantity(dispatchReady)}</strong>
          <p>Available for dispatch</p>
        </article>
        <article>
          <small>Reserved goods</small>
          <strong>{quantity(dispatchReserved)}</strong>
          <p>Held for customer orders</p>
        </article>
        <article>
          <small>Storage locations</small>
          <strong>{Number(data?.warehouses || 0).toLocaleString()}</strong>
          <p>Warehouses holding goods</p>
        </article>
        <article>
          <small>Goods requiring attention</small>
          <strong>{dispatchStock.filter((entry:any)=>Number(entry.available_quantity||0)<=0).length}</strong>
          <p>Unavailable or fully reserved</p>
        </article>
        </> : <>
        <article>
          <small>Stock items</small>
          <strong>{Number(data?.items || 0).toLocaleString()}</strong>
          <p>All catalogue items</p>
        </article>
        <article>
          <small>Warehouses</small>
          <strong>{Number(data?.warehouses || 0).toLocaleString()}</strong>
          <p>Active storage locations</p>
        </article>
        <article className={Number(data?.low_stock || 0) > 0 ? "warning" : ""}>
          <small>Low-stock items</small>
          <strong>{Number(data?.low_stock || 0).toLocaleString()}</strong>
          <p>Need attention</p>
        </article>
        <article>
          <small>Total stock value</small>
          <strong>{money(data?.total_value)}</strong>
          <p>Based on recorded costs</p>
        </article>
        </>}
      </div>
      <div className="module-tabs inventory-tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel inventory-data-panel">
        {loading && !data ? (
          <div className="admin-loading">Loading stock records…</div>
        ) : tab === "items" ? (
          <Catalog
            rows={data?.catalog || []}
            money={money}
            quantity={quantity}
            edit={editItem}
            changeStatus={changeStatus}
            busy={busy}
          />
        ) : tab === "stock" ? (
          <Balances
            rows={isLogisticsView ? dispatchStock : (data?.stock || [])}
            money={money}
            quantity={quantity}
          />
        ) : (
          <Transactions
            rows={visibleTransactions}
            quantity={quantity}
            money={money}
            title={
              tab === "transfers"
                ? "Stock transfers"
                : tab === "counts"
                  ? "Stock count adjustments"
                  : "Stock movement history"
            }
          />
        )}
      </section>
      {modal && (
        <div className="modal-backdrop">
          <section
            className="panel warehouse-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h2>
                  {modal === "item"
                    ? item.id
                      ? "Edit stock item"
                      : "Add stock item"
                    : modal === "movement"
                      ? "Record stock movement"
                      : modal === "transfer"
                        ? "Transfer stock"
                        : "Record stock count"}
                </h2>
                <p>
                  {modal === "item"
                    ? "Create or update an item in the factory catalogue."
                    : modal === "movement"
                      ? "Choose what happened to the stock, enter the quantity, and explain why."
                      : modal === "transfer"
                        ? "Move stock safely between factory warehouses."
                        : "Enter the physical quantity counted in a warehouse."}
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </header>
            {error && <div className="admin-alert error warehouse-modal-error">{error}</div>}
            {modal === "item" ? (
              <form
                className="warehouse-form"
                onSubmit={(e) =>
                  submit(
                    e,
                    item.id
                      ? `/api/inventory/items/${item.id}`
                      : "/api/inventory/items",
                    item,
                    item.id ? "Stock item updated." : "Stock item created.",
                  )
                }
              >
                <Field label="Item name">
                  <input
                    required
                    value={item.name}
                    onChange={(e) => setItem({ ...item, name: e.target.value })}
                  />
                </Field>
                <Field label="Stock code">
                  <input
                    disabled
                    value={item.id ? item.sku : "Generated automatically"}
                  />
                </Field>
                <Field label="Item type">
                  <select
                    value={item.type}
                    onChange={(e) => setItem({ ...item, type: e.target.value })}
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
                    required
                    value={item.unit_id}
                    onChange={(e) =>
                      setItem({ ...item, unit_id: e.target.value })
                    }
                  >
                    <option value="">Choose unit</option>
                    {tools.units.map((entry: any) => (
                      <option value={entry.id} key={entry.id}>
                        {entry.name} ({entry.symbol})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cost per unit">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.standard_cost}
                    onChange={(e) =>
                      setItem({ ...item, standard_cost: e.target.value })
                    }
                  />
                </Field>
                <Field label="Low-stock warning level">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={item.reorder_level}
                    onChange={(e) =>
                      setItem({ ...item, reorder_level: e.target.value })
                    }
                  />
                </Field>
                <Submit
                  busy={busy}
                  label={item.id ? "Save item changes" : "Create stock item"}
                  icon={item.id ? <Save /> : <Plus />}
                />
              </form>
            ) : modal === "movement" ? (
              <form
                className="warehouse-form"
                onSubmit={(e) =>
                  submit(
                    e,
                    "/api/inventory/transactions",
                    movement,
                    "Stock movement recorded.",
                  )
                }
              >
                <ItemSelect
                  value={movement.item_id}
                  change={(value:string) =>
                    setMovement({ ...movement, item_id: value })
                  }
                  items={tools.items}
                />
                <WarehouseSelect
                  value={movement.warehouse_id}
                  change={(value:string) =>
                    setMovement({ ...movement, warehouse_id: value })
                  }
                  warehouses={tools.warehouses}
                />
                <Field label="Movement">
                  <select
                    value={movement.type}
                    onChange={(e) =>
                      setMovement({
                        ...movement,
                        type: e.target.value,
                        unit_cost: e.target.value === "receipt" ? movement.unit_cost : "",
                      })
                    }
                  >
                    {[
                      ["receipt", "Receive stock from a supplier"],
                      ["production_output", "Add finished goods from production"],
                      ["return_in", "Put returned items back in stock"],
                      ["issue", "Send materials to production"],
                      ["dispatch", "Send goods to a customer"],
                      ["adjustment_in", "Add stock after a correction"],
                      ["adjustment_out", "Remove stock after a correction"],
                      ["waste", "Record damaged, expired or wasted stock"],
                      ["reserve", "Hold stock for planned work"],
                      ["release_reservation", "Stop holding reserved stock"],
                      ["quarantine", "Hold stock for inspection"],
                      ["release_quarantine", "Return inspected stock to use"],
                    ].map(([v, l]) => (
                      <option value={v} key={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    required
                    type="number"
                    min="0.000001"
                    step="any"
                    value={movement.quantity}
                    onChange={(e) =>
                      setMovement({ ...movement, quantity: e.target.value })
                    }
                  />
                </Field>
                {movement.type === "receipt" && (
                  <Field label="Purchase cost per unit (optional)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={movement.unit_cost}
                      onChange={(e) =>
                        setMovement({ ...movement, unit_cost: e.target.value })
                      }
                      placeholder="Leave empty to use the saved item cost"
                    />
                  </Field>
                )}
                <Field label="Why are you making this change?">
                  <textarea
                    required
                    value={movement.reason}
                    onChange={(e) =>
                      setMovement({ ...movement, reason: e.target.value })
                    }
                  />
                </Field>
                <Submit busy={busy} label="Save stock movement" icon={<Plus />} />
              </form>
            ) : modal === "transfer" ? (
              <form
                className="warehouse-form"
                onSubmit={(e) =>
                  submit(
                    e,
                    "/api/inventory/transfers",
                    transfer,
                    "Stock transferred successfully.",
                  )
                }
              >
                <ItemSelect
                  value={transfer.item_id}
                  change={(value:string) =>
                    setTransfer({ ...transfer, item_id: value })
                  }
                  items={tools.items}
                />
                <Field label="Quantity">
                  <input
                    required
                    type="number"
                    min="0.000001"
                    step="any"
                    value={transfer.quantity}
                    onChange={(e) =>
                      setTransfer({ ...transfer, quantity: e.target.value })
                    }
                  />
                </Field>
                <Field label="From warehouse">
                  <select
                    required
                    value={transfer.from_warehouse_id}
                    onChange={(e) =>
                      setTransfer({
                        ...transfer,
                        from_warehouse_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Choose source warehouse</option>
                    {tools.warehouses.map((entry: any) => (
                      <option value={entry.id} key={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To warehouse">
                  <select
                    required
                    value={transfer.to_warehouse_id}
                    onChange={(e) =>
                      setTransfer({
                        ...transfer,
                        to_warehouse_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Choose destination warehouse</option>
                    {tools.warehouses.map((entry: any) => (
                      <option value={entry.id} key={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Transfer reason">
                  <textarea
                    required
                    value={transfer.reason}
                    onChange={(e) =>
                      setTransfer({ ...transfer, reason: e.target.value })
                    }
                  />
                </Field>
                <Submit
                  busy={busy}
                  label="Transfer stock"
                  icon={<ArrowRightLeft />}
                />
              </form>
            ) : (
              <form
                className="warehouse-form"
                onSubmit={(e) =>
                  submit(
                    e,
                    "/api/inventory/stock-counts",
                    count,
                    "Stock count saved.",
                  )
                }
              >
                <ItemSelect
                  value={count.item_id}
                  change={(value:string) => setCount({ ...count, item_id: value })}
                  items={tools.items}
                />
                <WarehouseSelect
                  value={count.warehouse_id}
                  change={(value:string) =>
                    setCount({ ...count, warehouse_id: value })
                  }
                  warehouses={tools.warehouses}
                />
                <Field label="Physical quantity counted">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.001"
                    value={count.counted_quantity}
                    onChange={(e) =>
                      setCount({ ...count, counted_quantity: e.target.value })
                    }
                  />
                </Field>
                <Field label="Count note or reference">
                  <textarea
                    required
                    value={count.reason}
                    onChange={(e) =>
                      setCount({ ...count, reason: e.target.value })
                    }
                  />
                </Field>
                <Submit
                  busy={busy}
                  label="Save stock count"
                  icon={<ClipboardCheck />}
                />
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function Catalog({ rows, money, quantity, edit, changeStatus, busy }: any) {
  return (
    <>
      <Header title="All stock items" count={rows.length} />
      <div className="admin-table-wrap">
        <table className="admin-table inventory-table inventory-control-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Total quantity</th>
              <th>Unit cost</th>
              <th>Stock value</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((entry: any) => (
                <tr key={entry.id}>
                  <td>
                    <b>{entry.name}</b>
                  </td>
                  <td>{String(entry.type).replaceAll("_", " ")}</td>
                  <td>{entry.unit?.symbol || "—"}</td>
                  <td>{quantity(entry.total_quantity, entry.unit?.symbol)}</td>
                  <td>{money(entry.standard_cost)}</td>
                  <td>{money(entry.stock_value)}</td>
                  <td>
                    <span
                      className={`admin-status ${entry.is_active ? "active" : "suspended"}`}
                    >
                      {entry.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="inventory-row-actions">
                      <button disabled={busy} onClick={() => edit(entry)}>
                        <Edit3 />
                        Edit
                      </button>
                      <button
                        disabled={busy}
                        className={entry.is_active ? "danger" : ""}
                        onClick={() => changeStatus(entry)}
                      >
                        <Power />
                        {entry.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <Empty columns={9} text="No stock items exist yet." />
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Balances({ rows, money, quantity }: any) {
  return (
    <>
      <Header title="Current stock by warehouse" count={rows.length} />
      <div className="admin-table-wrap">
        <table className="admin-table inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Warehouse</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((entry: any) => (
                <tr key={entry.id}>
                  <td>
                    <b>{entry.item_name}</b>
                    <small>
                      {String(entry.item_type).replaceAll("_", " ")}
                    </small>
                  </td>
                  <td>{entry.warehouse_name}</td>
                  <td>{quantity(entry.quantity_on_hand, entry.unit)}</td>
                  <td>{quantity(entry.quantity_reserved, entry.unit)}</td>
                  <td>{quantity(entry.available_quantity, entry.unit)}</td>
                  <td>{money(entry.stock_value)}</td>
                  <td>
                    <span
                      className={`admin-status ${entry.is_low_stock ? "warning" : "active"}`}
                    >
                      {entry.is_low_stock ? "Low stock" : "Available"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <Empty
                columns={8}
                text="Items exist, but no stock quantities have been received yet."
              />
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Transactions({ rows, quantity, money, title }: any) {
  return (
    <>
      <Header title={title} count={rows.length} />
      <div className="admin-table-wrap">
        <table className="admin-table inventory-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th>Warehouse</th>
              <th>Movement</th>
              <th>Quantity</th>
              <th>Balance</th>
              <th>Cost</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((entry: any) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.occurred_at).toLocaleString()}</td>
                  <td>
                    <b>{entry.item_name}</b>
                  </td>
                  <td>{entry.warehouse_name}</td>
                  <td>{String(entry.type).replaceAll("_", " ")}</td>
                  <td>{quantity(entry.quantity_delta, entry.unit)}</td>
                  <td>{quantity(entry.balance_after, entry.unit)}</td>
                  <td>{money(entry.unit_cost)}</td>
                  <td>{entry.reason || "—"}</td>
                </tr>
              ))
            ) : (
              <Empty
                columns={8}
                text="No matching stock records have been entered yet."
              />
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Header({ title, count }: any) {
  return (
    <header className="inventory-panel-header">
      <h2>{title}</h2>
      <span>{count.toLocaleString()} records</span>
    </header>
  );
}
function Empty({ columns, text }: any) {
  return (
    <tr>
      <td colSpan={columns} className="empty-cell">
        {text}
      </td>
    </tr>
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
function ItemSelect({ value, change, items }: any) {
  return (
    <Field label="Stock item">
      <select required value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Choose item</option>
        {items.map((entry: any) => (
          <option value={entry.id} key={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function WarehouseSelect({ value, change, warehouses }: any) {
  return (
    <Field label="Warehouse">
      <select required value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Choose warehouse</option>
        {warehouses.map((entry: any) => (
          <option value={entry.id} key={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Submit({ busy, label, icon }: any) {
  return (
    <button className="primary-btn" disabled={busy}>
      {icon}
      {busy ? "Saving…" : label}
    </button>
  );
}



