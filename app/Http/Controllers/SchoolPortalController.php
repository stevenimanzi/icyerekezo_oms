<?php

namespace App\Http\Controllers;

use App\Models\AgreementDocument;
use App\Models\SalesDocument;
use App\Models\School;
use App\Models\SchoolAgreementSignature;
use App\Services\RwandaLocationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SchoolPortalController extends Controller
{
    private const PRICES = [
        'Nursery'   => ['Sweater' => 6500, 'Uniform' => 6000,  'Sport' => 9000, 'Overall' => 15000, 'Polo Lacoste' => 12000, 'T-shirt' => 4000, 'Jumper' => 12000],
        'Primary'   => ['Sweater' => 8000, 'Uniform' => 7500,  'Sport' => 9000, 'Overall' => 15000, 'Polo Lacoste' => 12000, 'T-shirt' => 4000, 'Jumper' => 12000],
        'Secondary' => ['Sweater' => 8500, 'Uniform' => 12000, 'Sport' => 12000, 'Overall' => 15000, 'Polo Lacoste' => 12000, 'T-shirt' => 4000, 'Jumper' => 12000]
    ];

    public function overview(Request $request): JsonResponse
    {
        $school = $this->school($request);
        $orders = SalesDocument::withoutGlobalScopes()->where('factory_id', $request->user()->current_factory_id)->where('school_id', $school->id)->where('document_type', 'customer_order')->with(['lines', 'shipments.vehicle'])->latest('document_date')->get();
        $ordered = (int) $orders->sum('item_count'); $delivered = (int) $orders->flatMap->lines->sum('quantity_delivered'); $rejected = (int) $orders->flatMap->lines->sum('quantity_rejected');
        $agreement = AgreementDocument::where('factory_id', $request->user()->current_factory_id)->latest()->first();
        return response()->json([
            'school'=>$school, 'orders'=>$orders, 'stats'=>['total_items'=>$ordered,'delivered_items'=>$delivered,'rejected_items'=>$rejected,'undelivered_items'=>max(0,$ordered-$delivered-$rejected)],
            'payments'=>DB::table('school_payment_submissions')->where('school_id',$school->id)->latest()->get(),
            'returns'=>DB::table('school_returns')->where('school_returns.school_id',$school->id)->join('sales_document_lines','sales_document_lines.id','=','school_returns.sales_document_line_id')->select('school_returns.*','sales_document_lines.class_level','sales_document_lines.garment_category','sales_document_lines.gender','sales_document_lines.size','sales_document_lines.color')->latest('school_returns.created_at')->get(),
            'agreement'=>$agreement,
            'agreement_signature'=>$agreement ? SchoolAgreementSignature::where('agreement_document_id',$agreement->id)->where('school_id',$school->id)->first() : null,
            'locations'=>app(RwandaLocationService::class)->northernDistrictsAndSectors(), 'academic_years'=>['2025-2026','2026-2027','2027-2028','2028-2029','2029-2030','2030-2031'],
            'classes'=>['Nursery 1','Nursery 2','Nursery 3','P1','P2','P3','P4','P5','P6','S1','S2','S3','S4','S5','S6'], 'prices'=>self::PRICES,
        ]);
    }

    public function uploadAgreementSignature(Request $request): JsonResponse
    {
        $school = $this->school($request);
        $factoryId = (int) $request->user()->current_factory_id;
        $current = AgreementDocument::where('factory_id', $factoryId)->latest()->first();
        abort_unless($current, 422, 'There is no agreement available to sign yet.');
        $data = $request->validate(['signed_agreement' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:15360']]);

        $existing = SchoolAgreementSignature::where('agreement_document_id', $current->id)->where('school_id', $school->id)->first();
        if ($existing) {
            Storage::disk('public')->delete($existing->file_path);
        }
        $path = $data['signed_agreement']->store('agreement/signatures/'.$factoryId, 'public');
        $signature = SchoolAgreementSignature::updateOrCreate(
            ['agreement_document_id' => $current->id, 'school_id' => $school->id],
            ['factory_id' => $factoryId, 'file_path' => $path, 'original_name' => $data['signed_agreement']->getClientOriginalName(), 'submitted_at' => now()]
        );

        return response()->json(['message' => 'Signed agreement submitted.', 'signature' => $signature], 201);
    }

    public function storeOrder(Request $request): JsonResponse
    {
        $school=$this->school($request); $factoryId=(int)$request->user()->current_factory_id;
        $data=$request->validate(['academic_year'=>['required',Rule::in(['2025-2026','2026-2027','2027-2028','2028-2029','2029-2030','2030-2031'])],'lines'=>['required','array','min:1'],'lines.*.class_level'=>['required','string','max:30'],'lines.*.garment_category'=>['required',Rule::in(['Uniform','Sweater','Sport Uniform','T-shirt','Overall'])],'lines.*.gender'=>['required',Rule::in(['Boy','Girl','Unisex'])],'lines.*.size'=>['required','string','max:20'],'lines.*.color'=>['nullable','string','max:255'],'lines.*.quantity_ordered'=>['required','integer','min:1']]);
        foreach($data['lines'] as $line){abort_if($line['garment_category']==='T-shirt'&&!preg_match('/^S[1-6]$/',$line['class_level']),422,'T-Shirts are available only for S1 to S6.');abort_if($line['garment_category']==='Overall'&&!preg_match('/^S[4-6]$/',$line['class_level']),422,'Overalls are available only for S4 to S6.');}
        if (SalesDocument::withoutGlobalScopes()->where('factory_id',$factoryId)->where('school_id',$school->id)->where('academic_year',$data['academic_year'])->where('document_type','customer_order')->where('status','!=','rejected')->exists()) {
            return response()->json(['message' => 'This school already has an active order for the selected academic year. Please edit your existing order instead of placing a new one.'], 400);
        }
        $total=collect($data['lines'])->sum(function($line){$level=str_starts_with($line['class_level'],'P')?'Primary':(str_starts_with($line['class_level'],'S')?'Secondary':'Nursery');return $line['quantity_ordered']*(self::PRICES[$level][$line['garment_category']]??0);});
        $order=DB::transaction(function()use($data,$school,$factoryId,$request,$total){$order=SalesDocument::withoutGlobalScopes()->create(['factory_id'=>$factoryId,'school_id'=>$school->id,'document_type'=>'customer_order','document_number'=>'SCH-'.now()->format('YmdHis').'-'.$school->id,'customer_name'=>$school->name,'customer_email'=>$school->email,'academic_year'=>$data['academic_year'],'status'=>'pending','currency_code'=>'RWF','total_amount'=>$total,'item_count'=>collect($data['lines'])->sum('quantity_ordered'),'document_date'=>today(),'created_by'=>$request->user()->id]);$order->lines()->createMany(array_map(fn($line)=>$line+['factory_id'=>$factoryId,'item_id'=>\App\Models\Item::resolveFinishedGood($factoryId,$line['garment_category'])->id],$data['lines']));return $order;});
        
        if ($order->customer_email) {
            try {
                \Illuminate\Support\Facades\Mail::to($order->customer_email)->send(new \App\Mail\SchoolOrderNotificationMail($order, 'placed'));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json(['message'=>'Your order was sent to the factory for review.','order'=>$order->load('lines')],201);
    }

    public function payment(Request $request, SalesDocument $document): JsonResponse
    {
        $school=$this->school($request);$this->owns($request,$school,$document);
        $pending=(float)DB::table('school_payment_submissions')->where('sales_document_id',$document->id)->where('status','pending')->sum('amount');
        $remaining=max(0,(float)$document->total_amount-(float)$document->paid_amount-$pending);
        abort_if($remaining<=0,422,'This order has no outstanding balance available for another payment submission.');
        $data=$request->validate(['amount'=>['required','numeric','min:1','max:'.$remaining],'payment_method'=>['required',Rule::in(['Bank Transfer','MoMo Pay','Cheque','Cash Deposit'])],'payment_reference'=>['required','string','max:120'],'paid_at'=>['required','date','before_or_equal:today'],'proof_file'=>['required','file','mimes:jpg,jpeg,png,pdf','max:5120']]);
        $path=$request->file('proof_file')->store('payment-proofs','public');DB::table('school_payment_submissions')->insert(['factory_id'=>$request->user()->current_factory_id,'school_id'=>$school->id,'sales_document_id'=>$document->id,'amount'=>$data['amount'],'payment_method'=>$data['payment_method'],'payment_reference'=>$data['payment_reference'],'paid_at'=>$data['paid_at'],'proof_path'=>$path,'status'=>'pending','created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['message'=>'Payment proof submitted for verification.'],201);
    }

    public function returnItems(Request $request, SalesDocument $document): JsonResponse
    {
        $school=$this->school($request);$this->owns($request,$school,$document);$data=$request->validate(['items'=>['required','array','min:1'],'items.*.line_id'=>['required','integer','distinct'],'items.*.quantity'=>['required','integer','min:1'],'items.*.reason'=>['required',Rule::in(['Too Small','Too Large','Damaged','Wrong Item','Other'])]]);
        DB::transaction(function()use($data,$document,$school,$request){
            foreach($data['items'] as $item){
                $line=$document->lines()->lockForUpdate()->findOrFail($item['line_id']);
                $alreadyReturned=(int)DB::table('school_returns')->where('sales_document_line_id',$line->id)->sum('quantity');
                $available=max(0,(int)$line->quantity_delivered-$alreadyReturned);
                abort_if($item['quantity']>$available,422,'The return quantity is greater than the quantity still available to return.');
                DB::table('school_returns')->insert(['factory_id'=>$request->user()->current_factory_id,'school_id'=>$school->id,'sales_document_id'=>$document->id,'sales_document_line_id'=>$line->id,'quantity'=>$item['quantity'],'reason'=>$item['reason'],'status'=>'pending','created_at'=>now(),'updated_at'=>now()]);
            }
        });
        return response()->json(['message'=>'Your return request was sent to the factory.'],201);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $school = $this->school($request);
        $locations = app(RwandaLocationService::class)->northernDistrictsAndSectors();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'], 'contact_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'], 'email' => ['nullable', 'email'],
            'district' => ['required', Rule::in(array_keys($locations))],
            'sector' => ['required', Rule::in($locations[$request->input('district')] ?? [])],
        ]);
        $school->update($data);
        return response()->json(['message' => 'School profile updated.', 'school' => $school]);
    }

    public function pdf(Request $request, SalesDocument $document): Response {$school=$this->school($request);$this->owns($request,$school,$document);$document->load(['school','lines']);$factory=$request->user()->currentFactory;return Pdf::loadView('pdf.school-order',compact('document','factory'))->setPaper('a4','landscape')->stream('school-order-'.$document->document_number.'.pdf');}
    private function school(Request $request): School {abort_unless($request->user()->roles()->wherePivot('factory_id',$request->user()->current_factory_id)->where('slug','school-user')->exists(),403,'School portal access is required.');return School::withoutGlobalScopes()->where('factory_id',$request->user()->current_factory_id)->findOrFail($request->user()->school_id);}
    private function owns(Request $request,School $school,SalesDocument $document): void {abort_unless((int)$document->factory_id===(int)$request->user()->current_factory_id&&(int)$document->school_id===(int)$school->id,404);}
}
