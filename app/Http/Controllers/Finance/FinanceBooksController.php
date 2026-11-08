<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmployeeProfile;
use App\Models\FinanceEntry;
use App\Models\SalesPayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The factory's money books: one cash book that merges customer payments, supplier payments,
 * expenses and staff pay, plus the client register and the sold-goods view that tie sales back to
 * stock and deliveries.
 */
class FinanceBooksController extends Controller
{
    private const EXCLUDED_ORDER_STATUSES = ['cancelled', 'rejected'];

    // ---------------------------------------------------------------- cash book

    public function cashbook(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'direction' => ['nullable', Rule::in(['all', 'in', 'out'])],
            'category' => ['nullable', 'string', 'max:40'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $to = isset($filters['to']) ? Carbon::parse($filters['to'])->startOfDay() : today();
        $from = isset($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : $to->copy()->startOfMonth();
        abort_if($from->diffInDays($to) > 800, 422, 'Please choose a shorter period.');

        $opening = $this->netBefore($factoryId, $from);
        $movements = $this->movements($factoryId, $from, $to)
            ->sortBy(fn (array $row) => $row['date'] . '|' . str_pad((string) $row['order'], 12, '0', STR_PAD_LEFT))
            ->values();

        $running = $opening;
        $movements = $movements->map(function (array $row) use (&$running) {
            $running = round($running + ($row['direction'] === 'in' ? $row['amount'] : -$row['amount']), 2);

            return $row + ['balance' => $running];
        });

        $moneyIn = round((float) $movements->where('direction', 'in')->sum('amount'), 2);
        $moneyOut = round((float) $movements->where('direction', 'out')->sum('amount'), 2);

        $visible = $movements
            ->when(($filters['direction'] ?? 'all') !== 'all', fn (Collection $rows) => $rows->where('direction', $filters['direction']))
            ->when($filters['category'] ?? null, fn (Collection $rows, string $category) => $rows->where('category', $category))
            ->when($filters['search'] ?? null, function (Collection $rows, string $term) {
                $needle = mb_strtolower($term);

                return $rows->filter(
                    fn (array $row) => str_contains(
                        mb_strtolower(implode(' ', [$row['description'], $row['party'], $row['reference'], $row['category_label']])),
                        $needle,
                    ),
                );
            })
            ->sortByDesc(fn (array $row) => $row['date'] . '|' . str_pad((string) $row['order'], 12, '0', STR_PAD_LEFT))
            ->values();

        $byCategory = fn (string $direction) => $movements
            ->where('direction', $direction)
            ->groupBy('category')
            ->map(fn (Collection $group, string $category) => [
                'category' => $category,
                'label' => $group->first()['category_label'],
                'amount' => round((float) $group->sum('amount'), 2),
                'count' => $group->count(),
            ])
            ->sortByDesc('amount')
            ->values();

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'summary' => [
                'opening_balance' => $opening,
                'money_in' => $moneyIn,
                'money_out' => $moneyOut,
                'net' => round($moneyIn - $moneyOut, 2),
                'closing_balance' => round($opening + $moneyIn - $moneyOut, 2),
                'cash_position' => $this->netBefore($factoryId, today()->addDay()),
            ],
            'in_by_category' => $byCategory('in'),
            'out_by_category' => $byCategory('out'),
            'rows' => $visible->take(1000)->values(),
            'truncated' => $visible->count() > 1000,
            'purchasing' => $this->purchasingSnapshot($factoryId),
            'categories' => [
                'in' => $this->labelList(FinanceEntry::IN_CATEGORIES),
                'out' => $this->labelList(FinanceEntry::OUT_CATEGORIES),
            ],
            'methods' => SalesPayment::METHODS,
            'currency' => $this->currency($request),
            'can_record' => $request->user()->hasPermission('finance.manage_books'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $data = $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])],
            'category' => ['required', 'string', 'max:40'],
            'description' => ['required', 'string', 'max:255'],
            'party' => ['nullable', 'string', 'max:160'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999'],
            'method' => ['required', Rule::in(SalesPayment::METHODS)],
            'reference' => ['nullable', 'string', 'max:120'],
            'entry_date' => ['required', 'date', 'before_or_equal:today'],
        ]);

