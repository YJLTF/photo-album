import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { authApi, type PermissionLevel } from "@/lib/api";

interface LoginProps {
  onLogin: (token: string, permission: PermissionLevel) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [key, setKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!key.trim()) {
      setError("请输入访问密码");
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.login(key.trim());
      localStorage.setItem("token", response.token);
      localStorage.setItem("permission", response.permission);
      onLogin(response.token, response.permission);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setError("访问密码无效，请重试");
      } else if (e.status === 429) {
        setError("尝试过于频繁，请稍后再试");
      } else {
        // 网络错误等：展示 request() 抛出的友好信息
        setError(e.message || "登录失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F0F23]">
      <div className="w-full max-w-md px-6">
        <div className="bg-[#16213E]/80 backdrop-blur-sm rounded-2xl border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.3)] p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#E8845C]/10 flex items-center justify-center">
              <Lock size={32} className="text-[#E8845C]" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-[#F5F0EB] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            光影集
          </h1>
          <p className="text-center text-[#F5F0EB]/50 text-sm mb-8">
            请输入访问密码
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="访问密码"
                className="w-full bg-[#1A1A2E] border border-white/10 rounded-xl px-4 py-3 text-[#F5F0EB] placeholder-[#F5F0EB]/30 outline-none focus:border-[#E8845C]/50 transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F5F0EB]/50 hover:text-[#F5F0EB] transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-[#E8845C] hover:bg-[#E8845C]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-[#F5F0EB]/30 text-xs">
              需要访问权限？请联系管理员获取访问密码
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}