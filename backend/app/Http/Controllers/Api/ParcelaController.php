<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Parcela;
use Illuminate\Http\Request;

class ParcelaController extends Controller
{
    // Lista todas as parcelas (com filtro opcional de status)
    public function index(Request $request)
    {
        $parcelas = Parcela::with(['cliente', 'venda'])
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->when($request->cliente_id, fn($q, $id) => $q->where('cliente_id', $id))
            ->orderBy('vencimento')
            ->get();

        return response()->json($parcelas);
    }

    // Marca uma parcela como paga
    public function marcarPaga(Request $request, Parcela $parcela)
    {
        $data = $request->validate([
            'forma_pagamento' => 'required|in:dinheiro,pix,debito,credito',
        ]);

        $parcela->update([
            'status'                => 'pago',
            'pago_em'               => now(),
            'forma_pagamento_pago'  => $data['forma_pagamento'],
        ]);

        return response()->json($parcela);
    }

    // Desfaz pagamento (caso marque errado)
    public function desmarcarPaga(Parcela $parcela)
    {
        $parcela->update([
            'status'               => 'pendente',
            'pago_em'              => null,
            'forma_pagamento_pago' => null,
        ]);

        return response()->json($parcela);
    }
}