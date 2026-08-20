import React, {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, FileText, Printer} from 'lucide-react';
import {LegacyOrderMatrix, OrderDetailsModal} from '../sales/SalesOverviewPage';

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

const printCategories=['Uniform','Sweater','Sport Uniform','TVET','Tourism','Polo','T-shirt','Rain Coat','Jumper'];
function PrintCategoryCell({order,category}:any){const aliases:Record<string,string[]>={TVET:['tvet','overall','overcoat'],'Sport Uniform':['sport','sport uniform'],'Rain Coat':['rain coat','raincoat'],'Polo':['polo','polo lacoste'],'T-shirt':['t-shirt','t shirt']};const names=aliases[category]||[category.toLowerCase()];const lines=(order.lines||[]).filter((line:any)=>names.includes(String(line.garment_category||'').toLowerCase()));const total=lines.reduce((sum:number,line:any)=>sum+Number(line.quantity_ordered||0),0);return <td className="print-category-total">{total?number(total):'—'}</td>}
function NoguchiPrintOrderTable({rows}:any){return <section className="noguchi-print-order-table"><table><thead><tr><th>No.</th><th>School</th>{printCategories.map(category=><th key={category}>{category}</th>)}<th>Total Qty</th><th>Total Amount</th><th>Contact</th><th>Comment / Status</th></tr></thead><tbody>{rows.map((order:any,index:number)=><tr key={order.id}><td>{index+1}</td><td><b>{order.school?.name||order.customer_name}</b><small>{order.document_number}</small></td>{printCategories.map(category=><PrintCategoryCell key={category} order={order} category={category}/>)}<td><b>{number(order.item_count)}</b></td><td>{order.currency_code||'RWF'} {number(order.total_amount)}</td><td>{order.school?.phone||order.customer_email||'—'}</td><td>{readableStatus(order.status)}{order.due_date?<small>Due {reportDate(order.due_date)}</small>:null}</td></tr>)}</tbody></table></section>}

function DailyRegister({data}: any) {
    const days = data.daily_activity || [];
    
    if (!days.length) {
        return <article className="panel noguchi-cutting-report" style={{marginBottom: 24}}>
            <header>
                <div><small>OFFICIAL FACTORY REGISTER</small><h2>{data.factory?.name || 'NOGUCHI HOLDINGS LTD'}</h2><p>Daily work register</p></div>
                <div><span>REPORT DATE<b>{new Date(data.report.generated_at).toLocaleDateString()}</b></span><span>PREPARED BY<b>{data.report.generated_by}</b></span></div>
            </header>
              <div className="noguchi-cutting-table-wrap" style={{ overflowX: 'auto' }}><table><thead>
                  <tr>
                      <th rowSpan={2} style={{verticalAlign: 'middle'}}>DATE</th>
                      <th colSpan={3} style={{textAlign: 'center', padding: '12px'}}>INPUT</th>
                      <th colSpan={4} style={{textAlign: 'center', padding: '12px'}}>OUTPUT</th>
                  </tr>
                  <tr>
                      <th>STYLE</th><th>SIZE</th><th>QTY</th>
                      <th>COLOR</th><th>STYLE</th><th>SIZE</th><th>QTY</th>
                  </tr>
              </thead><tbody>
                  <tr><td colSpan={8} className="empty-cell">No work was recorded for this period.</td></tr>
              </tbody></table></div>
        </article>;
    }

    return <>{days.map((day: any) => <article key={day.date} className="panel noguchi-cutting-report" style={{marginBottom: 24}}>
        <header>
            <div><small>OFFICIAL FACTORY REGISTER</small><h2>{data.factory?.name || 'NOGUCHI HOLDINGS LTD'}</h2><p>Daily work register</p></div>
            <div><span>REPORT DATE<b>{new Date(`${day.date}T00:00:00`).toLocaleDateString()}</b></span><span>PREPARED BY<b>{data.report.generated_by}</b></span></div>
        </header>
          <div className="noguchi-cutting-table-wrap" style={{ overflowX: 'auto' }}><table><thead>
              <tr>
                  <th rowSpan={2} style={{verticalAlign: 'middle'}}>DATE</th>
                  <th colSpan={3} style={{textAlign: 'center', padding: '12px'}}>INPUT</th>
                  <th colSpan={4} style={{textAlign: 'center', padding: '12px'}}>OUTPUT</th>
              </tr>
              <tr>
                  <th>STYLE</th><th>SIZE</th><th>QTY</th>
                  <th>COLOR</th><th>STYLE</th><th>SIZE</th><th>QTY</th>
              </tr>
          </thead><tbody>
                {day.departments.map((department: any) => department.records.map((record: any, index: number) => {
                  const info = splitItem(record.product);
                  const fabricColor = String(record.fabric || record.product || '').match(/\b(green|blue|red|yellow|black|white|navy|grey|gray|brown|orange|purple|pink|beige|cream)\b/i)?.[1];
                  const color = info.color !== '—' && info.color !== '?' ? info.color : (fabricColor || '\u2014');
                  const style = info.style !== record.product ? info.style : '\u2014';
                  
                  return <tr key={`${department.department_id}-${index}`}>
                      <td>{new Date(`${day.date}T00:00:00`).toLocaleDateString()}</td>
                      <td>{style}</td><td>{info.size}</td><td>{record.received > 0 ? <b>{number(record.received)}</b> : '\u2014'}</td>
                      <td>{color}</td><td>{style}</td><td>{info.size}</td><td>{record.completed > 0 ? <b>{number(record.completed)}</b> : '\u2014'}</td>
                  </tr>;
              }))}
          </tbody></table></div>
    </article>)}</>;
}

