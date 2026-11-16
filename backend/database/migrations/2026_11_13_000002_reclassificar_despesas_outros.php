<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reclassifica despesas lançadas como "outros" para as novas categorias,
 * com base na descrição (comparação exata, sem maiúsculas/espaços extras).
 * Descrições ambíguas (nomes de pessoas sem contexto, vazias) continuam em "outros".
 * Guarda o id de cada despesa alterada para o rollback ser exato.
 */
return new class extends Migration {
    private const MAPA = [
        'alimentacao' => [
            'mercado', 'mercado felix', 'merc.felix', 'merc. félix', 'félix', 'carne', 'carne moida', 'carne almoço',
            'lanche', 'padaria', 'pão', 'frango', 'janta', 'mistura', 'tempero', 'fruta', 'salgado', 'marmita',
            'feijoada', 'paçoca', 'banana do zequinha', 'zequinha', 'itens copa', 'café no paraguai', 'pizza igreja',
            'almoço + estacionamento londrina',
        ],
        'pagamento_funcionario' => [
            'cristiane', 'pgto fellipe', 'pagamento fellipe', 'pagamento do fellipe', 'fgts',
        ],
        'boleto_governo' => [
            'imposto', 'receita federal', 'imposto icms paraná', 'taxa bombeiro',
        ],
        'contas_consumo' => [
            'claro', 'samae', 'copel', 'luz', 'internet', 'gás',
        ],
        'veiculo' => [
            'financiamento carro', 'financiamento do carro', 'parcela carro', 'carro', 'seguro do carro',
            'lavagem do carro', 'la agem carro', 'pneu', 'encosto banco carro', 'marajó revisão do carro',
            'borracharia', 'pedágios', 'pedagio', 'estacionamento', 'seguro depvati', 'montagem moto donizete',
            'bicicletaria', 'uber',
        ],
        'emprestimos' => [
            'consórcio', 'empréstimo do cleison', 'empréstimo cleison', 'energia solar',
        ],
        'faturas_cartao' => [
            'cartão picpay',
        ],
        'pessoal' => [
            'faculdade', 'consulta mae', 'cabelo', 'corte de cabelo', 'corte de cabelo e hidratação', 'farmácia',
            'remédio verme nico', 'temedio', 'cadeira de roda', 'cadeira de rodas', 'dízimo', 'serviço de casa',
            'serviços de casa', 'serviço de casa cristiane', 'barra da calça', 'racao nico', 'ração lomio',
            'mercado pago - hospital',
        ],
        'mercadoria' => [
            'paraguai', 'paçoca para revenda', 'artesanato e banana', 'pct cola quente', 'sacola',
        ],
        'servicos' => [
            'certificado digital', 'aceibi', 'ely jornal',
        ],
    ];

    public function up(): void
    {
        Schema::create('despesas_reclassificadas_2026_11', function ($t) {
            $t->unsignedBigInteger('despesa_id')->primary();
            $t->string('categoria_anterior', 50);
        });

        foreach (self::MAPA as $categoria => $descricoes) {
            $ids = DB::table('despesas')
                ->where('categoria', 'outros')
                ->whereIn(DB::raw('LOWER(TRIM(descricao))'), $descricoes)
                ->pluck('id');

            if ($ids->isEmpty()) continue;

            DB::table('despesas_reclassificadas_2026_11')->insert(
                $ids->map(fn($id) => ['despesa_id' => $id, 'categoria_anterior' => 'outros'])->all()
            );
            DB::table('despesas')->whereIn('id', $ids)->update(['categoria' => $categoria]);
        }
    }

    public function down(): void
    {
        DB::statement('UPDATE despesas d JOIN despesas_reclassificadas_2026_11 r ON r.despesa_id = d.id SET d.categoria = r.categoria_anterior');
        Schema::dropIfExists('despesas_reclassificadas_2026_11');
    }
};
