<?php

namespace App\Http\Controllers\Factory;

use App\Models\AuditLog;
use App\Services\FactoryProfileApplier;
use App\Support\Catalogs\IndustryProfileCatalog;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class FactoryFlowController extends Controller
{
    public function suggestion(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;
        $resolved = IndustryProfileCatalog::resolve($factory->profileKeys());

        // `departments` keeps the shape the setup page already reads, using the primary profile's flow.
        $primary = array_key_first($resolved['profiles']);
        $departments = collect($resolved['profiles'][$primary]['departments'])->map(fn (string $name, int $index) => [
            'name' => $name,
            'code' => strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 8)).str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
            'workstation_type' => IndustryProfileCatalog::stationType($name),
        ])->all();

        return response()->json([
            'industry' => $factory->industry_type,
            'profiles' => $factory->profileKeys(),
            'suggestion' => ['name' => 'Recommended '.str_replace('_', ' ', $primary).' workflow', 'departments' => $departments],
        ]);
    }

    public function apply(Request $request, FactoryProfileApplier $applier): JsonResponse
    {
        try {
            $workflow = $applier->apply($request->user()->currentFactory);
        } catch (QueryException $exception) {
            report($exception);

            return response()->json([
                'message' => 'The suggested flow could not be applied safely. Refresh the page and try again. Your existing workflow was not changed.',
            ], 422);
        }
        AuditLog::record('factory.flow_applied', 'Applied the recommended industry workflow', $workflow);

        return response()->json([
            ...$workflow->load('stages')->toArray(),
            'message' => 'Suggested flow applied successfully. You can apply it again whenever your factory setup changes.',
        ], 201);
    }
}
