<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemNf extends Model
{
    protected $table = 'itens_nf';
    public $timestamps = false;
    protected $fillable = [
        'nota_fiscal_id', 'nome_produto', 'sku', 'ncm',
        'quantidade', 'fator', 'unidades_entrada', 'custo_unitario', 'custo_unidade', 'preco_venda',
        'produto_id', 'entrada_realizada',
    ];

    protected $casts = ['entrada_realizada' => 'boolean'];

    public function produto()
    {
        return $this->belongsTo(Produto::class, 'produto_id');
    }
}
