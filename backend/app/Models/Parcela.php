<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Parcela extends Model
{
    protected $table = 'parcelas';

    protected $fillable = [
        'venda_id', 'cliente_id', 'numero', 'valor', 'vencimento',
        'status', 'pago_em', 'forma_pagamento_pago',
    ];

    protected $casts = [
        'valor'      => 'decimal:2',
        'vencimento' => 'date',
        'pago_em'    => 'datetime',
    ];

    public function venda()
    {
        return $this->belongsTo(Venda::class, 'venda_id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }
}