        $allowed = array_keys($data['direction'] === 'in' ? FinanceEntry::IN_CATEGORIES : FinanceEntry::OUT_CATEGORIES);
        if (! in_array($data['category'], $allowed, true)) {
            throw ValidationException::withMessages(['category' => 'Choose a category from the list.']);
        }

        $entry = DB::transaction(function () use ($request, $factoryId, $data) {
            $year = Carbon::parse($data['entry_date'])->format('Y');
            $sequence = FinanceEntry::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('entry_number', 'like', "FIN-{$year}-%")
                ->lockForUpdate()
                ->count() + 1;

            return FinanceEntry::create([
                'entry_number' => sprintf('FIN-%s-%05d', $year, $sequence),
                'direction' => $data['direction'],
                'category' => $data['category'],
                'description' => $data['description'],
                'party' => $data['party'] ?? null,
                'amount' => round((float) $data['amount'], 2),
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'entry_date' => $data['entry_date'],
                'recorded_by' => $request->user()->id,
            ]);
        });

        AuditLog::record(
            'finance.entry_recorded',
            sprintf(
                '%s %s %s (%s)',
                $entry->direction === 'in' ? 'Recorded money received' : 'Recorded money spent',
                number_format((float) $entry->amount, 0),
                FinanceEntry::categoryLabel($entry->direction, $entry->category),
                $entry->entry_number,
            ),
            $entry,
        );

