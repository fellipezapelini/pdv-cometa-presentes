<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cliente extends Model
{
    protected $fillable = ['nome', 'cpf', 'telefone', 'tem_fiado'];
    protected $casts = ['tem_fiado' => 'boolean'];

    public function contaFiado()
    {
        return $this->hasOne(ContaFiado::class, 'titular_id');
    }

    // Clientes dos quais este é dependente
    public function titulares()
   {
    return $this->belongsToMany(
        Cliente::class,
        'dependentes_fiado',
        'dependente_id',
        'titular_id'
    );
}

    // Dependentes desta conta
    public function dependentes()
    {
    return $this->belongsToMany(
        Cliente::class,
        'dependentes_fiado',
        'titular_id',
        'dependente_id'
    );
}
}
