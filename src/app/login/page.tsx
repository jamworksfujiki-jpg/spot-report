"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。時間を置いて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">SPOT Report</h1>
          <p className="text-sm text-gray-500 mt-1">ログインしてください</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ID
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-base shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
          <p className="text-xs text-gray-400 text-center pt-2">
            10回連続でログインに失敗すると15分間ロックされます
          </p>
        </form>
      </div>
    </div>
  );
}
