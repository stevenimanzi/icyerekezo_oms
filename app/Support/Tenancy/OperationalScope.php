<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use App\Models\EmployeeProfile;
use App\Models\ProductionStageExecution;
use App\Models\User;
use App\Models\Warehouse;

final class OperationalScope
{
    private const FACTORY_WIDE_ROLES = [
        'factory-owner', 'factory-administrator', 'factory-manager',
        'production-manager', 'production-planner', 'quality-manager',
        'internal-auditor',
    ];

    public function __construct(
        public readonly User $user,
        public readonly int $factoryId,
        public readonly array $roleSlugs,
        public readonly ?EmployeeProfile $profile,
    ) {}

    public static function for(User $user): self
    {
        $factoryId = (int) $user->current_factory_id;
        $profile = request()->attributes->get('employee_scope') ?? EmployeeProfile::withoutGlobalScopes()
            ->with(['department', 'workstation'])->where('factory_id', $factoryId)->where('user_id', $user->id)->first();
        $roles = request()->attributes->get('factory_roles') ?? $user->roles()->wherePivot('factory_id', $factoryId)->get();

        return new self($user, $factoryId, $roles->pluck('slug')->all(), $profile);
    }

    public function isFactoryWide(): bool
    {
        return $this->user->is_platform_admin || (bool) array_intersect(self::FACTORY_WIDE_ROLES, $this->roleSlugs);
    }

    public function branchId(): ?int
    {
        $id = $this->profile?->workstation?->branch_id ?? $this->profile?->department?->branch_id;
        return $id ? (int) $id : null;
    }

    public function allowsWarehouse(Warehouse $warehouse): bool
    {
        if ((int) $warehouse->factory_id !== $this->factoryId) return false;
        if ($this->isFactoryWide() || ! $this->branchId()) return true;

        return (int) $warehouse->branch_id === $this->branchId();
    }

    public function allowsExecution(ProductionStageExecution $execution): bool
    {
        if ((int) $execution->factory_id !== $this->factoryId) return false;
        if ($this->isFactoryWide()) return true;
        if ((int) $execution->assigned_user_id === (int) $this->user->id) return true;

        $stage = $execution->relationLoaded('stage') ? $execution->stage : $execution->stage()->first();
        if (! $stage || ! $this->profile) return false;
        if ($this->profile->workstation_id) return (int) $stage->workstation_id === (int) $this->profile->workstation_id;
        if ($this->profile->department_id) return (int) $stage->department_id === (int) $this->profile->department_id;

        return false;
    }

    public function scopeExecutions(Builder|Relation $query): Builder|Relation
    {
        if ($this->isFactoryWide()) return $query;
        if (! $this->profile) return $query->whereRaw('1 = 0');

        return $query->where(function (Builder $builder) {
            $builder->where('assigned_user_id', $this->user->id);
            if ($this->profile?->workstation_id) {
                $builder->orWhereHas('stage', fn (Builder $stage) => $stage->where('workstation_id', $this->profile->workstation_id));
            } elseif ($this->profile?->department_id) {
                $builder->orWhereHas('stage', fn (Builder $stage) => $stage->where('department_id', $this->profile->department_id));
            }
        });
    }

    public function payload(): array
    {
        return [
            'factory_id' => $this->factoryId,
            'branch_id' => $this->branchId(),
            'department_id' => $this->profile?->department_id,
            'warehouse_ids' => $this->warehouseIds(),
            'workstation_id' => $this->profile?->workstation_id,
            'factory_wide' => $this->isFactoryWide(),
        ];
    }

    public function warehouseIds()
    {
        $query = Warehouse::query();
        if (! $this->isFactoryWide() && $this->branchId()) $query->where('branch_id', $this->branchId());

        return $query->pluck('id');
    }
}