        return response()->json(['message' => "{$entry->entry_number} recorded.", 'entry' => $entry], 201);
    }

    public function void(Request $request, FinanceEntry $entry): JsonResponse
    {
        abort_if($entry->voided_at !== null, 422, 'This entry was already cancelled.');
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $entry->update([
            'voided_at' => now(),
            'voided_by' => $request->user()->id,
            'void_reason' => $data['reason'],
        ]);
        AuditLog::record('finance.entry_voided', "Cancelled {$entry->entry_number}: {$data['reason']}", $entry);

        return response()->json(['message' => "{$entry->entry_number} cancelled."]);
    }

    // ------------------------------------------------------------------ clients

    public function clients(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'owing' => ['nullable', 'boolean'],
        ]);

        $clients = $this->orderBase($factoryId)
            ->leftJoin('schools as s', 's.id', '=', 'd.school_id')
            ->selectRaw(
                "COALESCE(CONCAT('s', d.school_id), CONCAT('c', LOWER(TRIM(d.customer_name))), 'c') as client_key,
                MAX(d.school_id) as school_id,
                COALESCE(MAX(s.name), MAX(d.customer_name), 'Unnamed customer') as name,
                MAX(d.customer_phone) as phone,
                MAX(COALESCE(d.customer_email, s.email)) as email,
                COUNT(*) as orders,
                SUM(d.total_amount) as billed,
                SUM(d.paid_amount) as paid,
                SUM(d.total_amount - d.paid_amount) as balance,
                SUM(CASE WHEN d.due_date IS NOT NULL AND d.due_date < CURDATE() AND d.payment_status <> 'paid'
                    THEN d.total_amount - d.paid_amount ELSE 0 END) as overdue,
                MAX(d.document_date) as last_order_date",
            )
            ->groupBy('client_key')
            ->when($filters['search'] ?? null, function ($query, string $term) {
                $query->havingRaw('name LIKE ?', ['%' . addcslashes($term, '\\%_') . '%']);
            })
            ->when($filters['owing'] ?? false, fn ($query) => $query->havingRaw('balance > 0'))
            ->orderByDesc('balance')
            ->orderBy('name')
            ->limit(500)
            ->get()
            ->map(fn ($row) => [
                'key' => $row->client_key,
                'school_id' => $row->school_id ? (int) $row->school_id : null,
                'name' => $row->name,
                'type' => $row->school_id ? 'school' : 'customer',
                'phone' => $row->phone,
                'email' => $row->email,
                'orders' => (int) $row->orders,
                'billed' => round((float) $row->billed, 2),
                'paid' => round((float) $row->paid, 2),
                'balance' => round((float) $row->balance, 2),
                'overdue' => round((float) $row->overdue, 2),
                'last_order_date' => $row->last_order_date,
            ]);

        return response()->json([
            'summary' => [
                'clients' => $clients->count(),
                'billed' => round((float) $clients->sum('billed'), 2),
                'paid' => round((float) $clients->sum('paid'), 2),
                'balance' => round((float) $clients->sum('balance'), 2),
                'overdue' => round((float) $clients->sum('overdue'), 2),
                'owing_clients' => $clients->where('balance', '>', 0)->count(),
            ],
            'clients' => $clients,
            'currency' => $this->currency($request),
        ]);
    }

    public function clientDetail(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);
        abort_if(empty($data['school_id']) && empty($data['name']), 422, 'Choose a client.');

        $documents = $this->orderBase($factoryId)
            ->when(
                ! empty($data['school_id']),
                fn ($query) => $query->where('d.school_id', $data['school_id']),
                fn ($query) => $query
                    ->whereNull('d.school_id')
                    ->whereRaw('LOWER(TRIM(d.customer_name)) = ?', [mb_strtolower(trim($data['name']))]),
            )
            ->orderByDesc('d.document_date')
            ->orderByDesc('d.id')
            ->limit(100)
            ->get(['d.id', 'd.document_number', 'd.document_date', 'd.due_date', 'd.status', 'd.payment_status', 'd.source', 'd.total_amount', 'd.paid_amount']);

        $ids = $documents->pluck('id');
        $direct = DB::table('sales_payments as p')
            ->join('sales_documents as d', 'd.id', '=', 'p.sales_document_id')
            ->whereIn('p.sales_document_id', $ids)
            ->get(['p.paid_on as date', 'd.document_number', 'p.method', 'p.reference', 'p.amount']);
        $school = DB::table('school_payment_submissions as s')
            ->join('sales_documents as d', 'd.id', '=', 's.sales_document_id')
            ->whereIn('s.sales_document_id', $ids)
            ->where('s.status', 'approved')
            ->get([DB::raw('DATE(s.reviewed_at) as date'), 'd.document_number', 's.payment_method as method', 's.payment_reference as reference', 's.amount']);

        return response()->json([
            'documents' => $documents->map(fn ($row) => [
                'document_number' => $row->document_number,
                'document_date' => $row->document_date,
                'due_date' => $row->due_date,
                'status' => $row->status,
                'payment_status' => $row->payment_status,
                'source' => $row->source,
                'total_amount' => (float) $row->total_amount,
                'paid_amount' => (float) $row->paid_amount,
                'balance' => round((float) $row->total_amount - (float) $row->paid_amount, 2),
            ])->values(),
            'payments' => $direct->concat($school)->map(fn ($row) => [
                'date' => $row->date,
                'document_number' => $row->document_number,
                'method' => $row->method,
                'reference' => $row->reference,
                'amount' => (float) $row->amount,
            ])->sortByDesc('date')->values(),
        ]);
    }

    // -------------------------------------------------------------- sold goods

    public function soldGoods(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $to = isset($filters['to']) ? Carbon::parse($filters['to'])->startOfDay() : today();
        $from = isset($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : $to->copy()->startOfMonth();
        abort_if($from->diffInDays($to) > 800, 422, 'Please choose a shorter period.');

        $warehouseIds = DB::table('warehouses')->where('factory_id', $factoryId)->pluck('id');
        $stock = DB::table('stock_balances')
            ->whereIn('warehouse_id', $warehouseIds)
            ->selectRaw('item_id, SUM(quantity_on_hand - quantity_reserved - quantity_quarantined) as available')
            ->groupBy('item_id')
            ->pluck('available', 'item_id');

        $products = DB::table('sales_document_lines as l')
            ->join('sales_documents as d', 'd.id', '=', 'l.sales_document_id')
            ->leftJoin('items as i', 'i.id', '=', 'l.item_id')
            ->leftJoin('units as u', 'u.id', '=', 'i.unit_id')
            ->where('d.factory_id', $factoryId)
            ->where('d.document_type', 'customer_order')
            ->whereNotIn('d.status', [...self::EXCLUDED_ORDER_STATUSES, 'pending'])
            ->whereBetween('d.document_date', [$from->toDateString(), $to->copy()->endOfDay()->toDateTimeString()])
            ->selectRaw(
                "COALESCE(l.item_id, 0) as item_id,
                COALESCE(l.garment_category, '') as category,
                COALESCE(MAX(i.name), MAX(l.garment_category), 'Item') as name,
                MAX(i.sku) as sku,
                MAX(u.symbol) as unit,
                SUM(l.quantity_ordered) as ordered,
                SUM(l.quantity_packed) as packed,
                SUM(l.quantity_delivered) as delivered,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM shipments sh WHERE sh.sales_document_id = d.id AND sh.status = 'delivered')
                    THEN l.quantity_delivered ELSE 0 END) as by_logistics,
                SUM(l.quantity_delivered * l.unit_price) as revenue",
            )
            ->groupByRaw("COALESCE(l.item_id, 0), COALESCE(l.garment_category, '')")
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row) => [
                'item_id' => (int) $row->item_id ?: null,
                'name' => $row->name,
                'sku' => $row->sku,
                'unit' => $row->unit,
                'ordered' => (float) $row->ordered,
                'packed' => (float) $row->packed,
                'delivered' => (float) $row->delivered,
                'by_logistics' => (float) $row->by_logistics,
                'revenue' => round((float) $row->revenue, 2),
                'in_stock' => $row->item_id ? round((float) ($stock[$row->item_id] ?? 0), 3) : null,
            ])
            ->values();

        $shipments = DB::table('shipments as sh')
            ->leftJoin('sales_documents as d', 'd.id', '=', 'sh.sales_document_id')
            ->where('sh.factory_id', $factoryId)
            ->where('sh.status', '!=', 'cancelled')
            ->orderByRaw('COALESCE(sh.delivered_at, sh.dispatched_at, sh.created_at) DESC')
            ->limit(60)
            ->get([
                'sh.shipment_number', 'sh.status', 'sh.customer_name', 'sh.destination', 'sh.package_count',
                'sh.dispatched_at', 'sh.delivered_at', 'd.document_number', 'd.total_amount', 'd.paid_amount',
            ])
            ->map(fn ($row) => [
                'shipment_number' => $row->shipment_number,
                'status' => $row->status,
                'customer_name' => $row->customer_name,
                'destination' => $row->destination,
                'packages' => (int) $row->package_count,
                'dispatched_at' => $row->dispatched_at,
                'delivered_at' => $row->delivered_at,
                'document_number' => $row->document_number,
                'balance' => $row->document_number ? round((float) $row->total_amount - (float) $row->paid_amount, 2) : null,
            ]);

        $counts = DB::table('shipments')->where('factory_id', $factoryId)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        $awaiting = DB::table('sales_documents')
            ->where('factory_id', $factoryId)
            ->where('document_type', 'customer_order')
            ->whereIn('status', ['accepted', 'partial'])
            ->count();

        $periodOrders = DB::table('sales_documents')
            ->where('factory_id', $factoryId)
            ->where('document_type', 'customer_order')
            ->whereNotIn('status', [...self::EXCLUDED_ORDER_STATUSES, 'pending'])
            ->whereBetween('document_date', [$from->toDateString(), $to->copy()->endOfDay()->toDateTimeString()]);

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'summary' => [
                'orders' => (clone $periodOrders)->count(),
                'orders_value' => round((float) (clone $periodOrders)->sum('total_amount'), 2),
                'orders_paid' => round((float) (clone $periodOrders)->sum('paid_amount'), 2),
                'units_sold' => round((float) $products->sum('delivered'), 3),
                'revenue' => round((float) $products->sum('revenue'), 2),
                'units_by_logistics' => round((float) $products->sum('by_logistics'), 3),
                'shipments_delivered' => (int) ($counts['delivered'] ?? 0),
                'shipments_open' => (int) collect($counts)->except(['delivered', 'cancelled'])->sum(),
                'orders_awaiting_delivery' => $awaiting,
            ],
            'products' => $products,
            'shipments' => $shipments,
            'currency' => $this->currency($request),
        ]);
    }

    // ------------------------------------------------------------------ helpers

    private function factoryId(Request $request): int
    {
        return (int) $request->user()->current_factory_id;
    }

    private function currency(Request $request): string
    {
        return $request->user()->currentFactory?->currency_code ?: 'RWF';
    }

    private function labelList(array $categories): array
    {
        return collect($categories)->map(fn (string $label, string $value) => compact('value', 'label'))->values()->all();
    }

    private function orderBase(int $factoryId)
    {
        return DB::table('sales_documents as d')
            ->where('d.factory_id', $factoryId)
            ->where('d.document_type', 'customer_order')
            ->whereNotIn('d.status', self::EXCLUDED_ORDER_STATUSES);
    }

    /**
     * Every money movement in the period, as one list. Customer payments and supplier payments are
     * read from where they are recorded, so recording them there is enough: nothing is entered twice.
     */
    private function movements(int $factoryId, ?Carbon $from, ?Carbon $to): Collection
    {
        $between = function ($query, string $column) use ($from, $to) {
            if ($from) {
                $query->whereDate($column, '>=', $from->toDateString());
            }
            if ($to) {
                $query->whereDate($column, '<=', $to->toDateString());
            }

            return $query;
        };
        $rows = collect();

        $between(
            DB::table('sales_payments as p')
                ->join('sales_documents as d', 'd.id', '=', 'p.sales_document_id')
                ->where('d.factory_id', $factoryId),
            'p.paid_on',
        )->get(['p.id', 'p.amount', 'p.method', 'p.reference', 'p.paid_on as date', 'd.document_number', 'd.customer_name'])
            ->each(function ($row) use ($rows) {
                $refund = (float) $row->amount < 0;
                $rows->push($this->row(
                    'sales-' . $row->id,
                    substr((string) $row->date, 0, 10),
                    $refund ? 'out' : 'in',
                    $refund ? 'refund_paid' : 'sales',
                    $refund ? 'Customer refund' : 'Customer payments',
                    ($refund ? 'Refund for ' : 'Payment for ') . $row->document_number,
                    $row->customer_name,
                    $row->method,
                    $row->reference,
                    abs((float) $row->amount),
                    'sales',
                    1,
                    $row->id,
                ));
            });

        $between(
            DB::table('school_payment_submissions as s')
                ->leftJoin('sales_documents as d', 'd.id', '=', 's.sales_document_id')
                ->leftJoin('schools as sc', 'sc.id', '=', 's.school_id')
                ->where('s.factory_id', $factoryId)
                ->where('s.status', 'approved'),
            's.reviewed_at',
        )->get(['s.id', 's.amount', 's.payment_method', 's.payment_reference', 's.reviewed_at as date', 'd.document_number', 'sc.name as school'])
            ->each(function ($row) use ($rows) {
                $rows->push($this->row(
                    'school-' . $row->id,
                    substr((string) $row->date, 0, 10),
                    'in',
                    'sales',
                    'Customer payments',
                    'School payment for ' . ($row->document_number ?: 'order'),
                    $row->school,
                    $row->payment_method,
                    $row->payment_reference,
                    (float) $row->amount,
                    'school',
                    2,
                    $row->id,
                ));
            });

        $between(
            DB::table('procurement_payments as pp')
                ->join('purchase_documents as pd', 'pd.id', '=', 'pp.purchase_document_id')
                ->leftJoin('suppliers as su', 'su.id', '=', 'pd.supplier_id')
                ->where('pd.factory_id', $factoryId),
            'pp.paid_on',
        )->get(['pp.id', 'pp.amount', 'pp.method', 'pp.reference', 'pp.paid_on as date', 'pd.document_number', 'su.name as supplier'])
            ->each(function ($row) use ($rows) {
                $rows->push($this->row(
                    'purchase-' . $row->id,
                    substr((string) $row->date, 0, 10),
                    'out',
                    'purchases',
                    'Materials & supplier payments',
                    'Supplier payment for ' . $row->document_number,
                    $row->supplier,
                    $row->method,
                    $row->reference,
                    (float) $row->amount,
                    'purchases',
                    3,
                    $row->id,
                ));
            });

        $between(
            DB::table('finance_entries as e')->where('e.factory_id', $factoryId)->whereNull('e.voided_at'),
            'e.entry_date',
        )->get(['e.id', 'e.entry_number', 'e.direction', 'e.category', 'e.description', 'e.party', 'e.method', 'e.reference', 'e.amount', 'e.entry_date as date'])
            ->each(function ($row) use ($rows) {
                $rows->push($this->row(
                    'entry-' . $row->id,
                    substr((string) $row->date, 0, 10),
                    $row->direction,
                    $row->category,
                    FinanceEntry::categoryLabel($row->direction, $row->category),
                    $row->description,
                    $row->party,
                    $row->method,
                    $row->reference,
                    (float) $row->amount,
                    'entry',
                    4,
                    $row->id,
                    $row->entry_number,
                ));
            });

        return $rows;
    }

    private function row(
        string $key,
        string $date,
        string $direction,
        string $category,
        string $categoryLabel,
        string $description,
        ?string $party,
        ?string $method,
        ?string $reference,
        float $amount,
        string $source,
        int $sourceRank,
        int $id,
        ?string $number = null,
    ): array {
        return [
            'key' => $key,
            'date' => $date,
            'order' => $sourceRank * 1_000_000_000 + $id,
            'direction' => $direction,
            'category' => $category,
            'category_label' => $categoryLabel,
            'description' => $description,
            'party' => $party,
            'method' => $method,
            'reference' => $reference,
            'amount' => round($amount, 2),
            'source' => $source,
            'number' => $number,
            'entry_id' => $source === 'entry' ? $id : null,
        ];
    }

    /** Net money (in minus out) from the start of the books up to, but not including, the given day. */
    private function netBefore(int $factoryId, Carbon $day): float
    {
        $before = $day->toDateString();

        $direct = (float) DB::table('sales_payments as p')
            ->join('sales_documents as d', 'd.id', '=', 'p.sales_document_id')
            ->where('d.factory_id', $factoryId)
            ->whereDate('p.paid_on', '<', $before)
            ->sum('p.amount');
        $school = (float) DB::table('school_payment_submissions')
            ->where('factory_id', $factoryId)
            ->where('status', 'approved')
            ->whereDate('reviewed_at', '<', $before)
            ->sum('amount');
        $suppliers = (float) DB::table('procurement_payments as pp')
            ->join('purchase_documents as pd', 'pd.id', '=', 'pp.purchase_document_id')
            ->where('pd.factory_id', $factoryId)
            ->whereDate('pp.paid_on', '<', $before)
            ->sum('pp.amount');
        $entries = DB::table('finance_entries')
            ->where('factory_id', $factoryId)
            ->whereNull('voided_at')
            ->whereDate('entry_date', '<', $before)
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as net")
            ->value('net');

        return round($direct + $school - $suppliers + (float) $entries, 2);
    }

    /** What the store has asked for and what is still owed to suppliers, so finance sees it beside the money. */
    private function purchasingSnapshot(int $factoryId): array
    {
        $documents = fn () => DB::table('purchase_documents')->where('factory_id', $factoryId);

        return [
            'pending_requests' => $documents()
                ->where('document_type', 'purchase_request')
                ->whereIn('status', ['draft', 'submitted', 'pending_approval'])
                ->count(),
            'approved_requests' => $documents()->where('document_type', 'purchase_request')->where('status', 'approved')->count(),
            'orders_to_receive' => $documents()
                ->where('document_type', 'purchase_order')
                ->whereIn('status', ['ordered', 'partially_received'])
                ->count(),
            'unpaid_to_suppliers' => round((float) $documents()
                ->where('document_type', 'purchase_order')
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as value')
                ->value('value'), 2),
        ];
    }
}
