-- DKFlow Intelligence Engine — Database Schema
-- Runs alongside existing schema, no modifications to existing tables

-- Embeddings table: stores vector representations of all project activity
CREATE TABLE IF NOT EXISTS engine_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID,
  entity_type VARCHAR(50) NOT NULL, -- 'task', 'comment', 'activity', 'sprint', 'document'
  entity_id UUID NOT NULL,
  content TEXT NOT NULL, -- the text that was embedded
  embedding vector(1024), -- NVIDIA NV-Embed-v2 produces 1024 dims
  metadata JSONB DEFAULT '{}', -- extra context (assignee, status, priority, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engine_embeddings_workspace ON engine_embeddings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_engine_embeddings_project ON engine_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_engine_embeddings_entity ON engine_embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_engine_embeddings_vector ON engine_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Insights table: AI-generated intelligence
CREATE TABLE IF NOT EXISTS engine_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID,
  type VARCHAR(50) NOT NULL, -- 'risk', 'pattern', 'recommendation', 'anomaly', 'prediction'
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- structured data (metrics, affected tasks, etc.)
  is_read BOOLEAN DEFAULT FALSE,
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_by UUID,
  actioned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- some insights are time-sensitive
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engine_insights_workspace ON engine_insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_engine_insights_project ON engine_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_engine_insights_type ON engine_insights(type, severity);
CREATE INDEX IF NOT EXISTS idx_engine_insights_unread ON engine_insights(workspace_id, is_read) WHERE is_read = FALSE;

-- Actions log: what the engine did or suggested
CREATE TABLE IF NOT EXISTS engine_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID,
  insight_id UUID REFERENCES engine_insights(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL, -- 'auto_assign', 'risk_alert', 'rebalance', 'estimate_adjust', 'reminder'
  status VARCHAR(20) DEFAULT 'suggested', -- 'suggested', 'approved', 'executed', 'dismissed'
  description TEXT NOT NULL,
  params JSONB DEFAULT '{}', -- action parameters
  result JSONB, -- what happened after execution
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_engine_actions_workspace ON engine_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_engine_actions_status ON engine_actions(status);

-- Patterns table: learned patterns over time
CREATE TABLE IF NOT EXISTS engine_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  pattern_type VARCHAR(50) NOT NULL, -- 'estimation_accuracy', 'team_velocity', 'member_strength', 'blocker_signal', 'completion_pattern'
  subject_id UUID, -- member ID, project ID, etc.
  subject_type VARCHAR(50), -- 'member', 'project', 'task_type', 'label'
  pattern_data JSONB NOT NULL, -- the actual pattern data
  confidence FLOAT DEFAULT 0, -- 0-1 how confident the pattern is
  sample_count INT DEFAULT 0, -- how many data points
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engine_patterns_workspace ON engine_patterns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_engine_patterns_type ON engine_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_engine_patterns_subject ON engine_patterns(subject_type, subject_id);

-- Engine state: tracks what's been processed
CREATE TABLE IF NOT EXISTS engine_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  last_embedding_sync TIMESTAMPTZ,
  last_pattern_analysis TIMESTAMPTZ,
  last_insight_generation TIMESTAMPTZ,
  total_embeddings INT DEFAULT 0,
  total_insights INT DEFAULT 0,
  total_patterns INT DEFAULT 0,
  config JSONB DEFAULT '{"autoAssign": false, "autoTriage": true, "riskAlerts": true, "dailyBriefing": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
