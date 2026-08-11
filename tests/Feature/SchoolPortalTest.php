<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SchoolPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_user_can_order_and_only_see_its_own_school_records(): void
    {
        $this->postJson('/api/auth/register', [
            'name'=>'Owner','email'=>'owner@school-portal.test','password'=>'Secure@12345','password_confirmation'=>'Secure@12345',
            'factory_name'=>'NOGUCHI HOLDINGS Ltd','industry_type'=>'clothing_textiles',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $factoryId=auth()->user()->current_factory_id;
        $school=School::create(['factory_id'=>$factoryId,'name'=>'GS Test School','district'=>'Burera','sector'=>'Cyanika','email'=>'school@test.test']);
        $other=School::create(['factory_id'=>$factoryId,'name'=>'Other School','district'=>'Gicumbi','sector'=>'Byumba','email'=>'other@test.test']);
        $role=Role::where('factory_id',$factoryId)->where('slug','school-user')->firstOrFail();
        $created=$this->postJson('/api/team/users',['name'=>'School Account','email'=>'school@test.test','password'=>'School@12345','password_confirmation'=>'School@12345','role_id'=>$role->id])->assertCreated()->json();
        $user=User::findOrFail($created['id']);
        $this->assertSame($school->id,$user->school_id);
        $this->actingAs($user)->getJson('/api/school/overview')->assertOk()->assertJsonPath('school.name','GS Test School')->assertJsonCount(0,'orders');
        $order=$this->postJson('/api/school/orders',['academic_year'=>'2026-2027','lines'=>[['class_level'=>'P1','garment_category'=>'Uniform','gender'=>'Boy','size'=>'S','color'=>'Blue','quantity_ordered'=>12]]])->assertCreated()->json('order');
        $this->getJson('/api/school/overview')->assertOk()->assertJsonPath('stats.total_items',12)->assertJsonCount(1,'orders');
        $foreign=\App\Models\SalesDocument::create(['factory_id'=>$factoryId,'school_id'=>$other->id,'document_type'=>'customer_order','document_number'=>'OTHER-1','customer_name'=>$other->name,'status'=>'pending','total_amount'=>0,'item_count'=>0,'document_date'=>today()]);
        $this->get('/api/school/orders/'.$foreign->id.'/pdf')->assertNotFound();
        $this->get('/api/school/orders/'.$order['id'].'/pdf')->assertOk();
    }
}
