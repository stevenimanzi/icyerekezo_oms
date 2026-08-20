<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Factory;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowStage;

class NoguchiWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $factory = Factory::where('name', 'Noguchi Holdings Ltd')->first();
        if (!$factory) {
            echo "Noguchi Holdings Ltd not found.\n";
            return;
        }

        $template = WorkflowTemplate::create([
            'factory_id' => $factory->id,
            'name' => 'Noguchi Standard Production Flow',
            'code' => 'NOGUCHI-STD',
            'description' => 'Strict workflow enforcing Cutting -> Sewing -> Finishing -> Packing',
            'status' => 'active',
            'is_default' => true,
        ]);

        // Unset old default workflows for this factory
        WorkflowTemplate::where('factory_id', $factory->id)->where('id', '!=', $template->id)->update(['is_default' => false]);

        $stages = [
            ['name' => 'Cutting', 'code' => 'CUTTING'],
            ['name' => 'Sewing', 'code' => 'SEWING'],
            ['name' => 'Finishing', 'code' => 'FINISHING'],
            ['name' => 'Packing', 'code' => 'PACKING'],
        ];

        foreach ($stages as $index => $stage) {
            WorkflowStage::create([
                'workflow_template_id' => $template->id,
                'name' => $stage['name'],
                'code' => $stage['code'],
                'sequence' => $index + 1,
                'expected_minutes' => 60,
                'required_workers' => 1,
                'quality_required' => false,
                'approval_required' => false,
            ]);
        }
        
        echo "Noguchi workflow seeded successfully.\n";
    }
}
