# TudoOn: site de revenda com Python (FastAPI) + Redis + React

Site de revenda com **Loja** (vitrine com fotos) e **Estoque** (gerenciamento). Cada produto tem foto e o CEP de onde sai; o endereço é preenchido sozinho pelo **ViaCEP**. Permite **cadastrar, listar, consultar por ID, atualizar e excluir** produtos por meio de uma API REST em Python, com os dados guardados no Redis e uma interface em React.

```
revenda/
├── backend/            API REST (FastAPI) + acesso ao Redis
│   ├── app/            main.py (rotas), schemas.py (validação), repository.py (Redis)
│   ├── tests/          testes automatizados (não precisam do Redis real)
│   └── seed.py         cadastra produtos de exemplo
├── frontend/           interface em React (Vite)
├── docs/MODELAGEM.md   modelagem da base de dados no Redis
└── docker-compose.yml  sobe o Redis
```

## O que você precisa instalar

| Ferramenta | Versão | Para quê |
|---|---|---|
| Python | 3.10 ou superior | backend |
| Node.js | 18 ou superior | frontend |
| Docker (ou Redis instalado) | qualquer | banco de dados |

## Como executar

Abra **3 terminais**, a partir da pasta `revenda/`.

### 1. Redis
```bash
docker compose up -d
```
Sem Docker? Instale o Redis (no Windows, use o WSL ou o Redis Cloud gratuito) e deixe-o rodando na porta 6379. Se o Redis estiver em outro endereço, defina as variáveis `REDIS_HOST`, `REDIS_PORT` e `REDIS_PASSWORD`.

### 2. Backend
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python seed.py                        # (opcional) cadastra produtos de exemplo
uvicorn app.main:app --reload
```
A API fica em **http://localhost:8000** e a documentação interativa (Swagger) em **http://localhost:8000/docs**.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Abra **http://localhost:5173**. Se a API estiver em outro endereço, copie `.env.example` para `.env` e ajuste `VITE_API_URL`.

### Testes do backend (opcional)
```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

## Endpoints da API

| Método | Rota | O que faz | Respostas |
|---|---|---|---|
| POST | `/produtos` | Cadastra um produto | 201, 422 |
| GET | `/produtos` | Lista todos (filtros opcionais: `busca`, `categoria`, `status`) | 200, 422 |
| GET | `/produtos/{id}` | Consulta um produto por ID | 200, 404 |
| PUT | `/produtos/{id}` | Atualiza um produto (envia todos os campos) | 200, 404, 422 |
| DELETE | `/produtos/{id}` | Exclui um produto | 200, 404 |
| GET | `/cep/{cep}` | Consulta o endereço de um CEP (8 números) no ViaCEP | 200, 404, 422, 503 |
| GET | `/saude` | Confere a conexão com o Redis | 200, 503 |

### Corpo de `POST` e `PUT`
```json
{
  "nome": "Tênis Nike Air Max",
  "marca": "Nike",
  "categoria": "Calçados",
  "preco_custo": 200.0,
  "preco_venda": 320.0,
  "quantidade": 5,
  "status": "Disponível"
}
```

Campos opcionais do produto: `imagem` (data URL, até ~450 KB; o site reduz a foto para 800 px antes de enviar), `cep`, `logradouro`, `bairro`, `cidade`, `uf`.

### Regras de validação
- `nome`: 2 a 100 caracteres. `marca`: 1 a 60. `categoria`: 2 a 60.
- `preco_custo` maior ou igual a 0; `preco_venda` maior que 0.
- `quantidade`: número inteiro maior ou igual a 0.
- `status`: `Disponível` ou `Vendido`. Um produto com `quantidade` 0 não pode ficar `Disponível`.

### Mensagens
- Sucesso (POST/PUT/DELETE): `{ "mensagem": "Produto 'X' cadastrado com sucesso.", "produto": { ... } }`
- Produto não encontrado: `404` com `{ "detail": "Produto 7 não encontrado." }`
- Dados inválidos: `422` com `{ "detail": "...", "erros": [{ "campo": "preco_venda", "mensagem": "O valor deve ser maior que 0." }] }`
- Redis fora do ar: `503` com `{ "detail": "Banco de dados indisponível. ..." }`

### Exemplo com curl
```bash
curl -X POST http://localhost:8000/produtos -H "Content-Type: application/json" \
  -d '{"nome":"Jaqueta","marca":"Adidas","categoria":"Roupas","preco_custo":120,"preco_venda":220,"quantidade":3,"status":"Disponível"}'

curl http://localhost:8000/produtos/1
curl -X DELETE http://localhost:8000/produtos/1
```

## Problemas comuns
- **"Não foi possível conectar à API"** no site: o backend não está rodando (passo 2).
- **"Banco de dados indisponível"**: o Redis não está rodando (passo 1).
- **Erro de CORS no navegador**: o frontend precisa estar em `localhost:5173`. Para outro endereço, defina `CORS_ORIGINS` antes de iniciar o backend.
