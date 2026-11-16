<?php
// database/migrations/2024_01_01_000010_create_pedidos_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pedidos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique(); // ex: CPT-2024-00001
            // Cliente pode ser cadastrado ou não (compra como visitante)
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();
            // Dados do comprador (sempre salvo, mesmo sem cadastro)
            $table->string('comprador_nome');
            $table->string('comprador_email');
            $table->string('comprador_cpf', 14)->nullable();
            $table->string('comprador_telefone', 20)->nullable();
            // Entrega
            $table->enum('tipo_entrega', ['retirada', 'envio']);
            $table->string('cep_destino', 9)->nullable();
            $table->string('endereco_destino')->nullable();
            $table->string('cidade_destino')->nullable();
            $table->string('uf_destino', 2)->nullable();
            $table->string('transportadora')->nullable(); // nome escolhido
            $table->decimal('valor_frete', 10, 2)->default(0);
            $table->integer('prazo_entrega')->nullable(); // dias úteis
            // Pagamento
            $table->enum('forma_pagamento', ['pix', 'credito', 'debito'])->nullable();
            $table->integer('parcelas')->default(1);
            $table->decimal('valor_produtos', 10, 2);
            $table->decimal('valor_total', 10, 2);
            // Mercado Pago
            $table->string('mp_payment_id')->nullable();
            $table->string('mp_preference_id')->nullable();
            // Status do pedido
            $table->enum('status', [
                'pendente',    // aguardando pagamento
                'pago',        // pagamento confirmado
                'separando',   // separando na loja
                'enviado',     // enviado (com código de rastreio)
                'entregue',    // entregue
                'cancelado',   // cancelado
            ])->default('pendente');
            $table->string('codigo_rastreio')->nullable();
            $table->text('observacoes')->nullable();
            $table->timestamps();
        });

        Schema::create('itens_pedido', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->foreignId('produto_id')->constrained('produtos')->restrictOnDelete();
            $table->string('nome_produto'); // snapshot do nome no momento da compra
            $table->decimal('preco_unitario', 10, 2);
            $table->integer('quantidade');
            $table->decimal('subtotal', 10, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itens_pedido');
        Schema::dropIfExists('pedidos');
    }
};
