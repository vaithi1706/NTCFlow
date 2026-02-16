const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

async function callNvidiaWithSystem(systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured.");
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callNvidiaWithMessages(messages: Array<{ role: string; content: string }>, maxTokens = 2000): Promise<string> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured.");
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({ model: NVIDIA_MODEL, messages, temperature: 0.7, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callNvidia(prompt: string, maxTokens = 2000): Promise<string> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured.");
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateContent(prompt: string): Promise<string> {
  return callNvidia(prompt);
}

async function generateJSON<T>(prompt: string): Promise<T> {
  const fullPrompt = prompt + "\n\nRespond ONLY with valid JSON. No markdown code blocks, no explanation, no text before or after the JSON.";
  const text = await callNvidia(fullPrompt);
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  // Extract JSON from response if there's extra text
  const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) throw new Error("No valid JSON found in AI response");
  return JSON.parse(jsonMatch[0]);
}

// --- Feature 1: Generate Task Description ---
export async function generateTaskDescription(title: string, projectName?: string, taskTypes?: string[]): Promise<{
  description: string; acceptanceCriteria: string[]; suggestedSubtasks: string[];
}> {
  const context = projectName ? `Project: ${projectName}.` : "";
  const types = taskTypes?.length ? `Existing task types: ${taskTypes.join(", ")}.` : "";
  
  try {
    return await generateJSON(`You are a project management assistant. Given this task title, generate a detailed task description.

Task Title: "${title}"
${context}
${types}

Return JSON with:
- description: A detailed description with sections "## Overview" (2-3 sentences), "## Acceptance Criteria" (as markdown checklist "- [ ] ..."), "## Technical Notes" (implementation hints)
- acceptanceCriteria: Array of acceptance criteria strings (3-5 items)
- suggestedSubtasks: Array of subtask title strings (2-4 items)`);
  } catch {
    return {
      description: `## Overview\nImplement: ${title}. This task involves planning, implementation, testing, and documentation.\n\n## Acceptance Criteria\n- [ ] Feature is fully implemented and functional\n- [ ] Unit tests cover the new logic\n- [ ] Edge cases handled gracefully\n\n## Technical Notes\nReview existing codebase before implementation.`,
      acceptanceCriteria: [
        `${title} is fully implemented`,
        "Unit tests added",
        "Edge cases handled",
        "Code reviewed and approved",
      ],
      suggestedSubtasks: [
        `Research approach for: ${title}`,
        "Implement core logic",
        "Add tests",
        "Update documentation",
      ],
    };
  }
}

// --- Feature 2: Task Breakdown ---
export async function breakdownTask(title: string, description: string, projectName?: string): Promise<
  Array<{ title: string; description: string; priority: string; estimatedPoints: number }>
> {
  try {
    return await generateJSON(`You are a project management assistant. Break this epic/large task into 3-8 smaller subtasks.

Task: "${title}"
Description: "${description}"
${projectName ? `Project: ${projectName}` : ""}

Return a JSON array of objects with: title (string), description (string, 1-2 sentences), priority ("urgent"|"high"|"medium"|"low"), estimatedPoints (Fibonacci: 1,2,3,5,8,13)`);
  } catch {
    return [
      { title: `Research: ${title}`, description: "Investigate approach and requirements", priority: "high", estimatedPoints: 2 },
      { title: `Implement: ${title}`, description: "Core implementation work", priority: "high", estimatedPoints: 5 },
      { title: `Test: ${title}`, description: "Write tests and validate", priority: "medium", estimatedPoints: 3 },
    ];
  }
}

// --- Feature 3: Project Summary ---
export async function summarizeProject(tasks: any[]): Promise<{
  summary: string; blockers: string[]; overdueTasks: string[]; completionPercentage: number;
}> {
  const total = tasks.length;
  const done = tasks.filter((t: any) => t.status === "done" || t.status === "cancelled").length;
  const inProgress = tasks.filter((t: any) => t.status === "in_progress" || t.status === "in_review").length;
  const overdue = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done" && t.status !== "cancelled");
  const blocked = tasks.filter((t: any) => t.status === "in_progress" && t.dueDate && new Date(t.dueDate) < new Date());
  const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total > 0) {
    try {
      const taskSummary = tasks.slice(0, 30).map((t: any) => `${t.title} [${t.status}] ${t.priority}`).join("\n");
      return await generateJSON(`You are a PM. Analyze this project and provide a status summary.

${total} tasks total: ${done} done, ${inProgress} in progress, ${overdue.length} overdue.
Tasks:
${taskSummary}

Return JSON: { summary (string, 2-3 sentences with emoji status 🟢/🟡/🔴), blockers (string array), overdueTasks (string array of task titles), completionPercentage (number: ${completionPercentage}) }`);
    } catch { /* fallback */ }
  }

  return {
    summary: total === 0
      ? "No tasks yet. Create tasks to track work."
      : `Project has ${total} tasks: ${done} completed (${completionPercentage}%), ${inProgress} in progress. ${overdue.length > 0 ? `⚠️ ${overdue.length} overdue.` : "On track."}`,
    blockers: blocked.map((t: any) => `"${t.title}" is in progress but past due`),
    overdueTasks: overdue.map((t: any) => t.title),
    completionPercentage,
  };
}

// --- Feature 4: Effort Estimation ---
export async function estimateEffort(
  title: string,
  description: string,
  completedTasks: Array<{ title: string; storyPoints: number | null }>
): Promise<{ points: number; reasoning: string }> {
  const context = completedTasks
    .filter((t) => t.storyPoints != null)
    .slice(0, 15)
    .map((t) => `"${t.title}" → ${t.storyPoints}pts`)
    .join("\n");

  try {
    return await generateJSON(`Estimate story points for this task. Use Fibonacci scale: 1,2,3,5,8,13,21.

Task: "${title}"
Description: "${description}"

${context ? `Similar completed tasks for reference:\n${context}` : "No reference tasks available."}

Return JSON: { points (number, one of 1,2,3,5,8,13,21), reasoning (string, 1-2 sentences) }`);
  } catch {
    return { points: 3, reasoning: "Default estimate. No AI analysis available." };
  }
}

// --- Feature 5: Release Notes ---
export async function generateReleaseNotes(
  tasks: Array<{ title: string; description: string | null; type: string; labels: string[] }>
): Promise<string> {
  const taskList = tasks.map((t) => `- [${t.type}] ${t.title}${t.labels.length ? ` (${t.labels.join(", ")})` : ""}: ${t.description?.slice(0, 100) || "No description"}`).join("\n");

  try {
    return await generateContent(`Generate professional release notes from these completed tasks. Use sections: ## 🚀 New Features, ## ✨ Improvements, ## 🐛 Bug Fixes, ## ⚠️ Breaking Changes (if any, otherwise omit). Be concise and user-friendly.

Tasks:
${taskList}`);
  } catch {
    return `# Release Notes\n\n## Changes\n${tasks.map((t) => `- ${t.title}`).join("\n")}`;
  }
}

// --- Feature 6: Natural Language Search ---
export async function naturalSearchToFilters(query: string): Promise<{
  status?: string;
  priority?: string;
  assigneeEmail?: string;
  labels?: string[];
  taskType?: string;
  isOverdue?: boolean;
  searchText?: string;
}> {
  try {
    return await generateJSON(`Convert this natural language search into structured task filters.

Query: "${query}"

Return JSON with any applicable fields (omit fields that don't apply):
{ status ("backlog"|"todo"|"in_progress"|"in_review"|"done"|"cancelled"), priority ("urgent"|"high"|"medium"|"low"|"none"), assigneeEmail (string), labels (string array), taskType ("bug"|"feature"|"story"|"task"|"epic"), isOverdue (boolean), searchText (string - keywords to search in title) }`);
  } catch {
    return { searchText: query };
  }
}

// --- Feature 7: Duplicate Detection ---
export async function checkDuplicates(
  title: string,
  description: string | undefined,
  existingTasks: Array<{ id: string; title: string; description: string | null }>
): Promise<Array<{ taskId: string; title: string; similarity: number; reason: string }>> {
  if (existingTasks.length === 0) return [];

  const taskList = existingTasks.slice(0, 50).map((t) => `ID:${t.id} | "${t.title}" | ${t.description?.slice(0, 80) || "no desc"}`).join("\n");

  try {
    return await generateJSON(`Compare this new task against existing tasks and find duplicates/similar tasks.

New task: "${title}"${description ? `\nDescription: "${description}"` : ""}

Existing tasks:
${taskList}

Return JSON array of similar tasks (similarity > 60%). Each: { taskId (string, the ID), title (string), similarity (number 0-100), reason (string, brief explanation) }. Return empty array [] if no duplicates.`);
  } catch {
    return [];
  }
}

// --- Legacy: Suggest Metadata ---
export async function suggestTaskMetadata(title: string, description: string): Promise<{
  suggestedPriority: string; suggestedLabels: string[]; suggestedType: string;
}> {
  try {
    return await generateJSON(`Given a task, suggest metadata. Return JSON: { suggestedPriority ("urgent"|"high"|"medium"|"low"), suggestedLabels (string array), suggestedType ("bug"|"feature"|"story"|"task"|"epic") }

Title: "${title}"
Description: "${description}"`);
  } catch {
    const lower = (title + " " + description).toLowerCase();
    const isBug = lower.includes("bug") || lower.includes("fix") || lower.includes("broken");
    const labels: string[] = [];
    if (lower.includes("frontend") || lower.includes("ui")) labels.push("frontend");
    if (lower.includes("backend") || lower.includes("api")) labels.push("backend");
    if (labels.length === 0) labels.push("enhancement");
    return {
      suggestedPriority: isBug ? "high" : "medium",
      suggestedLabels: labels,
      suggestedType: isBug ? "bug" : "feature",
    };
  }
}

// --- Feature V2-1: Sprint Planning Assistant ---
export async function sprintPlanSuggestion(
  backlogTasks: Array<{ id: string; title: string; priority: string; storyPoints: number | null; type: string; labels: string[] }>,
  teamCount: number,
  previousVelocity: number,
  sprintCapacity?: number
): Promise<{ suggestedTaskIds: string[]; totalPoints: number; reasoning: string; capacityUsed: number }> {
  const capacity = sprintCapacity || previousVelocity || teamCount * 10;
  const taskList = backlogTasks.slice(0, 40).map(t =>
    `ID:${t.id} | "${t.title}" | priority:${t.priority} | ${t.storyPoints || 1}pts | type:${t.type} | labels:${t.labels.join(",") || "none"}`
  ).join("\n");

  try {
    return await generateJSON(`You are a scrum master planning a sprint.

Team size: ${teamCount}
Previous sprint velocity: ${previousVelocity} story points
Sprint capacity: ${capacity} story points

Backlog tasks (ordered by priority):
${taskList}

Select tasks for the next sprint. Consider:
- Priority (urgent/high first)
- Total story points should not exceed capacity (${capacity})
- Balance task types for the team
- Group related tasks when possible

Return JSON: { suggestedTaskIds (array of task ID strings), totalPoints (number), reasoning (string, 2-3 sentences), capacityUsed (number, percentage 0-100) }`);
  } catch {
    // Fallback: pick by priority
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    const sorted = [...backlogTasks].sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
    let pts = 0;
    const ids: string[] = [];
    for (const t of sorted) {
      const p = t.storyPoints || 1;
      if (pts + p <= capacity) { ids.push(t.id); pts += p; }
    }
    return { suggestedTaskIds: ids, totalPoints: pts, reasoning: `Selected ${ids.length} highest-priority tasks fitting ${capacity}pt capacity.`, capacityUsed: Math.round((pts / capacity) * 100) };
  }
}

// --- Feature V2-2: Weekly Digest ---
export async function generateWeeklyDigest(data: {
  completedTasks: Array<{ title: string; completedBy: string }>;
  createdTasks: number;
  overdueTasks: Array<{ title: string; assignee: string }>;
  sprintProgress: { name: string; progress: number } | null;
  topContributors: Array<{ name: string; count: number }>;
  workspaceName: string;
}): Promise<{ subject: string; html: string }> {
  const prompt = `Generate a weekly project digest email in HTML format. Use clean, modern styling with inline CSS.

Workspace: ${data.workspaceName}
Week ending: ${new Date().toLocaleDateString()}

Data:
- Tasks completed this week: ${data.completedTasks.length} (${data.completedTasks.slice(0, 10).map(t => `"${t.title}" by ${t.completedBy}`).join("; ")})
- New tasks created: ${data.createdTasks}
- Overdue tasks: ${data.overdueTasks.length} (${data.overdueTasks.slice(0, 5).map(t => `"${t.title}" assigned to ${t.assignee}`).join("; ")})
- Sprint progress: ${data.sprintProgress ? `${data.sprintProgress.name} at ${data.sprintProgress.progress}%` : "No active sprint"}
- Top contributors: ${data.topContributors.slice(0, 5).map(c => `${c.name}: ${c.count} tasks`).join(", ")}

Sections needed: Summary, Key Achievements, Attention Needed, Team Highlights, Next Week Focus.
Use professional colors (blue accent), keep it concise.

Return JSON: { subject (string, email subject line), html (string, full HTML email body) }`;

  try {
    return await generateJSON(prompt);
  } catch {
    return {
      subject: `Weekly Digest - ${data.workspaceName}`,
      html: `<h2>Weekly Digest - ${data.workspaceName}</h2><p>${data.completedTasks.length} tasks completed, ${data.createdTasks} created, ${data.overdueTasks.length} overdue.</p>`,
    };
  }
}

// --- Feature V2-3: Meeting Notes → Tasks ---
export async function extractTasksFromNotes(
  notes: string,
  projectName?: string
): Promise<{ tasks: Array<{ title: string; description: string; priority: string; assigneeName?: string; dueDate?: string; type: string }> }> {
  try {
    return await generateJSON(`Extract action items from these meeting notes. For each action item, determine the task details.

Meeting Notes:
"""
${notes}
"""
${projectName ? `Project: ${projectName}` : ""}

Return JSON: { tasks: [{ title (string, concise task title), description (string, 1-2 sentences), priority ("urgent"|"high"|"medium"|"low"), assigneeName (string or null, person's name if mentioned), dueDate (string ISO date or null, if deadline mentioned), type ("task"|"bug"|"feature"|"story") }] }

Extract ALL action items, decisions that need follow-up, and commitments made. Be thorough.`);
  } catch {
    return { tasks: [{ title: "Review meeting notes", description: "AI extraction failed - please review manually", priority: "medium", type: "task" }] };
  }
}

// --- Feature V2-4: Smart Automation Suggestions ---
export async function suggestAutomations(
  activities: Array<{ action: string; field?: string; oldValue?: string; newValue?: string; taskType?: string; userId?: string; userName?: string }>
): Promise<{ suggestions: Array<{ trigger: string; action: string; description: string; confidence: number }> }> {
  const activitySummary = activities.slice(0, 100).map(a =>
    `${a.action}${a.field ? ` field:${a.field}` : ""}${a.oldValue ? ` from:${a.oldValue}` : ""}${a.newValue ? ` to:${a.newValue}` : ""}${a.taskType ? ` type:${a.taskType}` : ""}${a.userName ? ` by:${a.userName}` : ""}`
  ).join("\n");

  try {
    return await generateJSON(`Analyze these task activity patterns and suggest workflow automations.

Recent activities (last 100):
${activitySummary}

Look for patterns:
- Tasks frequently moved between same statuses
- Same person always assigned to certain task types
- Repeated manual actions
- Common status transitions

Return JSON: { suggestions: [{ trigger (string, e.g. "When a bug is created"), action (string, e.g. "Auto-assign to John and set priority to high"), description (string, why this automation makes sense), confidence (number 0-100, how confident based on data) }] }

Return 3-6 practical suggestions. Only suggest automations with confidence > 50.`);
  } catch {
    return { suggestions: [] };
  }
}

// --- Feature V2-5: Anomaly Detection ---
export async function detectAnomalies(metrics: {
  dailyCreated: number[];
  dailyCompleted: number[];
  overdueCount: number;
  totalBacklog: number;
  memberWorkloads: Array<{ name: string; taskCount: number }>;
  bugCount: number;
  avgBugCount: number;
}): Promise<{ alerts: Array<{ severity: "info" | "warning" | "critical"; title: string; description: string; metric: string }> }> {
  try {
    return await generateJSON(`Analyze these project metrics from the last 30 days and flag anomalies or concerns.

Metrics:
- Daily tasks created (last 30 days): [${metrics.dailyCreated.join(",")}]
- Daily tasks completed (last 30 days): [${metrics.dailyCompleted.join(",")}]
- Current overdue tasks: ${metrics.overdueCount}
- Current backlog size: ${metrics.totalBacklog}
- Team workload: ${metrics.memberWorkloads.map(m => `${m.name}: ${m.taskCount} tasks`).join(", ")}
- Current open bugs: ${metrics.bugCount} (avg: ${metrics.avgBugCount})

Analyze for:
- Sudden spike in bugs
- Team member overload (significantly more tasks than others)
- Velocity drop (completion rate declining)
- Growing backlog (created >> completed)
- Overdue pile-up

Return JSON: { alerts: [{ severity ("info"|"warning"|"critical"), title (string, short), description (string, 1-2 sentences with specific numbers), metric (string, which metric triggered this) }] }

Only flag genuine concerns. Return empty array if everything looks healthy.`);
  } catch {
    return { alerts: [] };
  }
}

// --- Legacy: Sprint Plan ---
export async function generateSprintPlan(backlogTasks: any[], teamSize: number, sprintDuration: number): Promise<{
  suggestedTasks: string[]; estimatedCapacity: number; reasoning: string;
}> {
  const estimatedCapacity = teamSize * sprintDuration * 5;
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  const sorted = [...backlogTasks].sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

  try {
    const taskList = sorted.slice(0, 30).map((t: any) => `${t.id}: ${t.title} [${t.priority}] ${t.storyPoints || 1}pts`).join("\n");
    return await generateJSON(`You are a scrum master. Suggest sprint tasks. Return JSON: { suggestedTasks (array of task IDs), estimatedCapacity (number), reasoning (string) }.

Team: ${teamSize}, Duration: ${sprintDuration} days, Capacity: ~${estimatedCapacity}pts
Backlog:
${taskList}`);
  } catch {
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
      reasoning: `Selected ${suggested.length} highest-priority tasks for team of ${teamSize} over ${sprintDuration} days (~${estimatedCapacity}pts capacity).`,
    };
  }
}

