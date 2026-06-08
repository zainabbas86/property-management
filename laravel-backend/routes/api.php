<?php

use App\Http\Controllers\ContractController;
use App\Http\Controllers\PropertyController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth.jwt')->group(function () {
    Route::apiResource('properties', PropertyController::class);

    Route::get('/properties/{property}/contract', [ContractController::class, 'show']);
    Route::post('/properties/{property}/contract', [ContractController::class, 'store']);
    Route::match(['put', 'patch'], '/properties/{property}/contract', [ContractController::class, 'update']);
    Route::delete('/properties/{property}/contract', [ContractController::class, 'destroy']);
});
