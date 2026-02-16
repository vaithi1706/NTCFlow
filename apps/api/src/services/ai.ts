// AI Service - uses OpenAI if available, otherwise smart templates

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(messages: { role: string; content: string }[]): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("No API key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-3.5-turbo", messages, temperature: 0.7, max_tokens: 1000 }),
  });
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function inferContext(title: string): { domain: string; action: string; subject: string } {
  const lower = title.toLowerCase();
  const action = lower.startsWith("add") ? "add" : lower.startsWith("fix") ? "fix" : lower.startsWith("update") ? "update" :
    lower.startsWith("create") ? "create" : lower.startsWith("implement") ? "implement" :
    lower.startsWith("remove") ? "remove" : lower.startsWith("design") ? "design" : "implement";
  const domain = lower.includes("auth") ? "authentication" : lower.includes("api") ? "API" :
    lower.includes("ui") || lower.includes("button") || lower.includes("page") || lower.includes("form") ? "UI" :
    lower.includes("database") || lower.includes("db") || lower.includes("schema") ? "database" :
    lower.includes("test") ? "testing" : lower.includes("deploy") ? "deployment" : "feature";
  return { domain, action, subject: title };
}

export async function generateTaskDescription(title: string): Promise<{
  description: string; acceptanceCriteria: string[]; suggestedSubtasks: string[];
}> {
  if (OPENAI_API_KEY) {
    try {
      const raw = await callOpenAI([{
        role: "system",
        content: "You are a PM assistant. Given a task title, generate a JSON with: description (string, 2-3 sentences), acceptanceCriteria (string array, 3-5 items), suggestedSubtasks (string array, 2-4 items). Return only valid JSON."
      }, { role: "user", content: title }]);
      return JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch { /* fallback */ }
  }

  const ctx = inferContext(title);
  return {
    description: `${ctx.action.charAt(0).toUpperCase() + ctx.action.slice(1)} the ${ctx.domain} functionality: ${title}. This task involves planning, implementation, testing, and documentation to ensure quality delivery.`,
    acceptanceCriteria: [
      `${title} is fully implemented and functional`,
      `Unit tests cover the new ${ctx.domain} logic`,
      `Edge cases and error states are handled gracefully`,
      `Code reviewed and approved by at least one team member`,
      `Documentation updated to reflect changes`,
    ],
    suggestedSubtasks: [
      `Research and plan approach for: ${title}`,
      `Implement core logic for ${ctx.domain}`,
      `Add tests and validation`,
      `Update documentation`,
    ],
  };
}

export async function suggestTaskMetadata(title: string, description: string): Promise<{
  suggestedPriority: string; suggestedLabels: string[]; suggestedType: string;
}> {
  if (OPENAI_API_KEY) {
    try {
      const raw = await callOpenAI([{
        role: "system",
        content: "Given a task title and description, suggest: suggestedPriority (urgent/high/medium/low), suggestedLabels (string array), suggestedType (bug/feature/story/task/epic). Return only valid JSON."
      }, { role: "user", content: `Title: ${title}\nDescription: ${description}` }]);
      return JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch { /* fallback */ }
  }

  const lower = (title + " " + description).toLowerCase();
  const isBug = lower.includes("bug") || lower.includes("fix") || lower.includes("broken") || lower.includes("error");
  const isUrgent = lower.includes("urgent") || lower.includes("critical") || lower.includes("crash") || lower.includes("security");
  const isEpic = lower.includes("epic") || lower.includes("redesign") || lower.includes("migration") || lower.includes("overhaul");

  const labels: string[] = [];
  if (lower.includes("frontend") || lower.includes("ui")) labels.push("frontend");
  if (lower.includes("backend") || lower.includes("api")) labels.push("backend");
  if (lower.includes("database") || lower.includes("db")) labels.push("database");
  if (isBug) labels.push("bug");
  if (lower.includes("performance")) labels.push("performance");
  if (labels.length === 0) labels.push("enhancement");

  return {
    suggestedPriority: isUrgent ? "urgent" : isBug ? "high" : "medium",
    suggestedLabels: labels,
    suggestedType: isEpic ? "epic" : isBug ? "bug" : "feature",
  };
}

export async function summarizeProject(tasks: any[]): Promise<{
  summary: string; blockers: string[]; overdueTasks: string[]; completionPercentage: number;
}> {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done" || t.status === "cancelled").length;
  const inProgress = tasks.filter(t => t.status === "in_progress" || t.status === "in_review").length;
  const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done" && t.status !== "cancelled");
  const blocked = tasks.filter(t => t.status === "in_progress" && t.dueDate && new Date(t.dueDate) < new Date());
  const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;

  if (OPENAI_API_KEY && total > 0) {
    try {
      const taskSummary = tasks.slice(0, 30).map(t => `${t.title} [${t.status}] ${t.priority}`).join("\n");
      const raw = await callOpenAI([{
        role: "system",
        content: "You are a PM. Summarize this project status in JSON: summary (2-3 sentences), blockers (string array), overdueTasks (string array of task titles), completionPercentage (number). Return only valid JSON."
      }, { role: "user", content: `${total} tasks, ${done} done, ${inProgress} in progress, ${overdue.length} overdue.\nTasks:\n${taskSummary}` }]);
      return JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch { /* fallback */ }
  }

  return {
    summary: total === 0
      ? "No tasks in this project yet. Start by creating tasks to track your work."
      : `Project has ${total} tasks: ${done} completed (${completionPercentage}%), ${inProgress} in progress, and ${total - done - inProgress} remaining. ${overdue.length > 0 ? `⚠️ ${overdue.length} task(s) are overdue and need attention.` : "All tasks are on track."}`,
    blockers: blocked.map(t => `"${t.title}" is in progress but past due date`),
    overdueTasks: overdue.map(t => t.title),
    completionPercentage,
  };
}

export async function generateSprintPlan(backlogTasks: any[], teamSize: number, sprintDuration: number): Promise<{
  suggestedTasks: string[]; estimatedCapacity: number; reasoning: string;
}> {
  const estimatedCapacity = teamSize * sprintDuration * 5; // ~5 story points per person per day (rough)
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  const sorted = [...backlogTasks].sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4));

  if (OPENAI_API_KEY && backlogTasks.length > 0) {
    try {
      const taskList = sorted.slice(0, 30).map(t => `${t.id}: ${t.title} [${t.priority}] ${t.storyPoints || 1}pts`).join("\n");
      const raw = await callOpenAI([{
        role: "system",
        content: "You are a scrum master. Suggest sprint tasks. Return JSON: suggestedTasks (array of task IDs), estimatedCapacity (number), reasoning (string). Return only valid JSON."
      }, { role: "user", content: `Team: ${teamSize}, Duration: ${sprintDuration} days, Capacity: ~${estimatedCapacity}pts\nBacklog:\n${taskList}` }]);
      return JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch { /* fallback */ }
  }

  // Pick tasks by priority until capacity is roughly met
  let points = 0;
  const suggested: string[] = [];
  for (const t of sorted) {
    const pts = t.storyPoints || 1;
    if (points + pts <= estimatedCapacity && suggested.length < 15) {
      suggested.push(t.id);
      points += pts;
    }
  }

  return {
    suggestedTasks: suggested,
    estimatedCapacity,
    reasoning: `Based on a team of ${teamSize} over ${sprintDuration} days (~${estimatedCapacity} story points capacity), selected ${suggested.length} highest-priority backlog tasks. Tasks are ordered by priority (urgent → high → medium → low).`,
  };
}
