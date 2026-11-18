<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Produto extends Model
{
    protected $fillable = [
        'nome', 'nome_vitrine', 'descricao', 'sku', 'ncm', 'categoria_id',
        'preco_custo', 'preco_venda', 'quantidade',
        'estoque_minimo', 'foto_url', 'ativo', 'visivel_vitrine',
    ];

    protected $casts = ['ativo' => 'boolean', 'visivel_vitrine' => 'boolean'];

    public function categoria()
    {
        return $this->belongsTo(Categoria::class, 'categoria_id');
    }

    public function movimentacoes()
    {
        return $this->hasMany(Movimentacao::class, 'produto_id');
    }

    /** Nome mostrado no site: o manual (nome_vitrine) ou uma versão limpa do nome interno. */
    public function nomeExibicao(): string
    {
        return trim((string) $this->nome_vitrine) ?: \App\Support\NomeVitrine::limpar($this->nome);
    }

    public function estoqueBaixo(): bool
    {
        return $this->quantidade <= $this->estoque_minimo;
    }

    public function margem(): float
    {
        if ($this->preco_custo <= 0) return 0;
        return round((($this->preco_venda - $this->preco_custo) / $this->preco_custo) * 100, 2);
    }
}
