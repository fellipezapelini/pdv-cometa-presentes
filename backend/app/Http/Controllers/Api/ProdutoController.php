<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Produto, Movimentacao, ProdutoEmbalagem};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProdutoController extends Controller
{
    public function index(Request $request)
    {
        $query = Produto::with('categoria')
            // Agrupado entre parênteses para não "furar" os outros filtros com o OR
            ->when($request->search, fn($q, $s) => $q->where(fn($w) => $w->where('nome', 'like', "%$s%")->orWhere('sku', 'like', "%$s%")))
            ->when($request->categoria_id, fn($q, $c) => $q->where('categoria_id', $c))
            ->when($request->estoque_baixo, fn($q) => $q->whereColumn('quantidade', '<=', 'estoque_minimo'))
            ->when(!$request->user()?->id, fn($q) => $q->where('visivel_vitrine', true)->where('ativo', true));

        // Painel (logado) pode pedir a lista inteira; vitrine pública continua em páginas de 30
        $porPagina = $request->user()?->id
            ? min(max((int) $request->input('per_page', 30), 1), 5000)
            : 30;

        return response()->json($query->orderBy('nome')->paginate($porPagina));
    }

    public function show(Produto $produto)
    {
        return response()->json($produto->load('categoria'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nome'             => 'required|string|max:200',
            'nome_vitrine'     => 'nullable|string|max:200',
            'descricao'        => 'nullable|string',
            'sku'           => 'nullable|string|unique:produtos,sku',
            'categoria_id'     => 'required|exists:categorias,id',
            'preco_custo'      => 'required|numeric|min:0',
            'preco_venda'      => 'required|numeric|min:0',
            'quantidade'       => 'required|integer|min:0',
            'estoque_minimo'   => 'required|integer|min:0',
            'foto_url'         => 'nullable|string',
            'visivel_vitrine'  => 'boolean',
        ]);

        $produto = Produto::create($data);
        return response()->json($produto->load('categoria'), 201);
    }

    public function update(Request $request, Produto $produto)
    {
        $data = $request->validate([
            'nome'            => 'sometimes|string|max:200',
            'nome_vitrine'    => 'nullable|string|max:200',
            'descricao'       => 'nullable|string',
            'sku'             => "sometimes|nullable|string|unique:produtos,sku,{$produto->id}",
            'categoria_id'    => 'sometimes|exists:categorias,id',
            'preco_custo'     => 'sometimes|numeric|min:0',
            'preco_venda'     => 'sometimes|numeric|min:0',
            'quantidade'      => 'sometimes|integer|min:0',
            'estoque_minimo'  => 'sometimes|integer|min:0',
            'foto_url'        => 'nullable|string',
            'ativo'           => 'sometimes|boolean',
            'visivel_vitrine' => 'sometimes|boolean',
        ]);

        $produto->update($data);
        return response()->json($produto->load('categoria'));
    }

    public function destroy(Produto $produto)
    {
        $produto->update(['ativo' => false]);
        return response()->json(null, 204);
    }

    /**
     * Inventário para o balanço: todos os produtos ativos (sem paginação) + totais do estoque.
     * Valor em estoque considera só quantidades positivas.
     */
    public function inventario()
    {
        $produtos = Produto::query()
            ->leftJoin('categorias', 'categorias.id', '=', 'produtos.categoria_id')
            ->where('produtos.ativo', true)
            ->orderBy('produtos.nome')
            ->get([
                'produtos.id', 'produtos.nome', 'produtos.sku', 'produtos.quantidade',
                'produtos.preco_custo', 'produtos.preco_venda', 'categorias.nome as categoria',
            ]);

        $positivos = $produtos->where('quantidade', '>', 0);

        return response()->json([
            'produtos' => $produtos,
            'resumo'   => [
                'produtos_ativos'     => $produtos->count(),
                'produtos_com_estoque'=> $positivos->count(),
                'unidades'            => (int) $positivos->sum('quantidade'),
                'valor_custo'         => round($positivos->sum(fn($p) => $p->quantidade * (float) $p->preco_custo), 2),
                'valor_venda'         => round($positivos->sum(fn($p) => $p->quantidade * (float) $p->preco_venda), 2),
                'sem_ean'             => $positivos->filter(fn($p) => blank($p->sku))->count(),
                'negativos'           => $produtos->where('quantidade', '<', 0)->count(),
            ],
        ]);
    }

    /**
     * Pares "caixa → unidade" criados pela tela antiga de entrada de nota:
     * o produto unidade tem o nome da caixa + um sufixo (ex.: "CAN ESF. BIC PRETA(E) CANETA BIC PRETA").
     * A detecção é por nome, então pode haver falsos pares — a tela pede confirmação de cada um.
     */
    public function caixasDuplicadas()
    {
        $pares = DB::select("
            SELECT c.id caixa_id, c.nome caixa_nome, c.sku caixa_sku, c.quantidade caixa_qtd,
                   c.preco_custo caixa_custo, c.preco_venda caixa_venda,
                   u.id unidade_id, u.nome unidade_nome, u.sku unidade_sku, u.quantidade unidade_qtd,
                   u.preco_custo unidade_custo, u.preco_venda unidade_venda
            FROM produtos c
            JOIN produtos u ON u.nome LIKE CONCAT(c.nome, ' %') AND u.id <> c.id
            WHERE c.ativo = 1 AND u.ativo = 1
            ORDER BY c.nome, u.id
        ");

        foreach ($pares as $p) {
            // Sugestão de "unidades por caixa" pelo nome: C/12, CX12, 10UN, 6X1...
            $fator = null;
            if (preg_match('/\bC\s*\/\s*(\d{1,4})\b|\bCX\s*(\d{1,4})\b|\b(\d{1,4})\s*UN\b|\b(\d{1,4})\s*X\s*1\b/i', $p->caixa_nome, $m)) {
                $fator = (int) collect(array_slice($m, 1))->first(fn($v) => $v !== '' && $v !== null);
            }
            $p->fator_sugerido = $fator > 1 ? $fator : null;
            $p->sufixo = trim(mb_substr($p->unidade_nome, mb_strlen($p->caixa_nome)));
            $p->vendas_caixa = (int) DB::table('itens_venda')->where('produto_id', $p->caixa_id)->sum('quantidade');
        }

        return response()->json($pares);
    }

    /**
     * Resolve pares confirmados pelo usuário:
     *  - "descartar": a caixa era cópia das unidades → zera e desativa a caixa (unidades não mudam)
     *  - "somar": a caixa é estoque real separado → soma caixas × fator nas unidades e desativa a caixa
     * Se a caixa tem EAN e há fator, grava a memória para a próxima nota já entrar na unidade.
     */
    public function resolverCaixasDuplicadas(Request $request)
    {
        $data = $request->validate([
            'pares'              => 'required|array|min:1',
            'pares.*.caixa_id'   => 'required|exists:produtos,id',
            'pares.*.unidade_id' => 'required|exists:produtos,id',
            'pares.*.acao'       => 'required|in:descartar,somar',
            'pares.*.fator'      => 'nullable|integer|min:1|max:100000',
        ]);

        foreach ($data['pares'] as $i => $p) {
            if ((int) $p['caixa_id'] === (int) $p['unidade_id']) {
                return response()->json(['message' => 'Caixa e unidade não podem ser o mesmo produto.'], 422);
            }
            if ($p['acao'] === 'somar' && empty($p['fator'])) {
                return response()->json(['message' => 'Informe quantas unidades vêm em cada caixa para somar.', 'errors' => ["pares.$i.fator" => ['obrigatório']]], 422);
            }
        }

        $usuarioId = $request->user()->id;
        $feitos = [];

        DB::transaction(function () use ($data, $usuarioId, &$feitos) {
            foreach ($data['pares'] as $p) {
                $caixa   = Produto::lockForUpdate()->find($p['caixa_id']);
                $unidade = Produto::lockForUpdate()->find($p['unidade_id']);
                // Já resolvida, ou a "unidade" foi desativada antes neste mesmo lote (cadeia caixa → pacote → unidade)
                if (!$caixa->ativo || !$unidade->ativo) continue;

                $qtdCaixa = (int) $caixa->quantidade;
                $fator    = !empty($p['fator']) ? (int) $p['fator'] : null;

                if ($qtdCaixa > 0) {
                    Movimentacao::create([
                        'produto_id' => $caixa->id, 'usuario_id' => $usuarioId, 'tipo' => 'saida',
                        'quantidade' => $qtdCaixa,
                        'motivo'     => $p['acao'] === 'somar'
                            ? "Caixa convertida em unidades → {$unidade->nome}"
                            : "Caixa duplicada (já contada nas unidades de {$unidade->nome})",
                    ]);
                }

                $somadas = 0;
                if ($p['acao'] === 'somar' && $qtdCaixa > 0) {
                    $somadas = $qtdCaixa * $fator;
                    $unidade->increment('quantidade', $somadas);
                    Movimentacao::create([
                        'produto_id' => $unidade->id, 'usuario_id' => $usuarioId, 'tipo' => 'entrada',
                        'quantidade' => $somadas, 'motivo' => "Conversão de {$qtdCaixa} caixa(s) × {$fator} — {$caixa->nome}",
                    ]);
                }

                $caixa->update(['quantidade' => 0, 'ativo' => false, 'visivel_vitrine' => false]);

                if ($caixa->sku && $fator) {
                    ProdutoEmbalagem::updateOrCreate(
                        ['ean' => $caixa->sku],
                        ['produto_id' => $unidade->id, 'fator' => $fator, 'descricao_nf' => $caixa->nome]
                    );
                }

                $feitos[] = ['caixa' => $caixa->nome, 'unidade' => $unidade->nome, 'caixas' => $qtdCaixa, 'somadas' => $somadas, 'estoque_unidade' => $unidade->fresh()->quantidade];
            }
        });

        return response()->json(['resolvidos' => $feitos]);
    }

    public function estoqueBaixo()
    {
        $produtos = Produto::with('categoria')
            ->where('ativo', true)
            ->whereColumn('quantidade', '<=', 'estoque_minimo')
            ->orderBy('quantidade')
            ->get();

        return response()->json($produtos);
    }

    public function uploadFoto(Request $request, Produto $produto)
{
    $request->validate([
        'foto' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
    ]);

    $pasta = rtrim(config('loja.fotos_dir'), '/');
    if (!is_dir($pasta)) mkdir($pasta, 0755, true);

    // Remove foto antiga se existir
    if ($produto->foto_url) {
        $caminhoAntigo = $pasta . '/' . basename($produto->foto_url);
        if (file_exists($caminhoAntigo)) unlink($caminhoAntigo);
    }

    $arquivo = $request->file('foto');
    $nome = 'produto_' . $produto->id . '_' . time() . '.' . $arquivo->extension();
    $arquivo->move($pasta, $nome);

    $url = rtrim(config('loja.fotos_url'), '/') . '/' . $nome;
    $produto->update(['foto_url' => $url]);

    return response()->json(['foto_url' => $url]);
}
}
