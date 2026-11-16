<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContaFiado extends Model
{
    protected $table = 'contas_fiado';
    protected $fillable = ['titular_id', 'saldo_devedor', 'ativa'];
    protected $casts = ['ativa' => 'boolean', 'saldo_devedor' => 'decimal:2'];

    public function titular()
    {
        return $this->belongsTo(Cliente::class, 'titular_id');
    }

    public function lancamentos()
    {
        return $this->hasMany(LancamentoFiado::class, 'conta_id');
    }

    /** Conta própria do cliente (cada membro do envelope tem a sua). Cria se não existir. */
    public static function daPessoa(Cliente $cliente): self
    {
        $conta = $cliente->contaFiado;
        if (!$conta) {
            $conta = self::create(['titular_id' => $cliente->id, 'saldo_devedor' => 0, 'ativa' => true]);
            $cliente->update(['tem_fiado' => true]);
        }
        return $conta;
    }

    /** Recalcula o saldo a partir do histórico (fonte da verdade). */
    public function recalcularSaldo(): float
    {
        $debitos  = (float) $this->lancamentos()->where('tipo', 'debito')->sum('valor');
        $creditos = (float) $this->lancamentos()->where('tipo', 'credito')->sum('valor');
        $saldo = round($debitos - $creditos, 2);
        $this->update(['saldo_devedor' => $saldo]);
        return $saldo;
    }

    public function adicionarDebito(float $valor, int $clienteId, ?int $vendaId = null, string $descricao = ''): void
    {
        $this->lancamentos()->create([
            'cliente_id'  => $clienteId,
            'tipo'        => 'debito',
            'valor'       => $valor,
            'descricao'   => $descricao,
            'venda_id'    => $vendaId,
        ]);
        $this->increment('saldo_devedor', $valor);
    }

    public function adicionarCredito(float $valor, string $descricao = 'Pagamento'): void
    {
        $this->lancamentos()->create([
            'cliente_id'  => $this->titular_id,
            'tipo'        => 'credito',
            'valor'       => $valor,
            'descricao'   => $descricao,
        ]);
        $this->decrement('saldo_devedor', $valor);
    }
}
