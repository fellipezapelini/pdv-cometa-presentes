<?php
// app/Models/ItemPedido.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemPedido extends Model
{
    protected $table = 'itens_pedido';
    public $timestamps = false;

    protected $fillable = [
        'pedido_id', 'produto_id', 'nome_produto',
        'preco_unitario', 'quantidade', 'subtotal',
    ];

    public function produto()
    {
        return $this->belongsTo(Produto::class, 'produto_id');
    }
}
