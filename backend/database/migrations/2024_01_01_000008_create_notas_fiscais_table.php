<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notas_fiscais', function (Blueprint $table) {
            $table->id();
            $table->string('numero_nf');
            $table->string('fornecedor');
            $table->date('data_emissao');
            $table->decimal('valor_total_nf', 10, 2)->default(0);
            $table->enum('status', ['rascunho', 'confirmada'])->default('rascunho');
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            $table->text('xml_conteudo')->nullable(); // XML da NF-e importado
            $table->timestamps();
        });

        Schema::create('itens_nf', function (Blueprint $table) {
            $table->id();
            $table->foreignId('nota_fiscal_id')->constrained('notas_fiscais')->cascadeOnDelete();
            $table->string('nome_produto');
            $table->string('sku')->nullable();
            $table->integer('quantidade');
            $table->decimal('custo_unitario', 10, 2);
            $table->decimal('preco_venda', 10, 2)->default(0); // vendedor define antes de confirmar
            $table->foreignId('produto_id')->nullable()->constrained('produtos')->nullOnDelete();
            $table->boolean('entrada_realizada')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itens_nf');
        Schema::dropIfExists('notas_fiscais');
    }
};
