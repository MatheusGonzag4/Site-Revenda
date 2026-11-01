const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const moeda = (valor) => brl.format(valor);

// Lucro por unidade e percentual sobre o custo.
export function lucro(custo, venda) {
  const valor = venda - custo;
  const pct = custo > 0 ? (valor / custo) * 100 : null;
  return { valor, pct };
}
