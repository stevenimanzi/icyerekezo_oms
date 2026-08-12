<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\SalesDocument;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NoguchiLogisticsReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_logistics_receives_only_logistics_data_while_management_receives_factory_report(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'owner@noguchi-report.test', 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'NOGUCHI HOLDINGS Ltd',
            'industry_type' => 'clothing_textiles',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();

        $owner = auth()->user();
        $role = Role::where('factory_id', $owner->current_factory_id)->where('slug', 'logistics-officer')->firstOrFail();
        $employee = $this->postJson('/api/team/users', [
            'name' => 'Logistics Officer', 'email' => 'logistics@noguchi-report.test',
            'password' => 'Officer@12345', 'password_confirmation' => 'Officer@12345',
            'role_id' => $role->id, 'job_title' => 'Logistics Officer',
        ])->assertCreated()->json();
        $burera = School::create(['factory_id' => $owner->current_factory_id, 'name' => 'School One', 'district' => 'Burera', 'sector' => 'Bungwe']);
        $gicumbi = School::create(['factory_id' => $owner->current_factory_id, 'name' => 'School Two', 'district' => 'Gicumbi', 'sector' => 'Byumba']);
        SalesDocument::create(['factory_id' => $owner->current_factory_id, 'school_id' => $burera->id, 'document_type' => 'customer_order', 'document_number' => 'ORDER-PENDING', 'customer_name' => $burera->name, 'status' => 'pending', 'total_amount' => 1000, 'item_count' => 10, 'document_date' => today()]);
        SalesDocument::create(['factory_id' => $owner->current_factory_id, 'school_id' => $gicumbi->id, 'document_type' => 'customer_order', 'document_number' => 'ORDER-DELIVERED', 'customer_name' => $gicumbi->name, 'status' => 'delivered', 'total_amount' => 2000, 'item_count' => 20, 'document_date' => today()]);
        $this->assertDatabaseHas('sales_documents', ['factory_id' => $owner->current_factory_id, 'document_number' => 'ORDER-PENDING', 'school_id' => $burera->id, 'status' => 'pending']);

        $this->actingAs(User::findOrFail($employee['id']))
            ->getJson('/api/reports?period=day&type=all')
            ->assertOk()
            ->assertJsonPath('report.scope', 'logistics')
            ->assertJsonPath('report.type', 'inventory')
            ->assertJsonPath('standard.title', 'Daily logistics report')
            ->assertJsonPath('production', [])
            ->assertJsonStructure(['logistics' => ['summary' => ['orders_processed', 'items_ordered', 'items_delivered', 'items_remaining', 'items_returned', 'total_value', 'shipments', 'deliveries_completed'], 'order_statuses', 'return_reasons', 'orders', 'shipments', 'vehicles'], 'stock_register', 'filters' => ['districts', 'sectors_by_district']])
            ->assertJsonPath('filters.sectors_by_district.Burera.0', 'Bungwe');

        $this->actingAs(User::findOrFail($employee['id']))
            ->getJson('/api/reports?period=all&district=Burera&sector=Bungwe&status=pending')
            ->assertOk()->assertJsonCount(1, 'logistics.orders')
            ->assertJsonPath('logistics.orders.0.document_number', 'ORDER-PENDING');
        $this->actingAs(User::findOrFail($employee['id']))
            ->getJson('/api/reports?period=all&status=delivered')
            ->assertOk()->assertJsonCount(1, 'logistics.orders')
            ->assertJsonPath('logistics.orders.0.document_number', 'ORDER-DELIVERED');

        $export = $this->actingAs(User::findOrFail($employee['id']))->get('/api/reports/orders.xlsx?period=all&district=Burera&sector=Bungwe&status=pending');
        $export->assertOk()->assertDownload();
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($export->baseResponse->getFile()->getPathname()) === true);
        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $this->assertStringContainsString('ORDER-PENDING', $sheetXml);
        $this->assertStringNotContainsString('ORDER-DELIVERED', $sheetXml);
        $this->assertStringContainsString('orientation="landscape"', $sheetXml);
        $zip->close();

        $this->actingAs($owner)->getJson('/api/reports?period=day&type=all')
            ->assertOk()
            ->assertJsonPath('report.scope', 'factory');
    }
}
