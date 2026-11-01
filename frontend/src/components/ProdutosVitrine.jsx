import { moeda } from "../format.js";

export default function ProdutosVitrine({ produtos, onDetalhes }) {
  return (
    <ul className="vitrine">
      {produtos.map((p) => (
        <li key={p.id} className={p.status === "Vendido" ? "item vendido" : "item"}>
          <button type="button" className="item-botao" onClick={() => onDetalhes(p.id)}>
            <span className="item-foto">
              {p.imagem ? <img src={p.imagem} alt={p.nome} loading="lazy" /> : <span>Sem foto</span>}
              {p.status === "Vendido" && <em className="selo">Vendido</em>}
            </span>
            <span className="item-nome">{p.nome}</span>
            <span className="item-meta">
              {p.marca}
              {p.cidade ? `, ${p.cidade} - ${p.uf}` : ""}
            </span>
            <span className="etiqueta">{moeda(p.preco_venda)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
