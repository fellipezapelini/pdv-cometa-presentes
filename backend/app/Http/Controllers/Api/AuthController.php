<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'senha' => 'required|string',
        ]);

        $usuario = Usuario::where('email', $request->email)
            ->where('ativo', true)
            ->first();

        if (!$usuario || !Hash::check($request->senha, $usuario->senha)) {
            return response()->json(['message' => 'Credenciais inválidas.'], 401);
        }

        $token = $usuario->createToken('api-token')->plainTextToken;

        return response()->json([
            'token'   => $token,
            'usuario' => [
                'id'    => $usuario->id,
                'nome'  => $usuario->nome,
                'email' => $usuario->email,
                'papel' => $usuario->papel,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logout realizado.']);
    }

    /** Troca a senha do usuário logado e encerra as outras sessões (tokens). */
    public function trocarSenha(Request $request)
    {
        $data = $request->validate([
            'senha_atual' => 'required|string',
            'nova_senha'  => 'required|string|min:10|max:200|confirmed|different:senha_atual',
        ], [
            'nova_senha.min'       => 'A nova senha precisa ter pelo menos 10 caracteres.',
            'nova_senha.confirmed' => 'A confirmação não é igual à nova senha.',
            'nova_senha.different' => 'A nova senha precisa ser diferente da atual.',
        ]);

        $usuario = $request->user();
        if (!Hash::check($data['senha_atual'], $usuario->senha)) {
            return response()->json(['message' => 'Senha atual incorreta.'], 422);
        }

        $usuario->update(['senha' => Hash::make($data['nova_senha'])]);

        // Desconecta os outros aparelhos; mantém a sessão atual
        $atual = $usuario->currentAccessToken();
        $usuario->tokens()->when($atual, fn($q) => $q->where('id', '<>', $atual->id))->delete();

        return response()->json(['message' => 'Senha alterada.']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->only('id', 'nome', 'email', 'papel'));
    }
}
