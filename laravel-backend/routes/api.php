<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\PropertyController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::apiResource('properties', PropertyController::class);

    Route::get('/properties/{property}/contract', [ContractController::class, 'show']);
    Route::post('/properties/{property}/contract', [ContractController::class, 'store']);
    Route::match(['put', 'patch'], '/properties/{property}/contract', [ContractController::class, 'update']);
    Route::delete('/properties/{property}/contract', [ContractController::class, 'destroy']);
});
