<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    /**
     * List the authenticated user's properties.
     */
    public function index(Request $request)
    {
        return $request->user()->properties()->with('contract')->get();
    }

    /**
     * Create a new property owned by the authenticated user.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $property = $request->user()->properties()->create($validated);

        return response()->json($property, 201);
    }

    /**
     * Show a single property owned by the authenticated user.
     */
    public function show(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        return $property->load('contract');
    }

    /**
     * Update a property owned by the authenticated user.
     */
    public function update(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'address' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $property->update($validated);

        return $property;
    }

    /**
     * Delete a property owned by the authenticated user.
     */
    public function destroy(Request $request, Property $property)
    {
        $this->authorizeOwner($request, $property);

        $property->delete();

        return response()->json(['message' => 'Property deleted successfully.']);
    }

    /**
     * Properties are only visible to and manageable by their owner.
     */
    private function authorizeOwner(Request $request, Property $property): void
    {
        if ($property->user_id !== $request->user()->id) {
            abort(403, 'You do not own this property.');
        }
    }
}
