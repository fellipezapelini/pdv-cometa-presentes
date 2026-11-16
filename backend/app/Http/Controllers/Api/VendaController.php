<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Venda, Produto, Cliente, ContaFiado, Movimentacao, Parcela};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class VendaController extends Controller
{
    public function index(Request $request)
    {
        $vendas = Venda::with(['cliente', 'usuario', 'itens.produto'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($vendas);
    }
    
    public function show(Venda $venda)
    {
        return response()->json($venda->load(['itens.produto', 'cliente', 'parcelas']));
    }
    
    
    public function destroy(Venda $venda)
    {
        return DB::transaction(function () use ($venda) {
            // Devolve estoque dos itens cadastrados
            foreach ($venda->itens as $item) {
                if ($item->produto_id) {
                    Produto::where('id', $item->produto_id)->increment('quantidade', $item->quantidade);
                }
            }
 
            // Remove movimentações de estoque ligadas a essa venda
            Movimentacao::where('venda_id', $venda->id)->delete();
 
            // Se era fiado, reverte o débito lançado na conta
            if ($venda->e_fiado && $venda->conta_fiado_id) {
                $conta = ContaFiado::find($venda->conta_fiado_id);
                $lancamento = \App\Models\LancamentoFiado::where('venda_id', $venda->id)
                    ->where('tipo', 'debito')
                    ->first();
                if ($lancamento && $conta) {
                    $conta->decrement('saldo_devedor', $lancamento->valor);
                    $lancamento->delete();
                }
            }
 
            // Remove parcelas do carnê (se houver)
            $venda->parcelas()->delete();
 
            // Remove itens e a venda
            $venda->itens()->delete();
            $venda->delete();
 
            return response()->json(['message' => 'Venda cancelada e estoque restaurado.']);
        });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'cliente_id'                 => 'nullable|exists:clientes,id',
            'forma_pagamento'            => 'required|in:dinheiro,pix,debito,credito,fiado,carne',
            'parcelas'                   => 'integer|min:1|max:12',
            'itens'                      => 'array',
            'itens.*.produto_id'         => 'required|exists:produtos,id',
            'itens.*.quantidade'         => 'required|integer|min:1',
            'itens_avulsos'              => 'array',
            'itens_avulsos.*.nome'       => 'required|string',
            'itens_avulsos.*.preco'      => 'required|numeric|min:0',
            'itens_avulsos.*.quantidade' => 'required|integer|min:1',
            // Campos do carnê
            'numero_parcelas'            => 'required_if:forma_pagamento,carne|integer|min:1|max:36',
            'valor_parcela'              => 'required_if:forma_pagamento,carne|numeric|min:0.01',
            'primeira_parcela'           => 'required_if:forma_pagamento,carne|date',
        ]);

        if (in_array($data['forma_pagamento'], ['fiado', 'carne']) && empty($data['cliente_id'])) {
            return response()->json(['message' => 'Venda fiado/carnê exige cliente identificado.'], 422);
        }

        $itens = $data['itens'] ?? [];
        $itensAvulsos = $data['itens_avulsos'] ?? [];

        if (empty($itens) && empty($itensAvulsos)) {
            return response()->json(['message' => 'A venda deve ter pelo menos um item.'], 422);
        }

        return DB::transaction(function () use ($data, $itens, $itensAvulsos, $request) {
            $valorTotal = 0;
            $itensProcessados = [];

            foreach ($itens as $item) {
                $produto = Produto::lockForUpdate()->findOrFail($item['produto_id']);
                if ($produto->quantidade < $item['quantidade']) {
                    throw new \Exception("Estoque insuficiente: {$produto->nome} (disponível: {$produto->quantidade})");
                }
                $subtotal = $produto->preco_venda * $item['quantidade'];
                $valorTotal += $subtotal;
                $itensProcessados[] = compact('produto', 'item', 'subtotal');
            }

            foreach ($itensAvulsos as $avulso) {
                $valorTotal += $avulso['preco'] * $avulso['quantidade'];
            }

            $eFiado = $data['forma_pagamento'] === 'fiado';
            $eCarne = $data['forma_pagamento'] === 'carne';
            $contaFiadoId = null;

            // Para o carnê, o valor total da venda é o total das parcelas (pode diferir do valor dos itens)
            if ($eCarne) {
                $valorTotal = $data['numero_parcelas'] * $data['valor_parcela'];
            }

            if ($eFiado && $data['cliente_id']) {
                $cliente = Cliente::find($data['cliente_id']);
                $conta = $cliente->contaFiado ?? ContaFiado::create([
                    'titular_id'    => $cliente->id,
                    'saldo_devedor' => 0,
                    'ativa'         => true,
                ]);
                $cliente->update(['tem_fiado' => true]);
                $contaFiadoId = $conta->id;
            }

            $venda = Venda::create([
                'cliente_id'      => $data['cliente_id'] ?? null,
                'usuario_id'      => $request->user()->id,
                'forma_pagamento' => $data['forma_pagamento'],
                'parcelas'        => $eCarne ? $data['numero_parcelas'] : ($data['parcelas'] ?? 1),
                'valor_total'     => $valorTotal,
                'e_fiado'         => $eFiado,
                'conta_fiado_id'  => $contaFiadoId,
            ]);

            foreach ($itensProcessados as ['produto' => $produto, 'item' => $item, 'subtotal' => $subtotal]) {
                $venda->itens()->create([
                    'produto_id'     => $produto->id,
                    'quantidade'     => $item['quantidade'],
                    'preco_unitario' => $produto->preco_venda,
                    'subtotal'       => $subtotal,
                ]);
                $produto->decrement('quantidade', $item['quantidade']);
                Movimentacao::create([
                    'produto_id'  => $produto->id,
                    'usuario_id'  => $request->user()->id,
                    'tipo'        => 'saida',
                    'quantidade'  => $item['quantidade'],
                    'motivo'      => $eFiado ? 'Venda fiado' : ($eCarne ? 'Venda carnê' : 'Venda'),
                    'venda_id'    => $venda->id,
                ]);
            }

            foreach ($itensAvulsos as $avulso) {
                $venda->itens()->create([
                    'produto_id'     => null,
                    'nome_avulso'    => $avulso['nome'],
                    'quantidade'     => $avulso['quantidade'],
                    'preco_unitario' => $avulso['preco'],
                    'subtotal'       => $avulso['preco'] * $avulso['quantidade'],
                ]);
            }

            if ($eFiado && $contaFiadoId) {
                $conta = ContaFiado::find($contaFiadoId);
                $conta->adicionarDebito($valorTotal, $data['cliente_id'], $venda->id, 'Venda #' . $venda->id);
            }

            // Gera as parcelas do carnê
            if ($eCarne) {
                $vencimento = Carbon::parse($data['primeira_parcela']);
                for ($i = 1; $i <= $data['numero_parcelas']; $i++) {
                    Parcela::create([
                        'venda_id'   => $venda->id,
                        'cliente_id' => $data['cliente_id'],
                        'numero'     => $i,
                        'valor'      => $data['valor_parcela'],
                        'vencimento' => $vencimento->copy(),
                        'status'     => 'pendente',
                    ]);
                    $vencimento->addMonthNoOverflow();
                }
            }

            return response()->json($venda->load(['itens.produto', 'cliente', 'parcelas']), 201);
        });
    }
}