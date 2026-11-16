<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotaFiscal extends Model
{
    protected $table = 'notas_fiscais';
    protected $fillable = [
        'numero_nf', 'fornecedor', 'data_emissao',
        'valor_total_nf', 'status', 'usuario_id', 'xml_conteudo',
    ];

    protected $casts = ['data_emissao' => 'date'];

    public function itens()
    {
        return $this->hasMany(ItemNf::class, 'nota_fiscal_id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }
}
