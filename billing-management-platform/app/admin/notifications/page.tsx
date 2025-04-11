"use client";

import useSWR from "swr";
import axios from "axios";
import { useState } from "react";

interface Template {
  id: string;
  type: string;
  subject: string;
  body: string;
  channels: string[];
}

export default function NotificationTemplates() {
  const { data, mutate } = useSWR<Template[]>("/api/admin/notification-templates");
  const [newTemplate, setNewTemplate] = useState({
    type: "",
    subject: "",
    body: "",
    channels: ["email", "in-app"],
  });

  const createTemplate = async () => {
    try {
      await axios.post("/api/admin/notification-templates", newTemplate);
      setNewTemplate({ type: "", subject: "", body: "", channels: ["email", "in-app"] });
      mutate();
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Notification Templates</h1>
      <div className="grid gap-2">
        {data?.map((template) => (
          <div key={template.id} className="border p-4 rounded-lg bg-white">
            <p><strong>Type:</strong> {template.type}</p>
            <p><strong>Subject:</strong> {template.subject}</p>
            <p><strong>Body:</strong> {template.body}</p>
            <p><strong>Channels:</strong> {template.channels.join(", ")}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        <h2 className="font-semibold">Create Template</h2>
        <div className="space-y-2">
          <input
            className="w-full p-2 border rounded"
            placeholder="Type"
            value={newTemplate.type}
            onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
          />
          <input
            className="w-full p-2 border rounded"
            placeholder="Subject"
            value={newTemplate.subject}
            onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
          />
          <textarea
            className="w-full p-2 border rounded"
            placeholder="Body"
            value={newTemplate.body}
            onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
          />
          <div className="space-x-2">
            <label>
              <input
                type="checkbox"
                checked={newTemplate.channels.includes("email")}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...newTemplate.channels, "email"]
                    : newTemplate.channels.filter((c) => c !== "email");
                  setNewTemplate({ ...newTemplate, channels });
                }}
              />
              Email
            </label>
            <label>
              <input
                type="checkbox"
                checked={newTemplate.channels.includes("in-app")}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...newTemplate.channels, "in-app"]
                    : newTemplate.channels.filter((c) => c !== "in-app");
                  setNewTemplate({ ...newTemplate, channels });
                }}
              />
              In-App
            </label>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={createTemplate}
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
} 