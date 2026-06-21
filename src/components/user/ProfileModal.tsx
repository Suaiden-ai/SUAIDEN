import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Camera, UserCircle, X, Check, Trash2 } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface ProfileModalProps {
  open: boolean;
  userId: string;
  initialName: string;
  initialAvatarUrl: string | null;
  onClose: () => void;
  /** Chamado após salvar com sucesso, para a tela que abriu o modal atualizar seus dados. */
  onSaved: (data: { full_name: string; avatar_url: string | null }) => void;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  userId,
  initialName,
  initialAvatarUrl,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  // Arquivo selecionado mas ainda não enviado (preview local).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sincroniza quando o modal abre com novos dados.
  useEffect(() => {
    if (open) {
      setName(initialName);
      setAvatarUrl(initialAvatarUrl);
      setPendingFile(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      setError(null);
    }
  }, [open, initialName, initialAvatarUrl]);

  // Limpa o object URL de preview ao trocar/desmontar.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('A imagem deve ter no máximo 5 MB.');
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const handleRemoveAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setAvatarUrl(null);
    setRemoveAvatar(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('O nome não pode ficar vazio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let nextAvatarUrl: string | null = avatarUrl;

      if (pendingFile) {
        const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        nextAvatarUrl = data.publicUrl;
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: trimmed, avatar_url: nextAvatarUrl })
        .eq('id', userId);
      if (updateError) throw updateError;

      onSaved({ full_name: trimmed, avatar_url: nextAvatarUrl });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const shownAvatar = previewUrl || avatarUrl;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 bg-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Editar perfil</h2>
                  <p className="text-xs text-muted-foreground">Altere seu nome e foto.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !saving && onClose()}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-primary flex items-center justify-center text-3xl font-bold text-white border-2 border-white/10">
                    {shownAvatar ? (
                      <img src={shownAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      name.trim().charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 transition-all"
                    title="Trocar foto"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>

                {shownAvatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover foto
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickFile}
                  className="hidden"
                />
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/80 uppercase tracking-wider">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-xl bg-black/30 border border-white/10 focus:border-primary/50 px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none"
                />
              </div>

              {error && (
                <p className="text-xs font-bold text-destructive">{error}</p>
              )}

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && onClose()}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ProfileModal;
