<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Venda extends Model
{
    protected $table = 'vendas';
    protected $fillable = [
        'cliente_id', 'usuario_id', 'forma_pagamento',
        'parcelas', 'valor_total', 'e_fiado', 'conta_fiado_id',
    ];

    protected $casts = ['e_fiado' => 'boolean'];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function itens()
    {
        return $this->hasMany(ItemVenda::class, 'venda_id');
    }

    public function contaFiado()
    {
        return $this->belongsTo(ContaFiado::class, 'conta_fiado_id');
    }
    
    public function parcelas()
{
    return $this->hasMany(Parcela::class);
}
}
