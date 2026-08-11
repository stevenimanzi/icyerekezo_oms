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
    [modal, setModal] = useState<"item" | "movement" | "supplier" | "request" | "price" | "order" | "receive" | "payment" | null>(null),
    [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [itemForm, setItemForm] = useState<any>(emptyItem),
    [movement, setMovement] = useState<any>(emptyMovement);
  const [form, setForm] = useState<any>({});
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
    request("/api/auth/me").then((result:any)=>setPermissions(result.user?.permissions||[])).catch(()=>setPermissions([]));
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
        (data?.documents || []).filter(
          (item: any) => item.document_type === typeForTab[tab],
        ),
      [data, tab],
    ),
    canManage = Boolean(tools);
  const documents = data?.documents || [], suppliers = data?.suppliers || [], items = data?.items || [];
  const allowed=(permission:string)=>permissions.includes('*')||permissions.includes(permission);
  const canCreate=allowed('procurement.create'), canApprove=allowed('procurement.approve');
  const canReceive=allowed('procurement.receive'), canPay=allowed('finance.receive_payment');
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
                body: JSON.stringify({
                    ...movement,
                    unit_cost: movement.type === "receipt" ? movement.unit_cost || null : null,
                }),
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
  const open = (name: any, values: any = {}) => { setError(""); setSuccess(""); setForm(values); setModal(name); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      let url = "", method = "POST", body: any = form, message = "Saved successfully.";
      if (modal === "supplier") { url = "/api/procurement/suppliers"; message = "Supplier saved."; }
      if (modal === "price") { url = `/api/procurement/suppliers/${form.supplier_id}/prices`; method = "PUT"; message = "Supplier price saved."; }
      if (modal === "request") { url = "/api/procurement/requests"; body = {...form, lines:[{item_id:form.item_id, quantity:form.quantity, description:form.description}]}; message = "Purchase request sent for approval."; }
      if (modal === "order") { url = `/api/procurement/requests/${form.document_id}/order`; message = "Purchase order created."; }
      if (modal === "receive") { url = `/api/procurement/orders/${form.document_id}/receive`; body = {...form, lines:[{line_id:form.line_id, quantity:form.quantity}]}; message = "Goods received and stock updated."; }
      if (modal === "payment") { url = `/api/procurement/orders/${form.document_id}/payments`; message = "Payment recorded."; }
      await request(url, {method, body:JSON.stringify(body)}); notify(message); setModal(null); setForm({}); await load();
    } catch (reason:any) { setError(reason.message); } finally { setBusy(false); }
  };
  const approve = async (id:number) => {
    setBusy(true); setError(""); try { await request(`/api/procurement/requests/${id}/approve`, {method:"POST"}); notify("Purchase request approved."); await load(); } catch(reason:any){setError(reason.message)} finally{setBusy(false)}
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
              Plan what is needed, compare suppliers, approve purchases, receive goods and track payments.
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
          {canCreate&&<button className="secondary-btn" onClick={() => open("supplier", {payment_terms_days:30})}><Plus/>Add supplier</button>}
          {canCreate&&<button className="secondary-btn" onClick={() => open("price", {lead_time_days:0, minimum_order_quantity:0})}><Plus/>Add supplier price</button>}
          {canCreate&&<button className="primary-btn" onClick={() => open("request", {expected_date:"", quantity:""})}><Plus/>New purchase request</button>}
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
      {false && canManage && tools.items.length > 0 && (
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
        <Metric label="Amount still to pay" value={money(summary.unpaid_value)} />
      </div>
      <div className="module-tabs sales-tabs">
        {[
          ["requests", "Purchase requests", summary.requests],
          ["prices", "Suppliers and prices", summary.suppliers],
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
        <PriceTable suppliers={suppliers} />
      ) : tab === "receipts" ? (
        <ReceiptTable rows={documents.filter((row:any)=>row.document_type==='purchase_order' && ['partially_received','received'].includes(row.status))} />
      ) : (
        <DocumentTable rows={rows} tab={tab} onApprove={approve} onOpen={open} permissions={{canCreate,canApprove,canReceive,canPay}} />
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
                  {({supplier:"Add supplier",price:"Add supplier price",request:"New purchase request",order:"Create purchase order",receive:"Receive ordered goods",payment:"Record supplier payment",item:"Add stock item",movement:"Record stock movement"} as any)[modal]}
                </h2>
                <p>
                  Complete the required details below. The system will keep a permanent purchasing record.
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModal(null)}>
                <X />
              </button>
            </header>
            {error && (
              <div className="admin-alert error warehouse-modal-error">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}
            {["supplier","price","request","order","receive","payment"].includes(modal) ? (
              <ProcurementForm kind={modal} form={form} setForm={setForm} data={data} busy={busy} onSubmit={submit}/>
            ) : modal === "item" ? (
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
                    value={movement.reason}
                    onChange={(e) =>
                      setMovement({ ...movement, reason: e.target.value })
                    }
                    placeholder="Example: Reserved for production order PO-104"
                    required
                  />
                </Field>
                <button className="primary-btn" disabled={busy}>
                  <ArrowDownToLine />
                  {busy ? "Saving..." : "Save stock movement"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
function ProcurementForm({kind,form,setForm,data,busy,onSubmit}:any){
  const suppliers=data?.suppliers||[], items=data?.items||[], warehouses=data?.warehouses||[], documents=data?.documents||[];
  const requests=documents.filter((d:any)=>d.document_type==='purchase_request'&&d.status==='approved');
  const orders=documents.filter((d:any)=>d.document_type==='purchase_order'&&['ordered','partially_received','received'].includes(d.status));
  const selectedOrder=orders.find((d:any)=>String(d.id)===String(form.document_id));
  const set=(key:string,value:any)=>setForm({...form,[key]:value});
  return <form className="warehouse-form" onSubmit={onSubmit}>
    {kind==='supplier'&&<><Field label="Supplier name"><input value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Example: Kigali Materials Ltd" required/></Field><Field label="Email"><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="supplier@company.com"/></Field><Field label="Phone number"><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="Example: +250 788 000 000"/></Field><Field label="Tax number"><input value={form.tax_number||''} onChange={e=>set('tax_number',e.target.value)} placeholder="Optional"/></Field><Field label="Payment due after"><input type="number" min="0" max="365" value={form.payment_terms_days??30} onChange={e=>set('payment_terms_days',e.target.value)} required/></Field><Field label="Address"><textarea value={form.address||''} onChange={e=>set('address',e.target.value)} placeholder="Supplier address"/></Field></>}
    {kind==='price'&&<><Select label="Supplier" value={form.supplier_id} onChange={(v:any)=>set('supplier_id',v)} options={suppliers.map((x:any)=>[x.id,x.name])}/><Select label="Item" value={form.item_id} onChange={(v:any)=>set('item_id',v)} options={items.map((x:any)=>[x.id,`${x.name} (${x.sku})`])}/><Field label="Price for one unit"><input type="number" min="0" step="0.01" value={form.unit_price||''} onChange={e=>set('unit_price',e.target.value)} placeholder="Enter supplier price" required/></Field><Field label="Delivery time in days"><input type="number" min="0" value={form.lead_time_days??0} onChange={e=>set('lead_time_days',e.target.value)} required/></Field><Field label="Smallest quantity supplier accepts"><input type="number" min="0" step="any" value={form.minimum_order_quantity??0} onChange={e=>set('minimum_order_quantity',e.target.value)} required/></Field><Field label="Supplier item code"><input value={form.supplier_sku||''} onChange={e=>set('supplier_sku',e.target.value)} placeholder="Optional"/></Field></>}
    {kind==='request'&&<><Field label="Why is this purchase needed?"><textarea value={form.purpose||''} onChange={e=>set('purpose',e.target.value)} placeholder="Explain what the factory needs and why" required/></Field><Field label="Needed by"><input type="date" value={form.expected_date||''} onChange={e=>set('expected_date',e.target.value)}/></Field><Select label="Item needed" value={form.item_id} onChange={(v:any)=>set('item_id',v)} options={items.map((x:any)=>[x.id,`${x.name} (${x.sku})`])}/><Field label="Quantity needed"><input type="number" min="0.000001" step="any" value={form.quantity||''} onChange={e=>set('quantity',e.target.value)} placeholder="Enter quantity" required/></Field><Field label="Extra details"><textarea value={form.description||''} onChange={e=>set('description',e.target.value)} placeholder="Size, grade, colour or other requirements"/></Field></>}
    {kind==='order'&&<><Select label="Approved request" value={form.document_id} onChange={(v:any)=>set('document_id',v)} options={requests.map((x:any)=>[x.id,`${x.document_number} — ${x.purpose}`])}/><Select label="Supplier" value={form.supplier_id} onChange={(v:any)=>set('supplier_id',v)} options={suppliers.filter((x:any)=>x.status==='active').map((x:any)=>[x.id,x.name])}/><p className="form-help">Prices saved for this supplier will be used automatically. Add supplier prices before creating the order.</p></>}
    {kind==='receive'&&<><Select label="Purchase order" value={form.document_id} onChange={(v:any)=>setForm({...form,document_id:v,line_id:'',quantity:''})} options={orders.filter((x:any)=>x.status!=='received').map((x:any)=>[x.id,`${x.document_number} — ${x.supplier?.name||''}`])}/><Select label="Item received" value={form.line_id} onChange={(v:any)=>set('line_id',v)} options={(selectedOrder?.lines||[]).filter((x:any)=>Number(x.received_quantity)<Number(x.quantity)).map((x:any)=>[x.id,`${x.item?.name} — ${Number(x.quantity)-Number(x.received_quantity)} remaining`])}/><Select label="Put goods in" value={form.warehouse_id} onChange={(v:any)=>set('warehouse_id',v)} options={warehouses.map((x:any)=>[x.id,x.name])}/><Field label="Quantity received"><input type="number" min="0.000001" step="any" value={form.quantity||''} onChange={e=>set('quantity',e.target.value)} required/></Field><Field label="Supplier delivery note"><input value={form.delivery_reference||''} onChange={e=>set('delivery_reference',e.target.value)} placeholder="Example: DN-104" required/></Field></>}
    {kind==='payment'&&<><Select label="Purchase order" value={form.document_id} onChange={(v:any)=>set('document_id',v)} options={orders.filter((x:any)=>Number(x.paid_amount)<Number(x.total_amount)).map((x:any)=>[x.id,`${x.document_number} — ${money(Number(x.total_amount)-Number(x.paid_amount))} due`])}/><Field label="Amount paid"><input type="number" min="0.01" step="0.01" value={form.amount||''} onChange={e=>set('amount',e.target.value)} required/></Field><Select label="Payment method" value={form.method} onChange={(v:any)=>set('method',v)} options={[["bank_transfer","Bank transfer"],["mobile_money","Mobile money"],["cash","Cash"],["cheque","Cheque"],["card","Card"]]}/><Field label="Payment date"><input type="date" value={form.paid_on||''} onChange={e=>set('paid_on',e.target.value)} required/></Field><Field label="Payment reference"><input value={form.reference||''} onChange={e=>set('reference',e.target.value)} placeholder="Bank, cheque or transaction number"/></Field></>}
    <button className="primary-btn" disabled={busy}><Plus/>{busy?'Saving...':'Save'}</button>
  </form>
}
function Select({label,value,onChange,options}:any){return <Field label={label}><select value={value||''} onChange={e=>onChange(e.target.value)} required><option value="">Choose</option>{options.map((x:any)=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>}
function DocumentTable({ rows, tab, onApprove, onOpen, permissions }: any) {
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
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.document_number}</b>
                  </td>
                  <td><div className="table-actions">
                    {permissions.canApprove&&tab==='requests'&&['submitted','pending_approval'].includes(item.status)&&<button className="secondary-btn" onClick={()=>onApprove(item.id)}>Approve</button>}
                    {permissions.canCreate&&tab==='requests'&&item.status==='approved'&&<button className="primary-btn" onClick={()=>onOpen('order',{document_id:item.id})}>Create order</button>}
                    {permissions.canReceive&&tab==='orders'&&['ordered','partially_received'].includes(item.status)&&<button className="secondary-btn" onClick={()=>onOpen('receive',{document_id:item.id})}>Receive goods</button>}
                    {permissions.canPay&&tab==='orders'&&Number(item.total_amount)>0&&Number(item.paid_amount)<Number(item.total_amount)&&<button className="secondary-btn" onClick={()=>onOpen('payment',{document_id:item.id,paid_on:new Date().toISOString().slice(0,10)})}>Record payment</button>}
                    <span className="record-state">{['received','converted'].includes(item.status)?'Complete':'View record'}</span>
                  </div></td>
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
                <td colSpan={8}>
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
          <p>Purchase orders received into factory stock.</p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th><th>Supplier</th><th>Items</th><th>Total ordered</th><th>Received</th><th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item: any) => (
                <tr key={item.id}>
                  <td><b>{item.document_number}</b></td><td>{item.supplier?.name}</td>
                  <td>{(item.lines||[]).map((line:any)=><small key={line.id}>{line.item?.name}: {Number(line.received_quantity).toLocaleString()} / {Number(line.quantity).toLocaleString()}</small>)}</td>
                  <td>{money(item.total_amount,item.currency_code)}</td><td>{item.received_at?new Date(item.received_at).toLocaleString():'Partly received'}</td><td>{String(item.payment_status).replaceAll('_',' ')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
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
