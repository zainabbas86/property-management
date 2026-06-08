<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    /**
     * Show the contract for a property owned by the authenticated user.
     */
    public function show(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        return $this->contractOrFail($property);
    }

    /**
     * Create the contract for a property owned by the authenticated user.
     * A property can have at most one contract.
     */
    public function store(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        if ($property->contract()->exists()) {
            abort(409, 'This property already has a contract.');
        }

        $validated = $this->validateContract($request);

        $contract = $property->contract()->create($validated);

        return response()->json($contract, 201);
    }

    /**
     * Update the contract for a property owned by the authenticated user.
     */
    public function update(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        $contract = $this->contractOrFail($property);

        $validated = $this->validateContract($request, sometimes: true);

        $contract->update($validated);

        return $contract;
    }

    /**
     * Delete the contract for a property owned by the authenticated user.
     */
    public function destroy(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        $contract = $this->contractOrFail($property);

        $contract->delete();

        return response()->json(['message' => 'Contract deleted successfully.']);
    }

    /**
     * Properties (and their contracts) are only visible to and manageable by their owner.
     */
    private function authorizeOwner(Request $request, Property $property): void
    {
        if ($property->user_id !== $request->user()->id) {
            abort(403, 'You do not own this property.');
        }
    }

    private function contractOrFail(Property $property)
    {
        $contract = $property->contract;

        if (! $contract) {
            abort(404, 'This property has no contract.');
        }

        return $contract;
    }

    private function validateContract(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? ['sometimes', ...$rules] : $rules;

        return $request->validate([
            'tenant_name' => $rule(['required', 'string', 'max:255']),
            'start_date' => $rule(['required', 'date']),
            'end_date' => $rule(['required', 'date', 'after:start_date']),
            'rent_amount' => $rule(['required', 'numeric', 'min:0']),
            'status' => ['sometimes', 'string', 'in:active,terminated,expired'],
        ]);
    }
}
