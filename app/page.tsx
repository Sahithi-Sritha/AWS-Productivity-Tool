"use client";

import { useState } from "react";

type PrioritizedTask = {
  task: string;
  priority: number;
  reason: string;
};

type HistoryItem = {
  id: string;
  timestamp: number;
  tasks: string[];
  prioritizedTasks: PrioritizedTask[];
};

export default function Home() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<PrioritizedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handlePrioritize = async () => {
    if (!input.trim()) {
      setError("Please enter at least one task");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("/api/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: input }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to prioritize tasks");
      }

      const data = await res.json();
      setResults(data.prioritizedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/history?userId=guest");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
        setShowHistory(true);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setResults(item.prioritizedTasks);
    setInput(item.tasks.join('\n'));
    setShowHistory(false);
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">TaskPilot</h1>
          <p className="text-gray-600">AI-powered task prioritization</p>
          <button
            onClick={loadHistory}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showHistory ? "Hide" : "View"} History
          </button>
        </header>

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <label htmlFor="tasks" className="block text-sm font-medium text-gray-700">
            Enter your tasks (one per line)
          </label>
          <textarea
            id="tasks"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Fix login bug&#10;Review pull requests&#10;Update documentation&#10;Plan Q2 features"
            className="w-full h-48 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={loading}
          />
          <button
            onClick={handlePrioritize}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
          >
            {loading ? "Prioritizing..." : "Prioritize"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {showHistory && history.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">Recent History</h2>
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition"
                >
                  <p className="text-sm text-gray-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {item.tasks.length} tasks prioritized
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Prioritized Tasks</h2>
            <div className="space-y-3">
              {results.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-md p-4 hover:border-blue-300 transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-gray-900">{item.task}</p>
                      <p className="text-sm text-gray-600 italic">{item.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
