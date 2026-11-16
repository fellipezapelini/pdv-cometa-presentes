<?php
// app/Http/Controllers/Api/PedidoController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Pedido, ItemPedido, Produto, Movimentacao};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Http};

class PedidoController extends Controller
{
    // Credenciais do Mercado Pago ficam no .env (MP_ACCESS_TOKEN / MP_PUBLIC_KEY), nunca no código
    private function mpToken(): string { return (string) config('services.mercadopago.access_token'); }
    private function mpPublicKey(): ?string { return config('services.mercadopago.public_key'); }
    // ── Vitrine: criar pedido + gerar preferência MP ──────────────────────────
    public function store(Request $request)
    {
        $data = $request->validate([
            'comprador_nome'     => 'required|string|max:200',
            'comprador_email'    => 'required|email',
            'comprador_cpf'      => 'nullable|string',
            'comprador_telefone' => 'nullable|string',
            'tipo_entrega'       => 'required|in:retirada,envio',
            'cep_destino'        => 'required_if:tipo_entrega,envio|nullable|string',
            'endereco_destino'   => 'nullable|string',
            'cidade_destino'     => 'nullable|string',
            'uf_destino'         => 'nullable|string',
            'transportadora'     => 'nullable|string',
            'valor_frete'        => 'numeric|min:0',
            'prazo_entrega'      => 'nullable|integer',
            'itens'              => 'required|array|min:1',
            'itens.*.produto_id' => 'required|exists:produtos,id',
            'itens.*.quantidade' => 'required|integer|min:1',
        ]);

        return DB::transaction(function () use ($data) {
            $valorProdutos = 0;
            $itensProcessados = [];

            foreach ($data['itens'] as $item) {
                $produto = Produto::lockForUpdate()->findOrFail($item['produto_id']);
                if ($produto->quantidade < $item['quantidade']) {
                    throw new \Exception("Estoque insuficiente: {$produto->nome}");
                }
                $subtotal = $produto->preco_venda * $item['quantidade'];
                $valorProdutos += $subtotal;
                $itensProcessados[] = compact('produto', 'item', 'subtotal');
            }

            $valorFrete = (float) ($data['valor_frete'] ?? 0);
            $valorTotal = $valorProdutos + $valorFrete;

            $pedido = Pedido::create([
                'codigo'             => Pedido::gerarCodigo(),
                'comprador_nome'     => $data['comprador_nome'],
                'comprador_email'    => $data['comprador_email'],
                'comprador_cpf'      => $data['comprador_cpf'] ?? null,
                'comprador_telefone' => $data['comprador_telefone'] ?? null,
                'tipo_entrega'       => $data['tipo_entrega'],
                'cep_destino'        => $data['cep_destino'] ?? null,
                'endereco_destino'   => $data['endereco_destino'] ?? null,
                'cidade_destino'     => $data['cidade_destino'] ?? null,
                'uf_destino'         => $data['uf_destino'] ?? null,
                'transportadora'     => $data['transportadora'] ?? null,
                'valor_frete'        => $valorFrete,
                'prazo_entrega'      => $data['prazo_entrega'] ?? null,
                'valor_produtos'     => $valorProdutos,
                'valor_total'        => $valorTotal,
                'status'             => 'pendente',
            ]);

            foreach ($itensProcessados as ['produto' => $produto, 'item' => $item, 'subtotal' => $subtotal]) {
                $pedido->itens()->create([
                    'produto_id'     => $produto->id,
                    'nome_produto'   => $produto->nome,
                    'preco_unitario' => $produto->preco_venda,
                    'quantidade'     => $item['quantidade'],
                    'subtotal'       => $subtotal,
                ]);
            }

            // Gera preferência no Mercado Pago
            $mpItems = collect($itensProcessados)->map(fn($i) => [
                'id'          => (string) $i['produto']->id,
                'title'       => $i['produto']->nomeExibicao(),
                'quantity'    => (int) $i['item']['quantidade'],
                'unit_price'  => (float) $i['produto']->preco_venda,
                'currency_id' => 'BRL',
            ])->toArray();

            if ($valorFrete > 0) {
                $mpItems[] = [
                    'id'         => 'frete',
                    'title'      => 'Frete - ' . ($data['transportadora'] ?? 'Envio'),
                    'quantity'   => 1,
                    'unit_price' => $valorFrete,
                    'currency_id' => 'BRL',
                ];
            }

            $mpResponse = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->mpToken(),
                'Content-Type'  => 'application/json',
            ])->post('https://api.mercadopago.com/checkout/preferences', [
                'items'           => $mpItems,
                'external_reference' => $pedido->codigo,
                'payer' => [
                    'name'  => $data['comprador_nome'],
                    'email' => $data['comprador_email'],
                ],
                'back_urls' => [
                    'success' => 'https://cometapresentes.com.br/pedido/' . $pedido->codigo . '?status=sucesso',
                    'failure' => 'https://cometapresentes.com.br/pedido/' . $pedido->codigo . '?status=falha',
                    'pending' => 'https://cometapresentes.com.br/pedido/' . $pedido->codigo . '?status=pendente',
                ],
                'auto_return'    => 'approved',
                'payment_methods' => [
                    'installments' => 12,
                ],
                'statement_descriptor' => 'COMETA PRESENTES',
            ]);

            if ($mpResponse->successful()) {
                $mp = $mpResponse->json();
                $pedido->update([
                    'mp_preference_id' => $mp['id'],
                ]);
            }

            return response()->json([
                'pedido'        => $pedido->load('itens'),
                'mp_preference_id' => $pedido->mp_preference_id,
                'mp_public_key' => $this->mpPublicKey(),
            ], 201);
        });
    }

    // ── Webhook do Mercado Pago ───────────────────────────────────────────────
    public function webhook(Request $request)
    {
        $tipo = $request->input('type') ?? $request->input('topic');

        if ($tipo === 'payment') {
            $paymentId = $request->input('data.id') ?? $request->input('id');

            $mpResponse = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->mpToken(),
            ])->get("https://api.mercadopago.com/v1/payments/{$paymentId}");

            if (!$mpResponse->successful()) {
                return response()->json(['ok' => false], 422);
            }

            $payment = $mpResponse->json();
            $codigoPedido = $payment['external_reference'] ?? null;

            if (!$codigoPedido) return response()->json(['ok' => true]);

            $pedido = Pedido::where('codigo', $codigoPedido)->first();
            if (!$pedido) return response()->json(['ok' => true]);

            if ($payment['status'] === 'approved' && $pedido->status === 'pendente') {
                DB::transaction(function () use ($pedido, $payment) {
                    $pedido->update([
                        'status'         => 'pago',
                        'mp_payment_id'  => $payment['id'],
                        'forma_pagamento' => $payment['payment_type_id'] === 'credit_card' ? 'credito' : 'pix',
                    ]);

                    // Baixa estoque
                    foreach ($pedido->itens as $item) {
                        $produto = Produto::find($item->produto_id);
                        if ($produto) {
                            $produto->decrement('quantidade', $item->quantidade);
                            Movimentacao::create([
                                'produto_id' => $produto->id,
                                'usuario_id' => 1, // sistema
                                'tipo'       => 'saida',
                                'quantidade' => $item->quantidade,
                                'motivo'     => 'Venda online — Pedido ' . $pedido->codigo,
                            ]);
                        }
                    }
                });
            } elseif (in_array($payment['status'], ['rejected', 'cancelled'])) {
                $pedido->update(['status' => 'cancelado']);
            }
        }

        return response()->json(['ok' => true]);
    }

    // ── Consultar pedido (vitrine) ────────────────────────────────────────────
    public function show(string $codigo)
    {
        $pedido = Pedido::where('codigo', $codigo)
            ->with('itens.produto')
            ->firstOrFail();

        return response()->json($pedido);
    }

    // ── Painel admin: listar pedidos ──────────────────────────────────────────
    public function index(Request $request)
    {
        $pedidos = Pedido::with('itens')
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($pedidos);
    }

    // ── Painel admin: atualizar status ────────────────────────────────────────
    public function atualizarStatus(Request $request, Pedido $pedido)
    {
        $data = $request->validate([
            'status'          => 'required|in:pago,separando,enviado,entregue,cancelado',
            'codigo_rastreio' => 'nullable|string',
        ]);

        $pedido->update($data);
        return response()->json($pedido);
    }
}
