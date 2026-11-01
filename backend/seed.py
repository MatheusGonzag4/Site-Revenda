"""Popula o Redis com produtos de exemplo.  Uso: python seed.py"""
from app import repository
from app.database import get_redis
from app.schemas import ProdutoDados

EXEMPLOS = [
    ("Tênis Nike Air Max 90", "Nike", "Calçados", 380, 599.9, 4, "Disponível"),
    ("Jaqueta Corta-vento", "Adidas", "Roupas", 120, 219.9, 6, "Disponível"),
    ("Camiseta Oversized Preta", "Hering", "Roupas", 35, 79.9, 12, "Disponível"),
    ("Fone Bluetooth TWS", "JBL", "Eletrônicos", 150, 279.0, 3, "Disponível"),
    ("Smartwatch Série 5", "Xiaomi", "Eletrônicos", 210, 349.9, 2, "Disponível"),
    ("Mochila Urbana 25L", "Samsonite", "Acessórios", 90, 189.9, 5, "Disponível"),
    ("Boné Aba Curva", "New Era", "Acessórios", 45, 109.9, 0, "Vendido"),
    ("Carregador Turbo 65W", "Anker", "Eletrônicos", 70, 149.9, 8, "Disponível"),
]


def main() -> None:
    r = get_redis()
    if r.zcard(repository.CHAVE_INDICE) > 0:
        print("O Redis já tem produtos cadastrados. Nada foi alterado.")
        return
    for nome, marca, categoria, custo, venda, qtd, status in EXEMPLOS:
        repository.criar(r, ProdutoDados(
            nome=nome, marca=marca, categoria=categoria, preco_custo=custo,
            preco_venda=venda, quantidade=qtd, status=status,
            cep="01001000", logradouro="Praça da Sé", bairro="Sé", cidade="São Paulo", uf="SP",
        ))
    print(f"{len(EXEMPLOS)} produtos de exemplo cadastrados.")


if __name__ == "__main__":
    main()
