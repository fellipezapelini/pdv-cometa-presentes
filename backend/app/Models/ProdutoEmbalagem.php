<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** EAN da nota → produto vendido na loja + quantas unidades vêm em cada item da nota. */
class ProdutoEmbalagem extends Model
{
    protected $table = 'produto_embalagens';
    protected $fillable = ['ean', 'produto_id', 'fator', 'descricao_nf', 'fornecedor'];

    public function produto()
    {
        return $this->belongsTo(Produto::class, 'produto_id');
    }
}
