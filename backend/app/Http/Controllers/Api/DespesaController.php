<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Despesa;
use Illuminate\Http\Request;

class DespesaController extends Controller
{
    // Manter em sincronia com CATEGORIAS em Despesas.jsx
    public const CATEGORIAS = [
        'boleto_loja', 'faturas_cartao', 'combustivel', 'alimentacao', 'pagamento_funcionario',
        'boleto_governo', 'contas_consumo', 'veiculo', 'emprestimos', 'mercadoria', 'servicos',
        'pessoal', 'outros',
    ];

    public function index(Request $request)
    {
        $mes = (int) $request->input('mes', date('n'));
        $ano = (int) $request->input('ano', date('Y'));

        $despesas = Despesa::whereYear('data_pagamento', $ano)
            ->whereMonth('data_pagamento', $mes)
            ->when($request->categoria, fn($q, $c) => $q->where('categoria', $c))
            ->orderByDesc('data_pagamento')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'despesas'            => $despesas,
            'total_geral'         => $despesas->sum('valor'),
            'total_por_categoria' => $despesas->groupBy('categoria')->map(fn($items) => $items->sum('valor')),
            'mes'                 => $mes,
            'ano'                 => $ano,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'categoria'      => 'required|in:' . implode(',', self::CATEGORIAS),
            'descricao'      => 'nullable|string|max:255',
            'valor'          => 'required|numeric|min:0.01',
            'data_pagamento' => 'required|date',
        ]);

        $data['usuario_id'] = $request->user()->id;

        return response()->json(Despesa::create($data), 201);
    }

    public function update(Request $request, Despesa $despesa)
    {
        $data = $request->validate([
            'categoria'      => 'sometimes|in:' . implode(',', self::CATEGORIAS),
            'descricao'      => 'sometimes|nullable|string|max:255',
            'valor'          => 'sometimes|numeric|min:0.01',
            'data_pagamento' => 'sometimes|date',
        ]);

        $despesa->update($data);
        return response()->json($despesa->fresh());
    }

    public function destroy(Despesa $despesa)
    {
        $despesa->delete();
        return response()->json(['message' => 'Despesa removida.']);
    }
}
