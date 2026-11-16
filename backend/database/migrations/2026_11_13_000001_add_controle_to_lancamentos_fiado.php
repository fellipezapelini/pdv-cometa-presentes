<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Controle de lançamentos do fiado:
 *  - natureza: compra | pagamento | transferencia | ajuste | estorno
 *    (só "pagamento" conta como dinheiro recebido em Recebimentos)
 *  - data_lancamento: data real do fato (permite pagamento retroativo)
 *  - forma_pagamento: dinheiro | pix | debito | credito (antes ia no texto da descrição)
 *  - relacionado_id: liga as duas pontas de uma transferência / o estorno ao original
 *  - estornado: lançamento que foi desfeito (fica no histórico, mas riscado)
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('lancamentos_fiado', function (Blueprint $table) {
            $table->string('natureza', 20)->default('compra')->after('tipo');
            $table->string('forma_pagamento', 20)->nullable()->after('natureza');
            $table->date('data_lancamento')->nullable()->after('forma_pagamento');
            $table->unsignedBigInteger('relacionado_id')->nullable()->after('venda_id');
            $table->boolean('estornado')->default(false)->after('relacionado_id');
            $table->unsignedBigInteger('usuario_id')->nullable()->after('estornado');
            $table->text('observacao')->nullable()->after('descricao');
            $table->index(['conta_id', 'data_lancamento']);
        });

        // Dados existentes: data real = data de registro; créditos = pagamentos
        DB::statement("UPDATE lancamentos_fiado SET data_lancamento = DATE(created_at) WHERE data_lancamento IS NULL");
        DB::statement("UPDATE lancamentos_fiado SET natureza = 'pagamento' WHERE tipo = 'credito'");
        DB::statement("UPDATE lancamentos_fiado SET natureza = 'compra' WHERE tipo = 'debito'");
        DB::statement("UPDATE lancamentos_fiado SET forma_pagamento = 'pix' WHERE tipo = 'credito' AND descricao LIKE '%PIX%'");
        DB::statement("UPDATE lancamentos_fiado SET forma_pagamento = 'dinheiro' WHERE tipo = 'credito' AND descricao LIKE '%dinheiro%'");
        DB::statement("UPDATE lancamentos_fiado SET forma_pagamento = 'debito' WHERE tipo = 'credito' AND descricao LIKE '%débito%'");
        DB::statement("UPDATE lancamentos_fiado SET forma_pagamento = 'credito' WHERE tipo = 'credito' AND descricao LIKE '%crédito%'");
    }

    public function down(): void
    {
        Schema::table('lancamentos_fiado', function (Blueprint $table) {
            $table->dropIndex(['conta_id', 'data_lancamento']);
            $table->dropColumn(['natureza', 'forma_pagamento', 'data_lancamento', 'relacionado_id', 'estornado', 'usuario_id', 'observacao']);
        });
    }
};
