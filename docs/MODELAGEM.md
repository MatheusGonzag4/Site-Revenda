# Modelagem da base de dados (Redis)

O Redis não tem tabelas: ele guarda **chaves** com estruturas de dados. Este projeto usa três.

## Visão geral

| Chave | Tipo no Redis | Função |
|---|---|---|
| `produto:seq` | String (inteiro) | Contador que gera o próximo ID (`INCR`) |
| `produto:<id>` | Hash | Guarda os campos de um produto |
| `produtos:index` | Sorted Set | Lista os IDs de todos os produtos, em ordem |

## Entidade Produto (`produto:<id>`)

| Campo | Tipo lógico | Obrigatório | Regra |
|---|---|---|---|
| `id` | inteiro | sim | Gerado pelo sistema (faz parte da chave, não do hash) |
| `nome` | texto | sim | 2 a 100 caracteres |
| `marca` | texto | sim | 1 a 60 caracteres |
| `categoria` | texto | sim | 2 a 60 caracteres |
| `preco_custo` | decimal | sim | maior ou igual a 0 |
| `preco_venda` | decimal | sim | maior que 0 |
| `quantidade` | inteiro | sim | maior ou igual a 0 |
| `status` | texto | sim | `Disponível` ou `Vendido` (`Disponível` exige `quantidade` > 0) |

Campos opcionais, gravados só quando informados: `imagem` (foto em data URL), `cep` (8 números), `logradouro`, `bairro`, `cidade`, `uf`. Ao atualizar um produto sem foto, o campo `imagem` é apagado do hash (`HDEL`).

O Redis guarda todos os valores do hash como texto. A API converte para número ao ler (via Pydantic).

## Por que essas estruturas?
- **Hash** por produto: permite ler e atualizar campos individualmente e mantém cada produto isolado em uma chave.
- **Contador com `INCR`**: operação atômica, então dois cadastros simultâneos nunca recebem o mesmo ID.
- **Sorted Set** como índice: o Redis não lista chaves por padrão de forma eficiente (`KEYS` é desaconselhado). O índice guarda os IDs com o próprio ID como pontuação, o que dá a ordem de cadastro. A listagem usa `ZREVRANGE` para mostrar os mais recentes primeiro.

## Exemplo de dados

```
produto:seq        -> "2"

produto:1          -> { nome: "Tênis Nike Air Max 90", marca: "Nike", categoria: "Calçados",
                        preco_custo: "380.0", preco_venda: "599.9", quantidade: "4",
                        status: "Disponível" }
produto:2          -> { nome: "Boné Aba Curva", marca: "New Era", categoria: "Acessórios",
                        preco_custo: "45.0", preco_venda: "109.9", quantidade: "0",
                        status: "Vendido" }

produtos:index     -> [ ("1", score 1), ("2", score 2) ]
```

## Comandos Redis usados em cada operação

| Operação | Comandos |
|---|---|
| Cadastrar | `INCR produto:seq` → `HSET produto:<id> ...` + `ZADD produtos:index <id> <id>` (juntos, em pipeline) |
| Listar | `ZREVRANGE produtos:index 0 -1` → `HGETALL produto:<id>` para cada ID (em pipeline) |
| Consultar por ID | `HGETALL produto:<id>` |
| Atualizar | `EXISTS produto:<id>` → `HSET produto:<id> ...` |
| Excluir | `DEL produto:<id>` + `ZREM produtos:index <id>` (juntos, em pipeline) |

Para conferir no terminal: `docker exec -it revenda-redis redis-cli` e depois `HGETALL produto:1`.

## Limitações conhecidas
A foto fica dentro do próprio hash, em texto (base64). Para uma loja grande, o ideal seria guardar os arquivos em disco ou em um serviço de armazenamento e salvar só o endereço da imagem.

Os filtros de `busca`, `categoria` e `status` são aplicados em Python depois de ler os produtos. Isso funciona bem para centenas ou poucos milhares de itens. Para volumes muito maiores, seria preciso criar índices secundários no Redis (por exemplo, um Set por categoria).
