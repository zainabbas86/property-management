<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyJwt
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');

        if (!str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $claims = $this->decode(substr($header, 7));

        if (!$claims) {
            return response()->json(['message' => 'Token invalid or expired.'], 401);
        }

        $user = User::find($claims['sub']);

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        auth()->setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }

    private function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $sig] = $parts;

        $secret = env('JWT_SECRET');
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload", $secret, true)), '+/', '-_'), '=');

        if (!hash_equals($expected, $sig)) {
            return null;
        }

        $padding = strlen($payload) % 4;
        $padded = $padding ? $payload . str_repeat('=', 4 - $padding) : $payload;
        $claims = json_decode(base64_decode(strtr($padded, '-_', '+/')), true);

        if (!is_array($claims)) {
            return null;
        }

        if (isset($claims['exp']) && $claims['exp'] < time()) {
            return null;
        }

        return $claims;
    }
}
