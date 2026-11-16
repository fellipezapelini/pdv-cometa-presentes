<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Categoria, Produto};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * API pública do site. Expõe só o que o cliente precisa:
 * nunca o custo, o EAN interno ou o estoque exato.
 */
class VitrineController extends Controller
{
    private const POR_PAGINA = 24;

    /** Produtos que podem aparecer no site: ativos, visíveis e com estoque. */
    private function disponiveis()
    {
        return Produto::query()
            ->where('produtos.ativo', true)
            ->where('produtos.visivel_vitrine', true)
            ->where('produtos.quantidade', '>', 0);
    }

    private function publico(Produto $p, bool $completo = false): array
    {
        $dados = [
            'id'        => $p->id,
            'nome'      => $p->nomeExibicao(),
            'preco'     => (float) $p->preco_venda,
            'preco_venda' => (float) $p->preco_venda, // compatibilidade com a tela antiga durante a troca
            'foto_url'  => $p->foto_url,
            'categoria' => $p->categoria ? ['id' => $p->categoria->id, 'nome' => $p->categoria->nome, 'slug' => $p->categoria->slug] : null,
            // Só um sinal, nunca o número exato
            'estoque'   => $p->quantidade <= 0 ? 'esgotado' : ($p->quantidade <= 3 ? 'ultimas' : 'disponivel'),
            'max_compra'=> (int) min($p->quantidade, 99),
        ];
        if ($completo) {
            $dados['descricao'] = $p->descricao;
        }
        return $dados;
    }

    public function produtos(Request $request)
    {
        $request->validate([
            'busca'     => 'nullable|string|max:100',
            'search'    => 'nullable|string|max:100', // compatibilidade
            'categoria' => 'nullable|string|max:100',
            'ordem'     => 'nullable|in:relevancia,novidades,menor_preco,maior_preco,nome',
            'com_foto'  => 'nullable|boolean',
        ]);

        $busca = trim((string) ($request->input('busca') ?? $request->input('search') ?? ''));
        $q = $this->disponiveis()->with('categoria');

        if ($busca !== '') {
            foreach (preg_split('/\s+/', $busca) as $termo) {
                $q->where(fn($w) => $w->where('produtos.nome', 'like', "%{$termo}%")
                    ->orWhere('produtos.nome_vitrine', 'like', "%{$termo}%")
                    ->orWhere('produtos.descricao', 'like', "%{$termo}%"));
            }
        }

        if ($cat = $request->input('categoria') ?? $request->input('categoria_id')) {
            $q->whereHas('categoria', fn($c) => is_numeric($cat) ? $c->where('id', $cat) : $c->where('slug', $cat));
        }

        if ($request->boolean('com_foto')) {
            $q->whereNotNull('produtos.foto_url');
        }

        match ($request->input('ordem', 'relevancia')) {
            'novidades'   => $q->orderByDesc('produtos.created_at'),
            'menor_preco' => $q->orderBy('produtos.preco_venda'),
            'maior_preco' => $q->orderByDesc('produtos.preco_venda'),
            'nome'        => $q->orderByRaw('COALESCE(produtos.nome_vitrine, produtos.nome)'),
            // Relevância: com foto primeiro, depois os mais recentes
            default       => $q->orderByRaw('produtos.foto_url IS NULL')->orderByDesc('produtos.updated_at'),
        };

        $pagina = $q->paginate(self::POR_PAGINA);

        return response()->json([
            'data'         => collect($pagina->items())->map(fn($p) => $this->publico($p))->values(),
            'current_page' => $pagina->currentPage(),
            'last_page'    => $pagina->lastPage(),
            'total'        => $pagina->total(),
        ]);
    }

    public function produto(int $id)
    {
        $p = $this->disponiveis()->with('categoria')->find($id);
        if (!$p) {
            return response()->json(['message' => 'Produto indisponível.'], 404);
        }

        $relacionados = $this->disponiveis()->with('categoria')
            ->where('produtos.id', '<>', $p->id)
            ->where('produtos.categoria_id', $p->categoria_id)
            ->orderByRaw('produtos.foto_url IS NULL')
            ->inRandomOrder()
            ->limit(8)
            ->get();

        return response()->json([
            ...$this->publico($p, true),
            'relacionados' => $relacionados->map(fn($r) => $this->publico($r))->values(),
        ]);
    }

    /** Categorias que têm produto disponível, com a contagem. */
    public function categorias()
    {
        $contagem = $this->disponiveis()
            ->select('produtos.categoria_id', DB::raw('count(*) as total'))
            ->groupBy('produtos.categoria_id')
            ->pluck('total', 'categoria_id');

        return response()->json(
            Categoria::where('ativo', true)->orderBy('nome')->get(['id', 'nome', 'slug'])
                ->filter(fn($c) => ($contagem[$c->id] ?? 0) > 0)
                ->map(fn($c) => ['id' => $c->id, 'nome' => $c->nome, 'slug' => $c->slug, 'total' => (int) $contagem[$c->id]])
                ->values()
        );
    }
}
