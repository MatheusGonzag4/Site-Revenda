import { moeda } from "../format.js";

export default function ProdutosTabela({ produtos, onDetalhes, onEditar, onExcluir }) {
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">Produto</th>
          <th scope="col">Custo</th>
          <th scope="col">Preço de venda</th>
          <th scope="col">Estoque</th>
          <th scope="col">Status</th>
          <th scope="col">
            <span className="so-leitor">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {produtos.map((p) => (
          <tr key={p.id}>
            <td data-label="ID" className="col-id">
              #{p.id}
            </td>
            <td data-label="Produto">
              <span className="produto-nome">{p.nome}</span>
              <span className="produto-meta">
                {p.marca}, {p.categoria}
              </span>
            </td>
            <td data-label="Custo" className="num">
              {moeda(p.preco_custo)}
            </td>
            <td data-label="Preço de venda">
              <span className="etiqueta">{moeda(p.preco_venda)}</span>
            </td>
            <td data-label="Estoque" className="num">
              {p.quantidade} un.
            </td>
            <td data-label="Status">
              <span className={`status ${p.status === "Disponível" ? "ok" : "off"}`}>{p.status}</span>
            </td>
            <td className="acoes">
              <button type="button" className="link" onClick={() => onDetalhes(p.id)}>
                Detalhes
              </button>
              <button type="button" className="link" onClick={() => onEditar(p)}>
                Editar
              </button>
              <button type="button" className="link perigo" onClick={() => onExcluir(p)}>
                Excluir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
