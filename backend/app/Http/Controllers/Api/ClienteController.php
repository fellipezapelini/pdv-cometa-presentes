<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Cliente, ContaFiado, LancamentoFiado};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClienteController extends Controller
{
    public function index(Request $request)
{
    $clientes = Cliente::when($request->search, fn($q, $s) => 
            $q->where('nome', 'like', "%$s%")->orWhere('cpf', 'like', "%$s%"))
        ->when($request->com_fiado, fn($q) => $q->where('tem_fiado', true))
        ->when($request->apenas_titulares, fn($q) => 
            $q->whereHas('contaFiado')
              ->whereNotExists(function($sub) {
                  $sub->from('dependentes_fiado')
                      ->whereColumn('dependentes_fiado.dependente_id', 'clientes.id');
              })
        )
        ->orderBy('nome')
        ->paginate(500);

    // Para cada cliente, busca se é dependente de alguém
    $clienteIds = $clientes->pluck('id');
    $dependencias = DB::table('dependentes_fiado')
        ->join('clientes', 'clientes.id', '=', 'dependentes_fiado.titular_id')
        ->whereIn('dependentes_fiado.dependente_id', $clienteIds)
        ->select('dependentes_fiado.dependente_id', 'clientes.id as titular_id', 'clientes.nome as titular_nome')
        ->get()
        ->keyBy('dependente_id');

    $clientes->getCollection()->transform(function($cliente) use ($dependencias) {
        $dep = $dependencias->get($cliente->id);
        $cliente->envelope_titular_id   = $dep?->titular_id;
        $cliente->envelope_titular_nome = $dep?->titular_nome;
        $cliente->e_titular = $cliente->tem_fiado && !$dep;
        return $cliente;
    });

    return response()->json($clientes);
}
    public function store(Request $request)
    {
        $data = $request->validate([
            'nome'     => 'required|string|max:200',
            'cpf'      => 'nullable|string|unique:clientes,cpf',
            'telefone' => 'nullable|string',
        ]);

        return response()->json(Cliente::create($data), 201);
    }

    public function show(Cliente $cliente)
{
    $cliente->load(['contaFiado']);
    
    $dependentes = DB::table('dependentes_fiado')
        ->join('clientes', 'clientes.id', '=', 'dependentes_fiado.dependente_id')
        ->where('dependentes_fiado.titular_id', $cliente->id)
        ->select('clientes.id', 'clientes.nome', 'clientes.cpf', 'clientes.telefone')
        ->get();

    $titulares = DB::table('dependentes_fiado')
        ->join('clientes', 'clientes.id', '=', 'dependentes_fiado.titular_id')
        ->where('dependentes_fiado.dependente_id', $cliente->id)
        ->select('clientes.id', 'clientes.nome')
        ->get();

    return response()->json([
        ...$cliente->toArray(),
        'dependentes' => $dependentes,
        'titulares'   => $titulares,
    ]);
}

    public function contaFiado(Cliente $cliente)
{
    $conta = $cliente->contaFiado;

    if (!$conta) {
        $titular = DB::table('dependentes_fiado')
            ->where('dependente_id', $cliente->id)
            ->first();
        if ($titular) {
            $conta = ContaFiado::where('titular_id', $titular->titular_id)->first();
        }
    }

    if (!$conta) {
        return response()->json(['message' => 'Cliente não possui conta fiado.'], 404);
    }

    $lancamentos = $conta->lancamentos()
        ->with(['cliente', 'venda.itens.produto'])
        ->orderByDesc('data_lancamento')
        ->orderByDesc('id')
        ->get();

    // Saldo da titular (só lançamentos dela na própria conta)
    $saldoPorPessoa = $lancamentos->groupBy('cliente_id')->map(function ($items) {
        $debitos  = $items->where('tipo', 'debito')->sum('valor');
        $creditos = $items->where('tipo', 'credito')->sum('valor');
        return [
            'cliente'  => $items->first()->cliente,
            'debitos'  => $debitos,
            'creditos' => $creditos,
            'saldo'    => $debitos - $creditos,
        ];
    })->values();

    // Busca saldo real de cada dependente na conta própria deles
    $dependentes = DB::table('dependentes_fiado')
        ->where('titular_id', $conta->titular_id)
        ->pluck('dependente_id');

    $saldoDependentes = [];
    foreach ($dependentes as $depId) {
        $contaDep = ContaFiado::where('titular_id', $depId)->first();
        if ($contaDep) {
            $saldoDependentes[$depId] = $contaDep->saldo_devedor;
        }
    }

    return response()->json([
        'conta'             => $conta->load('titular'),
        'lancamentos'       => $lancamentos,
        'saldo_por_pessoa'  => $saldoPorPessoa,
        'saldo_dependentes' => $saldoDependentes, // [ cliente_id => saldo ]
    ]);
}

    // ─── Helpers do fiado ────────────────────────────────────────────────────
    private const FORMAS = 'dinheiro,pix,debito,credito';

    private function descricaoForma(?string $forma): string
    {
        return match ($forma) {
            'pix'      => 'Pagamento via PIX',
            'dinheiro' => 'Pagamento em dinheiro',
            'debito'   => 'Pagamento no débito',
            'credito'  => 'Pagamento no crédito',
            default    => 'Pagamento',
        };
    }

    /** Conta onde o lançamento deve cair: a conta própria da pessoa; se ela não tiver, a do envelope. */
    private function resolverConta(Cliente $pessoa, ?Cliente $envelope = null): ?ContaFiado
    {
        return $pessoa->contaFiado
            ?? $envelope?->contaFiado
            ?? $pessoa->titulares()->first()?->contaFiado;
    }

    private function aplicarNoSaldo(ContaFiado $conta, string $tipo, float $valor): void
    {
        $tipo === 'debito'
            ? $conta->increment('saldo_devedor', $valor)
            : $conta->decrement('saldo_devedor', $valor);
    }

    // ─── Pagamento (dinheiro que entrou de verdade) ─────────────────────────
    public function pagarFiado(Request $request, Cliente $cliente)
    {
        $data = $request->validate([
            'valor'           => 'required|numeric|min:0.01',
            'descricao'       => 'nullable|string|max:255',
            'cliente_id'      => 'nullable|exists:clientes,id', // a quem se refere (membro do envelope)
            'forma_pagamento' => 'nullable|in:' . self::FORMAS,
            'data'            => 'nullable|date|before_or_equal:today',
            'observacao'      => 'nullable|string|max:1000',
        ]);

        $pagador = !empty($data['cliente_id']) ? Cliente::findOrFail($data['cliente_id']) : $cliente;
        $conta = $this->resolverConta($pagador, $cliente);

        if (!$conta || !$conta->ativa) {
            return response()->json(['message' => 'Conta fiado não encontrada ou inativa.'], 404);
        }

        if (round($data['valor'], 2) > round((float) $conta->saldo_devedor, 2)) {
            return response()->json(['message' => 'Valor maior que o saldo devedor de ' . $pagador->nome . ' (R$ ' . number_format($conta->saldo_devedor, 2, ',', '.') . ').'], 422);
        }

        $forma = $data['forma_pagamento'] ?? null;

        $lancamento = DB::transaction(function () use ($conta, $pagador, $data, $forma, $request) {
            $l = $conta->lancamentos()->create([
                'cliente_id'      => $pagador->id,
                'tipo'            => 'credito',
                'natureza'        => 'pagamento',
                'forma_pagamento' => $forma,
                'data_lancamento' => $data['data'] ?? now()->toDateString(),
                'valor'           => $data['valor'],
                'descricao'       => $data['descricao'] ?? $this->descricaoForma($forma),
                'observacao'      => $data['observacao'] ?? null,
                'usuario_id'      => $request->user()?->id,
            ]);
            $this->aplicarNoSaldo($conta, 'credito', (float) $data['valor']);
            return $l;
        });

        return response()->json(['saldo_devedor' => $conta->fresh()->saldo_devedor, 'lancamento' => $lancamento]);
    }

    // ─── Débito manual (compra anotada no papel) ────────────────────────────
    public function lancarDebito(Request $request, Cliente $cliente)
    {
        $data = $request->validate([
            'valor'      => 'required|numeric|min:0.01',
            'descricao'  => 'nullable|string|max:255',
            'cliente_id' => 'nullable|exists:clientes,id',
            'data'       => 'nullable|date|before_or_equal:today',
            'observacao' => 'nullable|string|max:1000',
        ]);

        $pessoa = !empty($data['cliente_id']) ? Cliente::findOrFail($data['cliente_id']) : $cliente;
        $conta = ContaFiado::daPessoa($pessoa);

        DB::transaction(function () use ($conta, $pessoa, $data, $request) {
            $conta->lancamentos()->create([
                'cliente_id'      => $pessoa->id,
                'tipo'            => 'debito',
                'natureza'        => 'compra',
                'data_lancamento' => $data['data'] ?? now()->toDateString(),
                'valor'           => $data['valor'],
                'descricao'       => $data['descricao'] ?? 'Lançamento manual',
                'observacao'      => $data['observacao'] ?? null,
                'usuario_id'      => $request->user()?->id,
            ]);
            $this->aplicarNoSaldo($conta, 'debito', (float) $data['valor']);
        });

        return response()->json(['saldo_devedor' => $conta->fresh()->saldo_devedor]);
    }

    // ─── Transferência de saldo entre pessoas (não é recebimento nem venda) ─
    public function transferirSaldo(Request $request)
    {
        $data = $request->validate([
            'origem_id'  => 'required|exists:clientes,id',
            'destino_id' => 'required|exists:clientes,id|different:origem_id',
            'valor'      => 'required|numeric|min:0.01',
            'data'       => 'nullable|date|before_or_equal:today',
            'observacao' => 'nullable|string|max:1000',
        ]);

        $origem  = Cliente::findOrFail($data['origem_id']);
        $destino = Cliente::findOrFail($data['destino_id']);
        $contaOrigem = $origem->contaFiado;

        if (!$contaOrigem) {
            return response()->json(['message' => "{$origem->nome} não tem conta fiado."], 422);
        }
        if (round($data['valor'], 2) > round((float) $contaOrigem->saldo_devedor, 2)) {
            return response()->json(['message' => "Valor maior que o saldo de {$origem->nome} (R$ " . number_format($contaOrigem->saldo_devedor, 2, ',', '.') . ').'], 422);
        }

        $contaDestino = ContaFiado::daPessoa($destino);
        $dataLanc = $data['data'] ?? now()->toDateString();
        $usuario  = $request->user()?->id;
        $valor    = (float) $data['valor'];

        DB::transaction(function () use ($contaOrigem, $contaDestino, $origem, $destino, $valor, $dataLanc, $data, $usuario) {
            $saida = $contaOrigem->lancamentos()->create([
                'cliente_id'      => $origem->id,
                'tipo'            => 'credito',
                'natureza'        => 'transferencia',
                'data_lancamento' => $dataLanc,
                'valor'           => $valor,
                'descricao'       => "Saldo transferido para {$destino->nome}",
                'observacao'      => $data['observacao'] ?? null,
                'usuario_id'      => $usuario,
            ]);
            $entrada = $contaDestino->lancamentos()->create([
                'cliente_id'      => $destino->id,
                'tipo'            => 'debito',
                'natureza'        => 'transferencia',
                'data_lancamento' => $dataLanc,
                'valor'           => $valor,
                'descricao'       => "Saldo recebido de {$origem->nome}",
                'observacao'      => $data['observacao'] ?? null,
                'relacionado_id'  => $saida->id,
                'usuario_id'      => $usuario,
            ]);
            $saida->update(['relacionado_id' => $entrada->id]);

            $this->aplicarNoSaldo($contaOrigem, 'credito', $valor);
            $this->aplicarNoSaldo($contaDestino, 'debito', $valor);
        });

        return response()->json([
            'message'       => 'Saldo transferido.',
            'saldo_origem'  => $contaOrigem->fresh()->saldo_devedor,
            'saldo_destino' => $contaDestino->fresh()->saldo_devedor,
        ]);
    }

    // ─── Ajuste de saldo (acertar com o envelope físico; não é venda nem recebimento) ─
    public function ajustarSaldo(Request $request, Cliente $cliente)
    {
        $data = $request->validate([
            'tipo'       => 'required|in:debito,credito', // debito = aumenta a dívida, credito = diminui
            'valor'      => 'required|numeric|min:0.01',
            'cliente_id' => 'nullable|exists:clientes,id',
            'data'       => 'nullable|date|before_or_equal:today',
            'observacao' => 'required|string|min:3|max:1000', // motivo obrigatório
        ]);

        $pessoa = !empty($data['cliente_id']) ? Cliente::findOrFail($data['cliente_id']) : $cliente;
        $conta = ContaFiado::daPessoa($pessoa);

        if ($data['tipo'] === 'credito' && round($data['valor'], 2) > round((float) $conta->saldo_devedor, 2)) {
            return response()->json(['message' => "Ajuste maior que o saldo de {$pessoa->nome}."], 422);
        }

        DB::transaction(function () use ($conta, $pessoa, $data, $request) {
            $conta->lancamentos()->create([
                'cliente_id'      => $pessoa->id,
                'tipo'            => $data['tipo'],
                'natureza'        => 'ajuste',
                'data_lancamento' => $data['data'] ?? now()->toDateString(),
                'valor'           => $data['valor'],
                'descricao'       => $data['tipo'] === 'debito' ? 'Ajuste de saldo (+)' : 'Ajuste de saldo (−)',
                'observacao'      => $data['observacao'],
                'usuario_id'      => $request->user()?->id,
            ]);
            $this->aplicarNoSaldo($conta, $data['tipo'], (float) $data['valor']);
        });

        return response()->json(['saldo_devedor' => $conta->fresh()->saldo_devedor]);
    }

    // ─── Estorno: desfaz um lançamento errado sem apagar o histórico ───────
    public function estornarLancamento(Request $request, LancamentoFiado $lancamento)
    {
        $data = $request->validate(['motivo' => 'required|string|min:3|max:1000']);

        if ($lancamento->estornado) {
            return response()->json(['message' => 'Este lançamento já foi estornado.'], 422);
        }
        if ($lancamento->natureza === 'estorno') {
            return response()->json(['message' => 'Não é possível estornar um estorno.'], 422);
        }
        if ($lancamento->venda_id) {
            return response()->json(['message' => 'Lançamento de venda: cancele a venda para desfazê-lo.'], 422);
        }

        // Transferência é desfeita nas duas pontas
        $alvos = collect([$lancamento]);
        if ($lancamento->natureza === 'transferencia' && $lancamento->relacionado_id) {
            $par = LancamentoFiado::find($lancamento->relacionado_id);
            if ($par && !$par->estornado) $alvos->push($par);
        }

        DB::transaction(function () use ($alvos, $data, $request) {
            foreach ($alvos as $orig) {
                $inverso = $orig->tipo === 'debito' ? 'credito' : 'debito';
                $orig->conta->lancamentos()->create([
                    'cliente_id'      => $orig->cliente_id,
                    'tipo'            => $inverso,
                    'natureza'        => 'estorno',
                    'forma_pagamento' => $orig->forma_pagamento,
                    'data_lancamento' => now()->toDateString(),
                    'valor'           => $orig->valor,
                    'descricao'       => 'Estorno: ' . ($orig->descricao ?: $orig->natureza),
                    'observacao'      => $data['motivo'],
                    'relacionado_id'  => $orig->id,
                    'usuario_id'      => $request->user()?->id,
                ]);
                $orig->update(['estornado' => true]);
                $this->aplicarNoSaldo($orig->conta, $inverso, (float) $orig->valor);
            }
        });

        return response()->json(['message' => 'Lançamento estornado.']);
    }

    // ─── Corrigir data / forma / descrição (o valor não muda: para isso, estorne) ─
    public function editarLancamento(Request $request, LancamentoFiado $lancamento)
    {
        $data = $request->validate([
            'data_lancamento' => 'sometimes|date|before_or_equal:today',
            'forma_pagamento' => 'sometimes|nullable|in:' . self::FORMAS,
            'descricao'       => 'sometimes|nullable|string|max:255',
            'observacao'      => 'sometimes|nullable|string|max:1000',
        ]);

        DB::transaction(function () use ($lancamento, $data) {
            $lancamento->update($data);
            // Transferência: a data vale para as duas pontas
            if (isset($data['data_lancamento']) && $lancamento->natureza === 'transferencia' && $lancamento->relacionado_id) {
                LancamentoFiado::where('id', $lancamento->relacionado_id)->update(['data_lancamento' => $data['data_lancamento']]);
            }
        });

        return response()->json($lancamento->fresh());
    }

    public function adicionarDependente(Request $request, Cliente $cliente)
{
    $data = $request->validate(['dependente_id' => 'required|exists:clientes,id']);

    if ($data['dependente_id'] == $cliente->id) {
        return response()->json(['message' => 'Titular não pode ser dependente de si mesmo.'], 422);
    }

    DB::table('dependentes_fiado')->insert([
        'titular_id'    => (int) $cliente->id,
        'dependente_id' => (int) $data['dependente_id'],
    ]);

    return response()->json(['message' => 'Dependente adicionado.', 'titular_id' => $cliente->id, 'dependente_id' => $data['dependente_id']]);
}

public function removerDependente(Cliente $cliente, Cliente $dependente)
{
    DB::table('dependentes_fiado')
        ->where('titular_id', $cliente->id)
        ->where('dependente_id', $dependente->id)
        ->delete();

    return response()->json(['message' => 'Dependente removido.']);

}

public function update(Request $request, Cliente $cliente)
{
    $data = $request->validate([
        'nome'     => 'sometimes|string|max:200',
        'cpf'      => 'nullable|string|unique:clientes,cpf,' . $cliente->id,
        'telefone' => 'nullable|string',
    ]);

    $cliente->update($data);
    return response()->json($cliente);
}
}
