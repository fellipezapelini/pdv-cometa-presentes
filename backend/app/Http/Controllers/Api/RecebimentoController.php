<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class RecebimentoController extends Controller
{
    // A loja trabalha no horário de Brasília; o banco grava em UTC.
    private const TZ_LOJA = 'America/Sao_Paulo';

    /** Data/hora gravada em UTC no banco → ISO 8601 (o navegador converte para o horário local). */
    private function isoUtc(?string $valor): ?string
    {
        return $valor ? Carbon::parse($valor, 'UTC')->toIso8601String() : null;
    }

    public function index(Request $request)
    {
        $request->validate([
            'de'   => 'nullable|date',
            'ate'  => 'nullable|date|after_or_equal:de',
            'dias' => 'nullable|integer|min:1|max:3650',
        ]);

        // Período no horário da loja. Padrão: últimos N dias (compatível com a tela antiga).
        if ($request->filled('de')) {
            $deLocal  = Carbon::parse($request->input('de'), self::TZ_LOJA)->startOfDay();
            $ateLocal = Carbon::parse($request->input('ate', $request->input('de')), self::TZ_LOJA)->endOfDay();
        } else {
            $dias = (int) $request->input('dias', 30);
            $ateLocal = Carbon::now(self::TZ_LOJA)->endOfDay();
            $deLocal  = Carbon::now(self::TZ_LOJA)->subDays($dias)->startOfDay();
        }

        // Faixa equivalente em UTC para as colunas de data/hora
        $deUtc  = $deLocal->copy()->utc()->format('Y-m-d H:i:s');
        $ateUtc = $ateLocal->copy()->utc()->format('Y-m-d H:i:s');

        // 1. Vendas pagas na hora (dinheiro, pix, debito, credito)
        $vendas = DB::table('vendas')
            ->leftJoin('clientes', 'clientes.id', '=', 'vendas.cliente_id')
            ->whereIn('vendas.forma_pagamento', ['dinheiro', 'pix', 'debito', 'credito'])
            ->whereBetween('vendas.created_at', [$deUtc, $ateUtc])
            ->select(
                'vendas.id',
                'vendas.created_at as data',
                'vendas.valor_total as valor',
                'vendas.forma_pagamento as forma',
                'clientes.nome as cliente_nome'
            )
            ->get();

        // 2. Pagamentos de fiado — só dinheiro que entrou de verdade.
        //    Transferências, ajustes e pagamentos estornados NÃO contam.
        //    Usa a data real do pagamento (pode ser retroativa).
        $fiado = DB::table('lancamentos_fiado')
            ->leftJoin('clientes', 'clientes.id', '=', 'lancamentos_fiado.cliente_id')
            ->where('lancamentos_fiado.tipo', 'credito')
            ->where('lancamentos_fiado.natureza', 'pagamento')
            ->where('lancamentos_fiado.estornado', false)
            ->whereBetween('lancamentos_fiado.data_lancamento', [$deLocal->toDateString(), $ateLocal->toDateString()])
            ->select(
                'lancamentos_fiado.id',
                'lancamentos_fiado.created_at',
                'lancamentos_fiado.data_lancamento',
                'lancamentos_fiado.valor',
                'lancamentos_fiado.descricao',
                'lancamentos_fiado.forma_pagamento',
                'clientes.nome as cliente_nome'
            )
            ->get();

        // 3. Parcelas de carnê pagas
        $parcelas = DB::table('parcelas')
            ->leftJoin('clientes', 'clientes.id', '=', 'parcelas.cliente_id')
            ->where('parcelas.status', 'pago')
            ->whereBetween('parcelas.pago_em', [$deUtc, $ateUtc])
            ->select(
                'parcelas.id',
                'parcelas.pago_em as data',
                'parcelas.valor',
                'parcelas.forma_pagamento_pago as forma',
                'clientes.nome as cliente_nome',
                'parcelas.venda_id',
                'parcelas.numero'
            )
            ->get();

        $todos = collect()
            ->concat($vendas->map(fn($v) => [
                'id' => $v->id, 'data' => $this->isoUtc($v->data), 'valor' => (float) $v->valor,
                'forma' => $v->forma, 'cliente' => $v->cliente_nome ?? 'Sem cliente',
                'tipo' => 'venda', 'venda_id' => $v->id,
            ]))
            ->concat($fiado->map(function ($f) {
                // Registrado no mesmo dia → mantém a hora; retroativo → meio-dia da data real
                $registro = Carbon::parse($f->created_at, 'UTC')->setTimezone(self::TZ_LOJA);
                $data = $registro->toDateString() === (string) $f->data_lancamento
                    ? $registro->toIso8601String()
                    : Carbon::parse($f->data_lancamento . ' 12:00:00', self::TZ_LOJA)->toIso8601String();
                return [
                    'id' => $f->id, 'data' => $data, 'valor' => (float) $f->valor,
                    'forma' => $f->forma_pagamento ?: $this->formaPelaDescricao($f->descricao),
                    'cliente' => $f->cliente_nome ?? '—', 'tipo' => 'fiado', 'descricao' => $f->descricao,
                    'retroativo' => $registro->toDateString() !== (string) $f->data_lancamento,
                ];
            }))
            ->concat($parcelas->map(fn($p) => [
                'id' => $p->id, 'data' => $this->isoUtc($p->data), 'valor' => (float) $p->valor,
                'forma' => $p->forma ?? 'outro', 'cliente' => $p->cliente_nome ?? '—',
                'tipo' => 'carne', 'venda_id' => $p->venda_id, 'numero_parcela' => $p->numero,
            ]))
            ->sortByDesc('data')
            ->values();

        return response()->json([
            'de'              => $deLocal->toDateString(),
            'ate'             => $ateLocal->toDateString(),
            'recebimentos'    => $todos,
            'total_geral'     => $todos->sum('valor'),
            'total_por_forma' => $todos->groupBy('forma')->map(fn($g) => $g->sum('valor')),
            'total_por_tipo'  => $todos->groupBy('tipo')->map(fn($g) => $g->sum('valor')),
        ]);
    }

    private function formaPelaDescricao(?string $desc): string
    {
        $desc = $desc ?? '';
        return str_contains($desc, 'PIX') ? 'pix'
            : (str_contains($desc, 'dinheiro') ? 'dinheiro'
            : (str_contains($desc, 'débito') ? 'debito'
            : (str_contains($desc, 'crédito') ? 'credito' : 'outro')));
    }
}
