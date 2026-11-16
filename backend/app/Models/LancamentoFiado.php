<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LancamentoFiado extends Model
{
    protected $table = 'lancamentos_fiado';
    protected $fillable = [
        'conta_id', 'cliente_id', 'tipo', 'natureza', 'forma_pagamento', 'data_lancamento',
        'valor', 'descricao', 'observacao', 'venda_id', 'relacionado_id', 'estornado', 'usuario_id',
    ];
    protected $casts = [
        'estornado'       => 'boolean',
        'data_lancamento' => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        // Garante data real mesmo em lançamentos criados por código antigo (ex.: venda no PDV)
        static::creating(function (LancamentoFiado $l) {
            if (!$l->data_lancamento) $l->data_lancamento = now()->toDateString();
            if (!$l->natureza) $l->natureza = $l->tipo === 'credito' ? 'pagamento' : 'compra';
        });
    }

    public function conta()
    {
        return $this->belongsTo(ContaFiado::class, 'conta_id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function venda()
    {
        return $this->belongsTo(Venda::class, 'venda_id');
    }

    public function relacionado()
    {
        return $this->belongsTo(LancamentoFiado::class, 'relacionado_id');
    }
}
