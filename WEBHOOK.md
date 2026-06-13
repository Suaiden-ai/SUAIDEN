# Documentação do Webhook de Criação de Tarefas (Kanban)

Este webhook permite criar cartões/tarefas diretamente em quadros específicos do Kanban da plataforma Suaiden. Ele foi projetado para ser robusto, de fácil utilização tanto por desenvolvedores (via Postman, N8N, scripts) quanto por **Agentes de Inteligência Artificial**.

---

## 🔗 Endpoint

O webhook está disponível sob a seguinte URL das Supabase Edge Functions:

```http
POST https://[SUA_REF_DO_PROJETO_SUPABASE].supabase.co/functions/v1/create-task
```

> [!NOTE]
> Substitua `[SUA_REF_DO_PROJETO_SUPABASE]` pela referência real do seu projeto Supabase (encontrada no painel do Supabase).

---

## 🔒 Autenticação

Para garantir a segurança, todas as requisições devem incluir uma chave de autenticação estática.
Você deve passar essa chave em **um** dos seguintes locais da requisição:

1. No cabeçalho **Authorization** (formato Bearer):
   ```http
   Authorization: Bearer SEU_TOKEN_SECRETO_AQUI
   ```
2. No cabeçalho personalizado **x-api-key**:
   ```http
   x-api-key: SEU_TOKEN_SECRETO_AQUI
   ```

### ⚙️ Configuração no Supabase
Para definir o token secreto no seu ambiente do Supabase, execute o seguinte comando no terminal (usando a CLI do Supabase):

```bash
supabase secrets set WEBHOOK_API_KEY="seu_token_secreto_aqui"
```

Alternativamente, adicione o segredo `WEBHOOK_API_KEY` diretamente no painel do Supabase em:  
*Dashboard > Settings > Edge Functions > Secrets*.

---

## 📋 Estrutura da Requisição (JSON Payload)

A requisição deve ser um método **POST** com corpo no formato `application/json`.

| Campo | Tipo | Obrigatoriedade | Descrição |
| :--- | :--- | :--- | :--- |
| `board_id` | String (UUID) | **Obrigatório** | ID do quadro onde a tarefa será adicionada. |
| `title` | String | **Obrigatório** | Título/nome da tarefa. |
| `column_id` | String (UUID) | *Opcional* | ID da coluna específica. Se não informado, o webhook tentará usar a coluna padrão de chamados do quadro (`ticket_column_id`). |
| `description` | String | *Opcional* | Descrição detalhada da tarefa. Aceita formatação em Markdown (padrão: `""`). |
| `priority` | String | *Opcional* | Define a etiqueta de prioridade. Valores suportados:<br>• `"alta"` / `"high"` ➔ Etiqueta vermelha (`#ef4444`) <br>• `"media"` / `"média"` / `"medium"` ➔ Etiqueta amarela (`#eab308`) <br>• `"baixa"` / `"low"` ➔ Etiqueta verde (`#22c55e`) <br>*Outros textos criarão uma etiqueta cinza com o nome fornecido.* |
| `sector` | String | *Opcional* | Nome do setor responsável (ex: `"Financeiro"`, `"T.I."`). Mapeado automaticamente para uma etiqueta na cor cinza (`#64748b`). |
| `due_date` | String | *Opcional* | Data de entrega/vencimento. Deve ser informada em formato válido (ex: `YYYY-MM-DD` ou ISO string). |
| `checklist` | Array de Strings | *Opcional* | Lista de itens para criar um checklist na tarefa. Cada string virará um sub-item não concluído. |

### ⚠️ Regras Importantes de Validação (Sem Fallbacks)
* Se `column_id` não for informado no body **E** o quadro (`board_id`) não tiver uma coluna de chamados (`ticket_column_id`) configurada no banco de dados, o webhook **falhará imediatamente** com o status `400 Bad Request` e não criará o card.
* Se a data informada em `due_date` não for reconhecida como válida, a requisição retornará `400 Bad Request`.
* Se o `board_id` ou a coluna especificada não existirem na base de dados, a requisição retornará um erro apropriado (`404` ou `400`).

---

## 📝 Exemplo de Payload Completo

```json
{
  "board_id": "f5b822d9-1bc9-4b67-a026-c23d0628a8d0",
  "title": "Corrigir bugs no faturamento mensal",
  "description": "Revisar logs do servidor para identificar falha no processamento de notas fiscais nas segundas-feiras.",
  "priority": "alta",
  "sector": "Financeiro",
  "due_date": "2026-06-25",
  "checklist": [
    "Analisar logs de erro do webhook de notas",
    "Ajustar payload enviado para a API de faturamento",
    "Executar testes em ambiente de homologação",
    "Liberar patch de correção em produção"
  ]
}
```

---

## 💻 Exemplos de Código para Integração

### 1. cURL (Terminal)
```bash
curl -X POST "https://[SUA_REF_DO_PROJETO_SUPABASE].supabase.co/functions/v1/create-task" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_SECRETO" \
  -d '{
    "board_id": "f5b822d9-1bc9-4b67-a026-c23d0628a8d0",
    "title": "Tarefa via cURL",
    "priority": "media"
  }'
```

### 2. JavaScript (Fetch API)
```javascript
const response = await fetch("https://[SUA_REF_DO_PROJETO_SUPABASE].supabase.co/functions/v1/create-task", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "SEU_TOKEN_SECRETO"
  },
  body: JSON.stringify({
    board_id: "f5b822d9-1bc9-4b67-a026-c23d0628a8d0",
    title: "Implementar novas rotas",
    description: "Criar endpoints de consulta",
    priority: "baixa"
  })
});

const data = await response.json();
console.log(data);
```

---

## 🤖 Guia para Agentes de IA

Se você utiliza IAs baseadas em Large Language Models (como o ChatGPT, Claude ou Gemini) com suporte a chamadas de funções/ferramentas, você pode fornecer a especificação abaixo para instruí-las sobre como consumir este webhook.

### System Instructions para IA
> "Você tem acesso a uma ferramenta que cria tarefas em um quadro Kanban. Para utilizá-la, realize uma requisição POST HTTP para a Edge Function de criação de tarefas. Você precisará solicitar do usuário o `board_id` caso ele não tenha sido fornecido. Sempre passe um título claro em `title`. Se o usuário detalhar as etapas a serem seguidas, formate-as como uma lista de itens textuais e envie no parâmetro `checklist`."

### Schema OpenAPI para Ferramentas de IA (Functions Definition)
```json
{
  "name": "create_kanban_task",
  "description": "Cria um card/tarefa no quadro Kanban da plataforma Suaiden utilizando um webhook HTTP.",
  "parameters": {
    "type": "object",
    "properties": {
      "board_id": {
        "type": "string",
        "description": "O UUID identificador do quadro Kanban."
      },
      "title": {
        "type": "string",
        "description": "Título curto e descritivo da tarefa a ser realizada."
      },
      "description": {
        "type": "string",
        "description": "Descrição detalhada do escopo da tarefa."
      },
      "priority": {
        "type": "string",
        "enum": ["alta", "media", "baixa"],
        "description": "A prioridade da tarefa."
      },
      "sector": {
        "type": "string",
        "description": "Setor responsável pela tarefa (ex: Financeiro, Marketing, TI)."
      },
      "due_date": {
        "type": "string",
        "description": "Data de vencimento da tarefa no formato YYYY-MM-DD."
      },
      "checklist": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Lista de sub-tarefas ou checklist de entrega."
      }
    },
    "required": ["board_id", "title"]
  }
}
```