// --- V3 Feature 1: AI Chat (Project Manager) ---
export async function aiChat(
  message: string,
  context: {
    projectName: string;
    columns: Array<{ id: string; name: string }>;
    members: Array<{ id: string; name: string; email: string }>;
    recentTasks: Array<{ id: string; title: string; status: string; assignee: string | null; priority: string; taskNumber: number }>;
  },
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ response: string; actions: Array<{ type: string; params: any }> }> {
  const systemPrompt = `You are DKFlow AI — an intelligent project management assistant. You are helpful, concise, and action-oriented.

CAPABILITIES:
- Create tasks (with title, description, priority, assignee)
- Move tasks between columns/statuses
- Assign tasks to team members
- Update task priorities
- Create sprints
- Add comments to tasks
- Analyze project status and provide insights

Available actions in JSON response:
- create_task: { title, description?, priority?, assigneeEmail? }
- move_task: { taskId, columnName }
- assign_task: { taskId, userNameOrEmail }
- update_priority: { taskId, priority } (urgent|high|medium|low|none)
- create_sprint: { name, startDate, endDate, goal? }
- comment: { taskId, content }

CONTEXT:
Project: ${context.projectName}
Board columns: ${context.columns.map(c => `"${c.name}" (id:${c.id})`).join(", ")}
Team: ${context.members.map(m => `${m.name} <${m.email}> (id:${m.id})`).join(", ")}
Recent Tasks:
${context.recentTasks.slice(0, 30).map(t => `- DK-${t.taskNumber} "${t.title}" [${t.status}] priority:${t.priority} assignee:${t.assignee || "unassigned"} (id:${t.id})`).join("\n")}

RULES:
1. Be conversational and friendly, but professional
2. When the user asks you to do something, DO IT — don't just explain how
3. Use the team member names/IDs from context to assign tasks
4. When creating tasks, always set a priority based on context
5. Format your responses with markdown for readability (bold, lists, headers, code blocks)
6. When asked about status, analyze the actual task data
7. Be proactive — suggest next steps after completing an action
8. If you can't find a specific task/person, say so clearly

RESPONSE FORMAT:
You MUST respond ONLY with valid JSON:
{ "response": "your message in markdown", "actions": [{ "type": "action_type", "params": {...} }] }
If no actions needed, return empty actions array.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history for continuity
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: message });

  const raw = await callNvidiaWithMessages(messages, 3000);
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const jsonMatch = cleaned.match(/[\{][\s\S]*[\}]/);
  if (!jsonMatch) return { response: raw, actions: [] };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      response: parsed.response || raw,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { response: raw, actions: [] };
  }
}

// --- AI Chat: Generate session title ---
export async function generateSessionTitle(message: string): Promise<string> {
  try {
    const result = await callNvidia(`Generate a very short title (3-6 words max) for a chat conversation that starts with this message. Return ONLY the title text, nothing else.\n\nMessage: "${message}"`, 50);
    return result.trim().replace(/^["']|["']$/g, "").slice(0, 100) || "New Chat";
  } catch {
    return message.slice(0, 50) + (message.length > 50 ? "..." : "");
  }
}

// --- V3 Feature 2: Auto-Triage ---
export async function autoTriageTask(
  task: { title: string; description: string | null },
  projectLabels: string[],
  members: Array<{ id: string; name: string; recentTaskTypes: string[] }>
): Promise<{ priority: string; taskType: string; labels: string[]; suggestedAssignee: { userId: string; name: string; reason: string } | null }> {
  const prompt = `Analyze this task and suggest categorization.

Task title: "${task.title}"
Task description: "${task.description || "No description"}"

Available labels in project: ${projectLabels.length > 0 ? projectLabels.join(", ") : "none"}
Team members and their expertise:
${members.map(m => `- ${m.name} (id:${m.id}): works on ${m.recentTaskTypes.join(", ") || "various"}`).join("\n")}

Return JSON: { "priority": "urgent"|"high"|"medium"|"low", "taskType": "bug"|"feature"|"story"|"task"|"epic", "labels": ["label1"], "suggestedAssignee": { "userId": "id", "name": "name", "reason": "brief reason" } or null }

Only suggest labels from the available list. Suggest assignee based on expertise match.`;

  try {
    return await generateJSON(prompt);
  } catch {
    return { priority: "medium", taskType: "task", labels: [], suggestedAssignee: null };
  }
}

// --- V3 Feature 3: Sprint Risk Predictor ---
export async function predictSprintRisk(metrics: {
  sprintName: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  totalPoints: number;
  completedPoints: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyCompletionRate: number;
  historicalVelocity: number;
}): Promise<{ riskLevel: string; completionProbability: number; predictedEndDate: string; insights: string[]; recommendations: string[] }> {
  const prompt = `Analyze sprint risk based on these metrics:

Sprint: "${metrics.sprintName}"
Tasks: ${metrics.completedTasks}/${metrics.totalTasks} completed (${metrics.remainingTasks} remaining)
Story points: ${metrics.completedPoints}/${metrics.totalPoints}
Time: ${metrics.daysElapsed} days elapsed, ${metrics.daysRemaining} days remaining
Daily completion rate: ${metrics.dailyCompletionRate.toFixed(1)} tasks/day
Historical velocity: ${metrics.historicalVelocity} points/sprint

Return JSON: { "riskLevel": "low"|"medium"|"high"|"critical", "completionProbability": number 0-100, "predictedEndDate": "YYYY-MM-DD", "insights": ["insight1", "insight2", "insight3"], "recommendations": ["rec1", "rec2", "rec3"] }`;

  try {
    return await generateJSON(prompt);
  } catch {
    const projectedCompletion = metrics.dailyCompletionRate > 0 ? metrics.remainingTasks / metrics.dailyCompletionRate : Infinity;
    const onTrack = projectedCompletion <= metrics.daysRemaining;
    return {
      riskLevel: onTrack ? "low" : projectedCompletion <= metrics.daysRemaining * 1.5 ? "medium" : "high",
      completionProbability: onTrack ? 80 : 40,
      predictedEndDate: new Date(Date.now() + projectedCompletion * 86400000).toISOString().split("T")[0]!,
      insights: [`${metrics.remainingTasks} tasks remaining with ${metrics.daysRemaining} days left`],
      recommendations: ["Review and re-prioritize remaining tasks"],
    };
  }
}

// --- V3 Feature 4: Standup Report ---
export async function generateStandupReport(
  members: Array<{
    userId: string;
    name: string;
    completedYesterday: string[];
    inProgressToday: string[];
    blockers: string[];
  }>
): Promise<{ standups: Array<{ userId: string; name: string; yesterday: string[]; today: string[]; blockers: string[] }>; teamSummary: string }> {
  const prompt = `Generate a standup report for each team member and a team summary.

Team activity data:
${members.map(m => `
${m.name} (id:${m.userId}):
  Yesterday completed: ${m.completedYesterday.length > 0 ? m.completedYesterday.join("; ") : "nothing tracked"}
  In progress today: ${m.inProgressToday.length > 0 ? m.inProgressToday.join("; ") : "nothing tracked"}
  Potential blockers: ${m.blockers.length > 0 ? m.blockers.join("; ") : "none"}
`).join("")}

Return JSON: { "standups": [{ "userId": "id", "name": "name", "yesterday": ["done item"], "today": ["planned item"], "blockers": ["blocker"] }], "teamSummary": "Brief 2-3 sentence team summary with overall status" }

Keep items concise. If no data, say "No tracked activity".`;

  try {
    return await generateJSON(prompt);
  } catch {
    return {
      standups: members.map(m => ({
        userId: m.userId,
        name: m.name,
        yesterday: m.completedYesterday.length > 0 ? m.completedYesterday : ["No tracked activity"],
        today: m.inProgressToday.length > 0 ? m.inProgressToday : ["No tracked activity"],
        blockers: m.blockers,
      })),
      teamSummary: `Team of ${members.length} members. ${members.filter(m => m.blockers.length > 0).length} members have blockers.`,
    };
  }
}

// --- V3 Feature 5: Project Health Score ---
export async function calculateHealthScore(metrics: {
  velocityTrend: string;
  overduePercentage: number;
  bugRatio: number;
  teamBalanceStdDev: number;
  completionRate: number;
  sprintProgress: number;
}): Promise<{ score: number; grade: string; assessment: string; suggestions: string[] }> {
  // Calculate score
  let score = 100;
  // Overdue penalty (0-30 points)
  score -= Math.min(30, metrics.overduePercentage * 100);
  // Bug ratio penalty (0-15 points)
  score -= Math.min(15, metrics.bugRatio * 50);
  // Team balance penalty (0-15 points)
  score -= Math.min(15, metrics.teamBalanceStdDev * 3);
  // Completion rate bonus/penalty (0-20 points)
  score -= Math.max(0, (1 - metrics.completionRate) * 20);
  // Velocity trend
  if (metrics.velocityTrend === "declining") score -= 10;
  else if (metrics.velocityTrend === "improving") score += 5;
  // Sprint progress
  score -= Math.max(0, (1 - metrics.sprintProgress) * 10);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const prompt = `Given these project health metrics, provide a brief assessment and suggestions.

Score: ${score}/100 (${grade})
Velocity trend: ${metrics.velocityTrend}
Overdue tasks: ${(metrics.overduePercentage * 100).toFixed(0)}%
Bug ratio: ${(metrics.bugRatio * 100).toFixed(0)}%
Team balance std dev: ${metrics.teamBalanceStdDev.toFixed(1)} tasks
Completion rate: ${(metrics.completionRate * 100).toFixed(0)}%
Sprint progress: ${(metrics.sprintProgress * 100).toFixed(0)}%

Return JSON: { "assessment": "2-3 sentence health assessment", "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }`;

  try {
    const result = await generateJSON<{ assessment: string; suggestions: string[] }>(prompt);
    return { score, grade, assessment: result.assessment, suggestions: result.suggestions };
  } catch {
    return {
      score,
      grade,
      assessment: `Project health is ${grade}. Score: ${score}/100.`,
      suggestions: ["Review overdue tasks", "Balance team workload", "Track velocity trends"],
    };
  }
}

// --- Excel Import: Parse spreadsheet rows into tasks via AI ---
export async function analyzeExcelForTasks(
  headers: string[],
  rows: Record<string, any>[]
): Promise<{ tasks: Array<{ title: string; description: string; type: string; priority: string; labels: string[] }> }> {
  const prompt = `Analyze this spreadsheet data and convert each row into a task or bug for project management.
For each row, determine:
- title (concise task title)
- description (detailed from row data)
- type: "task" or "bug" (detect from content — errors/issues/crashes/defects = bug, else task)
- priority: "urgent"|"high"|"medium"|"low" (infer from severity/importance columns if present, default "medium")
- labels (infer relevant labels from content, e.g. "frontend", "backend", "design", "documentation")

Spreadsheet headers: ${JSON.stringify(headers)}
Data rows (${rows.length} rows): ${JSON.stringify(rows.slice(0, 50))}

Return JSON: { "tasks": [{ "title": "...", "description": "...", "type": "task"|"bug", "priority": "urgent"|"high"|"medium"|"low", "labels": ["..."] }] }`;

  try {
    return await generateJSON(prompt);
  } catch {
    // Fallback: create basic tasks from rows
    return {
      tasks: rows.slice(0, 50).map((row, i) => {
        const values = Object.values(row).filter(Boolean);
        const title = String(values[0] || `Row ${i + 1}`).slice(0, 200);
        const description = Object.entries(row).map(([k, v]) => `**${k}:** ${v}`).join("\n");
        const lower = description.toLowerCase();
        const isBug = /bug|error|crash|issue|defect|broken|fix/.test(lower);
        return { title, description, type: isBug ? "bug" : "task", priority: "medium" as const, labels: [] };
      }),
    };
  }
}
