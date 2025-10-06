# Sistema de Limitação de Requisições (Rate Limiting)

## Visão Geral

Este sistema implementa limitação de requisições por IP para prevenir abuso da funcionalidade de geração de propostas com IA. Cada IP pode fazer até **10 requisições por 24 horas**.

## Componentes

### 1. Tabela `request_attempts`
Armazena todas as tentativas de requisição com as seguintes informações:
- `id`: UUID único
- `ip_address`: Endereço IP do usuário
- `endpoint`: Tipo de endpoint (ex: 'ai_generation')
- `created_at`: Timestamp da tentativa
- `user_agent`: User agent do navegador
- `referrer`: URL de referência

### 2. Funções do Banco de Dados

#### `check_rate_limit(ip_address, endpoint, max_attempts, time_window_hours)`
Verifica se um IP atingiu o limite de requisições.

**Parâmetros:**
- `ip_address`: Endereço IP a verificar
- `endpoint`: Tipo de endpoint (padrão: 'ai_generation')
- `max_attempts`: Número máximo de tentativas (padrão: 10)
- `time_window_hours`: Janela de tempo em horas (padrão: 24)

**Retorna:**
```json
{
  "is_blocked": boolean,
  "attempt_count": number,
  "max_attempts": number,
  "remaining_attempts": number,
  "reset_time": string,
  "time_window_hours": number
}
```

#### `log_request_attempt(ip_address, endpoint, user_agent, referrer)`
Registra uma tentativa de requisição.

**Retorna:** UUID da tentativa registrada

#### `cleanup_old_attempts(days_to_keep)`
Remove tentativas antigas para manutenção do banco.

### 3. Serviços Frontend

#### `src/services/supabase.ts`
- `checkRateLimit()`: Wrapper para a função do banco
- `logRequestAttempt()`: Wrapper para registrar tentativas

#### `src/services/ai.ts`
- `getUserIP()`: Obtém o IP público do usuário
- `generateProposal()`: Verifica rate limit antes de processar

### 4. Interface do Usuário

#### `src/components/ui/LeadForm.tsx`
- Exibe erro quando limite é excedido
- Mostra informações sobre tentativas restantes
- Calcula tempo até reset do limite

## Fluxo de Funcionamento

1. **Usuário faz requisição** → Sistema obtém IP do usuário
2. **Verificação de limite** → Consulta tentativas nas últimas 24h
3. **Decisão:**
   - Se **dentro do limite**: Processa requisição e registra tentativa
   - Se **limite excedido**: Retorna erro com informações de reset
4. **Registro** → Todas as tentativas são logadas para auditoria

## Configuração

### Limites Atuais
- **Máximo de tentativas**: 10 por IP
- **Janela de tempo**: 24 horas
- **Endpoint monitorado**: 'ai_generation'

### Personalização
Para alterar os limites, modifique os parâmetros nas chamadas das funções:

```typescript
// Exemplo: 5 tentativas por 12 horas
const rateLimitInfo = await checkRateLimit(userIP, 'ai_generation', 5, 12);
```

## Monitoramento

### Consultas Úteis

```sql
-- Ver tentativas por IP nas últimas 24h
SELECT ip_address, COUNT(*) as attempts
FROM request_attempts 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY attempts DESC;

-- Ver IPs bloqueados
SELECT ip_address, COUNT(*) as attempts
FROM request_attempts 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) >= 10;

-- Limpar tentativas antigas (manutenção)
SELECT cleanup_old_attempts(7); -- Remove tentativas com mais de 7 dias
```

## Teste

Execute o script de teste para verificar o funcionamento:

```bash
# Configure as variáveis de ambiente
export VITE_SUPABASE_URL="sua-url"
export VITE_SUPABASE_ANON_KEY="sua-chave"

# Execute o teste
node test-rate-limit.js
```

## Segurança

- **RLS habilitado**: Apenas operações permitidas são executadas
- **IP tracking**: Rastreamento preciso de origem das requisições
- **Auditoria completa**: Todas as tentativas são registradas
- **Reset automático**: Limites são resetados automaticamente após 24h

## Troubleshooting

### Problemas Comuns

1. **Rate limit não funciona**
   - Verifique se as funções foram criadas no banco
   - Confirme se RLS está configurado corretamente

2. **IP não é detectado**
   - Verifique se o serviço ipify.org está acessível
   - Implemente fallback para IP local se necessário

3. **Performance lenta**
   - Verifique se os índices estão criados
   - Execute limpeza de dados antigos regularmente

### Logs
Monitore os logs do console para debug:
- `✅ Rate limit OK` - Requisição permitida
- `🚫 Rate limit excedido` - Requisição bloqueada
- `❌ Erro ao verificar rate limit` - Erro no sistema
