<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{NotaFiscal, ItemNf, Produto, Movimentacao, ProdutoEmbalagem};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotaFiscalController extends Controller
{
    public function index()
    {
        return response()->json(
            NotaFiscal::with('usuario')->withCount('itens')->orderByDesc('created_at')->paginate(50)
        );
    }

    public function show(NotaFiscal $notaFiscal)
    {
        return response()->json($notaFiscal->load(['itens.produto:id,nome,sku,quantidade']));
    }

    /**
     * Reconhece os itens da nota antes de lançar:
     *  1º memória (EAN da nota já usado antes → produto + fator)
     *  2º produto cujo EAN (sku) é igual ao da nota (fator 1)
     *  3º produto cujo EAN é o EAN tributável/unitário informado na nota
     */
    public function analisar(Request $request)
    {
        $data = $request->validate([
            'itens'             => 'required|array|min:1',
            'itens.*.ean'       => 'nullable|string',
            'itens.*.ean_unidade' => 'nullable|string',
        ]);

        $campos = ['id', 'nome', 'sku', 'quantidade', 'preco_custo', 'preco_venda'];

        $resultado = collect($data['itens'])->map(function ($item) use ($campos) {
            $ean = trim($item['ean'] ?? '');
            $eanUn = trim($item['ean_unidade'] ?? '');

            if ($ean !== '') {
                $emb = ProdutoEmbalagem::with('produto:' . implode(',', $campos))->where('ean', $ean)->first();
                if ($emb && $emb->produto) {
                    return ['origem' => 'memoria', 'fator' => $emb->fator, 'produto' => $emb->produto];
                }
                $p = Produto::where('ativo', true)->where('sku', $ean)->first($campos);
                if ($p) return ['origem' => 'ean', 'fator' => null, 'produto' => $p];
            }
            if ($eanUn !== '' && $eanUn !== $ean) {
                $p = Produto::where('ativo', true)->where('sku', $eanUn)->first($campos);
                if ($p) return ['origem' => 'ean_unidade', 'fator' => null, 'produto' => $p];
            }
            return ['origem' => null, 'fator' => null, 'produto' => null];
        });

        return response()->json($resultado);
    }

    /**
     * Lança a nota inteira de uma vez: cada linha alimenta UM produto, na unidade de venda.
     * Ex.: 1 CX "CANETA BIC C/6" com fator 600 → +600 unidades da caneta, custo = valor ÷ 600.
     */
    public function registrarEntrada(Request $request)
    {
        $data = $request->validate([
            'numero_nf'       => 'nullable|string|max:60',
            'fornecedor'      => 'nullable|string|max:255',
            'data_emissao'    => 'nullable|date',
            'valor_total_nf'  => 'nullable|numeric|min:0',
            'forcar'          => 'boolean',
            'itens'                   => 'required|array|min:1',
            'itens.*.nome_nf'         => 'required|string|max:255',
            'itens.*.ean_nf'          => 'nullable|string|max:30',
            'itens.*.quantidade_nf'   => 'required|numeric|min:0.001',
            'itens.*.custo_nf'        => 'required|numeric|min:0',
            'itens.*.fator'           => 'required|integer|min:1|max:100000',
            'itens.*.produto_id'      => 'nullable|exists:produtos,id',
            'itens.*.novo_nome'       => 'nullable|required_without:itens.*.produto_id|string|max:255',
            'itens.*.novo_ean'        => 'nullable|string|max:30',
            'itens.*.categoria_id'    => 'nullable|exists:categorias,id',
            'itens.*.preco_venda'     => 'required|numeric|min:0.01',
            'itens.*.lembrar'         => 'boolean',
        ]);

        $numero = trim($data['numero_nf'] ?? '') ?: 'S/N';
        $fornecedor = trim($data['fornecedor'] ?? '') ?: 'Não informado';

        // Evita lançar a mesma nota duas vezes
        if ($numero !== 'S/N' && empty($data['forcar'])) {
            $existente = NotaFiscal::where('numero_nf', $numero)->where('fornecedor', $fornecedor)
                ->where('status', 'confirmada')->first();
            if ($existente) {
                return response()->json([
                    'message'   => "A NF {$numero} de {$fornecedor} já foi lançada em " . $existente->created_at->format('d/m/Y') . '.',
                    'duplicada' => true,
                ], 409);
            }
        }

        $usuarioId = $request->user()->id;

        return DB::transaction(function () use ($data, $numero, $fornecedor, $usuarioId) {
            $nf = NotaFiscal::create([
                'numero_nf'      => $numero,
                'fornecedor'     => $fornecedor,
                'data_emissao'   => $data['data_emissao'] ?? now()->toDateString(),
                'valor_total_nf' => $data['valor_total_nf'] ?? 0,
                'status'         => 'confirmada',
                'usuario_id'     => $usuarioId,
            ]);

            $resumo = [];
            foreach ($data['itens'] as $item) {
                $fator    = (int) $item['fator'];
                $unidades = (int) round($item['quantidade_nf'] * $fator);
                $custoUn  = $fator > 0 ? (float) $item['custo_nf'] / $fator : (float) $item['custo_nf'];
                $eanNf    = trim($item['ean_nf'] ?? '') ?: null;

                if (!empty($item['produto_id'])) {
                    $produto = Produto::lockForUpdate()->find($item['produto_id']);
                    $produto->update([
                        'preco_custo' => round($custoUn, 2),
                        'preco_venda' => $item['preco_venda'],
                        'ativo'       => true,
                    ]);
                    $produto->increment('quantidade', $unidades);
                } else {
                    // EAN do produto novo: o da unidade (se informado); o da nota só se for 1 por 1
                    $sku = trim($item['novo_ean'] ?? '') ?: ($fator === 1 ? $eanNf : null);
                    $jaExiste = $sku ? Produto::where('sku', $sku)->first() : null;
                    if ($jaExiste) {
                        $produto = $jaExiste;
                        $produto->update(['preco_custo' => round($custoUn, 2), 'preco_venda' => $item['preco_venda'], 'ativo' => true]);
                        $produto->increment('quantidade', $unidades);
                    } else {
                        $produto = Produto::create([
                            'nome'           => trim($item['novo_nome']),
                            'sku'            => $sku,
                            'categoria_id'   => $item['categoria_id'] ?? 1,
                            'preco_custo'    => round($custoUn, 2),
                            'preco_venda'    => $item['preco_venda'],
                            'quantidade'     => $unidades,
                            'estoque_minimo' => 5,
                        ]);
                    }
                }

                $nf->itens()->create([
                    'nome_produto'      => $item['nome_nf'],
                    'sku'               => $eanNf,
                    'quantidade'        => (int) round($item['quantidade_nf']),
                    'fator'             => $fator,
                    'unidades_entrada'  => $unidades,
                    'custo_unitario'    => $item['custo_nf'],
                    'custo_unidade'     => round($custoUn, 4),
                    'preco_venda'       => $item['preco_venda'],
                    'produto_id'        => $produto->id,
                    'entrada_realizada' => true,
                ]);

                Movimentacao::create([
                    'produto_id'     => $produto->id,
                    'usuario_id'     => $usuarioId,
                    'tipo'           => 'entrada',
                    'quantidade'     => $unidades,
                    'motivo'         => "NF {$numero} — {$fornecedor}" . ($fator > 1 ? " ({$item['quantidade_nf']} × {$fator})" : ''),
                    'nota_fiscal_id' => $nf->id,
                ]);

                // Memória: da próxima vez esse EAN já vem com produto e fator preenchidos
                if ($eanNf && ($item['lembrar'] ?? true)) {
                    ProdutoEmbalagem::updateOrCreate(
                        ['ean' => $eanNf],
                        ['produto_id' => $produto->id, 'fator' => $fator, 'descricao_nf' => $item['nome_nf'], 'fornecedor' => $fornecedor]
                    );
                }

                $resumo[] = ['produto' => $produto->nome, 'unidades' => $unidades, 'estoque' => $produto->fresh()->quantidade];
            }

            return response()->json(['nota' => $nf, 'resumo' => $resumo], 201);
        });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'numero_nf'     => 'required|string',
            'fornecedor'    => 'required|string',
            'data_emissao'  => 'required|date',
            'valor_total_nf' => 'numeric|min:0',
            'itens'         => 'required|array|min:1',
            'itens.*.nome_produto'   => 'required|string',
            'itens.*.sku'            => 'nullable|string',
            'itens.*.quantidade'     => 'required|integer|min:1',
            'itens.*.custo_unitario' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $nf = NotaFiscal::create([
                'numero_nf'     => $data['numero_nf'],
                'fornecedor'    => $data['fornecedor'],
                'data_emissao'  => $data['data_emissao'],
                'valor_total_nf' => $data['valor_total_nf'] ?? 0,
                'status'        => 'rascunho',
                'usuario_id'    => $request->user()->id,
            ]);

            foreach ($data['itens'] as $item) {
                // Tenta vincular a um produto existente pelo SKU
                $produto = null;
                if (!empty($item['sku'])) {
                    $produto = Produto::where('sku', $item['sku'])->first();
                }

                $nf->itens()->create([
                    'nome_produto'   => $item['nome_produto'],
                    'sku'            => $item['sku'] ?? null,
                    'quantidade'     => $item['quantidade'],
                    'custo_unitario' => $item['custo_unitario'],
                    'preco_venda'    => $produto?->preco_venda ?? 0,
                    'produto_id'     => $produto?->id,
                    'entrada_realizada' => false,
                ]);
            }

            return response()->json($nf->load('itens'), 201);
        });
    }

    public function atualizarItem(Request $request, NotaFiscal $notaFiscal, ItemNf $item)
    {
        if ($notaFiscal->status === 'confirmada') {
            return response()->json(['message' => 'NF já confirmada.'], 422);
        }

        $data = $request->validate([
    'preco_venda'      => 'required|numeric|min:0',
    'produto_id'       => 'nullable|exists:produtos,id',
    'quantidade_final' => 'nullable|integer|min:1',
    'custo_final'      => 'nullable|numeric|min:0',
]);

if (isset($data['quantidade_final'])) {
    $item->quantidade = $data['quantidade_final'];
}
if (isset($data['custo_final'])) {
    $item->custo_unitario = $data['custo_final'];
}
$item->preco_venda = $data['preco_venda'];
if (isset($data['produto_id'])) {
    $item->produto_id = $data['produto_id'];
}
$item->save();
return response()->json($item);
    }

    public function confirmarEntrada(Request $request, NotaFiscal $notaFiscal)
    {
        if ($notaFiscal->status === 'confirmada') {
            return response()->json(['message' => 'NF já confirmada.'], 422);
        }

        $itens = $notaFiscal->itens()->where('entrada_realizada', false)->get();

        if ($itens->isEmpty()) {
            return response()->json(['message' => 'Nenhum item pendente.'], 422);
        }

        // Valida se todos os itens têm preço de venda definido
        foreach ($itens as $item) {
            if ($item->preco_venda <= 0) {
                return response()->json([
                    'message' => "Item \"{$item->nome_produto}\" sem preço de venda definido."
                ], 422);
            }
        }

        return DB::transaction(function () use ($notaFiscal, $itens, $request) {
            foreach ($itens as $item) {
                if ($item->produto_id) {
                    // Produto já existe: atualiza custo, preço e incrementa estoque
                    $produto = Produto::find($item->produto_id);
                    $produto->update([
                        'preco_custo' => $item->custo_unitario,
                        'preco_venda' => $item->preco_venda,
                    ]);
                    $produto->increment('quantidade', $item->quantidade);
                } else {
                    // Produto novo: cria com estoque mínimo padrão
                    $produto = Produto::create([
                        'nome'           => $item->nome_produto,
                        'sku'            => $item->sku ?? 'NF-' . $notaFiscal->id . '-' . $item->id,
                        'categoria_id'   => 1, // Categoria "Outros" — vendedor ajusta depois
                        'preco_custo'    => $item->custo_unitario,
                        'preco_venda'    => $item->preco_venda,
                        'quantidade'     => $item->quantidade,
                        'estoque_minimo' => 5,
                    ]);
                    $item->update(['produto_id' => $produto->id]);
                }

                Movimentacao::create([
                    'produto_id'     => $produto->id,
                    'usuario_id'     => $request->user()->id,
                    'tipo'           => 'entrada',
                    'quantidade'     => $item->quantidade,
                    'motivo'         => "NF {$notaFiscal->numero_nf} — {$notaFiscal->fornecedor}",
                    'nota_fiscal_id' => $notaFiscal->id,
                ]);

                $item->update(['entrada_realizada' => true]);
            }

            $notaFiscal->update(['status' => 'confirmada']);

            return response()->json(['message' => 'Entrada confirmada com sucesso.']);
        });
    }
}
