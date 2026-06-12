import React, { useMemo } from 'react';
import { Task, Column } from './CardModal';
import { Calendar, CheckSquare, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BoardListViewProps {
  columns: Column[];
  onTaskClick: (task: Task, colId: string) => void;
}

export const initials = (name: string) => {
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

export const avatarColor = (userId: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-red-500'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const BoardListView: React.FC<BoardListViewProps> = ({ columns, onTaskClick }) => {
  // Achatar todas as tarefas para uma lista única, preservando de qual coluna vieram
  const flatTasks = useMemo(() => {
    const list: Array<{ task: Task; column: Column }> = [];
    columns.forEach(col => {
      col.tasks.forEach(task => {
        list.push({ task, column: col });
      });
    });
    return list;
  }, [columns]);

  if (flatTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/20 rounded-2xl border border-white/5 mx-4">
        <AlignLeft className="w-12 h-12 text-white/20 mb-4" />
        <p className="text-white/50 text-sm">Nenhum chamado ou tarefa encontrado neste quadro.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar px-2 sm:px-6 pb-6">
      <div className="min-w-[800px] bg-[#1d2125]/80 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Cabeçalho da Tabela */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-white/5 text-xs font-bold text-white/50 uppercase tracking-wider">
          <div className="col-span-4">Tarefa / Título</div>
          <div className="col-span-2">Status (Coluna)</div>
          <div className="col-span-2">Etiquetas</div>
          <div className="col-span-2">Responsáveis</div>
          <div className="col-span-2 text-right">Infos</div>
        </div>

        {/* Corpo da Tabela */}
        <div className="divide-y divide-white/5">
          {flatTasks.map(({ task, column }) => {
            const hasChecklist = task.checklist && task.checklist.length > 0;
            const completedItems = hasChecklist ? task.checklist.filter(i => i.done).length : 0;
            const isDueDateOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_done;

            return (
              <div 
                key={task.id}
                onClick={() => onTaskClick(task, column.id)}
                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors cursor-pointer group"
              >
                {/* Título e Descrição */}
                <div className="col-span-4 flex flex-col gap-1 pr-4">
                  <span className={`text-sm font-bold truncate ${task.is_done ? 'line-through text-white/40' : 'text-white group-hover:text-primary transition-colors'}`}>
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="text-xs text-white/40 truncate">
                      {task.description}
                    </span>
                  )}
                </div>

                {/* Status (Coluna) */}
                <div className="col-span-2 flex items-center">
                  <span className="px-2.5 py-1 bg-white/10 text-white/80 rounded-full text-xs font-medium truncate max-w-[140px]" title={column.title}>
                    {column.title}
                  </span>
                </div>

                {/* Etiquetas */}
                <div className="col-span-2 flex flex-wrap gap-1.5 items-center">
                  {task.labels && task.labels.slice(0, 3).map(label => (
                    <span 
                      key={label.id} 
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white truncate max-w-[80px]"
                      style={{ backgroundColor: label.color }}
                      title={label.text}
                    >
                      {label.text}
                    </span>
                  ))}
                  {task.labels && task.labels.length > 3 && (
                    <span className="text-xs text-white/40 font-bold">+{task.labels.length - 3}</span>
                  )}
                </div>

                {/* Responsáveis */}
                <div className="col-span-2 flex items-center">
                  {task.assignees && task.assignees.length > 0 ? (
                    <div className="flex -space-x-2">
                      {task.assignees.slice(0, 4).map(assignee => (
                        <div 
                          key={assignee.user_id}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#1d2125] ${avatarColor(assignee.user_id)}`}
                          title={assignee.full_name}
                        >
                          {initials(assignee.full_name)}
                        </div>
                      ))}
                      {task.assignees.length > 4 && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#1d2125] bg-white/10 backdrop-blur-sm">
                          +{task.assignees.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-white/30 italic">Sem responsável</span>
                  )}
                </div>

                {/* Infos (Data, Checklist) */}
                <div className="col-span-2 flex items-center justify-end gap-3 text-xs text-white/50">
                  {task.due_date && (
                    <div className={`flex items-center gap-1 ${task.is_done ? 'bg-green-500/20 text-green-400' : isDueDateOverdue ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/70'} px-2 py-1 rounded`}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{format(new Date(task.due_date), "d MMM", { locale: ptBR })}</span>
                    </div>
                  )}
                  {hasChecklist && (
                    <div className={`flex items-center gap-1 ${completedItems === task.checklist.length ? 'bg-green-500/20 text-green-400' : 'bg-white/5'} px-2 py-1 rounded`}>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{completedItems}/{task.checklist.length}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BoardListView;
