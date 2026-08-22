<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\DeliveryVehicle;
use App\Models\ProductionStageExecution;
use App\Models\SalesDocument;
use App\Models\School;
use App\Models\Shipment;
use App\Models\StockTransaction;
use App\Support\IndustryDailyReportCatalog;
use App\Support\NoguchiDailyReportXlsxExporter;
use App\Support\OperationalScope;
use App\Support\SchoolOrderXlsxExporter;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function exportDaily(Request $request): BinaryFileResponse
    {
        $factory = $request->user()->currentFactory;
        abort_unless(strcasecmp(trim($factory->name), 'NOGUCHI HOLDINGS Ltd') === 0, 404);
        $data = $this->__invoke($request)->getData(true);
        abort_unless(($data['report']['scope'] ?? null) === 'factory', 403);
        $path = tempnam(sys_get_temp_dir(), 'noguchi-daily-').'.xlsx';
        NoguchiDailyReportXlsxExporter::create($data, $path);

        return response()->download($path, 'noguchi-daily-report-'.now()->format('Y-m-d-His').'.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    public function exportOrders(Request $request): BinaryFileResponse
    {
        $factory = $request->user()->currentFactory;
        abort_unless($factory->hasNoguchiSchoolOrders(), 404);
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['all', 'day', 'week', 'month', 'year', 'custom'])], 'from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', Rule::in(['draft', 'pending', 'submitted', 'accepted', 'confirmed', 'processing', 'ready', 'partial', 'delivered', 'completed', 'rejected', 'cancelled'])],
            'district' => ['nullable', 'string', 'max:80'], 'sector' => ['nullable', 'string', 'max:80'],
        ]);
        [$from, $to] = $this->range($data);
        $orders = SalesDocument::withoutGlobalScopes()->where('factory_id', $factory->id)->where('document_type', 'customer_order')
            ->whereDate('document_date', '>=', $from->toDateString())->whereDate('document_date', '<=', $to->toDateString())
            ->when($data['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when(($data['district'] ?? null) || ($data['sector'] ?? null), function ($query) use ($data, $factory) {
                $ids = School::withoutGlobalScopes()->where('factory_id', $factory->id)->when($data['district'] ?? null, fn ($schools, $district) => $schools->where('district', $district))->when($data['sector'] ?? null, fn ($schools, $sector) => $schools->where('sector', $sector))->pluck('id');
                $query->whereIn('school_id', $ids);
            })->with(['school:id,name,phone,district,sector', 'lines'])->latest('document_date')->latest('id')->get();
        $filters = array_merge(['period' => 'all', 'status' => '', 'district' => '', 'sector' => ''], $data);
        $path = tempnam(sys_get_temp_dir(), 'school-orders-').'.xlsx';
        SchoolOrderXlsxExporter::create($factory->name, $orders, $filters, $path);
        return response()->download($path, 'school-order-report-'.now()->format('Y-m-d-His').'.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])->deleteFileAfterSend(true);
    }

    public function __invoke(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;
        $roles = $request->attributes->get('factory_roles') ?? $request->user()->roles()->wherePivot('factory_id', $factory->id)->get();
        $isExecutive = $request->user()->is_platform_admin || $roles->whereIn('slug', ['factory-owner', 'factory-administrator', 'factory-manager'])->isNotEmpty();
        $dashboardKey = (string) ($roles->first()?->dashboard_key ?? 'operations');
        $logisticsOnly = ! $isExecutive && $dashboardKey === 'logistics';
        $warehouseOnly = ! $isExecutive && $dashboardKey === 'warehouse';
        $departmentOnly = ! $isExecutive && ! $logisticsOnly && ! $warehouseOnly;
        $operationalScope = OperationalScope::for($request->user());
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['all', 'day', 'week', 'month', 'year', 'custom'])],
            'type' => ['nullable', Rule::in(['all', 'departments', 'production', 'inventory', 'activity'])],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factory->id)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', Rule::in(['draft', 'pending', 'submitted', 'accepted', 'confirmed', 'processing', 'ready', 'partial', 'delivered', 'completed', 'rejected', 'cancelled'])],
            'district' => ['nullable', 'string', 'max:80'],
            'sector' => ['nullable', 'string', 'max:80'],
        ]);
        [$from, $to] = $this->range($data);
        $type = $departmentOnly ? 'production' : (($logisticsOnly || $warehouseOnly) ? 'inventory' : ($data['type'] ?? 'all'));
        $departmentId = isset($data['department_id']) ? (int) $data['department_id'] : null;
        if ($departmentOnly) {
            $departmentId = $operationalScope->profile?->department_id;
            if (! $departmentId) {
                $departmentId = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)
                    ->where(fn ($query) => $query->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower(str_replace('_', ' ', $dashboardKey)).'%'])->orWhereRaw('LOWER(code) = ?', [strtolower($dashboardKey)]))
                    ->value('id');
            }
        }
        $configuredDepartmentIds = collect($factory->settings['report']['department_ids'] ?? [])->map(fn ($id) => (int) $id)->filter()->unique();

        $flowDepartmentIds = DB::table('workflow_stages')
            ->join('workflow_templates', 'workflow_templates.id', '=', 'workflow_stages.workflow_template_id')
            ->where('workflow_templates.factory_id', $factory->id)->where('workflow_templates.status', 'active')
            ->whereNotNull('workflow_stages.department_id')->distinct()->pluck('workflow_stages.department_id');
        if ($departmentOnly && $departmentId && ! $flowDepartmentIds->contains($departmentId)) {
            if (stripos($factory->name, 'noguchi') === false) {
                abort(403, 'This department is not part of the active production flow.');
            }
        }

        $departments = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)
            ->when($departmentOnly, fn ($query) => $query->whereIn('id', $flowDepartmentIds))
            ->when(! $departmentId && $configuredDepartmentIds->isNotEmpty(), fn ($query) => $query->whereIn('id', $configuredDepartmentIds))
            ->when($departmentId, fn ($query) => $query->whereKey($departmentId))
            ->orderBy('name')->get();

        $executions = ProductionStageExecution::withoutGlobalScopes()->where('production_stage_executions.factory_id', $factory->id)
            ->whereBetween('production_stage_executions.updated_at', [$from, $to])
            ->join('workflow_stages', 'workflow_stages.id', '=', 'production_stage_executions.workflow_stage_id')
            ->join('production_orders', 'production_orders.id', '=', 'production_stage_executions.production_order_id')
            ->leftJoin('items', 'items.id', '=', 'production_orders.item_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->when($logisticsOnly || $warehouseOnly || ($departmentOnly && ! $departmentId), fn ($query) => $query->whereRaw('1 = 0'))
            ->when(! $departmentId && $configuredDepartmentIds->isNotEmpty(), fn ($query) => $query->whereIn('workflow_stages.department_id', $configuredDepartmentIds))
            ->when($departmentId, fn ($query) => $query->where('workflow_stages.department_id', $departmentId))
            ->select('production_stage_executions.id', 'production_stage_executions.status', 'production_stage_executions.input_quantity', 'production_stage_executions.output_quantity', 'production_stage_executions.waste_quantity', 'production_stage_executions.rejected_quantity', 'production_stage_executions.updated_at', 'workflow_stages.department_id', 'workflow_stages.name as stage_name', 'production_orders.id as production_order_id', 'production_orders.order_number', 'items.name as product_name', 'units.name as unit_name', 'units.symbol as unit_symbol')
            ->latest('production_stage_executions.updated_at')->get();

        $rawSewingDept = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('name', 'like', '%sewing%')->first();
        $isSewingSelected = !isset($departmentId) || (isset($departmentId) && $rawSewingDept && $departmentId == $rawSewingDept->id);

        if (stripos($factory->name, 'noguchi') !== false && $isSewingSelected) {
            $sewingDept = $rawSewingDept;
            if (!$sewingDept && !$departmentOnly) $sewingDept = $departments->first();
            
            if ($sewingDept) {
                if (!$departments->contains('id', $sewingDept->id)) {
                    $departments->push($sewingDept);
                }
                
                $sewingWarehouseId = DB::table('warehouses')->where('factory_id', $factory->id)->where(fn($q) => $q->where('code', 'SEW')->orWhere('name', 'like', '%sewing%'))->value('id') ?? 1;
                $sewingTx = StockTransaction::withoutGlobalScopes()->where('stock_transactions.factory_id', $factory->id)
                    ->where('warehouse_id', $sewingWarehouseId)
                    ->whereBetween('occurred_at', [$from, $to])
                    ->where('reason', 'like', '%CutID:%')
                    ->join('items', 'items.id', '=', 'stock_transactions.item_id')
                    ->select('stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as product_name')
                    ->get();
                    
                $sewingTxGrouped = $sewingTx->groupBy(function($tx) {
                    preg_match('/CutID:\s*([^\s|]+)/i', $tx->reason, $match);
                    $cutId = $match[1] ?? 'unknown';
                    return \Carbon\Carbon::parse($tx->occurred_at)->toDateString() . '|' . $cutId;
                });
                
                foreach ($sewingTxGrouped as $key => $txs) {
                    $cutId = explode('|', $key)[1];
                    $parts = explode('-', $cutId);
                    $style = $parts[1] ?? '';
                    $color = $parts[2] ?? '';
                    $size = $parts[3] ?? '';
                    $fabricName = $txs->first()->product_name;
                    $formattedProduct = trim("$style - $color - $size", ' -');
                    if (!$formattedProduct) $formattedProduct = $fabricName;
                    
                    $input = $txs->where('type', 'receipt')->sum(fn($t) => abs($t->quantity_delta));
                    $output = $txs->where('type', 'issue')->sum(fn($t) => abs($t->quantity_delta));
                    $waste = $txs->where('type', 'waste')->sum(fn($t) => abs($t->quantity_delta));
                    
                    $executions->push((object)[
                        'updated_at' => \Carbon\Carbon::parse($txs->first()->occurred_at),
                        'department_id' => $sewingDept->id,
                        'production_order_id' => crc32($cutId),
                        'stage_name' => 'Sewing',
                        'order_number' => $cutId,
                        'product_name' => $formattedProduct,
                        'fabric_name' => $fabricName,
                        'input_quantity' => $input,
                        'output_quantity' => $output,
                        'rejected_quantity' => 0,
                        'waste_quantity' => $waste,
                        'unit_symbol' => 'pcs',
                        'status' => 'completed',
                    ]);
                }
            }
        }

        $rawFinishingDept = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where(fn($q) => $q->where('name', 'like', '%finishing%')->orWhere('name', 'like', '%finished%'))->first();
        $isFinishingSelected = !isset($departmentId) || (isset($departmentId) && $rawFinishingDept && $departmentId == $rawFinishingDept->id);

        if (stripos($factory->name, 'noguchi') !== false && $isFinishingSelected) {
            $finishingDept = $rawFinishingDept;
            if (!$finishingDept && !$departmentOnly) $finishingDept = $departments->first();
            
            if ($finishingDept) {
                if (!$departments->contains('id', $finishingDept->id)) {
                    $departments->push($finishingDept);
                }
                
                $finishingTx = StockTransaction::withoutGlobalScopes()->where('stock_transactions.factory_id', $factory->id)
                    ->whereBetween('occurred_at', [$from, $to])
                    ->where(fn($q) => $q->where('reason', 'like', '%[Finishing Output]%')->orWhere('reason', 'like', '%[Finishing Receipt]%'))
                    ->join('items', 'items.id', '=', 'stock_transactions.item_id')
                    ->select('stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as product_name')
                    ->get();
                    
                $finishingTxGrouped = $finishingTx->groupBy(function($tx) {
                    preg_match('/SewnID:\s*([^\s|]+)/i', $tx->reason, $match);
                    $sewnId = $match[1] ?? 'unknown';
                    return \Carbon\Carbon::parse($tx->occurred_at)->toDateString() . '|' . $sewnId;
                });
                
                foreach ($finishingTxGrouped as $key => $txs) {
                    $sewnId = explode('|', $key)[1];
                    $parts = explode('-', $sewnId);
                    $style = $parts[1] ?? '';
                    $color = $parts[2] ?? '';
                    $size = $parts[3] ?? '';
                    $fabricName = $txs->first()->product_name;
                    $formattedProduct = trim("$style - $color - $size", ' -');
                    if (!$formattedProduct) $formattedProduct = $fabricName;
                    
                    $input = $txs->where('type', 'receipt')->sum(fn($t) => abs($t->quantity_delta));
                    $output = $txs->where('type', 'issue')->sum(fn($t) => abs($t->quantity_delta));
                    $waste = $txs->where('type', 'waste')->sum(fn($t) => abs($t->quantity_delta));
                    
                    $executions->push((object)[
                        'updated_at' => \Carbon\Carbon::parse($txs->first()->occurred_at),
                        'department_id' => $finishingDept->id,
                        'production_order_id' => crc32($sewnId),
                        'stage_name' => 'Finishing',
                        'order_number' => $sewnId,
                        'product_name' => $formattedProduct,
                        'fabric_name' => $fabricName,
                        'input_quantity' => $input,
                        'output_quantity' => $output,
                        'rejected_quantity' => 0,
                        'waste_quantity' => $waste,
                        'unit_symbol' => 'pcs',
                        'status' => 'completed',
                    ]);
                }
            }
        }
        
        $rawPackingDept = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where(fn($q) => $q->where('name', 'like', '%packing%')->orWhere('name', 'like', '%packaging%'))->first();
        if (stripos($factory->name, 'noguchi') !== false && (!$departmentId || ($rawPackingDept && $departmentId == $rawPackingDept->id))) {
            $packingDept = $rawPackingDept;
            if (!$packingDept && !$departmentOnly) $packingDept = $departments->first();
            
            if ($packingDept) {
                if (!$departments->contains('id', $packingDept->id)) {
                    $departments->push($packingDept);
                }
                
                $packingTx = StockTransaction::withoutGlobalScopes()->where('stock_transactions.factory_id', $factory->id)
                    ->whereBetween('occurred_at', [$from, $to])
                    ->where(fn($q) => $q->where('reason', 'like', '%[Packing Output]%')->orWhere('reason', 'like', '%[Packing Receipt]%'))
                    ->join('items', 'items.id', '=', 'stock_transactions.item_id')
                    ->select('stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as product_name')
                    ->get();
                    
                $packingTxGrouped = $packingTx->groupBy(function($tx) {
                    preg_match('/FinishedID:\s*([^\s|]+)/i', $tx->reason, $match);
                    $finishedId = $match[1] ?? 'unknown';
                    return \Carbon\Carbon::parse($tx->occurred_at)->toDateString() . '|' . $finishedId;
                });
                
                foreach ($packingTxGrouped as $key => $txs) {
                    $finishedId = explode('|', $key)[1];
                    $parts = explode('-', $finishedId);
                    $style = $parts[1] ?? '';
                    $color = $parts[2] ?? '';
                    $size = $parts[3] ?? '';
                    $fabricName = $txs->first()->product_name;
                    $formattedProduct = trim("$style - $color - $size", ' -');
                    if (!$formattedProduct) $formattedProduct = $fabricName;
                    
                    $input = $txs->where('type', 'receipt')->sum(fn($t) => abs($t->quantity_delta));
                    $output = $txs->where('type', 'issue')->sum(fn($t) => abs($t->quantity_delta));
                    $waste = $txs->where('type', 'waste')->sum(fn($t) => abs($t->quantity_delta));
                    
                    $executions->push((object)[
                        'updated_at' => \Carbon\Carbon::parse($txs->first()->occurred_at),
                        'department_id' => $packingDept->id,
                        'production_order_id' => crc32($finishedId),
                        'stage_name' => 'Packing',
                        'order_number' => $finishedId,
                        'product_name' => $formattedProduct,
                        'fabric_name' => $fabricName,
                        'input_quantity' => $input,
                        'output_quantity' => $output,
                        'rejected_quantity' => 0,
                        'waste_quantity' => $waste,
                        'unit_symbol' => 'pcs',
                        'status' => 'completed',
                    ]);
                }
            }
        }

        $departmentActivity = $departments->map(function ($department) use ($executions) {
            $records = $executions->where('department_id', $department->id);

            return [
                'id' => $department->id, 'code' => $department->code, 'name' => $department->name,
                'production_orders' => $records->pluck('production_order_id')->unique()->count(),
                'work_records' => $records->count(), 'completed_records' => $records->where('status', 'completed')->count(),
                'in_progress_stages' => $records->where('status', 'in_progress')->count(),
                'received_quantity' => (float) $records->sum('input_quantity'),
                'completed_quantity' => (float) $records->sum('output_quantity'), 'damaged_quantity' => (float) $records->sum('rejected_quantity'),
                'waste_quantity' => (float) $records->sum('waste_quantity'),
                'unit' => $records->pluck('unit_symbol')->filter()->unique()->count() === 1 ? $records->pluck('unit_symbol')->filter()->first() : ($records->isEmpty() ? '—' : 'mixed'),
            ];
        })->values();

        $inventory = ! $departmentOnly && in_array($type, ['all', 'inventory'], true) ? StockTransaction::withoutGlobalScopes()
            ->where('stock_transactions.factory_id', $factory->id)->whereBetween('occurred_at', [$from, $to])
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->select('stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.unit_cost', 'stock_transactions.balance_after', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku', 'warehouses.name as warehouse_name')->latest('occurred_at')->get() : collect();

        $dailyActivity = $executions->groupBy(fn ($record) => $record->updated_at->toDateString())
            ->sortKeys()
            ->map(function ($dayRecords, $date) {
                return [
                    'date' => $date,
                    'departments' => $dayRecords->groupBy('department_id')->map(function ($departmentRecords) {
                        return [
                            'department_id' => (int) $departmentRecords->first()->department_id,
                            'department' => Department::withoutGlobalScopes()->find($departmentRecords->first()->department_id)?->name ?? 'Unassigned',
                            'records' => $departmentRecords->groupBy(fn ($record) => implode('|', [$record->production_order_id, $record->stage_name, $record->product_name, $record->unit_symbol]))
                                ->map(fn ($records) => [
                                    'order_number' => $records->first()->order_number,
                                    'product' => $records->first()->product_name ?? 'Unspecified product',
                                    'fabric' => $records->first()->fabric_name ?? $records->first()->product_name ?? 'Unspecified product',
                                    'work_step' => $records->first()->stage_name,
                                    'received' => (float) $records->sum('input_quantity'),
                                    'completed' => (float) $records->sum('output_quantity'),
                                    'damaged' => (float) $records->sum('rejected_quantity'),
                                    'waste' => (float) $records->sum('waste_quantity'),
                                    'unit' => $records->first()->unit_symbol ?: 'unit',
                                ])->values(),
                        ];
                    })->values(),
                ];
            })->values();

        $stockRegister = $inventory->groupBy(fn ($record) => implode('|', [$record->item_name, $record->sku, $record->warehouse_name]))
            ->map(function ($records) {
                $ordered = $records->sortBy('occurred_at')->values();
                $first = $ordered->first();
                $last = $ordered->last();

                return [
                    'item' => $first->item_name,
                    'sku' => $first->sku,
                    'warehouse' => $first->warehouse_name,
                    'opening_balance' => (float) $first->balance_after - (float) $first->quantity_delta,
                    'quantity_in' => (float) $ordered->where('quantity_delta', '>', 0)->sum('quantity_delta'),
                    'quantity_out' => abs((float) $ordered->where('quantity_delta', '<', 0)->sum('quantity_delta')),
                    'closing_balance' => (float) $last->balance_after,
                ];
            })->values();

        $logistics = null;
        if ($logisticsOnly) {
            $orderQuery = SalesDocument::withoutGlobalScopes()->where('sales_documents.factory_id', $factory->id)
                ->where('document_type', 'customer_order')->whereDate('document_date', '>=', $from->toDateString())->whereDate('document_date', '<=', $to->toDateString())
                ->with(['school:id,name,phone,district,sector', 'lines:id,sales_document_id,class_level,garment_category,gender,size,color,quantity_ordered,quantity_packed,quantity_delivered,quantity_rejected,rejection_reason', 'shipments.vehicle']);
            $orderQuery->when($data['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
                ->when(($data['district'] ?? null) || ($data['sector'] ?? null), function ($query) use ($data, $factory) {
                    $schoolIds = School::withoutGlobalScopes()->where('factory_id', $factory->id)
                        ->when($data['district'] ?? null, fn ($schools, $district) => $schools->where('district', $district))
                        ->when($data['sector'] ?? null, fn ($schools, $sector) => $schools->where('sector', $sector))
                        ->pluck('id');
                    $query->whereIn('school_id', $schoolIds);
                });
            $logisticsOrders = $orderQuery->latest('document_date')->latest('id')->get();
            $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factory->id)
                ->where(fn ($query) => $query->whereBetween('created_at', [$from, $to])->orWhereBetween('planned_dispatch_at', [$from, $to])->orWhereBetween('delivered_at', [$from, $to]))
                ->with(['vehicle', 'salesDocument:id,document_number'])->latest()->get();
            $vehicles = DeliveryVehicle::withoutGlobalScopes()->where('factory_id', $factory->id)->orderBy('registration_number')->get();
            $delivered = $logisticsOrders->sum(fn ($order) => $order->lines->sum('quantity_delivered'));
            $rejected = $logisticsOrders->sum(fn ($order) => $order->lines->sum('quantity_rejected'));
            $logistics = [
                'summary' => [
                    'orders_processed' => $logisticsOrders->count(), 'items_ordered' => (int) $logisticsOrders->sum('item_count'),
                    'items_delivered' => (int) $delivered, 'items_remaining' => max(0, (int) $logisticsOrders->sum('item_count') - (int) $delivered),
                    'items_returned' => (int) $rejected, 'total_value' => (float) $logisticsOrders->sum('total_amount'),
                    'shipments' => $shipments->count(), 'deliveries_completed' => $shipments->where('status', 'delivered')->count(),
                ],
                'order_statuses' => $logisticsOrders->countBy('status')->map(fn ($count, $status) => ['status' => $status, 'count' => $count])->values(),
                'return_reasons' => $logisticsOrders->flatMap->lines->where('quantity_rejected', '>', 0)->groupBy(fn ($line) => $line->rejection_reason ?: 'Reason not specified')->map(fn ($lines, $reason) => ['reason' => $reason, 'quantity' => (int) $lines->sum('quantity_rejected')])->values(),
                'orders' => $logisticsOrders,
                'shipments' => $shipments,
                'vehicles' => $vehicles,
            ];
        }

        return response()->json([
            'factory' => $factory->only(['name', 'industry_type', 'email', 'phone', 'currency_code', 'timezone']),
            'standard' => array_replace(
                IndustryDailyReportCatalog::for($factory->industry_type),
                array_filter($factory->settings['report'] ?? [], fn ($value) => $value !== '' && $value !== []),
                $logisticsOnly ? ['title' => 'Daily logistics report', 'orientation' => 'landscape', 'show_department_totals' => false, 'show_daily_register' => false, 'default_period' => $factory->hasNoguchiSchoolOrders() ? 'all' : 'day']
                    : ($warehouseOnly ? ['title' => 'Daily stock report', 'orientation' => 'landscape', 'show_summary' => false, 'show_department_totals' => false, 'show_daily_register' => false, 'show_stock_register' => true, 'default_period' => 'day']
                        : ($departmentOnly ? ['title' => ($departments->first()?->name ?? ucfirst($dashboardKey)).' daily report', 'show_stock_register' => false] : []))
            ),
            'filters' => ['departments' => $isExecutive ? Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)->when($configuredDepartmentIds->isNotEmpty(), fn ($query) => $query->whereIn('id', $configuredDepartmentIds))->orderBy('name')->get(['id', 'name']) : [], 'districts' => $logisticsOnly ? SalesDocument::withoutGlobalScopes()->where('sales_documents.factory_id', $factory->id)->where('document_type', 'customer_order')->join('schools', 'schools.id', '=', 'sales_documents.school_id')->whereNotNull('schools.district')->distinct()->orderBy('schools.district')->pluck('schools.district') : [], 'sectors_by_district' => $logisticsOnly ? SalesDocument::withoutGlobalScopes()->where('sales_documents.factory_id', $factory->id)->where('document_type', 'customer_order')->join('schools', 'schools.id', '=', 'sales_documents.school_id')->whereNotNull('schools.district')->whereNotNull('schools.sector')->select(['schools.district', 'schools.sector'])->distinct()->orderBy('schools.sector')->get()->groupBy('district')->map(fn ($rows) => $rows->pluck('sector')->values()) : (object) []],
            'report' => ['scope' => $logisticsOnly ? 'logistics' : ($warehouseOnly ? 'warehouse' : ($departmentOnly ? 'department' : 'factory')), 'scope_label' => $logisticsOnly ? 'Logistics' : ($warehouseOnly ? 'Warehouse stock' : ($departments->first()?->name ?? 'Whole factory')), 'type' => $type, 'period' => $data['period'] ?? 'week', 'department_id' => $departmentId, 'from' => $from->toDateString(), 'to' => $to->toDateString(), 'generated_at' => now()->toIso8601String(), 'generated_by' => $request->user()->name],
            'summary' => array_filter([($departmentOnly ? 'flow_categories' : 'departments') => $departmentActivity->count(), 'production_orders' => $executions->pluck('production_order_id')->unique()->count(), 'work_records' => $executions->count(), 'completed_records' => $executions->where('status', 'completed')->count(), 'quantity_received' => (float) $executions->sum('input_quantity'), 'quantity_completed' => (float) $executions->sum('output_quantity'), 'damaged_quantity' => (float) $executions->sum('rejected_quantity'), 'waste_quantity' => (float) $executions->sum('waste_quantity'), 'stock_movements' => $departmentOnly ? null : $inventory->count()], fn ($value) => $value !== null),
            'department_activity' => $departmentActivity,
            'daily_activity' => $dailyActivity,
            'stock_register' => $stockRegister,
            'production' => in_array($type, ['all', 'departments', 'production'], true) ? $executions : [],
            'inventory' => $inventory,
            'activities' => [],
            'logistics' => $logistics,
        ]);
    }

    private function range(array $data): array
    {
        $period = $data['period'] ?? 'week';
        if ($period === 'custom') {
            return [Carbon::parse($data['from'] ?? today())->startOfDay(), Carbon::parse($data['to'] ?? today())->endOfDay()];
        }

        return match ($period) {
            'all' => [Carbon::create(2000, 1, 1)->startOfDay(), today()->endOfDay()],
            'day' => [today()->startOfDay(), today()->endOfDay()],
            'month' => [today()->startOfMonth(), today()->endOfDay()],
            'year' => [today()->startOfYear(), today()->endOfDay()],
            default => [today()->subDays(6)->startOfDay(), today()->endOfDay()],
        };
    }
}
