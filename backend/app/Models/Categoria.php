<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Categoria extends Model
{
    protected $fillable = ['nome', 'slug', 'descricao', 'ativo'];
    protected $casts = ['ativo' => 'boolean'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($cat) {
            if (empty($cat->slug)) {
                $cat->slug = Str::slug($cat->nome);
            }
        });
    }

    public function produtos()
    {
        return $this->hasMany(Produto::class, 'categoria_id');
    }
}
