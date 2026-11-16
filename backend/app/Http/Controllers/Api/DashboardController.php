<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Produto, Venda, ContaFiado, Movimentacao};
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function resumo()
    {
        $totalProdutos  = Produto::where('ativo', true)->count();
        $valorEstoque   = Produto::where('ativo', true)->sum(DB::raw('preco_venda * quantidade'));
        $estoqueBaixo   = Produto::where('ativo', true)->whereColumn('quantidade', '<=', 'estoque_minimo')->count();
        $totalFiado     = ContaFiado::where('ativa', true)->sum('saldo_devedor');
        $vendasHoje     = Venda::whereDate('created_at', today())->sum('valor_total');

        $movRecentes = Movimentacao::with(['produto', 'usuario'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        $topVendidos = DB::table('itens_venda')
            ->join('produtos', 'produtos.id', '=', 'itens_venda.produto_id')
            ->select('produtos.nome', DB::raw('SUM(itens_venda.quantidade) as total_vendido'), DB::raw('SUM(itens_venda.subtotal) as faturamento'))
            ->groupBy('produtos.id', 'produtos.nome')
            ->orderByDesc('total_vendido')
            ->limit(10)
            ->get();

        return response()->json([
            'total_produtos'  => $totalProdutos,
            'valor_estoque'   => $valorEstoque,
            'estoque_baixo'   => $estoqueBaixo,
            'total_fiado'     => $totalFiado,
            'vendas_hoje'     => $vendasHoje,
            'mov_recentes'    => $movRecentes,
            'top_vendidos'    => $topVendidos,
        ]);
    }
}
