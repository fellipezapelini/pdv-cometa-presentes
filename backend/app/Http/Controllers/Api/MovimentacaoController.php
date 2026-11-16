<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Movimentacao, Produto};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MovimentacaoController extends Controller
{
    public function index(Request $request)
    {
        $movs = Movimentacao::with(['produto', 'usuario'])
            ->when($request->produto_id, fn($q, $p) => $q->where('produto_id', $p))
            ->when($request->tipo, fn($q, $t) => $q->where('tipo', $t))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($movs);
    }

    // Registrar saída manual (perda, avaria, ajuste)
    public function saida(Request $request)
    {
        $data = $request->validate([
            'produto_id' => 'required|exists:produtos,id',
            'quantidade' => 'required|integer|min:1',
            'motivo'     => 'required|string',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $produto = Produto::lockForUpdate()->findOrFail($data['produto_id']);

            if ($produto->quantidade < $data['quantidade']) {
                return response()->json(['message' => 'Estoque insuficiente.'], 422);
            }

            $produto->decrement('quantidade', $data['quantidade']);

            $mov = Movimentacao::create([
                'produto_id' => $produto->id,
                'usuario_id' => $request->user()->id,
                'tipo'       => 'saida',
                'quantidade' => $data['quantidade'],
                'motivo'     => $data['motivo'],
            ]);

            return response()->json($mov, 201);
        });
    }
}
