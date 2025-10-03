# Melhorias na Captura de Referrer

## Problema Identificado

O campo `referrer` na tabela `leads` não estava sendo capturado consistentemente devido a limitações de segurança dos navegadores.

## Causas do Problema

1. **Limitações de Segurança do Navegador**:
   - Navegação de HTTPS para HTTP
   - Políticas de Referrer-Policy configuradas
   - Navegação a partir de arquivos locais
   - Configurações de privacidade do navegador

2. **Falta de Validação**: O código não validava se o referrer foi capturado corretamente

3. **Falta de Fallbacks**: Não havia alternativas quando o referrer não estava disponível

## Soluções Implementadas

### 1. Captura Robusta do Referrer
- Validação se o referrer existe e não está vazio
- Classificação automática do tipo de referrer (Google, Facebook, Instagram, etc.)
- Extração do domínio do referrer
- Tratamento de erros na análise do URL

### 2. Rastreamento UTM Melhorado
- Captura de todos os parâmetros UTM da URL
- Validação se existem parâmetros UTM
- Fallback para quando o referrer não está disponível

### 3. Rastreamento de Sessão
- Geração de ID único de sessão
- Contagem de visualizações de página
- Timestamp de entrada na sessão
- Página de entrada na sessão

### 4. Logs de Debug
- Console logs para monitorar captura de dados
- Informações detalhadas sobre UTM, referrer e sessão

## Campos Adicionados

### No Webhook (N8N)
- `referrer_domain`: Domínio do referrer
- `has_referrer`: Boolean indicando se há referrer
- `referrer_source`: Tipo de referrer (google, facebook, etc.)
- `has_utm`: Boolean indicando se há parâmetros UTM
- `session_id`: ID único da sessão
- `landing_page`: Página de entrada
- `entry_timestamp`: Timestamp de entrada na sessão
- `page_views`: Número de visualizações de página

### No Supabase
- Mantém o campo `referrer` original
- Agora com validação melhorada

## Como Usar

As melhorias são automáticas e não requerem mudanças no código existente. Os logs de debug podem ser removidos em produção.

## Monitoramento

Para monitorar a eficácia das melhorias:
1. Verifique os logs do console para ver as informações capturadas
2. Monitore a tabela `leads` no Supabase
3. Verifique os dados recebidos no webhook N8N

## Próximos Passos

1. Remover logs de debug em produção
2. Configurar alertas para quando o referrer não é capturado
3. Implementar analytics mais avançados baseados nos novos campos
