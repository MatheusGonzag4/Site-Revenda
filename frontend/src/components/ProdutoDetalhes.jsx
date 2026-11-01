import { lucro, moeda } from "../format.js";

export default function ProdutoDetalhes({ produto, onEditar, onFechar }) {
  const { valor, pct } = lucro(produto.preco_custo, produto.preco_venda);
  const itens = [
    ["ID", `#${produto.id}`],
    ["Marca", produto.marca],
    ["Categoria", produto.categoria],
    ["Preço de custo", moeda(produto.preco_custo)],
    ["Preço de venda", moeda(produto.preco_venda)],
    [
      "Lucro por unidade",
      `${moeda(valor)}${pct !== null ? ` (${pct.toFixed(0)}% sobre o custo)` : ""}`,
    ],
    ...(produto.cidade
      ? [["Sai de", [produto.bairro, `${produto.cidade} - ${produto.uf}`].filter(Boolean).join(", ")]]
      : []),
    ["Em estoque", `${produto.quantidade} un.`],
    ["Status", produto.status],
  ];

  return (
    <div>
      {produto.imagem && <img className="detalhe-foto" src={produto.imagem} alt={produto.nome} />}
      <p className="detalhe-nome">{produto.nome}</p>
      <dl className="detalhes">
        {itens.map(([rotulo, valorItem]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valorItem}</dd>
          </div>
        ))}
      </dl>
      <div className="acoes-form">
        <button type="button" className="botao secundario" onClick={onFechar}>
          Fechar
        </button>
        <button type="button" className="botao" onClick={() => onEditar(produto)}>
          Editar produto
        </button>
      </div>
    </div>
  );
}
