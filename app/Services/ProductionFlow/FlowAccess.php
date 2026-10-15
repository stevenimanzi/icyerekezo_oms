<?php

namespace App\Services\ProductionFlow;

use App\Models\User;
use App\Support\Catalogs\ProductionFlowCatalog;

final class FlowAccess
{
    private function __construct(private readonly User $user, private readonly array $roleSlugs) {}

    public static function for(User $user): self
    {
        $roles = request()->attributes->get('factory_roles');

        $slugs = $roles
            ? $roles->pluck('slug')->all()
            : $user->roles()->wherePivot('factory_id', $user->current_factory_id)->pluck('slug')->all();

        return new self($user, $slugs);
    }

    public function isManager(): bool
    {
        return $this->user->is_platform_admin || (bool) array_intersect(ProductionFlowCatalog::MANAGER_ROLES, $this->roleSlugs);
    }

    public function canWork(string $stage): bool
    {
        return $this->isManager() || (bool) array_intersect(ProductionFlowCatalog::STAGES[$stage]['roles'] ?? [], $this->roleSlugs);
    }

    public function workStages(): array
    {
        return array_values(array_filter(ProductionFlowCatalog::keys(), fn (string $stage) => $this->canWork($stage)));
    }

    public function canApproveRequests(): bool
    {
        return $this->user->is_platform_admin || (bool) array_intersect(ProductionFlowCatalog::WAREHOUSE_ROLES, $this->roleSlugs);
    }

    public function canInspect(): bool
    {
        return $this->user->hasPermission('quality.inspect');
    }

    public function defaultStage(): ?string
    {
        return ProductionFlowCatalog::stageForRoles($this->roleSlugs) ?? ($this->isManager() ? 'cutting' : null);
    }

    public function user(): User
    {
        return $this->user;
    }
}
