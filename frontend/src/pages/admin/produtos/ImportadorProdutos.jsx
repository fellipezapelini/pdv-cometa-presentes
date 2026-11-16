import React, { useState } from 'react';
import api from '../../../api/client'; // Ajuste o caminho relativo até seu client.js
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function ImportadorProdutos() {
  const [produtosPrevia, setProdutosPrevia] = useState([]);
  const [estrategia, setEstrategia] = useState('pular');
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultadoFinal, setResultadoFinal] = useState(null);

  // Mapeamento automático rudimentar para aceitar variações de nomes de coluna
  const normalizarChaves = (obj) => {
    const chaves = Object.keys(obj);
    const n = (nome) => nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    let itemFormatado = {};
    chaves.forEach(key => {
      const k = n(key);
      if (k === 'nome' || k === 'descricao' || k === 'produto' || k === 'item') itemFormatado.nome = obj[key];
      if (k === 'sku' || k === 'codigo' || k === 'ref') itemFormatado.sku = String(obj[key]);
      if (k === 'categoria' || k === 'categoria_id') itemFormatado.categoria_id = parseInt(obj[key]) || 1; // Padrão ID 1 se vir string
      if (k === 'preco custo' || k === 'custo') itemFormatado.preco_custo = parseFloat(obj[key]) || 0;
      if (k === 'preco venda' || k === 'preco' || k === 'venda') itemFormatado.preco_venda = parseFloat(obj[key]);
      if (k === 'quantidade' || k === 'estoque' || k === 'qtd') itemFormatado.quantidade = parseInt(obj[key]) || 0;
      if (k === 'estoque minimo') itemFormatado.estoque_minimo = parseInt(obj[key]) || 5;
      if (k === 'descricao' || k === 'detalhes') itemFormatado.descricao = obj[key];
    });
    return itemFormatado;
  };

  const handleArquivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extensao = file.name.split('.').pop().toLowerCase();

    if (extensao === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const formatados = results.data.map(item => normalizarChaves(item));
          setProdutosPrevia(formatados.filter(p => p.nome && p.sku));
        }
      });
    } else if (['xlsx', 'xls'].includes(extensao)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        const formatados = data.map(item => normalizarChaves(item));
        setProdutosPrevia(formatados.filter(p => p.nome && p.sku));
      };
      reader.readAsBinaryString(file);
    }
  };

  const processarImportacao = async () => {
    if (produtosPrevia.length === 0) return;
    setCarregando(true);
    setProgresso(0);
    setResultadoFinal(null);

    const tamanhoLote = 100;
    let totalSucesso = 0;
    let totalAtualizados = 0;
    let todosErros = [];

    const totalItens = produtosPrevia.length;

    for (let i = 0; i < totalItens; i += tamanhoLote) {
      const lote = produtosPrevia.slice(i, i + tamanhoLote);

      try {
        const response = await api.post('/produtos/importar-lote', {
          produtos: lote,
          estrategia: estrategia
        });

        totalSucesso += response.data.sucesso;
        totalAtualizados += response.data.atualizados;
        if (response.data.erros) {
          todosErros = [...todosErros, ...response.data.erros];
        }
      } catch (error) {
        todosErros.push(`Falha crítica ao enviar lote que inicia na linha ${i + 1}`);
      }

      // Atualiza a barra de progresso baseado no lote atual
      const atual = Math.min(i + tamanhoLote, totalItens);
      setProgresso(Math.round((atual / totalItens) * 100));
    }

    setResultadoFinal({
      sucesso: totalSucesso,
      atualizados: totalAtualizados,
      erros: todosErros
    });
    setCarregando(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Importação em Massa de Produtos - Cometa Presentes</h2>
      
      <div style={{ marginBottom: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '6px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>1. Selecione a Planilha (.csv, .xlsx)</label>
        <input type="file" accept=".csv, .xlsx, .xls" onChange={handleArquivo} disabled={carregando} />
      </div>

      {produtosPrevia.length > 0 && (
        <div style={{ marginBottom: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '6px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>2. Estratégia para SKUs repetidos:</label>
          <select value={estrategia} onChange={(e) => setEstrategia(e.target.value)} disabled={carregando} style={{ padding: '6px', width: '100%' }}>
            <option value="pular">Pular e registrar erro (Não mexe no que já existe)</option>
            <option value="atualizar">Atualizar dados do produto com as infos da planilha</option>
          </select>

          <div style={{ marginTop: '15px' }}>
            <strong>Prévia detectada:</strong> {produtosPrevia.length} produtos prontos para processar.
          </div>

          <button 
            onClick={processarImportacao} 
            disabled={carregando}
            style={{ marginTop: '15px', padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {carregando ? 'Processando...' : 'Iniciar Importação'}
          </button>
        </div>
      )}

      {carregando && (
        <div style={{ margin: '20px 0' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Progresso: {progresso}%</div>
          <div style={{ width: '100%', background: '#ddd', borderRadius: '8px', height: '15px', overflow: 'hidden' }}>
            <div style={{ width: `${progresso}%`, background: '#007bff', height: '100%', transition: 'width 0.2s' }}></div>
          </div>
        </div>
      )}

      {resultadoFinal && (
        <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ccc', borderRadius: '6px' }}>
          <h3>Resultado da Importação</h3>
          <p style={{ color: 'green' }}><strong>Novos Cadastrados:</strong> {resultadoFinal.sucesso}</p>
          <p style={{ color: 'blue' }}><strong>Atualizados:</strong> {resultadoFinal.atualizados}</p>
          <p style={{ color: 'red' }}><strong>Falhas/Alertas:</strong> {resultadoFinal.erros.length}</p>

          {resultadoFinal.erros.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#fff5f5', padding: '10px', borderRadius: '4px', fontSize: '13px' }}>
              <strong>Log de Ocorrências:</strong>
              <ul>
                {resultadoFinal.erros.map((erro, idx) => <li key={idx} style={{ color: '#c00' }}>{erro}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}