function DepartmentMatrix({data}: any) {
    const departments = data.department_activity || [];
    const metrics = [
        [data.standard.input_label, (row: any) => quantity(row.received_quantity, row.unit)],
        [data.standard.output_label, (row: any) => quantity(row.completed_quantity, row.unit)],
        ['Damaged / rejected', (row: any) => quantity(row.damaged_quantity, row.unit)],
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

const noguchiFactoryName = (value: any) => String(value || '').trim().toLowerCase() === 'noguchi holdings ltd';
const itemKind = (name: any) => /thread|zip|button|elastic|label|accessor/i.test(String(name || '')) ? 'accessory' : 'fabric';
const splitItem = (name: any) => {
    const text = String(name || 'Unspecified');
    const parts = text.split(/\s[-–—|/]\s/).map(value => value.trim()).filter(Boolean);
    
    let style = parts[0] || text;
    let color = parts[1] || '—';
    let size = parts[2] || '—';

    // If there are only two parts (e.g. "Short - M"), the second part is likely the size.
    if (parts.length === 2 && (color.length <= 4 || !isNaN(Number(color)))) {
        size = color;
        color = '—';
    }
    
    return {style, color, size};
};
function NoguchiEntry({rows, mode = 'inventory'}: any) {
    if (!rows.length) return <span className="noguchi-daily-empty">—</span>;
    return <>{rows.map((row: any, index: number) => {
        const info = splitItem(row.item_name || row.product_name);
        const qty = Math.abs(Number(mode === 'inventory' ? row.quantity_delta : row.output_quantity || row.input_quantity || 0));
        return <span className="noguchi-daily-entry" key={`${row.id}-${index}`}><b>{info.style}</b><small>{info.color} · {info.size}</small><strong>{number(qty)}</strong></span>;
    })}</>;
}
function NoguchiFieldCell({rows, field, mode = 'production'}: any) {
    return <td>{rows.length ? rows.map((row:any,index:number) => {
        const info = splitItem(row.item_name || row.product_name);
        const value = field === 'quantity'
            ? number(Math.abs(Number(mode === 'inventory' ? row.quantity_delta : row.output_quantity || row.input_quantity || 0)))
            : info[field as 'style'|'color'|'size'];
        return <span className={`noguchi-field-value ${field === 'quantity' ? 'quantity' : ''}`} key={`${row.id}-${field}-${index}`}>{value}</span>;
    }) : <span className="noguchi-daily-empty">—</span>}</td>;
}
const printField = (rows:any[], field:string, mode='production') => rows.length ? rows.map((row:any) => {
    const info = splitItem(row.item_name || row.product_name);
    return field === 'quantity' ? number(Math.abs(Number(mode === 'inventory' ? row.quantity_delta : row.output_quantity || row.input_quantity || 0))) : info[field as 'style'|'color'|'size'];
}).join('\n') : '—';
function NoguchiPrintSection({title, headers, rows}:any) {
    return <section className="noguchi-print-section"><h3>{title}</h3><table><thead><tr>{headers.map((header:string)=><th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row:any[],index:number)=><tr key={index}>{row.map((cell:any,cellIndex:number)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></section>;
}
function NoguchiDailyDocument({data}: any) {
    const inventory = data.inventory || [], production = data.production || [], stock = data.stock_register || [];
    const scrollRef = useRef<HTMLDivElement>(null);
    const dates = Array.from(new Set([...inventory.map((row: any) => reportDate(row.occurred_at)), ...production.map((row: any) => reportDate(row.updated_at))].filter(Boolean))).sort();
    const reportDates = dates.length ? dates : [data.report.to];
    const byDate = (rows: any[], field: string, date: string) => rows.filter(row => reportDate(row[field]) === date);
    const stageRows = (rows: any[], area: string) => rows.filter(row => stageArea(row.stage_name) === area);
    const inventoryRows = (rows: any[], direction: 'in'|'out', kind: 'fabric'|'accessory') => rows.filter(row => (direction === 'in' ? Number(row.quantity_delta) > 0 : Number(row.quantity_delta) < 0) && itemKind(row.item_name) === kind);
    const fields = (rows:any[], mode = 'production', names = ['style','color','size','quantity']) => <>{names.map(field=><NoguchiFieldCell key={field} rows={rows} field={field} mode={mode}/>)}</>;
    const sum = (rows:any[], key:string) => rows.reduce((total:number,row:any)=>total+Math.abs(Number(row[key]||0)),0);
    const summary = [['Warehouse received',sum(inventory.filter((row:any)=>Number(row.quantity_delta)>0),'quantity_delta')],['Warehouse issued',sum(inventory.filter((row:any)=>Number(row.quantity_delta)<0),'quantity_delta')],['Factory output',sum(production,'output_quantity')],['Closing stock',stock.reduce((total:number,row:any)=>total+Number(row.closing_balance||0),0)]];
    const dailyRows = reportDates.map((date:string,index:number) => ({date,label:new Date(`${date}T00:00:00`).toLocaleDateString(),inventory:byDate(inventory,'occurred_at',date),production:byDate(production,'updated_at',date),stock:index===reportDates.length-1?stock.map((row:any)=>({...row,id:`stock-${row.sku}-${row.warehouse}`,item_name:row.item,quantity_delta:row.closing_balance})):[]}));
    useEffect(()=>{scrollRef.current?.scrollTo({left:0,behavior:'smooth'})},[data.report.from,data.report.to,data.report.department_id]);
    const move = (direction:number) => scrollRef.current?.scrollBy({left:direction*Math.max(420,scrollRef.current.clientWidth*.72),behavior:'smooth'});
    return <article className="noguchi-daily-document">
        <style>{'@media print{@page{size:landscape;margin:8mm}}'}</style>
        <header><div><span className="noguchi-report-kicker">OFFICIAL FACTORY REGISTER</span><h1>{data.factory.name.toUpperCase()}</h1><h2>Daily operations report</h2></div><section><span><small>Reporting period</small><b>{data.report.from} — {data.report.to}</b></span><span><small>Prepared by</small><b>{data.report.generated_by}</b></span><span><small>Generated</small><b>{new Date(data.report.generated_at).toLocaleString()}</b></span></section></header>
        <section className="noguchi-daily-summary">{summary.map(([label,value])=><div key={String(label)}><span>{label}</span><b>{number(value)}</b></div>)}</section>
        <div className="noguchi-table-toolbar no-print"><div><b>Daily movement register</b><span>Scroll across to review every factory section</span></div><div><button type="button" onClick={()=>move(-1)} aria-label="View previous report columns"><ChevronLeft/></button><button type="button" onClick={()=>move(1)} aria-label="View next report columns"><ChevronRight/></button></div></div>
        <div className="noguchi-daily-scroll" ref={scrollRef}><table><thead>
            <tr><th rowSpan={3}>DATE</th><th colSpan={8}>WAREHOUSE</th><th colSpan={6}>CUTTING</th><th colSpan={8}>PRODUCTION</th><th colSpan={8}>FINISHING</th><th colSpan={4}>WAREHOUSE</th></tr>
            <tr><th colSpan={4}>INPUT</th><th colSpan={4}>OUTPUT</th><th colSpan={2}>INPUT</th><th colSpan={4}>OUTPUT</th><th colSpan={4}>INPUT</th><th colSpan={4}>OUTPUT</th><th colSpan={4}>INPUT</th><th colSpan={4}>OUTPUT</th><th colSpan={4}>QTY IN STOCK</th></tr>
            <tr><th>COLOR</th><th>METERS</th><th>COLOR</th><th>QTY</th><th>COLOR</th><th>METERS</th><th>COLOR</th><th>QTY</th><th>COLOR</th><th>METERS</th><th>STYLE</th><th>COLOR</th><th>SIZE</th><th>QTY</th><th>STYLE</th><th>COLOR</th><th>SIZE</th><th>QTY</th><th>STYLE</th><th>COLOR</th><th>SIZE</th><th>QTY</th><th>STYLE</th><th>COLOR</th><th>SIZE</th><th>QTY</th><th>STYLE</th><th>COLOR</th><th>SIZE</th><th>QTY</th><th>STYLE</th><th>COLOR</th><th>SIZE</th><th>QTY</th></tr>
        </thead><tbody>{reportDates.map((date: string, index: number) => {
            const dayInventory = byDate(inventory, 'occurred_at', date), dayProduction = byDate(production, 'updated_at', date);
            return <tr key={date}><td>{new Date(`${date}T00:00:00`).toLocaleDateString()}</td>
                {fields(inventoryRows(dayInventory,'in','fabric'),'inventory',['color','quantity'])}{fields(inventoryRows(dayInventory,'in','accessory'),'inventory',['color','quantity'])}
                {fields(inventoryRows(dayInventory,'out','fabric'),'inventory',['color','quantity'])}{fields(inventoryRows(dayInventory,'out','accessory'),'inventory',['color','quantity'])}
                {fields(stageRows(dayProduction,'cutting'),'production',['color','quantity'])}{fields(stageRows(dayProduction,'cutting'))}
                {fields(stageRows(dayProduction,'production'))}{fields(stageRows(dayProduction,'production'))}
                {fields(stageRows(dayProduction,'finishing'))}{fields(stageRows(dayProduction,'finishing'))}
                {fields(index === reportDates.length - 1 ? stock.map((row:any)=>({...row,id:`stock-${row.sku}-${row.warehouse}`,item_name:row.item,quantity_delta:row.closing_balance})) : [],'inventory')}
            </tr>;
        })}</tbody></table></div>
        <div className="noguchi-print-register">
            <NoguchiPrintSection title="Warehouse movement" headers={['Date','Input fabric color','Input metres','Input accessory color','Input qty','Output fabric color','Output metres','Output accessory color','Output qty']} rows={dailyRows.map(day=>{const inFabric=inventoryRows(day.inventory,'in','fabric'),inAccessory=inventoryRows(day.inventory,'in','accessory'),outFabric=inventoryRows(day.inventory,'out','fabric'),outAccessory=inventoryRows(day.inventory,'out','accessory');return [day.label,printField(inFabric,'color','inventory'),printField(inFabric,'quantity','inventory'),printField(inAccessory,'color','inventory'),printField(inAccessory,'quantity','inventory'),printField(outFabric,'color','inventory'),printField(outFabric,'quantity','inventory'),printField(outAccessory,'color','inventory'),printField(outAccessory,'quantity','inventory')]})}/>
            <NoguchiPrintSection title="Cutting" headers={['Date','Input color','Input metres','Output style','Output color','Output size','Output qty']} rows={dailyRows.map(day=>{const records=stageRows(day.production,'cutting');return [day.label,printField(records,'color'),printField(records,'quantity'),printField(records,'style'),printField(records,'color'),printField(records,'size'),printField(records,'quantity')]})}/>
            <NoguchiPrintSection title="Production" headers={['Date','Input style','Input color','Input size','Input qty','Output style','Output color','Output size','Output qty']} rows={dailyRows.map(day=>{const records=stageRows(day.production,'production');return [day.label,printField(records,'style'),printField(records,'color'),printField(records,'size'),printField(records,'quantity'),printField(records,'style'),printField(records,'color'),printField(records,'size'),printField(records,'quantity')]})}/>
            <NoguchiPrintSection title="Finishing" headers={['Date','Input style','Input color','Input size','Input qty','Output style','Output color','Output size','Output qty']} rows={dailyRows.map(day=>{const records=stageRows(day.production,'finishing');return [day.label,printField(records,'style'),printField(records,'color'),printField(records,'size'),printField(records,'quantity'),printField(records,'style'),printField(records,'color'),printField(records,'size'),printField(records,'quantity')]})}/>
            <NoguchiPrintSection title="Warehouse closing stock" headers={['Date','Style / item','Color','Size','Quantity']} rows={dailyRows.map(day=>[day.label,printField(day.stock,'style','inventory'),printField(day.stock,'color','inventory'),printField(day.stock,'size','inventory'),printField(day.stock,'quantity','inventory')])}/>
        </div>
        <footer><span>NOGUCHI HOLDINGS LTD · DAILY FACTORY OPERATIONS</span><span>Generated by ICYEREKEZO OMS</span></footer>
    </article>;
}

const readableStatus=(value:any)=>({pending:'Pending',accepted:'Accepted',rejected:'Rejected',partial:'Partially delivered',delivered:'Delivered',planned:'Planned',ready:'Ready to dispatch',in_transit:'In transit',cancelled:'Cancelled',maintenance:'In maintenance',available:'Available',assigned:'Assigned'} as any)[value]||String(value||'Not set').replaceAll('_',' ');
const shortOrder=(value:any)=>String(value||'').replace(/^LEGACY-NOGUCHI-/i,'');
function LogisticsDocument({data}:any){const report=data.logistics||{},summary=report.summary||{},orders=report.orders||[],shipments=report.shipments||[],vehicles=report.vehicles||[];return <article className="report-document report-landscape logistics-status-report"><style>{'@media print{@page{size:A4 landscape;margin:7mm}}'}</style><header><div><h1>{data.factory.name}</h1><p>Logistics and dispatch operations</p></div><div><b>LOGISTICS STATUS REPORT</b><span>{data.report.from} to {data.report.to}</span></div></header><section className="report-meta"><span>Prepared by: {data.report.generated_by}</span><span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span><span>Department: Logistics</span></section><div className="report-summary logistics-report-summary">{[['Orders processed',summary.orders_processed],['Items ordered',summary.items_ordered],['Items delivered',summary.items_delivered],['Remaining',summary.items_remaining],['Returned / rejected',summary.items_returned],['Order value',`RWF ${number(summary.total_value)}`],['Shipments',summary.shipments],['Deliveries completed',summary.deliveries_completed]].map(([label,value])=><div key={label}><span>{label}</span><b>{typeof value==='number'?number(value):value}</b></div>)}</div><div className="logistics-report-pair"><Table title="Order status" headers={['Status','Orders']} rows={(report.order_statuses||[]).map((row:any)=>[readableStatus(row.status),number(row.count)])}/><Table title="Returned or rejected items" headers={['Reason','Items']} rows={(report.return_reasons||[]).map((row:any)=>[row.reason,number(row.quantity)])}/></div><Table title="School and customer orders" headers={['Date','Order','School / customer','District and sector','Items','Delivered','Remaining','Value','Status']} rows={orders.map((row:any)=>{const delivered=(row.lines||[]).reduce((sum:number,line:any)=>sum+Number(line.quantity_delivered||0),0);return [reportDate(row.document_date),shortOrder(row.document_number),row.school?.name||row.customer_name,[row.school?.district,row.school?.sector].filter(Boolean).join(' / ')||'Not set',number(row.item_count),number(delivered),number(Math.max(0,Number(row.item_count)-delivered)),`${row.currency_code||'RWF'} ${number(row.total_amount)}`,readableStatus(row.status)]})}/><Table title="Shipments and delivery confirmations" headers={['Shipment','Order','Customer','Destination','Packages','Vehicle','Driver','Status','Planned','Delivered','Received by','Proof']} rows={shipments.map((row:any)=>[row.shipment_number,shortOrder(row.sales_document?.document_number),row.customer_name,row.destination,number(row.package_count),row.vehicle?.registration_number||'Not assigned',row.vehicle?.driver_name||'Not assigned',readableStatus(row.status),row.planned_dispatch_at?new Date(row.planned_dispatch_at).toLocaleString():'Not set',row.delivered_at?new Date(row.delivered_at).toLocaleString():'Not delivered',row.received_by||'Not recorded',row.proof_reference||'Not recorded'])}/><Table title="Vehicles and drivers" headers={['Registration','Vehicle type','Driver','Phone','Capacity','Status']} rows={vehicles.map((row:any)=>[row.registration_number,row.vehicle_type,row.driver_name||'Not assigned',row.driver_phone||'Not set',row.capacity?`${number(row.capacity)} ${row.capacity_unit||''}`:'Not set',readableStatus(row.status)])}/><Table title="Warehouse stock balances" headers={['Item','SKU','Warehouse','Opening','Received','Issued','Closing']} rows={(data.stock_register||[]).map((row:any)=>[row.item,row.sku,row.warehouse,number(row.opening_balance),number(row.quantity_in),number(row.quantity_out),number(row.closing_balance)])}/><footer>{data.factory.name} · Logistics and dispatch report · Generated by ICYEREKEZO OMS</footer></article>}

function Document({data}: any) {
    if(data.report.scope==='logistics')return String(data.factory?.name||'').trim().toLowerCase()==='noguchi holdings ltd'?null:<LogisticsDocument data={data}/>;
    if(data.report.scope==='factory' && noguchiFactoryName(data.factory?.name))return <NoguchiDailyDocument data={data}/>;
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
            <div><span>Total received</span><b>{number(data.summary.quantity_received)}</b></div>
            <div><span>Total completed</span><b>{number(data.summary.quantity_completed)}</b></div>
            <div><span>Damaged / rejected</span><b>{number(data.summary.damaged_quantity)}</b></div>
        </div>}

        {data.standard.show_daily_register && <div className="noguchi-cutting-report"><DailyRegister data={data}/></div>}

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
    const searchParams = new URLSearchParams(window.location.search);
    const initialFilters = {
        period: searchParams.get('period') || 'day',
        type: searchParams.get('type') || (productionOnly ? 'production' : 'all'),
        department_id: searchParams.get('department_id') || '',
        from: searchParams.get('from') || today,
        to: searchParams.get('to') || today,
        status: searchParams.get('status') || '',
        district: searchParams.get('district') || '',
        sector: searchParams.get('sector') || ''
    };
    const [filters, setFilters] = useState(initialFilters);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [reportPage, setReportPage] = useState(1);
    
    // We only want to apply the default period if the user didn't specify one in the URL
    const hasInitialPeriod = useRef(searchParams.has('period'));
    const defaultPeriodApplied = useRef(false);

    const reportScope = data?.report?.scope;
    const logisticsOnly = reportScope === 'logistics';
    const noguchiOrdersOnly = logisticsOnly && String(data?.factory?.name||'').trim().toLowerCase()==='noguchi holdings ltd';
    const departmentOnly = reportScope === 'department';
    const factoryWide = reportScope === 'factory';
    const noguchiFactoryWide = factoryWide && noguchiFactoryName(data?.factory?.name);
    const reportOrders = data?.logistics?.orders || [];
    const reportPageSize = 10;
    const reportLastPage = Math.max(1, Math.ceil(reportOrders.length / reportPageSize));
    const visibleReportOrders = reportOrders.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize);

    useEffect(() => { setReportPage(1); }, [filters.period, filters.status, filters.district, filters.sector, filters.from, filters.to]);
    const changeReportPage = (nextPage: number) => {
        setReportPage(nextPage);
        window.requestAnimationFrame(() => document.querySelector('.legacy-order-sheet')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
    };

    useEffect(() => {
        let active = true;
        const load = async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                // Only include non-empty filters in the URL
                const activeFilters = Object.fromEntries(
                    Object.entries(filters).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
                );
                const params = new URLSearchParams(activeFilters as any);
                window.history.replaceState(null, '', `?${params.toString()}`);
                
                const result = await api(`/api/reports?${params.toString()}`);
                if (active) {
                    setData(result);
                    setError('');
                    setUpdated(new Date());
                    
                    // Only apply the server's default period if we haven't already and the user didn't request a specific one
                    if (!defaultPeriodApplied.current) {
                        defaultPeriodApplied.current = true;
                        if (!hasInitialPeriod.current && result.standard?.default_period && result.standard.default_period !== filters.period) {
                            setFilters(current => ({...current, period: result.standard.default_period}));
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
    }, [filters.period, filters.type, filters.department_id, filters.from, filters.to, filters.status, filters.district, filters.sector]);

    return <section className="module-page report-page">
        <div className="no-print">
            <div className="module-hero">
                <div className="module-title">
                    <span><FileText/></span>
                    <div>
                        <div className="eyebrow"><i/>LIVE FACTORY WORK</div>
                        <h1>{noguchiOrdersOnly?'School order reports':noguchiFactoryWide?'NOGUCHI HOLDINGS LTD daily report':logisticsOnly ? 'Daily logistics report' : departmentOnly ? `${data?.report?.scope_label || 'Department'} daily report` : productionOnly ? 'Daily production report' : 'Daily factory report'}</h1>
                        <p>{noguchiOrdersOnly?'Review school order quantities, delivery progress, values and statuses by district and sector.':noguchiFactoryWide?'Warehouse, cutting, production, finishing and closing stock in the official Noguchi daily register format.':logisticsOnly ? 'See only goods received, goods issued and warehouse balances handled by logistics.' : departmentOnly ? 'See only your department input, output, rejected quantity and waste.' : 'Combined factory report for management, covering every department and warehouse.'}</p>
                    </div>
                </div>
                <div className="workflow-actions report-action-row">{noguchiOrdersOnly&&<a className="secondary-btn" href={`/api/reports/orders.xlsx?${new URLSearchParams(filters)}`}>Export Excel</a>}{noguchiFactoryWide&&<a className="secondary-btn" href={`/api/reports/daily.xlsx?${new URLSearchParams(filters)}`}>Export Excel</a>}<button className="primary-btn" disabled={!data} onClick={() => window.print()}><Printer size={17}/>Print filtered report</button></div>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            <div className="panel report-filters">
                <label>Report period
                    <select value={filters.period} onChange={event => setFilters({...filters, period: event.target.value})}>
                        {noguchiOrdersOnly&&<option value="all">All order dates</option>}
                        <option value="day">Today</option>
                        <option value="week">Last 7 days</option>
                        <option value="month">This month</option>
                        <option value="year">Yearly</option>
                        <option value="custom">Choose dates</option>
                    </select>
                </label>
                {factoryWide && <label>Department
                    <select value={filters.department_id} onChange={event => setFilters({...filters, department_id: event.target.value})}>
                        <option value="">All departments</option>
                        {(data?.filters?.departments || []).map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                </label>}
                {logisticsOnly&&<><label>Order status<select value={filters.status} onChange={event=>setFilters({...filters,status:event.target.value})}><option value="">All order statuses</option><option value="pending">Incoming / pending</option><option value="accepted">Accepted</option><option value="processing">In preparation</option><option value="ready">Ready for delivery</option><option value="partial">Partially delivered</option><option value="delivered">Delivered</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label><label>District<select value={filters.district} onChange={event=>setFilters({...filters,district:event.target.value,sector:''})}><option value="">All districts</option>{(data?.filters?.districts||[]).map((district:string)=><option key={district}>{district}</option>)}</select></label><label>Sector<select disabled={!filters.district} value={filters.sector} onChange={event=>setFilters({...filters,sector:event.target.value})}><option value="">{filters.district?'All sectors':'Choose district first'}</option>{(data?.filters?.sectors_by_district?.[filters.district]||[]).map((sector:string)=><option key={sector}>{sector}</option>)}</select></label></>}
                {filters.period === 'custom' && <>
                    <label>From<input type="date" value={filters.from} onChange={event => setFilters({...filters, from: event.target.value})}/></label>
                    <label>To<input type="date" value={filters.to} onChange={event => setFilters({...filters, to: event.target.value})}/></label>
                </>}
                <div className="live-report-status"><i/><span>{loading ? 'Updating…' : updated ? `Live · ${updated.toLocaleTimeString()}` : 'Connecting…'}</span></div>
            </div>
        </div>
        {noguchiOrdersOnly&&data&&<header className="noguchi-print-header"><div><b>{data.factory.name}</b><span>ICYEREKEZO OMS · School Garment Logistics</span></div><div><h1>School Order Quantity Report</h1><p>{data.report.from} to {data.report.to}</p></div><section><span><strong>Status:</strong> {filters.status||'All order statuses'}</span><span><strong>District:</strong> {filters.district||'All districts'}</span><span><strong>Sector:</strong> {filters.sector||'All sectors'}</span><span><strong>Generated:</strong> {new Date(data.report.generated_at).toLocaleString()}</span></section></header>}
        {noguchiOrdersOnly&&data&&<NoguchiPrintOrderTable rows={reportOrders}/>}
        {logisticsOnly && data && <LegacyOrderMatrix rows={noguchiOrdersOnly?visibleReportOrders:reportOrders} open={setSelectedOrder}/>}
        {noguchiOrdersOnly&&reportLastPage>1&&<nav className="school-pagination no-print" aria-label="School order report pages"><button className="secondary-btn" disabled={reportPage<=1} onClick={()=>changeReportPage(reportPage-1)}>Previous</button><span>Page {reportPage} of {reportLastPage} · {reportOrders.length.toLocaleString()} orders</span><button className="secondary-btn" disabled={reportPage>=reportLastPage} onClick={()=>changeReportPage(reportPage+1)}>Next</button></nav>}
        {noguchiOrdersOnly&&data&&<footer className="noguchi-print-footer"><span>{data.factory.name} · Confidential operational report</span><span>Generated by ICYEREKEZO OMS</span></footer>}
        {data && <Document data={data}/>}
        {selectedOrder && <OrderDetailsModal order={selectedOrder} editable={false} busy={null} run={async()=>false} close={()=>setSelectedOrder(null)}/>}
    </section>;
}
