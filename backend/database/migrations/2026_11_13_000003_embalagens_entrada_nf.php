<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Entrada de mercadoria por unidade de venda:
 *  - produto_embalagens: "memória" de conversão. O EAN que vem na nota (ex.: da caixa C/6)
 *    aponta para o produto vendido na loja (ex.: a caneta) e quantas unidades ele contém.
 *  - itens_nf: guarda o fator usado, as unidades que entraram e o custo por unidade.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('produto_embalagens', function (Blueprint $table) {
            $table->id();
            $table->string('ean', 30)->unique();          // EAN como vem na nota (caixa/fardo/unidade)
            $table->foreignId('produto_id')->constrained('produtos')->cascadeOnDelete();
            $table->unsignedInteger('fator')->default(1);  // unidades de venda por item da nota
            $table->string('descricao_nf')->nullable();    // nome como veio na nota (referência)
            $table->string('fornecedor')->nullable();
            $table->timestamps();
        });

        Schema::table('itens_nf', function (Blueprint $table) {
            $table->unsignedInteger('fator')->default(1)->after('quantidade');
            $table->unsignedInteger('unidades_entrada')->nullable()->after('fator');
            $table->decimal('custo_unidade', 12, 4)->nullable()->after('custo_unitario');
        });
    }

    public function down(): void
    {
        Schema::table('itens_nf', function (Blueprint $table) {
            $table->dropColumn(['fator', 'unidades_entrada', 'custo_unidade']);
        });
        Schema::dropIfExists('produto_embalagens');
    }
};
