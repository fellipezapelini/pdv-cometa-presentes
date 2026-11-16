<?php
// app/Models/Pedido.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pedido extends Model
{
    protected $table = 'pedidos';

    protected $fillable = [
        'codigo', 'cliente_id',
        'comprador_nome', 'comprador_email', 'comprador_cpf', 'comprador_telefone',
        'tipo_entrega', 'cep_destino', 'endereco_destino', 'cidade_destino', 'uf_destino',
        'transportadora', 'valor_frete', 'prazo_entrega',
        'forma_pagamento', 'parcelas', 'valor_produtos', 'valor_total',
        'mp_payment_id', 'mp_preference_id',
        'status', 'codigo_rastreio', 'observacoes',
    ];

    public function itens()
    {
        return $this->hasMany(ItemPedido::class, 'pedido_id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public static function gerarCodigo(): string
    {
        $ano = date('Y');
        $ultimo = static::whereYear('created_at', $ano)->count() + 1;
        return 'CPT-' . $ano . '-' . str_pad($ultimo, 5, '0', STR_PAD_LEFT);
    }
}
