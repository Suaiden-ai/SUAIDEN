import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  PlusCircle,
  MapPin,
  Clock,
  DollarSign,
  Type,
  FileText,
  Wrench,
  Trophy,
  CheckCircle,
  Zap,
  Users as UsersIcon
} from 'lucide-react';
import { Button } from '@/components/jobs/ui/button';
import { jobsService, type Job } from '../../services/jobs';
import { useToast } from '@/hooks/jobs/use-toast';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateJobModal = ({ isOpen, onClose, onSuccess }: CreateJobModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    salary: '',
    location: 'Remoto',
    type: 'Full-time (40h)',
    techStack: [] as string[],
    requirements: [] as string[],
    responsibilities: [] as string[],
    softSkills: [] as string[],
    team: [] as string[],
    benefits: [] as { icon_name: string; text: string }[],
    workEnvironment: [] as { icon_name: string; text: string }[],
    paymentTerms: [] as { icon_name: string; text: string }[],
  });

  const [newItem, setNewItem] = useState({
    tech: '',
    req: '',
    resp: '',
    soft: '',
    team: '',
    benefit: { icon: 'Zap', text: '' },
    work: { icon: 'Monitor', text: '' },
    payment: { icon: 'CreditCard', text: '' }
  });

  const addItem = (field: keyof typeof formData, value: any) => {
    if (!value) return;
    setFormData(prev => ({
      ...prev,
      [field]: Array.isArray(prev[field]) ? [...(prev[field] as any[]), value] : value
    }));
  };

  const removeItem = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as any[]).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.shortDescription) {
      toast({
        title: "Erro",
        description: "Preencha ao menos o título e a descrição curta.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await jobsService.createJob(formData);
      toast({
        title: "Sucesso!",
        description: "Vaga criada com sucesso.",
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro ao criar vaga",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-black border border-border rounded-3xl shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-black">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <PlusCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Nova Vaga</h2>
                <p className="text-sm text-muted-foreground">Cadastre uma nova oportunidade no sistema.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <form id="job-form" onSubmit={handleSubmit} className="space-y-8">
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Type className="w-4 h-4" /> Título da Vaga
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    placeholder="Ex: Desenvolvedor Full Stack"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Salário
                  </label>
                  <input
                    type="text"
                    value={formData.salary}
                    onChange={e => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    placeholder="Ex: USD 500,00 / mês"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Localização
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    placeholder="Ex: Remoto (Arizona Timezone)"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Tipo de Contrato
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    placeholder="Ex: Full-time (40h)"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Descrição Curta (Card)
                  </label>
                  <textarea
                    required
                    value={formData.shortDescription}
                    onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all min-h-[80px]"
                    placeholder="Breve resumo para a listagem..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Descrição Completa
                  </label>
                  <textarea
                    required
                    value={formData.fullDescription}
                    onChange={e => setFormData({ ...formData, fullDescription: e.target.value })}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all min-h-[120px]"
                    placeholder="Descrição detalhada para a página da vaga..."
                  />
                </div>
              </div>

              {/* Lists Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Tech Stack */}
                <div className="space-y-4">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Tech Stack
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem.tech}
                      onChange={e => setNewItem({ ...newItem, tech: e.target.value })}
                      className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="Ex: React"
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('techStack', newItem.tech), setNewItem({...newItem, tech: ''}))}
                    />
                    <Button type="button" size="icon" className="rounded-xl" onClick={() => { addItem('techStack', newItem.tech); setNewItem({...newItem, tech: ''}); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.techStack.map((item, idx) => (
                      <span key={idx} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-primary/20">
                        {item} <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeItem('techStack', idx)} />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Requirements */}
                <div className="space-y-4">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Requisitos
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem.req}
                      onChange={e => setNewItem({ ...newItem, req: e.target.value })}
                      className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="Ex: 3+ anos exp..."
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem('requirements', newItem.req), setNewItem({...newItem, req: ''}))}
                    />
                    <Button type="button" size="icon" className="rounded-xl" onClick={() => { addItem('requirements', newItem.req); setNewItem({...newItem, req: ''}); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.requirements.map((item, idx) => (
                      <div key={idx} className="bg-muted/30 p-2 rounded-lg text-xs flex justify-between items-center group border border-border/50">
                        <span>{item}</span>
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem('requirements', idx)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Responsibilities & Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Benefits with Icon mapping logic would be here - simplified for now */}
                <div className="space-y-4">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4" /> Benefícios (Item + Ícone Zap)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem.benefit.text}
                      onChange={e => setNewItem({ ...newItem, benefit: { ...newItem.benefit, text: e.target.value } })}
                      className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="Ex: Horários flexíveis"
                    />
                    <Button type="button" size="icon" className="rounded-xl" onClick={() => { addItem('benefits', { icon_name: 'Zap', text: newItem.benefit.text }); setNewItem({...newItem, benefit: { ...newItem.benefit, text: '' } }); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.benefits.map((item, idx) => (
                      <div key={idx} className="bg-muted/30 p-2 rounded-lg text-xs flex justify-between items-center border border-border/50">
                        <span className="flex items-center gap-2"><Zap className="w-3 h-3 text-primary" /> {item.text}</span>
                        <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeItem('benefits', idx)} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team */}
                <div className="space-y-4">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" /> Membros do Time
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem.team}
                      onChange={e => setNewItem({ ...newItem, team: e.target.value })}
                      className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="Ex: 2 Devs Frontend"
                    />
                    <Button type="button" size="icon" className="rounded-xl" onClick={() => { addItem('team', newItem.team); setNewItem({...newItem, team: ''}); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.team.map((item, idx) => (
                      <span key={idx} className="bg-muted px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-border">
                        {item} <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeItem('team', idx)} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex justify-end gap-3 bg-black">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              form="job-form"
              type="submit" 
              className="rounded-xl px-8" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Vaga
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Loader2 = ({ className }: { className: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default CreateJobModal;
