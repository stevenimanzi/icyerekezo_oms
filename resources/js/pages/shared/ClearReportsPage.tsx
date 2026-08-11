import React, {useEffect, useRef, useState} from 'react';
import {FileText, Printer} from 'lucide-react';

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

async function api(url: string) {
    const response = await fetch(url, {headers: {Accept: 'application/json', 'X-CSRF-TOKEN': csrf()}});
    const text = await response.text();
    let data: any;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The report service returned an invalid response.');
    }
    if (!response.ok) throw new Error(data.message || 'Unable to load the report.');
    return data;
}

function Table({title, headers, rows}: any) {
    return <section className="report-section">
        <h2>{title}</h2>
        <table>
            <thead><tr>{headers.map((header: string) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>{rows.length
                ? rows.map((row: any[], index: number) => <tr key={index}>{row.map((cell: any, cellIndex: number) => <td key={cellIndex}>{cell}</td>)}</tr>)
                : <tr><td colSpan={headers.length}>No work was recorded for this period.</td></tr>}
            </tbody>
        </table>
    </section>;
}

const number = (value: any) => Number(value || 0).toLocaleString(undefined, {maximumFractionDigits: 3});
const quantity = (value: any, unit?: string) => `${number(value)}${unit && unit !== '—' ? ` ${unit}` : ''}`;

function DailyRegister({data}: any) {
    const days = data.daily_activity || [];
    return <>{days.length
        ? days.map((day: any) => <section className="daily-register" key={day.date}>
            <h2>Daily work register — {new Date(`${day.date}T00:00:00`).toLocaleDateString()}</h2>
            {day.departments.map((department: any) => <Table
                key={department.department_id}
                title={department.department}
                headers={['Order', 'Product / item', 'Work step', data.standard.input_label, data.standard.output_label, 'Damaged / rejected', 'Waste', 'Unit']}
                rows={department.records.map((record: any) => [
                    record.order_number,
                    record.product,
                    record.work_step,
                    number(record.received),
                    number(record.completed),
                    number(record.damaged),
                    number(record.waste),
                    record.unit,
                ])}
            />)}
        </section>)
        : <Table title="Daily work register" headers={['Date', 'Department', 'Product / item', data.standard.input_label, data.standard.output_label, 'Damaged / rejected', 'Waste', 'Unit']} rows={[]}/>}
    </>;
}

function DepartmentMatrix({data}: any) {
    const departments = data.department_activity || [];
    const metrics = [
        ['Orders', (row: any) => number(row.production_orders)],
        ['Work entries', (row: any) => number(row.work_records)],
        [data.standard.input_label, (row: any) => quantity(row.received_quantity, row.unit)],
        [data.standard.output_label, (row: any) => quantity(row.completed_quantity, row.unit)],
        ['Damaged / rejected', (row: any) => quantity(row.damaged_quantity, row.unit)],
        ['Waste', (row: any) => quantity(row.waste_quantity, row.unit)],
    ];
    return <Table
        title="Work totals by department"
        headers={['Recorded work', ...departments.map((row: any) => row.name)]}
        rows={metrics.map(([label, value]: any) => [label, ...departments.map((row: any) => value(row))])}
    />;
}

const reportDate = (value: string) => String(value || '').slice(0, 10);
const stageArea = (name: string) => {
    const value = String(name || '').toLowerCase();
    if (value.includes('cut')) return 'cutting';
    if (['finish', 'iron', 'press', 'quality', 'pack'].some(word => value.includes(word))) return 'finishing';
    return 'production';
};

function FlowCell({records, input = false}: any) {
    return <td>{records.length ? records.map((record: any, index: number) => <div className="noguchi-report-entry" key={`${record.id}-${index}`}>
        <b>{record.item_name || record.product_name || 'Unspecified item'}</b>
        <span>{number(input ? (record.input_quantity ?? Math.abs(record.quantity_delta)) : (record.output_quantity ?? Math.abs(record.quantity_delta)))} {record.unit_symbol || ''}</span>
        {record.order_number && <small>Order {record.order_number}</small>}
    </div>) : <span className="noguchi-report-empty">No activity</span>}</td>;
}

function NoguchiLogisticsDocument({data}: any) {
    const inventory = data.inventory || [];
    const production = data.production || [];
    const dates = Array.from(new Set([
        ...inventory.map((row: any) => reportDate(row.occurred_at)),
        ...production.map((row: any) => reportDate(row.updated_at)),
    ].filter(Boolean))).sort();
    const reportDates = dates.length ? dates : [data.report.to];
    const total = (rows: any[], key: string) => rows.reduce((sum: number, row: any) => sum + Math.abs(Number(row[key] || 0)), 0);
    const warehouseIn = inventory.filter((row: any) => Number(row.quantity_delta) > 0);
    const warehouseOut = inventory.filter((row: any) => Number(row.quantity_delta) < 0);
    const stages = (area: string) => production.filter((row: any) => stageArea(row.stage_name) === area);
    const flowTotals = [
        ['Warehouse received', total(warehouseIn, 'quantity_delta')],
        ['Warehouse issued', total(warehouseOut, 'quantity_delta')],
        ['Cutting output', total(stages('cutting'), 'output_quantity')],
        ['Production output', total(stages('production'), 'output_quantity')],
        ['Finishing output', total(stages('finishing'), 'output_quantity')],
        ['Items in stock', (data.stock_register || []).reduce((sum: number, row: any) => sum + Number(row.closing_balance || 0), 0)],
    ];
    const onDate = (rows: any[], field: string, date: string) => rows.filter((row: any) => reportDate(row[field]) === date);

    return <article className="report-document report-landscape noguchi-logistics-report">
        <style>{'@media print{@page{size:A4 landscape;margin:7mm}}'}</style>
        <header><div><h1>{data.factory.name}</h1><p>School garment logistics</p></div><div><b>DAILY LOGISTICS REPORT</b><span>{data.report.from} to {data.report.to}</span></div></header>
        <section className="report-meta"><span>Prepared by: {data.report.generated_by}</span><span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span><span>Live warehouse and factory flow</span></section>
        <div className="report-summary">{flowTotals.map(([label, value]: any) => <div key={label}><span>{label}</span><b>{number(value)}</b></div>)}</div>
        <section className="report-section"><h2>Daily movement through factory sections</h2><div className="noguchi-report-scroll"><table className="noguchi-flow-table"><thead>
            <tr><th rowSpan={2}>Date</th><th colSpan={2}>Warehouse</th><th colSpan={2}>Cutting</th><th colSpan={2}>Production</th><th colSpan={2}>Finishing</th><th rowSpan={2}>Warehouse quantity in stock</th></tr>
            <tr><th>Input</th><th>Output</th><th>Input</th><th>Output</th><th>Input</th><th>Output</th><th>Input</th><th>Output</th></tr>
        </thead><tbody>{reportDates.map((date: string, index: number) => {
            const dayInventory = onDate(inventory, 'occurred_at', date);
            const dayProduction = onDate(production, 'updated_at', date);
            const area = (name: string) => dayProduction.filter((row: any) => stageArea(row.stage_name) === name);
            return <tr key={date}><td><b>{new Date(`${date}T00:00:00`).toLocaleDateString()}</b></td>
                <FlowCell records={dayInventory.filter((row: any) => Number(row.quantity_delta) > 0)} input/>
                <FlowCell records={dayInventory.filter((row: any) => Number(row.quantity_delta) < 0)}/>
                <FlowCell records={area('cutting')} input/><FlowCell records={area('cutting')}/>
                <FlowCell records={area('production')} input/><FlowCell records={area('production')}/>
                <FlowCell records={area('finishing')} input/><FlowCell records={area('finishing')}/>
                <td>{index === reportDates.length - 1 ? (data.stock_register || []).map((row: any) => <div className="noguchi-report-entry" key={`${row.sku}-${row.warehouse}`}><b>{row.item}</b><span>{number(row.closing_balance)}</span><small>{row.warehouse}</small></div>) : <span className="noguchi-report-empty">See closing day</span>}</td>
            </tr>;
        })}</tbody></table></div></section>
        <footer>{data.factory.name} · Logistics daily report · Generated by ICYEREKEZO OMS</footer>
    </article>;
}

const readableStatus=(value:any)=>({pending:'Pending',accepted:'Accepted',rejected:'Rejected',partial:'Partially delivered',delivered:'Delivered',planned:'Planned',ready:'Ready to dispatch',in_transit:'In transit',cancelled:'Cancelled',maintenance:'In maintenance',available:'Available',assigned:'Assigned'} as any)[value]||String(value||'Not set').replaceAll('_',' ');
const shortOrder=(value:any)=>String(value||'').replace(/^LEGACY-NOGUCHI-/i,'');
function LogisticsDocument({data}:any){const report=data.logistics||{},summary=report.summary||{},orders=report.orders||[],shipments=report.shipments||[],vehicles=report.vehicles||[];return <article className="report-document report-landscape logistics-status-report"><style>{'@media print{@page{size:A4 landscape;margin:7mm}}'}</style><header><div><h1>{data.factory.name}</h1><p>Logistics and dispatch operations</p></div><div><b>LOGISTICS STATUS REPORT</b><span>{data.report.from} to {data.report.to}</span></div></header><section className="report-meta"><span>Prepared by: {data.report.generated_by}</span><span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span><span>Department: Logistics</span></section><div className="report-summary logistics-report-summary">{[['Orders processed',summary.orders_processed],['Items ordered',summary.items_ordered],['Items delivered',summary.items_delivered],['Remaining',summary.items_remaining],['Returned / rejected',summary.items_returned],['Order value',`RWF ${number(summary.total_value)}`],['Shipments',summary.shipments],['Deliveries completed',summary.deliveries_completed]].map(([label,value])=><div key={label}><span>{label}</span><b>{typeof value==='number'?number(value):value}</b></div>)}</div><div className="logistics-report-pair"><Table title="Order status" headers={['Status','Orders']} rows={(report.order_statuses||[]).map((row:any)=>[readableStatus(row.status),number(row.count)])}/><Table title="Returned or rejected items" headers={['Reason','Items']} rows={(report.return_reasons||[]).map((row:any)=>[row.reason,number(row.quantity)])}/></div><Table title="School and customer orders" headers={['Date','Order','School / customer','District and sector','Items','Delivered','Remaining','Value','Status']} rows={orders.map((row:any)=>{const delivered=(row.lines||[]).reduce((sum:number,line:any)=>sum+Number(line.quantity_delivered||0),0);return [reportDate(row.document_date),shortOrder(row.document_number),row.school?.name||row.customer_name,[row.school?.district,row.school?.sector].filter(Boolean).join(' / ')||'Not set',number(row.item_count),number(delivered),number(Math.max(0,Number(row.item_count)-delivered)),`${row.currency_code||'RWF'} ${number(row.total_amount)}`,readableStatus(row.status)]})}/><Table title="Shipments and delivery confirmations" headers={['Shipment','Order','Customer','Destination','Packages','Vehicle','Driver','Status','Planned','Delivered','Received by','Proof']} rows={shipments.map((row:any)=>[row.shipment_number,shortOrder(row.sales_document?.document_number),row.customer_name,row.destination,number(row.package_count),row.vehicle?.registration_number||'Not assigned',row.vehicle?.driver_name||'Not assigned',readableStatus(row.status),row.planned_dispatch_at?new Date(row.planned_dispatch_at).toLocaleString():'Not set',row.delivered_at?new Date(row.delivered_at).toLocaleString():'Not delivered',row.received_by||'Not recorded',row.proof_reference||'Not recorded'])}/><Table title="Vehicles and drivers" headers={['Registration','Vehicle type','Driver','Phone','Capacity','Status']} rows={vehicles.map((row:any)=>[row.registration_number,row.vehicle_type,row.driver_name||'Not assigned',row.driver_phone||'Not set',row.capacity?`${number(row.capacity)} ${row.capacity_unit||''}`:'Not set',readableStatus(row.status)])}/><Table title="Warehouse stock balances" headers={['Item','SKU','Warehouse','Opening','Received','Issued','Closing']} rows={(data.stock_register||[]).map((row:any)=>[row.item,row.sku,row.warehouse,number(row.opening_balance),number(row.quantity_in),number(row.quantity_out),number(row.closing_balance)])}/><footer>{data.factory.name} · Logistics and dispatch report · Generated by ICYEREKEZO OMS</footer></article>}

function Document({data}: any) {
    if(data.report.scope==='logistics')return <LogisticsDocument data={data}/>;
    const departmentOnly = data.report.scope === 'department';
    const logisticsOnly = data.report.scope === 'logistics';
    return <article className={`report-document report-${data.standard.orientation || 'landscape'}`}>
        <style>{`@media print{@page{size:A4 ${data.standard.orientation === 'portrait' ? 'portrait' : 'landscape'};margin:10mm}}`}</style>
        <header>
            <div>
                <h1>{data.factory.name}</h1>
                <p>{String(data.factory.industry_type).replaceAll('_', ' ')}</p>
            </div>
            <div>
                <b>{data.standard.title.toUpperCase()}</b>
                <span>{data.report.from} to {data.report.to}</span>
            </div>
        </header>
        <section className="report-meta">
            <span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span>
            <span>Prepared by: {data.report.generated_by}</span>
            <span>Scope: {data.report.scope_label}</span>
        </section>
        {data.standard.show_summary && <div className="report-summary">
            <div><span>Departments reporting</span><b>{number(data.summary.flow_categories ?? data.summary.departments)}</b></div>
            <div><span>Production orders</span><b>{number(data.summary.production_orders)}</b></div>
            <div><span>Work entries</span><b>{number(data.summary.work_records)}</b></div>
            <div><span>Total received</span><b>{number(data.summary.quantity_received)}</b></div>
            <div><span>Total completed</span><b>{number(data.summary.quantity_completed)}</b></div>
            <div><span>Damaged / rejected</span><b>{number(data.summary.damaged_quantity)}</b></div>
            <div><span>Waste</span><b>{number(data.summary.waste_quantity)}</b></div>
        </div>}

        {data.standard.show_daily_register && <DailyRegister data={data}/>}

        {data.standard.show_department_totals && <DepartmentMatrix data={data}/>}

        {!departmentOnly && data.standard.show_stock_register && <Table
            title="Warehouse stock register"
            headers={['Item', 'SKU', 'Warehouse', 'Opening balance', 'Quantity in', 'Quantity out', 'Closing balance']}
            rows={(data.stock_register || []).map((row: any) => [
                row.item, row.sku, row.warehouse, number(row.opening_balance), number(row.quantity_in),
                number(row.quantity_out), number(row.closing_balance),
            ])}
        />}

        {data.standard.show_guidance && <section className="report-guidance">
            <h2>Information used for this industry</h2>
            <p>Record these details on products, batches and orders when they apply: {data.standard.attributes.join(', ')}.</p>
            <p>Typical units: {data.standard.unit_examples.join(', ')}. The report always shows the unit saved with each product.</p>
        </section>}

        <footer>{data.factory.name} · {data.standard.footer_text || 'Generated by ICYEREKEZO OMS'} · {new Date(data.report.generated_at).toLocaleDateString()}</footer>
    </article>;
}

export default function ClearReportsPage({canExport, productionOnly = false}: any) {
    const today = new Date().toISOString().slice(0, 10);
    const [filters, setFilters] = useState({period: 'day', type: productionOnly ? 'production' : 'all', department_id: '', from: today, to: today, status:'', district:''});
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [updated, setUpdated] = useState<Date | null>(null);
    const defaultPeriodApplied = useRef(false);
    const reportScope = data?.report?.scope;
    const logisticsOnly = reportScope === 'logistics';
    const departmentOnly = reportScope === 'department';
    const factoryWide = reportScope === 'factory';

    useEffect(() => {
        let active = true;
        const load = async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                const result = await api(`/api/reports?${new URLSearchParams(filters)}`);
                if (active) {
                    setData(result);
                    setError('');
                    setUpdated(new Date());
                    if (!defaultPeriodApplied.current && result.standard?.default_period && result.standard.default_period !== filters.period) {
                        defaultPeriodApplied.current = true;
                        setFilters(current => ({...current, period: result.standard.default_period}));
                    }
                }
            } catch (exception: any) {
                if (active) setError(exception.message);
            } finally {
                if (active && !silent) setLoading(false);
            }
        };
        const wait = setTimeout(() => load(), 200);
        const timer = setInterval(() => load(true), 5000);
        return () => {
            active = false;
            clearTimeout(wait);
            clearInterval(timer);
        };
    }, [filters.period, filters.type, filters.department_id, filters.from, filters.to, filters.status, filters.district]);

    return <section className="module-page report-page">
        <div className="no-print">
            <div className="module-hero">
                <div className="module-title">
                    <span><FileText/></span>
                    <div>
                        <div className="eyebrow"><i/>LIVE FACTORY WORK</div>
                        <h1>{logisticsOnly ? 'Daily logistics report' : departmentOnly ? `${data?.report?.scope_label || 'Department'} daily report` : productionOnly ? 'Daily production report' : 'Daily factory report'}</h1>
                        <p>{logisticsOnly ? 'See only goods received, goods issued and warehouse balances handled by logistics.' : departmentOnly ? 'See only your department input, output, rejected quantity and waste.' : 'Combined factory report for management, covering every department and warehouse.'}</p>
                    </div>
                </div>
                {canExport && <button className="primary-btn" disabled={!data} onClick={() => window.print()}><Printer size={17}/>Print / Save PDF</button>}
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            <div className="panel report-filters">
                <label>Report period
                    <select value={filters.period} onChange={event => setFilters({...filters, period: event.target.value})}>
                        <option value="day">Today</option>
                        <option value="week">Last 7 days</option>
                        <option value="month">This month</option>
                        <option value="custom">Choose dates</option>
                    </select>
                </label>
                {factoryWide && <label>Department
                    <select value={filters.department_id} onChange={event => setFilters({...filters, department_id: event.target.value})}>
                        <option value="">All departments</option>
                        {(data?.filters?.departments || []).map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                </label>}
                {logisticsOnly&&<><label>Order status<select value={filters.status} onChange={event=>setFilters({...filters,status:event.target.value})}><option value="">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="partial">Partially delivered</option><option value="delivered">Delivered</option><option value="rejected">Rejected</option></select></label><label>District<select value={filters.district} onChange={event=>setFilters({...filters,district:event.target.value})}><option value="">All districts</option>{(data?.filters?.districts||[]).map((district:string)=><option key={district}>{district}</option>)}</select></label></>}
                {filters.period === 'custom' && <>
                    <label>From<input type="date" value={filters.from} onChange={event => setFilters({...filters, from: event.target.value})}/></label>
                    <label>To<input type="date" value={filters.to} onChange={event => setFilters({...filters, to: event.target.value})}/></label>
                </>}
                <div className="live-report-status"><i/><span>{loading ? 'Updating…' : updated ? `Live · ${updated.toLocaleTimeString()}` : 'Connecting…'}</span></div>
            </div>
        </div>
        {data && <Document data={data}/>}
    </section>;
}
