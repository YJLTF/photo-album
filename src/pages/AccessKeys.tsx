import { useState, useEffect, useCallback } from "react";
import { Plus, Key, Trash2, Edit2, Copy, Check } from "lucide-react";
import { accessKeyApi, type AccessKey, type PermissionLevel } from "@/lib/api";
import { PERMISSION_LABELS, PERMISSION_BADGE_COLORS } from "@/lib/constants";
import Modal from "@/components/Modal";
import { toast } from "@/lib/toastStore";

const extractMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export default function AccessKeys() {
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKey, setEditingKey] = useState<AccessKey | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newPermission, setNewPermission] = useState<PermissionLevel>("viewer");
  const [newDescription, setNewDescription] = useState("");
  const [editNewKey, setEditNewKey] = useState("");
  const [editPermission, setEditPermission] = useState<PermissionLevel>("viewer");
  const [editDescription, setEditDescription] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");

  const loadKeys = useCallback(async () => {
    try {
      const data = await accessKeyApi.getAll();
      setKeys(data);
    } catch (error) {
      console.error("Failed to load access keys:", error);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // 修改/禁用/删除当前登录密钥后，旧 token 已失效，需要强制重新登录
  const forceLogoutIfCurrentKey = (key: AccessKey) => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) return false;
    try {
      const payload = JSON.parse(atob(currentToken.split(".")[1]));
      // 新令牌携带 kid（密钥 ID）；旧令牌回退比较 payload 里的 key 与页面展示的密钥
      const matches = payload.kid ? payload.kid === key.id : payload.key === key.key;
      if (matches) {
        localStorage.removeItem("token");
        localStorage.removeItem("permission");
        window.location.href = "/login";
        return true;
      }
    } catch {
      // token 解析失败，继续刷新列表
    }
    return false;
  };

  const handleCreate = async () => {
    if (!newKey || newKey.length < 6) return;
    setCreateError("");
    try {
      await accessKeyApi.create(newKey, newPermission, newDescription);
      setShowCreateModal(false);
      setNewKey("");
      setNewPermission("viewer");
      setNewDescription("");
      toast.success("密钥已创建");
      loadKeys();
    } catch (error) {
      console.error("Failed to create access key:", error);
      setCreateError(extractMessage(error, "创建失败"));
    }
  };

  const handleEdit = async () => {
    if (!editingKey) return;
    // 密钥值留空表示不修改；填写时同样要求至少 6 个字符
    const wantsKeyChange = editNewKey.length > 0;
    if (wantsKeyChange && editNewKey.length < 6) return;
    const permissionChanged = editPermission !== editingKey.permission;
    const descriptionChanged = editDescription !== (editingKey.description ?? "");
    if (!wantsKeyChange && !permissionChanged && !descriptionChanged) {
      setShowEditModal(false);
      setEditingKey(null);
      return;
    }

    setEditError("");
    try {
      if (wantsKeyChange) {
        await accessKeyApi.updateKey(editingKey.id, editNewKey);
      }
      if (permissionChanged || descriptionChanged) {
        await accessKeyApi.update(editingKey.id, {
          ...(permissionChanged ? { permission: editPermission } : {}),
          ...(descriptionChanged ? { description: editDescription } : {}),
        });
      }
      setShowEditModal(false);
      setEditingKey(null);
      setEditNewKey("");

      // 修改密钥值后旧 token 立即失效，需要强制重新登录；仅改权限/描述时刷新列表即可
      if (wantsKeyChange) {
        if (!forceLogoutIfCurrentKey(editingKey)) {
          loadKeys();
        }
      } else {
        loadKeys();
      }
      toast.success("密钥已更新");
    } catch (error) {
      console.error("Failed to update access key:", error);
      setEditError(extractMessage(error, "修改失败"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个密钥吗？")) return;
    try {
      const keyToDelete = keys.find(k => k.id === id);
      await accessKeyApi.delete(id);

      if (keyToDelete && !forceLogoutIfCurrentKey(keyToDelete)) {
        toast.success("密钥已删除");
        loadKeys();
      }
    } catch (error) {
      toast.error(extractMessage(error, "删除失败"));
    }
  };

  const handleToggleActive = async (key: AccessKey) => {
    const action = key.active ? "禁用" : "启用";
    if (!confirm(`确定要${action}此密钥吗？`)) return;

    try {
      await accessKeyApi.update(key.id, { active: !key.active });

      if (key.active && !forceLogoutIfCurrentKey(key)) {
        loadKeys();
      }
      toast.success(key.active ? "密钥已禁用" : "密钥已启用");
    } catch (error) {
      toast.error(extractMessage(error, `${action}失败`));
    }
  };

  // 与后端 assertNotLastAdmin 一致：仅拦住"最后一个启用的管理员"，
  // 存在多个管理员时允许正常管理（禁用/删除其余管理员密钥）
  const isLastActiveAdmin = (key: AccessKey) => {
    const activeAdminCount = keys.filter(k => k.permission === "admin" && k.active).length;
    return key.permission === "admin" && key.active && activeAdminCount <= 1;
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const openEditModal = (key: AccessKey) => {
    setEditingKey(key);
    // 密钥值默认留空（不修改）；权限/描述预填当前值
    setEditNewKey("");
    setEditPermission(key.permission);
    setEditDescription(key.description ?? "");
    setShowEditModal(true);
  };

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F0EB] mb-1 font-display">
            访问密钥管理
          </h1>
          <p className="text-[#F5F0EB]/50 text-sm">管理用户的访问密钥和权限</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          <span>创建密钥</span>
        </button>
      </div>

      {/* Keys list */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="text-center py-12 text-[#F5F0EB]/40">
            <Key size={48} className="mx-auto mb-4 opacity-30" />
            <p>暂无访问密钥</p>
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
                key.active
                  ? "bg-[#16213E]/50 border-white/10"
                  : "bg-[#16213E]/20 border-white/5 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mb-2">
                  <code className="text-[#E8845C] font-mono font-medium break-all">{key.key}</code>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${PERMISSION_BADGE_COLORS[key.permission]}`}>
                    {PERMISSION_LABELS[key.permission]}
                  </span>
                  {!key.active && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                      已禁用
                    </span>
                  )}
                </div>
                {key.description && (
                  <p className="text-[#F5F0EB]/40 text-sm">{key.description}</p>
                )}
                <p className="text-[#F5F0EB]/30 text-xs mt-1">
                  创建于 {new Date(key.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(key.key, key.id)}
                  className="p-2 rounded-lg hover:bg-white/10 text-[#F5F0EB]/60 hover:text-[#F5F0EB] transition-colors"
                  title="复制密钥"
                  aria-label="复制密钥"
                >
                  {copiedId === key.id ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <button
                  onClick={() => openEditModal(key)}
                  className="p-2 rounded-lg hover:bg-white/10 text-[#F5F0EB]/60 hover:text-[#F5F0EB] transition-colors"
                  title="修改密钥"
                  aria-label="修改密钥"
                >
                  <Edit2 size={18} />
                </button>
                {isLastActiveAdmin(key) ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 cursor-not-allowed" title="不能禁用最后一个启用的管理员密钥">
                    管理员
                  </span>
                ) : (
                  <button
                    onClick={() => handleToggleActive(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      key.active
                        ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                        : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    }`}
                  >
                    {key.active ? "禁用" : "启用"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(key.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    isLastActiveAdmin(key)
                      ? "text-[#F5F0EB]/20 cursor-not-allowed"
                      : "hover:bg-red-500/20 text-[#F5F0EB]/60 hover:text-red-400"
                  }`}
                  title={isLastActiveAdmin(key) ? "不能删除最后一个启用的管理员密钥" : "删除密钥"}
                  aria-label="删除密钥"
                  disabled={isLastActiveAdmin(key)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-6 font-display">
            创建访问密钥
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                密钥 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => {
                  setNewKey(e.target.value);
                  setCreateError("");
                }}
                placeholder="请输入密钥（至少6个字符）"
                className="w-full px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB] placeholder:text-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
              />
              {createError && (
                <p className="mt-1.5 text-red-400 text-sm">{createError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                权限级别 <span className="text-red-400">*</span>
              </label>
              <select
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value as PermissionLevel)}
                className="w-full px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB] focus:outline-none focus:border-[#E8845C]/50"
              >
                <option value="viewer">浏览者 - 仅能查看</option>
                <option value="editor">编辑者 - 可添加和管理内容</option>
                <option value="admin">管理员 - 完整权限</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                描述（可选）
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="例如：测试账号"
                className="w-full px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB] placeholder:text-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex-1 px-4 py-2.5 border border-white/20 rounded-lg text-[#F5F0EB]/70 hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newKey || newKey.length < 6}
              className="flex-1 px-4 py-2.5 bg-[#E8845C] rounded-lg font-medium hover:bg-[#E8845C]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal && !!editingKey} onClose={() => setShowEditModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-6 font-display">
            修改密钥
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                当前密钥
              </label>
              <div className="px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB]/50 font-mono">
                {editingKey?.key}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                新密钥（留空则不修改）
              </label>
              <input
                type="text"
                value={editNewKey}
                onChange={(e) => {
                  setEditNewKey(e.target.value);
                  setEditError("");
                }}
                placeholder="留空则不修改密钥值；填写时至少 6 个字符"
                className="w-full px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB] placeholder:text-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
              />
              {editError && (
                <p className="mt-1.5 text-red-400 text-sm">{editError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                权限级别
              </label>
              <select
                value={editPermission}
                onChange={(e) => {
                  setEditPermission(e.target.value as PermissionLevel);
                  setEditError("");
                }}
                className="w-full px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB] focus:outline-none focus:border-[#E8845C]/50"
              >
                <option value="viewer">浏览者 - 仅能查看</option>
                <option value="editor">编辑者 - 可添加和管理内容</option>
                <option value="admin">管理员 - 完整权限</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F5F0EB]/70 mb-2">
                描述
              </label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  setEditError("");
                }}
                placeholder="例如：测试账号"
                className="w-full px-4 py-2.5 bg-[#1A1A2E] border border-white/10 rounded-lg text-[#F5F0EB] placeholder:text-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowEditModal(false)}
              className="flex-1 px-4 py-2.5 border border-white/20 rounded-lg text-[#F5F0EB]/70 hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleEdit}
              className="flex-1 px-4 py-2.5 bg-[#E8845C] rounded-lg font-medium hover:bg-[#E8845C]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
