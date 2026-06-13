import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Lidar com requisições CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Apenas aceitar requisições do tipo POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método HTTP não permitido. Utilize POST." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    // 1. Validar a API Key nas variáveis de ambiente da Function
    const webhookApiKey = Deno.env.get("WEBHOOK_API_KEY");
    if (!webhookApiKey) {
      return new Response(
        JSON.stringify({ error: "Erro de Configuração: WEBHOOK_API_KEY não configurado nas variáveis de ambiente da Edge Function." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 2. Extrair e validar o Token fornecido
    const authHeader = req.headers.get("Authorization");
    const customApiKeyHeader = req.headers.get("x-api-key");
    
    let providedKey = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7);
    } else if (customApiKeyHeader) {
      providedKey = customApiKeyHeader;
    }

    if (!providedKey || providedKey !== webhookApiKey) {
      return new Response(
        JSON.stringify({ error: "Não autorizado. Chave de API inválida ou ausente no cabeçalho (Authorization ou x-api-key)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // 3. Fazer o parse do corpo da requisição
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido. Esperado um payload JSON estruturado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { 
      board_id, 
      title, 
      column_id, 
      description = "", 
      priority, 
      sector, 
      due_date, 
      checklist 
    } = body;

    // 4. Validar os campos obrigatórios básicos
    if (!board_id || typeof board_id !== "string") {
      return new Response(
        JSON.stringify({ error: "O campo 'board_id' é obrigatório e deve ser uma string com o ID do quadro." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return new Response(
        JSON.stringify({ error: "O campo 'title' é obrigatório e deve ser uma string não vazia." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 5. Inicializar o cliente Supabase com a Service Role para ignorar RLS e realizar alterações administrativas
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Erro interno: Credenciais do Supabase não encontradas no ambiente da Function." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Resolver a coluna de destino do card
    let targetColumnId = column_id;

    if (!targetColumnId) {
      // Buscar no banco se o quadro tem o ticket_column_id configurado
      const { data: boardData, error: boardError } = await supabase
        .from("boards")
        .select("ticket_column_id")
        .eq("id", board_id)
        .maybeSingle();

      if (boardError) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar informações do quadro no banco de dados.", details: boardError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      if (!boardData) {
        return new Response(
          JSON.stringify({ error: `Quadro com ID '${board_id}' não encontrado.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      if (!boardData.ticket_column_id) {
        return new Response(
          JSON.stringify({
            error: "Nenhum 'column_id' foi fornecido e o quadro informado não possui uma coluna de chamados ('ticket_column_id') configurada. A requisição foi recusada sem fallback."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      targetColumnId = boardData.ticket_column_id;
    }

    // 7. Validar a existência e vínculo da coluna
    const { data: columnData, error: columnError } = await supabase
      .from("columns")
      .select("id, board_id")
      .eq("id", targetColumnId)
      .maybeSingle();

    if (columnError) {
      return new Response(
        JSON.stringify({ error: "Erro ao validar a coluna no banco de dados.", details: columnError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!columnData) {
      return new Response(
        JSON.stringify({ error: `A coluna de destino com ID '${targetColumnId}' não existe.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (columnData.board_id !== board_id) {
      return new Response(
        JSON.stringify({ error: `A coluna especificada '${targetColumnId}' não pertence ao quadro informado '${board_id}'.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 8. Validar e formatar a data de entrega (due_date) se fornecida
    let formattedDueDate = null;
    if (due_date) {
      const parsedDate = new Date(due_date);
      if (isNaN(parsedDate.getTime())) {
        return new Response(
          JSON.stringify({ error: "O campo 'due_date' possui um formato de data inválido. Use um formato compatível (ex: YYYY-MM-DD ou ISO String)." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      formattedDueDate = parsedDate.toISOString();
    }

    // 9. Obter a contagem de tarefas existentes na coluna para definir a posição final do novo card
    const { count, error: countError } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("column_id", targetColumnId);

    if (countError) {
      return new Response(
        JSON.stringify({ error: "Erro ao calcular a posição do card na coluna.", details: countError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const position = count || 0;

    // 10. Mapear as etiquetas (labels) de prioridade e setor
    const labels = [];

    if (priority) {
      const normPriority = priority.toString().toLowerCase().trim();
      if (normPriority === "alta" || normPriority === "high") {
        labels.push({ id: crypto.randomUUID(), text: "ALTA", color: "#ef4444" });
      } else if (normPriority === "media" || normPriority === "média" || normPriority === "medium") {
        labels.push({ id: crypto.randomUUID(), text: "MÉDIA", color: "#eab308" });
      } else if (normPriority === "baixa" || normPriority === "low") {
        labels.push({ id: crypto.randomUUID(), text: "BAIXA", color: "#22c55e" });
      } else {
        // Suporte a etiquetas de prioridade livre/customizada
        labels.push({ id: crypto.randomUUID(), text: priority.toString().toUpperCase().trim(), color: "#64748b" });
      }
    }

    if (sector && typeof sector === "string" && sector.trim()) {
      labels.push({ id: crypto.randomUUID(), text: sector.toUpperCase().trim(), color: "#64748b" });
    }

    // 11. Mapear o checklist de tarefas (array de strings)
    const checklistItems = [];
    if (Array.isArray(checklist)) {
      for (const item of checklist) {
        if (item && typeof item === "string" && item.trim()) {
          checklistItems.push({
            id: crypto.randomUUID(),
            text: item.trim(),
            done: false
          });
        }
      }
    }

    // 12. Inserir a nova tarefa no banco de dados
    const taskInsert = {
      column_id: targetColumnId,
      title: title.trim(),
      description: description.trim(),
      position,
      labels,
      checklist: checklistItems,
      assignees: [],
      due_date: formattedDueDate,
      cover_color: null,
      is_done: false
    };

    const { data: newTask, error: insertError } = await supabase
      .from("tasks")
      .insert(taskInsert)
      .select("*")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Erro ao inserir a tarefa na base de dados.", details: insertError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Retornar a tarefa criada com sucesso
    return new Response(
      JSON.stringify({
        success: true,
        message: "Tarefa criada no Kanban com sucesso!",
        task: {
          id: newTask.id,
          title: newTask.title,
          column_id: newTask.column_id,
          position: newTask.position,
          labels: newTask.labels,
          checklist: newTask.checklist,
          due_date: newTask.due_date,
          created_at: newTask.created_at
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 201 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor ao processar o webhook.", details: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
