<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vendas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            $table->enum('forma_pagamento', ['dinheiro', 'pix', 'debito', 'credito', 'fiado']);
            $table->integer('parcelas')->default(1);
            $table->decimal('valor_total', 10, 2);
            $table->boolean('e_fiado')->default(false);
            // Para vendas fiado: qual conta recebe o débito
            $table->foreignId('conta_fiado_id')->nullable()->constrained('contas_fiado')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('itens_venda', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venda_id')->constrained('vendas')->cascadeOnDelete();
            $table->foreignId('produto_id')->constrained('produtos')->restrictOnDelete();
            $table->integer('quantidade');
            $table->decimal('preco_unitario', 10, 2);
            $table->decimal('subtotal', 10, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itens_venda');
        Schema::dropIfExists('vendas');
    }
};
